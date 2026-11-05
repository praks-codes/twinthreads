import type { AddressInfo } from "node:net";
import {
  InMemoryRoomStore,
  type AnyGame,
  type ClientToServerEvents,
  type RoomErrorPayload,
  type RoomJoinedPayload,
  type RoomStatePayload,
  type ServerToClientEvents,
} from "@twinthreads/engine";
import { io as connect, type Socket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";
import { createNumberDuel, TEST_GAME_ID } from "@twinthreads/test-game";
import { buildApp } from "../src/app.js";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const WAIT_MS = 2000;
const cleanups: (() => Promise<unknown> | void)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function startServer({ idleMinutes = 30, graceSeconds = 60 } = {}) {
  const store = new InMemoryRoomStore(() => Date.now());
  const { app } = buildApp(
    {
      CLIENT_ORIGIN: "http://localhost:5173",
      LOG_LEVEL: "silent",
      ROOM_IDLE_MINUTES: idleMinutes,
      RECONNECT_GRACE_SECONDS: graceSeconds,
    },
    {
      store,
      games: new Map([[TEST_GAME_ID, createNumberDuel() as AnyGame]]),
      countRooms: () => store.size,
      now: () => Date.now(),
    },
  );
  await app.listen({ port: 0, host: "127.0.0.1" });
  let closed = false;
  const close = async () => {
    if (!closed) await app.close();
    closed = true;
  };
  cleanups.push(close);
  const { port } = app.server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, store, close };
}

