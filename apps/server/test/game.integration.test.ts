import type { AddressInfo } from "node:net";
import {
  InMemoryRoomStore,
  type AnyGame,
  type ClientToServerEvents,
  type Phase,
  type RoomErrorPayload,
  type RoomJoinedPayload,
  type RoomStatePayload,
  type ServerToClientEvents,
} from "@twinthreads/engine";
import {
  createNumberDuel,
  TEST_GAME_ID,
  type NumberDuelTimings,
  type NumberDuelView,
} from "@twinthreads/test-game";
import { io as connect, type Socket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
type State = RoomStatePayload<NumberDuelView | null>;

const WAIT_MS = 4000;
const FAST: NumberDuelTimings = {
  pickMs: 5000,
  revealMs: 20,
  scoreMs: 20,
  nextRoundMs: 20,
};
const cleanups: (() => void | Promise<unknown>)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function newClient(url: string): Promise<Client> {
  const client: Client = connect(url, {
    forceNew: true,
    reconnection: false,
    transports: ["websocket"],
  });
  cleanups.push(() => void client.disconnect());
  await new Promise<void>((resolve, reject) => {
    client.once("connect", resolve);
    client.once("connect_error", reject);
  });
  return client;
}

/** Records every message, so tests can wait for one that already arrived. */
function track(client: Client) {
  const states: State[] = [];
  const errors: RoomErrorPayload[] = [];
  const waiters = new Set<() => void>();
  const wake = () => waiters.forEach((waiter) => waiter());
  client.on("room:state", (state) => {
    states.push(state as State);
    wake();
  });
  client.on("room:error", (error) => {
    errors.push(error);
    wake();
  });
  const until = <T>(find: () => T | undefined, what: string) =>
    new Promise<T>((resolve, reject) => {
      const check = () => {
        const found = find();
        if (found === undefined) return;
        clearTimeout(timer);
        waiters.delete(check);
        resolve(found);
      };
      const timer = setTimeout(() => {
        waiters.delete(check);
        reject(new Error(`Timed out waiting for ${what}`));
      }, WAIT_MS);
      waiters.add(check);
      check();
    });
  return {
    client,
    states,
    errors,
    latest: () => states.at(-1),
    /** Waits for the current state to match. */
    state: (matches: (state: State) => boolean, what = "state") =>
      until(() => {
        const latest = states.at(-1);
        return latest && matches(latest) ? latest : undefined;
      }, what),
    phase: (phase: Phase) =>
      until(() => {
        const latest = states.at(-1);
        return latest?.phase === phase ? latest : undefined;
      }, `phase ${phase}`),
    error: (from: number) => until(() => errors[from], "room:error"),
  };
}
type Player = ReturnType<typeof track>;

async function startServer({
  timings = FAST,
  graceSeconds = 60,
}: { timings?: NumberDuelTimings; graceSeconds?: number } = {}) {
  const store = new InMemoryRoomStore(() => Date.now());
  const { app } = buildApp(
    {
      CLIENT_ORIGIN: "http://localhost:5173",
      LOG_LEVEL: "silent",
      ROOM_IDLE_MINUTES: 30,
      RECONNECT_GRACE_SECONDS: graceSeconds,
    },
    {
      store,
      games: new Map([[TEST_GAME_ID, createNumberDuel(timings) as AnyGame]]),
      countRooms: () => store.size,
      now: () => Date.now(),
    },
  );
  await app.listen({ port: 0, host: "127.0.0.1" });
  cleanups.push(() => app.close());
  const { port } = app.server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, store };
}

const joined = (client: Client) =>
  new Promise<RoomJoinedPayload>((resolve) =>
    client.once("room:joined", resolve),
  );

async function startRoom(options?: Parameters<typeof startServer>[0]) {
  const server = await startServer(options);
  const aClient = await newClient(server.url);
  const a = track(aClient);
  const aJoined = joined(aClient);
  aClient.emit("room:create", { gameId: TEST_GAME_ID, displayName: "Sam" });
  const aInfo = await aJoined;

  const bClient = await newClient(server.url);
  const b = track(bClient);
  const bJoined = joined(bClient);
  bClient.emit("room:join", { code: aInfo.code, displayName: "Alex" });
  const bInfo = await bJoined;
  await a.state((s) => s.status === "active", "active room");
  return { server, a, b, aInfo, bInfo };
}

async function startPlaying(options?: Parameters<typeof startServer>[0]) {
  const room = await startRoom(options);
  room.a.client.emit("room:ready", { ready: true });
  room.b.client.emit("room:ready", { ready: true });
  await room.a.phase("PRIVATE_INPUT");
  await room.b.phase("PRIVATE_INPUT");
  return room;
}

