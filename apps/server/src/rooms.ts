import { randomBytes, randomUUID } from "node:crypto";
import {
  RoomExistsError,
  type PlayerId,
  type Result,
  type RoomErrorCode,
  type RoomPlayer,
  type RoomRecord,
  type RoomStatePayload,
  type RoomStatus,
  type RoomStore,
} from "@twinthreads/engine";
import { generateRoomCode } from "./room-code.js";

const MAX_CODE_ATTEMPTS = 5;
const MAX_PLAYERS = 2;

type Timer = ReturnType<typeof setTimeout>;

export interface RoomServiceOptions {
  store: RoomStore;
  idleMs: number;
  graceMs: number;
  now: () => number;
  generateCode?: () => string;
  onGraceEnded: (code: string) => void | Promise<void>;
  onExpired: (room: RoomRecord) => void | Promise<void>;
  onTimerError: (error: unknown) => void;
}

export interface Membership {
  code: string;
  player: RoomPlayer;
}

export function roomStatus(room: RoomRecord): RoomStatus {
  if (room.players.length < MAX_PLAYERS) {
    return room.partnerLeft ? "partner_left" : "waiting";
  }
  const offline = room.players.filter((player) => !player.connected);
  if (offline.length === 0) return "active";
  return offline.some((player) => player.graceExpired)
    ? "paused"
    : "reconnecting";
}

/** Room lifecycle, with no knowledge of sockets. */
export class RoomService {
  readonly #locks = new Map<string, Promise<unknown>>();
  readonly #idleTimers = new Map<string, Timer>();
  readonly #graceTimers = new Map<PlayerId, Timer>();
  #disposed = false;

  constructor(private readonly options: RoomServiceOptions) {}

