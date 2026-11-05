import type {
  ClientToServerEvents,
  PlayerId,
  RoomErrorCode,
  RoomRecord,
  RoomStore,
  ServerToClientEvents,
} from "@twinthreads/engine";
import type { FastifyBaseLogger } from "fastify";
import type { DefaultEventsMap, Server, Socket } from "socket.io";
import { RateLimiter } from "./rate-limit.js";
import { RoomService, type Membership } from "./rooms.js";
import {
  roomCreateSchema,
  roomJoinSchema,
  roomLeaveSchema,
} from "./schemas.js";

const MESSAGES_PER_SECOND = 20;
const CREATES_PER_MINUTE = 10;
const JOINS_PER_MINUTE = 20;

const MESSAGES: Record<RoomErrorCode, string> = {
  INVALID: "Check your name and room code, then try again.",
  NOT_FOUND: "We couldn't find that room. Check the code, or create a new one.",
  ROOM_FULL: "That room already has two players.",
  BAD_TOKEN: "We couldn't return you to that room.",
  ALREADY_IN_ROOM: "You're already in a room.",
  RATE_LIMITED: "Too many attempts. Please wait a moment and try again.",
  ROOM_EXPIRED: "This room expired because nobody was active.",
  REPLACED: "This room was opened in another tab or window.",
  SHUTTING_DOWN: "The server is restarting. Please try again in a moment.",
  INTERNAL: "Something went wrong. Please try again.",
};

interface SocketData {
  binding: { code: string; playerId: PlayerId } | null;
}

type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  DefaultEventsMap,
  SocketData
>;
type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  DefaultEventsMap,
  SocketData
>;

export interface RoomSocketOptions {
  io: AppServer;
  store: RoomStore;
  idleMs: number;
  graceMs: number;
  log: FastifyBaseLogger;
  now: () => number;
}

/** Wires Socket.IO events to the room service. Returns the shutdown function. */
export function attachRoomSockets(options: RoomSocketOptions): () => void {
  const { io, log, now } = options;
  const connections = new Map<PlayerId, AppSocket>();
  const createLimiter = new RateLimiter(CREATES_PER_MINUTE, 60_000, now);
  const joinLimiter = new RateLimiter(JOINS_PER_MINUTE, 60_000, now);
  let shuttingDown = false;

  const fail = (socket: AppSocket, code: RoomErrorCode) => {
    socket.emit("room:error", { code, message: MESSAGES[code] });
  };

  const publish = async (code: string) => {
    const state = await service.snapshot(code);
    if (state) io.to(code).emit("room:state", state);
  };

  const onExpired = (room: RoomRecord) => {
    log.info({ roomCode: room.code }, "room expired");
    for (const { playerId } of room.players) {
      const socket = connections.get(playerId);
      if (!socket) continue;
      connections.delete(playerId);
      socket.data.binding = null;
      void socket.leave(room.code);
      fail(socket, "ROOM_EXPIRED");
    }
  };

  const service = new RoomService({
    store: options.store,
    idleMs: options.idleMs,
    graceMs: options.graceMs,
    now,
    onGraceEnded: publish,
    onExpired,
    onTimerError: (err) => log.error({ err }, "room timer failed"),
  });

  /** Attaches the socket to the player. The newest connection replaces an older one. */
  const enter = async (socket: AppSocket, membership: Membership) => {
    const { code, player } = membership;
    const previous = connections.get(player.playerId);
    connections.set(player.playerId, socket);
    if (previous && previous !== socket) {
      previous.data.binding = null;
      fail(previous, "REPLACED");
      previous.disconnect(true);
    }
    socket.data.binding = { code, playerId: player.playerId };
    await socket.join(code);
    socket.emit("room:joined", {
      code,
      playerId: player.playerId,
      playerToken: player.playerToken,
    });
    await publish(code);
  };

  io.on("connection", (socket: AppSocket) => {
    socket.data.binding = null;
    const ip = socket.handshake.address;
    const messageLimiter = new RateLimiter(MESSAGES_PER_SECOND, 1000, now);

    // Each socket's messages run one at a time, in order.
    let queue: Promise<void> = Promise.resolve();
    const enqueue = (task: () => Promise<void>) => {
      queue = queue.then(task).catch((err: unknown) => {
        log.error({ err }, "socket handler failed");
        fail(socket, "INTERNAL");
      });
    };

    socket.use((_packet, next) => {
      if (messageLimiter.allow(socket.id)) next();
      else fail(socket, "RATE_LIMITED");
    });

    socket.on("room:create", (payload: unknown) => {
      enqueue(async () => {
        if (shuttingDown) return fail(socket, "SHUTTING_DOWN");
        if (!createLimiter.allow(ip)) return fail(socket, "RATE_LIMITED");
        const parsed = roomCreateSchema.safeParse(payload);
        if (!parsed.success) return fail(socket, "INVALID");
        if (socket.data.binding) return fail(socket, "ALREADY_IN_ROOM");

        const membership = await service.create(parsed.data.displayName);
        log.info(
          { roomCode: membership.code, playerId: membership.player.playerId },
          "room created",
        );
        await enter(socket, membership);
      });
    });

    socket.on("room:join", (payload: unknown) => {
      enqueue(async () => {
        if (shuttingDown) return fail(socket, "SHUTTING_DOWN");
        if (!joinLimiter.allow(ip)) return fail(socket, "RATE_LIMITED");
        const parsed = roomJoinSchema.safeParse(payload);
        if (!parsed.success) return fail(socket, "INVALID");
        if (socket.data.binding) return fail(socket, "ALREADY_IN_ROOM");

        const { code, displayName, playerToken } = parsed.data;
        const result = await service.join(code, displayName, playerToken);
        if (!result.ok) return fail(socket, result.error);
        log.info(
          { roomCode: code, playerId: result.value.player.playerId },
          "player joined",
        );
        await enter(socket, result.value);
      });
    });

    socket.on("room:leave", (payload: unknown) => {
      enqueue(async () => {
        if (!roomLeaveSchema.safeParse(payload).success) {
          return fail(socket, "INVALID");
        }
        const binding = socket.data.binding;
        if (!binding) return;

        socket.data.binding = null;
        connections.delete(binding.playerId);
        await socket.leave(binding.code);
        await service.leave(binding.code, binding.playerId);
        log.info(
          { roomCode: binding.code, playerId: binding.playerId },
          "player left",
        );
        await publish(binding.code);
      });
    });

    socket.on("disconnect", () => {
      enqueue(async () => {
        const binding = socket.data.binding;
        if (!binding || connections.get(binding.playerId) !== socket) return;

        connections.delete(binding.playerId);
        await service.disconnected(binding.code, binding.playerId);
        log.info(
          { roomCode: binding.code, playerId: binding.playerId },
          "player disconnected",
        );
        await publish(binding.code);
      });
    });
  });

  return () => {
    shuttingDown = true;
    service.dispose();
    io.emit("room:error", {
      code: "SHUTTING_DOWN",
      message: MESSAGES.SHUTTING_DOWN,
    });
    io.disconnectSockets(true);
  };
}