const pick = (player: Player, value: number) =>
  player.client.emit("game:action", { type: "pick", payload: { value } });

async function rejoin(url: string, code: string, token: string) {
  const client = await newClient(url);
  const player = track(client);
  const info = joined(client);
  client.emit("room:join", { code, displayName: "Sam", playerToken: token });
  await info;
  return player;
}

describe("starting a game", () => {
  it("starts only when both players are ready, and ready can be undone", async () => {
    const { a, b } = await startRoom();
    a.client.emit("room:ready", { ready: true });
    await b.state((s) => s.players.some((p) => p.ready), "a ready");
    a.client.emit("room:ready", { ready: false });
    await b.state((s) => s.players.every((p) => !p.ready), "a not ready");
    b.client.emit("room:ready", { ready: true });
    await a.state((s) => s.players.some((p) => p.ready), "b ready");
    expect(a.latest()?.phase).toBe("LOBBY");

    a.client.emit("room:ready", { ready: true });
    const started = await a.phase("PRIVATE_INPUT");
    expect(started.deadline).toBeGreaterThan(started.serverTime);
  });

  it("waits for a ready player who is offline", async () => {
    const { server, a, b, aInfo } = await startRoom();
    a.client.emit("room:ready", { ready: true });
    await b.state((s) => s.players.some((p) => p.ready), "a ready");
    a.client.disconnect();
    await b.state((s) => s.status === "reconnecting", "reconnecting");

    b.client.emit("room:ready", { ready: true });
    await sleep(50);
    expect(b.latest()?.phase).toBe("LOBBY");

    await rejoin(server.url, aInfo.code, aInfo.playerToken);
    await b.phase("PRIVATE_INPUT");
  });

  it("rejects game messages before joining a room", async () => {
    const { url } = await startServer();
    const stranger = track(await newClient(url));
    stranger.client.emit("room:ready", { ready: true });
    expect((await stranger.error(0)).code).toBe("INVALID");
    pick(stranger, 1);
    expect((await stranger.error(1)).code).toBe("INVALID");
  });
});

describe("a full game", () => {
  it("goes through every phase, then a rematch", async () => {
    const { a, b, aInfo, bInfo } = await startPlaying();

    for (let round = 1; round <= 3; round++) {
      await a.state(
        (s) => s.phase === "PRIVATE_INPUT" && s.game?.round === round,
        `round ${round}`,
      );
      pick(a, 1);
      pick(b, 5);
      if (round < 3) await a.phase("NEXT_ROUND");
    }
    const results = await a.phase("RESULTS");
    expect(a.states.map((s) => s.phase)).toEqual(
      expect.arrayContaining([
        "LOBBY",
        "PRIVATE_INPUT",
        "REVEAL",
        "SCORE",
        "NEXT_ROUND",
        "RESULTS",
      ]),
    );
    expect(results.deadline).toBeNull();
    expect(results.result?.scores).toEqual(results.game?.scores);
    expect(Object.keys(results.result?.scores ?? {}).sort()).toEqual(
      [aInfo.playerId, bInfo.playerId].sort(),
    );

    a.client.emit("room:rematch", {});
    const waiting = await b.phase("REMATCH");
    expect(waiting.rematchVotes).toEqual([aInfo.playerId]);
    expect(waiting.result).not.toBeNull();

    b.client.emit("room:rematch", {});
    const fresh = await a.phase("PRIVATE_INPUT");
    expect(fresh.game).toMatchObject({ round: 1, myPick: null });
    expect(fresh.rematchVotes).toEqual([]);
    expect(fresh.result).toBeNull();
  });

  it("uses different randomness in each game", async () => {
    const targets = new Set<number | null>();
    const { a, b } = await startPlaying();
    for (let game = 0; game < 4; game++) {
      for (let round = 1; round <= 3; round++) {
        await a.state(
          (s) => s.phase === "PRIVATE_INPUT" && s.game?.round === round,
          "next round",
        );
        pick(a, 1);
        pick(b, 1);
        targets.add(
          (await a.state((s) => s.game?.target != null)).game?.target ?? null,
        );
        if (round < 3) await a.phase("NEXT_ROUND");
      }
      await a.phase("RESULTS");
      a.client.emit("room:rematch", {});
      b.client.emit("room:rematch", {});
      await a.state((s) => s.phase === "PRIVATE_INPUT" && s.game?.round === 1);
    }
    expect(targets.size).toBeGreaterThan(1);
  });
});