  async create(displayName: string): Promise<Membership> {
    const generate = this.options.generateCode ?? generateRoomCode;
    const player = newPlayer(displayName);

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const code = generate();
      try {
        await this.options.store.create({
          code,
          gameId: "court",
          players: [player],
          phase: "LOBBY",
          gameState: null,
          lastActiveAt: this.options.now(),
          partnerLeft: false,
        });
      } catch (error) {
        if (error instanceof RoomExistsError) continue;
        throw error;
      }
      this.#resetIdleTimer(code);
      return { code, player };
    }
    throw new Error("Could not find a free room code");
  }

  /** With a token this rejoins that player's slot. Without one it takes a free slot. */
  join(
    code: string,
    displayName: string,
    token: string | undefined,
  ): Promise<Result<Membership, RoomErrorCode>> {
    return this.#withLock(code, async () => {
      const { store } = this.options;
      const room = await store.get(code);
      if (!room) return { ok: false, error: "NOT_FOUND" };

      if (token !== undefined) {
        const existing = room.players.find((p) => p.playerToken === token);
        if (!existing) return { ok: false, error: "BAD_TOKEN" };

        this.#clearGraceTimer(existing.playerId);
        const player = { ...existing, connected: true, graceExpired: false };
        await store.update(code, {
          players: replacePlayer(room.players, player),
        });
        await this.#touch(code);
        return { ok: true, value: { code, player } };
      }

      if (room.players.length >= MAX_PLAYERS) {
        return { ok: false, error: "ROOM_FULL" };
      }
      const player = newPlayer(displayName);
      await store.update(code, {
        players: [...room.players, player],
        partnerLeft: false,
      });
      await this.#touch(code);
      return { ok: true, value: { code, player } };
    });
  }

  /** Frees the player's slot. Deletes the room if nobody remains. */
  leave(code: string, playerId: PlayerId): Promise<void> {
    return this.#withLock(code, async () => {
      const { store } = this.options;
      const room = await store.get(code);
      if (!room) return;

      this.#clearGraceTimer(playerId);
      const players = room.players.filter((p) => p.playerId !== playerId);
      if (players.length === 0) {
        await store.delete(code);
        this.#clearIdleTimer(code);
        return;
      }
      await store.update(code, { players, partnerLeft: true });
      await this.#touch(code);
    });
  }

  /** A dropped connection keeps the slot and starts the grace period. */
  disconnected(code: string, playerId: PlayerId): Promise<void> {
    return this.#withLock(code, async () => {
      const { store } = this.options;
      const room = await store.get(code);
      const player = room?.players.find((p) => p.playerId === playerId);
      if (!room || !player) return;

      await store.update(code, {
        players: replacePlayer(room.players, { ...player, connected: false }),
      });
      this.#startGraceTimer(code, playerId);
    });
  }

  async snapshot(code: string): Promise<RoomStatePayload | null> {
    const room = await this.options.store.get(code);
    if (!room) return null;
    return {
      code: room.code,
      // Listed field by field, so a new secret on RoomPlayer can't leak by default.
      players: room.players.map((player) => ({
        playerId: player.playerId,
        displayName: player.displayName,
        ready: player.ready,
        connected: player.connected,
      })),
      status: roomStatus(room),
      phase: room.phase,
      game: null,
      serverTime: this.options.now(),
      deadline: null,
    };
  }

  /** Stops all timers, so nothing fires during shutdown. */
  dispose(): void {
    this.#disposed = true;
    for (const timer of this.#idleTimers.values()) clearTimeout(timer);
    for (const timer of this.#graceTimers.values()) clearTimeout(timer);
    this.#idleTimers.clear();
    this.#graceTimers.clear();
  }

  // One operation at a time per room, so two players can't both take the last slot.
  // A Redis RoomStore will need its own atomic check.
  #withLock<T>(code: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.#locks.get(code) ?? Promise.resolve();
    const run = previous.then(operation);
    const tail = run.catch(() => undefined);
    this.#locks.set(code, tail);
    void tail.then(() => {
      if (this.#locks.get(code) === tail) this.#locks.delete(code);
    });
    return run;
  }

  async #touch(code: string): Promise<void> {
    await this.options.store.touch(code);
    this.#resetIdleTimer(code);
  }

  #resetIdleTimer(code: string): void {
    this.#clearIdleTimer(code);
    if (this.#disposed) return;
    const timer: Timer = setTimeout(() => {
      this.#expire(code, timer).catch(this.options.onTimerError);
    }, this.options.idleMs);
    timer.unref();
    this.#idleTimers.set(code, timer);
  }

  #clearIdleTimer(code: string): void {
    clearTimeout(this.#idleTimers.get(code));
    this.#idleTimers.delete(code);
  }

  #expire(code: string, timer: Timer): Promise<void> {
    return this.#withLock(code, async () => {
      // Activity while this was queued replaced the timer, so the room isn't idle.
      if (this.#idleTimers.get(code) !== timer) return;
      this.#idleTimers.delete(code);

      const room = await this.options.store.get(code);
      if (!room) return;
      for (const player of room.players) {
        this.#clearGraceTimer(player.playerId);
      }
      await this.options.store.delete(code);
      await this.options.onExpired(room);
    });
  }

  #startGraceTimer(code: string, playerId: PlayerId): void {
    this.#clearGraceTimer(playerId);
    if (this.#disposed) return;
    const timer: Timer = setTimeout(() => {
      this.#endGrace(code, playerId, timer).catch(this.options.onTimerError);
    }, this.options.graceMs);
    timer.unref();
    this.#graceTimers.set(playerId, timer);
  }

  #clearGraceTimer(playerId: PlayerId): void {
    clearTimeout(this.#graceTimers.get(playerId));
    this.#graceTimers.delete(playerId);
  }

  async #endGrace(
    code: string,
    playerId: PlayerId,
    timer: Timer,
  ): Promise<void> {
    await this.#withLock(code, async () => {
      if (this.#graceTimers.get(playerId) !== timer) return;
      this.#graceTimers.delete(playerId);

      const room = await this.options.store.get(code);
      const player = room?.players.find((p) => p.playerId === playerId);
      if (!room || !player) return;
      await this.options.store.update(code, {
        players: replacePlayer(room.players, { ...player, graceExpired: true }),
      });
    });
    await this.options.onGraceEnded(code);
  }
}

function newPlayer(displayName: string): RoomPlayer {
  return {
    playerId: randomUUID(),
    playerToken: randomBytes(32).toString("base64url"),
    displayName,
    ready: false,
    connected: true,
    graceExpired: false,
  };
}

function replacePlayer(players: RoomPlayer[], player: RoomPlayer) {
  return players.map((p) => (p.playerId === player.playerId ? player : p));
}
