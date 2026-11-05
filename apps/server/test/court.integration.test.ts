import type { AddressInfo } from "node:net";
import type { CourtView } from "@twinthreads/court";
import {
  InMemoryRoomStore,
  type ClientToServerEvents,
  type GameEffect,
  type RoomStatePayload,
  type ServerToClientEvents,
} from "@twinthreads/engine";
import { io as connect, type Socket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createGameRegistry } from "../src/games.js";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
type State = RoomStatePayload<CourtView | null>;
type RunEffect = (gameId: string, effect: GameEffect) => Promise<unknown>;

const cleanups: (() => void | Promise<unknown>)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function startServer(runEffect?: RunEffect) {
  const store = new InMemoryRoomStore(Date.now);
  const { app } = buildApp(
    {
      CLIENT_ORIGIN: "http://localhost",
      LOG_LEVEL: "silent",
      ROOM_IDLE_MINUTES: 5,
      RECONNECT_GRACE_SECONDS: 5,
    },
    {
      store,
      games: createGameRegistry("test"),
      countRooms: () => store.size,
      now: Date.now,
      ...(runEffect ? { runEffect } : {}),
    },
  );
  await app.listen({ port: 0, host: "127.0.0.1" });
  cleanups.push(() => app.close());
  return `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
}

async function newPlayer(url: string) {
  const client: Client = connect(url, {
    forceNew: true,
    reconnection: false,
    transports: ["websocket"],
  });
  cleanups.push(() => void client.disconnect());
  await new Promise((resolve) => client.once("connect", () => resolve(null)));
  const states: State[] = [];
  let wake = () => undefined as void;
  client.on("room:state", (state) => {
    states.push(state as State);
    wake();
  });
  const until = (check: (game: CourtView) => boolean) =>
    new Promise<CourtView>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out")), 4000);
      const test = () => {
        const game = states[states.length - 1]?.game;
        if (game && check(game)) {
          clearTimeout(timer);
          resolve(game);
        }
      };
      wake = test;
      test();
    });
  const act = (type: string, payload: unknown = {}) =>
    client.emit("game:action", { type, payload });
  return { client, states, until, act };
}

async function startCase(url: string) {
  const a = await newPlayer(url);
  const b = await newPlayer(url);
  const joined = new Promise<string>((resolve) =>
    a.client.once("room:joined", ({ code }) => resolve(code)),
  );
  a.client.emit("room:create", { gameId: "court", displayName: "Alex" });
  const code = await joined;
  const bJoined = new Promise((resolve) =>
    b.client.once("room:joined", resolve),
  );
  b.client.emit("room:join", { code, displayName: "Sam" });
  await bJoined;
  a.client.emit("room:ready", { ready: true });
  b.client.emit("room:ready", { ready: true });
  await a.until((game) => game.stage === "setup");
  await b.until((game) => game.stage === "setup");
  a.act("setup", { judge: "dramatic" });
  b.act("setup", { judge: "dramatic" });
  await a.until((game) => game.setupAgreed);
  await b.until((game) => game.setupAgreed);
  a.act("continue");
  await a.until((game) => game.haveContinued);
  b.act("continue");
  await a.until((game) => game.stage === "accuse");
  a.act("accuse", { text: "Stole the duvet." });
  await b.until((game) => game.stage === "defend");
  return { a, b };
}

describe("Court with an AI", () => {
  it("shows the judge thinking, then the AI's reaction, to both players", async () => {
    let answer: (output: unknown) => void = () => undefined;
    const url = await startServer(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    const { a, b } = await startCase(url);
    b.act("defend", { text: "Was asleep." });
    await a.until((game) => game.stage === "hearing" && game.judgeThinking);

    answer({ line: "Order!", score: 10, crowd: "boo" });
    const seen = await a.until(
      (game) => game.stage === "hearing" && !game.judgeThinking,
    );
    const seenByB = await b.until(
      (game) => game.stage === "hearing" && !game.judgeThinking,
    );
    expect(seen.reaction?.line).toBe("Order!");
    expect(seen.reaction?.crowd).toBe("boo");
    expect(seen.meter).toBe(60);
    expect(seenByB.reaction?.line).toBe("Order!");
  });

  it("still moves on when the AI fails, or there's no AI at all", async () => {
    for (const runEffect of [
      () => Promise.reject(new Error("down")),
      undefined,
    ]) {
      const { a, b } = await startCase(await startServer(runEffect));
      b.act("defend", { text: "Was asleep." });
      const game = await a.until(
        (g) => g.stage === "hearing" && !g.judgeThinking,
      );
      expect(game.reaction?.line).toEqual(expect.any(String));
    }
  });

  it("keeps the lawyer's suggestions away from the prosecutor", async () => {
    const url = await startServer(() =>
      Promise.resolve({
        suggestions: [{ style: "Sincere", text: "Top secret excuse" }],
      }),
    );
    const { a, b } = await startCase(url);
    b.act("askLawyer");
    await b.until((game) => game.lawyerStatus === "ready");
    b.act("defend", { text: "Was asleep." });
    await a.until((game) => game.stage === "hearing");
    expect(JSON.stringify(a.states)).not.toContain("Top secret excuse");
    expect(JSON.stringify(b.states)).toContain("Top secret excuse");
  });

  it("ignores an AI reply that arrives after a player left", async () => {
    let answer: (output: unknown) => void = () => undefined;
    const url = await startServer(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    const { a, b } = await startCase(url);
    b.act("defend", { text: "Was asleep." });
    await a.until((game) => game.stage === "hearing");
    const lobby = new Promise<State>((resolve) =>
      a.client.on("room:state", (state) => {
        if (state.phase === "LOBBY") resolve(state as State);
      }),
    );
    b.client.emit("room:leave", {});
    await lobby;
    const count = a.states.length;
    answer({ line: "Too late" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(a.states.length).toBe(count);
  });
});