describe("secrets", () => {
  it("never sends a player's pick to their partner before REVEAL", async () => {
    const { a, b } = await startPlaying();
    const before = b.states.length;
    pick(a, 4);
    await a.state((s) => s.game?.myPick === 4, "own pick");
    const seen = await b.state((s) => s.game?.partnerHasPicked === true);

    expect(seen.game?.partnerPick).toBeNull();
    for (const state of b.states.slice(before)) {
      expect(JSON.stringify(state.game)).not.toMatch(
        /"(myPick|partnerPick|target)":[1-5]/,
      );
    }
    pick(b, 2);
    const revealed = await b.phase("REVEAL");
    expect(revealed.game).toMatchObject({ partnerPick: 4, myPick: 2 });
  });

  it("never sends tokens or the seed", async () => {
    const { a, b, aInfo, bInfo } = await startPlaying();
    pick(a, 1);
    pick(b, 1);
    await a.phase("REVEAL");
    const all = JSON.stringify([...a.states, ...b.states]);
    expect(all).not.toContain(aInfo.playerToken);
    expect(all).not.toContain(bInfo.playerToken);
    expect(all).not.toContain("seed");
    expect(all).not.toContain("session");
  });
});

describe("rejected actions", () => {
  it.each([
    ["an out-of-range pick", { type: "pick", payload: { value: 9 } }],
    ["an unknown action", { type: "dance", payload: {} }],
  ])("rejects %s and changes nothing", async (_name, action) => {
    const { a } = await startPlaying();
    const before = a.latest()?.game;
    a.client.emit("game:action", action);
    expect((await a.error(0)).code).toBe("GAME_ERROR");
    expect(a.latest()?.game).toEqual(before);
  });

  it("rejects a badly shaped message", async () => {
    const { a } = await startPlaying();
    a.client.emit("game:action", { nonsense: true } as never);
    expect((await a.error(0)).code).toBe("INVALID");
  });

  it("rejects a pick in the wrong phase, and a second pick", async () => {
    const { a, b } = await startPlaying({
      timings: { ...FAST, revealMs: 500 },
    });
    pick(a, 1);
    await a.state((s) => s.game?.myPick === 1);
    pick(a, 2);
    expect((await a.error(0)).message).toContain("already picked");
    pick(b, 1);
    await a.phase("REVEAL");
    pick(a, 3);
    expect((await a.error(1)).message).toContain("can't pick");
  });

  it("rejects actions and rematches outside a game", async () => {
    const { a } = await startRoom();
    pick(a, 1);
    expect((await a.error(0)).code).toBe("GAME_ERROR");
    a.client.emit("room:rematch", {});
    expect((await a.error(1)).code).toBe("GAME_ERROR");
  });

  it("rejects ready once the game has started", async () => {
    const { a } = await startPlaying();
    a.client.emit("room:ready", { ready: true });
    expect((await a.error(0)).code).toBe("GAME_ERROR");
  });
});

describe("timers", () => {
  it("moves on when nobody acts", async () => {
    const { a, b } = await startPlaying({ timings: { ...FAST, pickMs: 40 } });
    const revealed = await a.state(
      (s) => s.phase === "REVEAL" || s.phase === "SCORE",
    );
    expect(revealed.game?.myPick).toBeNull();
    await b.state((s) => s.game?.round === 2);
  });

  it("doesn't let an old timer skip a phase after an action", async () => {
    const { a, b } = await startPlaying({
      timings: { ...FAST, pickMs: 60, revealMs: 300 },
    });
    pick(a, 1);
    pick(b, 1);
    await a.phase("REVEAL");
    await sleep(120);
    expect(a.latest()?.phase).toBe("REVEAL");
  });
});

describe("reconnecting mid-game", () => {
  it("restores the right phase and the player's own pick", async () => {
    const { server, a, b, aInfo } = await startPlaying();
    pick(a, 3);
    await b.state((s) => s.game?.partnerHasPicked === true);
    a.client.disconnect();
    await b.state((s) => s.status === "reconnecting");

    const back = await rejoin(server.url, aInfo.code, aInfo.playerToken);
    const state = await back.state((s) => s.game !== null);
    expect(state.phase).toBe("PRIVATE_INPUT");
    expect(state.game?.myPick).toBe(3);
    await b.state((s) => s.status === "active");
  });

  it("keeps timers running during the grace period", async () => {
    const { a, b } = await startPlaying({ timings: { ...FAST, pickMs: 60 } });
    a.client.disconnect();
    await b.state((s) => s.status === "reconnecting");
    await b.state((s) => s.phase === "REVEAL" || s.phase === "SCORE");
  });

  it("lets the connected partner act during the grace period", async () => {
    const { a, b } = await startPlaying();
    a.client.disconnect();
    await b.state((s) => s.status === "reconnecting");
    pick(b, 2);
    await b.state((s) => s.game?.myPick === 2);
  });
});

