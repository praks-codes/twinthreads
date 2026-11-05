import cors from "@fastify/cors";
import type {
  ClientToServerEvents,
  GameEffect,
  RoomStore,
  ServerToClientEvents,
} from "@twinthreads/engine";
import Fastify from "fastify";
import { Server } from "socket.io";
import type { Config } from "./config.js";
import type { GameRegistry } from "./games.js";
import { attachRoomSockets } from "./sockets.js";

const MAX_MESSAGE_BYTES = 16 * 1024;

// Notices a dropped phone in about 15 seconds, instead of the default 45.
const PING_INTERVAL_MS = 10_000;
const PING_TIMEOUT_MS = 5_000;

export interface AppDependencies {
  store: RoomStore;
  games: GameRegistry;
  countRooms: () => number;
  now: () => number;
  runEffect?: (gameId: string, effect: GameEffect) => Promise<unknown>;
}

export function buildApp(
  config: Pick<
    Config,
    | "CLIENT_ORIGIN"
    | "LOG_LEVEL"
    | "ROOM_IDLE_MINUTES"
    | "RECONNECT_GRACE_SECONDS"
  >,
  { store, games, countRooms, now, runEffect }: AppDependencies,
) {
  const app = Fastify({ logger: { level: config.LOG_LEVEL } });

  app.register(cors, { origin: config.CLIENT_ORIGIN });

  app.get("/health", async () => ({
    status: "ok",
    uptime: process.uptime(),
    rooms: countRooms(),
  }));

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(
    app.server,
    {
      cors: { origin: config.CLIENT_ORIGIN },
      maxHttpBufferSize: MAX_MESSAGE_BYTES,
      pingInterval: PING_INTERVAL_MS,
      pingTimeout: PING_TIMEOUT_MS,
    },
  );

  const shutdownRooms = attachRoomSockets({
    io,
    store,
    games,
    idleMs: config.ROOM_IDLE_MINUTES * 60_000,
    graceMs: config.RECONNECT_GRACE_SECONDS * 1000,
    log: app.log,
    now,
    ...(runEffect ? { runEffect } : {}),
  });

  app.addHook("preClose", async () => {
    shutdownRooms();
  });

  return { app, io };
}
