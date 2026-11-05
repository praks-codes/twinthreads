import cors from "@fastify/cors";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@twinthreads/engine";
import Fastify from "fastify";
import { Server } from "socket.io";
import type { Config } from "./config.js";

export function buildApp(
  config: Pick<Config, "CLIENT_ORIGIN" | "LOG_LEVEL">,
  countRooms: () => number,
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
    },
  );

  app.addHook("preClose", async () => {
    io.disconnectSockets(true);
  });

  return { app, io };
}