describe("pausing", () => {
  it("stops timers and actions, then continues with the time left", async () => {
    const { server, a, b, aInfo } = await startPlaying({
      graceSeconds: 0.03,
      timings: { ...FAST, pickMs: 300 },
    });
    const started = a.latest();
    a.client.disconnect();
    const paused = await b.state((s) => s.status === "paused");
    expect(paused.deadline).toBeNull();
    expect(paused.phase).toBe("PRIVATE_INPUT");

    pick(b, 1);
    expect((await b.error(0)).code).toBe("ROOM_PAUSED");

    // Well past the original deadline. The game must not have moved.
    await sleep(500);
    expect(b.latest()?.phase).toBe("PRIVATE_INPUT");

    const resumedAt = Date.now();
    const back = await rejoin(server.url, aInfo.code, aInfo.playerToken);
    const resumed = await b.state((s) => s.status === "active");
    expect(resumed.deadline).toBeGreaterThan(resumedAt);
    // The clock shifted by the pause, so less than a full turn is left.
    const left = (resumed.deadline ?? 0) - resumed.serverTime;
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThan(300);
    expect(resumed.deadline).toBeGreaterThan(started?.deadline ?? 0);

    await back.state((s) => s.phase !== "PRIVATE_INPUT");
  });

  it("stays paused until every offline player is back", async () => {
    const { server, a, b, aInfo, bInfo } = await startPlaying({
      graceSeconds: 0.03,
      timings: { ...FAST, pickMs: 200 },
    });
    a.client.disconnect();
    await b.state((s) => s.status === "paused");
    b.client.disconnect();
    await sleep(60);

    const aBack = await rejoin(server.url, aInfo.code, aInfo.playerToken);
    const state = await aBack.state(() => true);
    expect(state.status).toBe("paused");
    await sleep(250);
    expect(aBack.latest()?.phase).toBe("PRIVATE_INPUT");

    const bBack = await rejoin(server.url, aInfo.code, bInfo.playerToken);
    await bBack.state((s) => s.status === "active");
    await bBack.state((s) => s.phase !== "PRIVATE_INPUT");
  });
});

describe("leaving", () => {
  it("ends the game mid-round and tells the partner", async () => {
    const { a, b } = await startPlaying();
    pick(b, 2);
    await b.state((s) => s.game?.myPick === 2);
    a.client.emit("room:leave", {});

    const state = await b.state((s) => s.status === "partner_left");
    expect(state.phase).toBe("LOBBY");
    expect(state.game).toBeNull();
    expect(state.deadline).toBeNull();
    expect(state.players).toHaveLength(1);
    expect(state.players[0]?.ready).toBe(false);
  });

  it("doesn't fire the old game's timer after leaving", async () => {
    const { a, b } = await startPlaying({ timings: { ...FAST, pickMs: 60 } });
    a.client.emit("room:leave", {});
    await b.state((s) => s.status === "partner_left");
    await sleep(120);
    expect(b.latest()?.phase).toBe("LOBBY");
  });

  it("lets the room start a new game after someone rejoins", async () => {
    const { server, a, b, aInfo } = await startPlaying();
    a.client.emit("room:leave", {});
    await b.state((s) => s.status === "partner_left");

    const newcomer = track(await newClient(server.url));
    const info = joined(newcomer.client);
    newcomer.client.emit("room:join", {
      code: aInfo.code,
      displayName: "Sam",
    });
    await info;
    await b.state((s) => s.status === "active");
    newcomer.client.emit("room:ready", { ready: true });
    b.client.emit("room:ready", { ready: true });
    await b.phase("PRIVATE_INPUT");
  });

  it("returns the partner to the lobby when someone leaves during a rematch", async () => {
    const { a, b } = await startPlaying({ timings: { ...FAST, pickMs: 5 } });
    await a.phase("RESULTS");
    a.client.emit("room:rematch", {});
    await b.phase("REMATCH");
    a.client.emit("room:leave", {});
    const state = await b.state((s) => s.status === "partner_left");
    expect(state.phase).toBe("LOBBY");
    expect(state.result).toBeNull();
  });
});