function waitFor<T>(
  client: Client,
  event: "room:joined" | "room:state" | "room:error",
  matches: (payload: T) => boolean = () => true,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${event}`)),
      WAIT_MS,
    );
    const listener = (payload: T) => {
      if (!matches(payload)) return;
      clearTimeout(timer);
      (client as unknown as Socket).off(event, listener);
      resolve(payload);
    };
    (client as unknown as Socket).on(event, listener);
  });
}

const stateIs = (status: RoomStatePayload["status"]) =>
  waitForStatus.bind(null, status);
function waitForStatus(status: RoomStatePayload["status"], client: Client) {
  return waitFor<RoomStatePayload>(
    client,
    "room:state",
    (state) => state.status === status,
  );
}
const errorOf = (client: Client) =>
  waitFor<RoomErrorPayload>(client, "room:error");

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

async function createRoom(client: Client, displayName = "Sam") {
  const joined = waitFor<RoomJoinedPayload>(client, "room:joined");
  client.emit("room:create", { gameId: TEST_GAME_ID, displayName });
  return joined;
}

async function joinRoom(
  client: Client,
  code: string,
  displayName = "Alex",
  playerToken?: string,
) {
  const joined = waitFor<RoomJoinedPayload>(client, "room:joined");
  client.emit("room:join", {
    code,
    displayName,
    ...(playerToken ? { playerToken } : {}),
  });
  return joined;
}

async function startPair(options?: Parameters<typeof startServer>[0]) {
  const server = await startServer(options);
  const a = await newClient(server.url);
  const b = await newClient(server.url);
  const aJoined = await createRoom(a);
  const bJoined = await joinRoom(b, aJoined.code);
  return { server, a, b, aJoined, bJoined };
}

describe("creating and joining", () => {
  it("creates a room with a valid code and waits for a partner", async () => {
    const { url, store } = await startServer();
    const a = await newClient(url);
    const waiting = stateIs("waiting")(a);
    const joined = await createRoom(a);

    expect(joined.code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
    expect((await waiting).players.map((p) => p.displayName)).toEqual(["Sam"]);
    expect(store.size).toBe(1);
  });

  it("updates both players live when the partner joins", async () => {
    const { url } = await startServer();
    const a = await newClient(url);
    const { code } = await createRoom(a);
    const b = await newClient(url);
    const seenByA = stateIs("active")(a);
    const seenByB = stateIs("active")(b);
    await joinRoom(b, code);

    for (const state of [await seenByA, await seenByB]) {
      expect(state.players.map((p) => p.displayName)).toEqual(["Sam", "Alex"]);
      expect(state.game).toBeNull();
    }
  });

  it("accepts a lower-case code", async () => {
    const { url } = await startServer();
    const a = await newClient(url);
    const { code } = await createRoom(a);
    const b = await newClient(url);
    await expect(joinRoom(b, code.toLowerCase())).resolves.toMatchObject({
      code,
    });
  });

  it("never sends tokens in room:state", async () => {
    const { url } = await startServer();
    const a = await newClient(url);
    const { code, playerToken } = await createRoom(a);
    const b = await newClient(url);
    const state = stateIs("active")(a);
    const bJoined = await joinRoom(b, code);

    const serialized = JSON.stringify(await state);
    expect(serialized).not.toContain(playerToken);
    expect(serialized).not.toContain(bJoined.playerToken);
    expect(serialized).not.toContain("playerToken");
  });
});

describe("rejections", () => {
  it("rejects a wrong code", async () => {
    const { url } = await startServer();
    const client = await newClient(url);
    const error = errorOf(client);
    client.emit("room:join", { code: "ABC234", displayName: "Sam" });
    expect((await error).code).toBe("NOT_FOUND");
  });

  it("rejects a third player", async () => {
    const { server, aJoined } = await startPair();
    const third = await newClient(server.url);
    const error = errorOf(third);
    third.emit("room:join", { code: aJoined.code, displayName: "Kit" });
    expect((await error).code).toBe("ROOM_FULL");
  });

  it("lets only one of two simultaneous joiners take the last slot", async () => {
    const { url, store } = await startServer();
    const a = await newClient(url);
    const { code } = await createRoom(a);
    const b = await newClient(url);
    const c = await newClient(url);
    const outcomes = [b, c].map(
      (client) =>
        new Promise<string>((resolve) => {
          client.once("room:joined", () => resolve("joined"));
          client.once("room:error", (e) => resolve(e.code));
        }),
    );
    b.emit("room:join", { code, displayName: "B" });
    c.emit("room:join", { code, displayName: "C" });

    expect((await Promise.all(outcomes)).sort()).toEqual([
      "ROOM_FULL",
      "joined",
    ]);
    expect((await store.get(code))?.players).toHaveLength(2);
  });

  it("rejects a wrong token", async () => {
    const { url } = await startServer();
    const a = await newClient(url);
    const { code } = await createRoom(a);
    const b = await newClient(url);
    const error = errorOf(b);
    b.emit("room:join", { code, displayName: "B", playerToken: "wrong" });
    expect((await error).code).toBe("BAD_TOKEN");
  });

  it("rejects an invalid message", async () => {
    const { url } = await startServer();
    const client = await newClient(url);
    const error = errorOf(client);
    client.emit("room:create", { gameId: "chess", displayName: "Sam" });
    expect((await error).code).toBe("INVALID");
  });

  it("rejects joining a second room", async () => {
    const { url } = await startServer();
    const a = await newClient(url);
    await createRoom(a);
    const error = errorOf(a);
    a.emit("room:create", { gameId: TEST_GAME_ID, displayName: "Sam" });
    expect((await error).code).toBe("ALREADY_IN_ROOM");
  });

  it("rate limits repeated join attempts from one IP", async () => {
    const { url } = await startServer();
    const client = await newClient(url);
    const limited = waitFor<RoomErrorPayload>(
      client,
      "room:error",
      (error) => error.code === "RATE_LIMITED",
    );
    for (let i = 0; i < 21; i++) {
      client.emit("room:join", { code: "ABC234", displayName: "Sam" });
    }
    await expect(limited).resolves.toBeDefined();
  });
});

describe("reconnecting", () => {
  it("returns to the same slot with a token, and the partner is told", async () => {
    const { server, a, b, aJoined } = await startPair();
    const reconnecting = stateIs("reconnecting")(b);
    a.disconnect();
    const during = await reconnecting;
    expect(
      during.players.find((p) => p.playerId === aJoined.playerId)?.connected,
    ).toBe(false);

    const active = stateIs("active")(b);
    const returned = await newClient(server.url);
    const rejoined = await joinRoom(
      returned,
      aJoined.code,
      "Sam",
      aJoined.playerToken,
    );

    expect(rejoined.playerId).toBe(aJoined.playerId);
    expect((await active).players).toHaveLength(2);
  });

  it("pauses when the grace period ends, and resumes on return", async () => {
    const { server, a, b, aJoined } = await startPair({ graceSeconds: 0.05 });
    const paused = stateIs("paused")(b);
    a.disconnect();
    await paused;

    const active = stateIs("active")(b);
    const returned = await newClient(server.url);
    await joinRoom(returned, aJoined.code, "Sam", aJoined.playerToken);
    await active;
  });

  it("does not pause if the player returns within the grace period", async () => {
    const { server, a, b, aJoined } = await startPair({ graceSeconds: 0.15 });
    const statuses: string[] = [];
    b.on("room:state", (state) => statuses.push(state.status));
    const reconnecting = stateIs("reconnecting")(b);
    a.disconnect();
    await reconnecting;
    const returned = await newClient(server.url);
    await joinRoom(returned, aJoined.code, "Sam", aJoined.playerToken);
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(statuses).not.toContain("paused");
  });

  it("replaces an older connection for the same player", async () => {
    const { server, a, b, aJoined } = await startPair();
    const replaced = errorOf(a);
    const statuses: string[] = [];
    b.on("room:state", (state) => statuses.push(state.status));

    const second = await newClient(server.url);
    await joinRoom(second, aJoined.code, "Sam", aJoined.playerToken);

    expect((await replaced).code).toBe("REPLACED");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(statuses).not.toContain("reconnecting");
    expect(statuses.at(-1)).toBe("active");
  });
});

describe("leaving", () => {
  it("tells the partner, frees the slot and rejects the old token", async () => {
    const { server, a, b, aJoined } = await startPair();
    const partnerLeft = stateIs("partner_left")(b);
    a.emit("room:leave", {});
    expect((await partnerLeft).players).toHaveLength(1);

    const oldToken = await newClient(server.url);
    const error = errorOf(oldToken);
    oldToken.emit("room:join", {
      code: aJoined.code,
      displayName: "Sam",
      playerToken: aJoined.playerToken,
    });
    expect((await error).code).toBe("BAD_TOKEN");
  });

  it("keeps the code working so the player can rejoin", async () => {
    const { a, b, aJoined } = await startPair();
    const partnerLeft = stateIs("partner_left")(b);
    a.emit("room:leave", {});
    await partnerLeft;

    const active = stateIs("active")(b);
    await joinRoom(a, aJoined.code, "Sam");
    expect((await active).players).toHaveLength(2);
  });

  it("deletes the room when the last player leaves", async () => {
    const { server, a, b, aJoined } = await startPair();
    const partnerLeft = stateIs("partner_left")(b);
    a.emit("room:leave", {});
    await partnerLeft;
    b.emit("room:leave", {});

    await expect.poll(() => server.store.size).toBe(0);
    const error = errorOf(a);
    a.emit("room:join", { code: aJoined.code, displayName: "Sam" });
    expect((await error).code).toBe("NOT_FOUND");
  });
});

describe("expiry and shutdown", () => {
  it("expires an idle room and tells connected players", async () => {
    const { server, a, b } = await startPair({ idleMinutes: 0.002 });
    const [errorA, errorB] = [errorOf(a), errorOf(b)];
    expect((await errorA).code).toBe("ROOM_EXPIRED");
    expect((await errorB).code).toBe("ROOM_EXPIRED");
    expect(server.store.size).toBe(0);
  });

  it("does not let rejected messages keep a room alive", async () => {
    const { server, a } = await startPair({ idleMinutes: 0.003 });
    const expired = waitFor<RoomErrorPayload>(
      a,
      "room:error",
      (error) => error.code === "ROOM_EXPIRED",
    );
    const noise = setInterval(
      () => a.emit("room:leave", { bad: true } as never),
      30,
    );
    cleanups.push(() => clearInterval(noise));
    await expired;
    expect(server.store.size).toBe(0);
  });

  it("tells connected players when the server shuts down", async () => {
    const { server, a } = await startPair();
    const error = errorOf(a);
    await server.close();
    expect((await error).code).toBe("SHUTTING_DOWN");
  });
});
