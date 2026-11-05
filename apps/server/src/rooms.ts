import { randomBytes, randomInt, randomUUID } from "node:crypto";
import {
  applyAction,
  applyTimeout,
  RoomExistsError,
  startGame,
  viewFor,
  type AnyGame,
  type GameSession,
  type PlayerId,
  type Result,
  type RoomErrorCode,
  type RoomPlayer,
  type RoomRecord,
  type RoomStatePayload,
  type RoomStatus,
  type RoomStore,
} from "@twinthreads/engine";
import type { GameRegistry } from "./games.js";
import { generateRoomCode } from "./room-code.js";

const MAX_CODE_ATTEMPTS = 5;
const MAX_PLAYERS = 2;
const MAX_SEED = 2 ** 32;

type Timer = ReturnType<typeof setTimeout>;

/**
 * What's kept in RoomRecord.gameState while a game exists.
 *
 * Games read time from a clock that stops during a pause, so they need no pause
 * code of their own: game time = real time - pausedMs.
 */
interface ActiveGame {
  session: GameSession<unknown>;
  pausedMs: number;
  pausedAt: number | null;
  rematchVotes: PlayerId[];
}

export interface RoomFailure {
  code: RoomErrorCode;
  message?: string;
}

export interface RoomServiceOptions {
  store: RoomStore;
  games: GameRegistry;
  idleMs: number;
  graceMs: number;
  now: () => number;
  generateCode?: () => string;
  onGraceEnded: (code: string) => void | Promise<void>;
  onGameChanged: (code: string) => void | Promise<void>;
  onExpired: (room: RoomRecord) => void | Promise<void>;
  onTimerError: (error: unknown) => void;
}

export interface Membership {
  code: string;
  player: RoomPlayer;
}

const OK = { ok: true, value: undefined } as const;

const failure = (
  code: RoomErrorCode,
  message?: string,
): { ok: false; error: RoomFailure } => ({
  ok: false,
  error: message === undefined ? { code } : { code, message },
});

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

const activeGame = (room: RoomRecord) => room.gameState as ActiveGame | null;

const gameClock = (active: ActiveGame, now: number) =>
  (active.pausedAt ?? now) - active.pausedMs;

/** Room and game lifecycle, with no knowledge of sockets. */
export class RoomService {
  readonly #locks = new Map<string, Promise<unknown>>();
  readonly #idleTimers = new Map<string, Timer>();
  readonly #graceTimers = new Map<PlayerId, Timer>();
  readonly #gameTimers = new Map<string, Timer>();
  #disposed = false;

  constructor(private readonly options: RoomServiceOptions) {}

  hasGame(gameId: string): boolean {
    return this.options.games.has(gameId);
  }

  async create(gameId: string, displayName: string): Promise<Membership> {
    const generate = this.options.generateCode ?? generateRoomCode;
    const player = newPlayer(displayName);

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const code = generate();
      try {
        await this.options.store.create({
          code,
          gameId,
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
        await this.#resumeIfPossible(code);
        await this.#startIfReady(code);
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

  /**
   * Frees the player's slot and ends any game, because a two-player game can't
   * continue with one. Deletes the room if nobody remains.
   */
  leave(code: string, playerId: PlayerId): Promise<void> {
    return this.#withLock(code, async () => {
      const { store } = this.options;
      const room = await store.get(code);
      if (!room) return;

      this.#clearGraceTimer(playerId);
      this.#clearGameTimer(code);
      const players = room.players.filter((p) => p.playerId !== playerId);
      if (players.length === 0) {
        await store.delete(code);
        this.#clearIdleTimer(code);
        return;
      }
      await store.update(code, {
        players: players.map((player) => ({ ...player, ready: false })),
        partnerLeft: true,
        phase: "LOBBY",
        gameState: null,
      });
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

  setReady(
    code: string,
    playerId: PlayerId,
    ready: boolean,
  ): Promise<Result<void, RoomFailure>> {
    return this.#withLock(code, async () => {
      const { store } = this.options;
      const room = await store.get(code);
      const player = room?.players.find((p) => p.playerId === playerId);
      if (!room || !player) return failure("NOT_FOUND");
      if (room.phase !== "LOBBY") {
        return failure("GAME_ERROR", "The game has already started.");
      }
      await store.update(code, {
        players: replacePlayer(room.players, { ...player, ready }),
      });
      await this.#touch(code);
      await this.#startIfReady(code);
      return OK;
    });
  }

  gameAction(
    code: string,
    playerId: PlayerId,
    input: unknown,
  ): Promise<Result<void, RoomFailure>> {
    return this.#withLock(code, async () => {
      const room = await this.options.store.get(code);
      if (!room) return failure("NOT_FOUND");
      const active = activeGame(room);
      if (!active) return failure("GAME_ERROR", "No game is running.");
      if (roomStatus(room) === "paused") return failure("ROOM_PAUSED");

      const game = this.#game(room);
      const result = applyAction(
        game,
        active.session,
        playerId,
        input,
        gameClock(active, this.options.now()),
      );
      if (!result.ok) return failure("GAME_ERROR", result.error.message);

      await this.#saveGame(room, game, { ...active, session: result.value });
      await this.#touch(code);
      return OK;
    });
  }

  /** Both players voting starts a new game with new randomness. */
  rematch(
    code: string,
    playerId: PlayerId,
  ): Promise<Result<void, RoomFailure>> {
    return this.#withLock(code, async () => {
      const { store } = this.options;
      const room = await store.get(code);
      if (!room) return failure("NOT_FOUND");
      const active = activeGame(room);
      if (!active || (room.phase !== "RESULTS" && room.phase !== "REMATCH")) {
        return failure("GAME_ERROR", "The game hasn't finished yet.");
      }
      await store.update(code, {
        phase: "REMATCH",
        gameState: {
          ...active,
          rematchVotes: [...new Set([...active.rematchVotes, playerId])],
        } satisfies ActiveGame,
      });
      await this.#touch(code);
      await this.#startIfReady(code);
      return OK;
    });
  }

  /** Built per player, because this is the only data that player may see. */
  async snapshot(
    code: string,
    playerId: PlayerId,
  ): Promise<RoomStatePayload | null> {
    const room = await this.options.store.get(code);
    if (!room) return null;
    const active = activeGame(room);
    const game = active ? this.#game(room) : null;
    const deadline =
      active && game ? game.deadline(active.session.state) : null;

    return {
      code: room.code,
      gameId: room.gameId,
      // Listed field by field, so a new secret on RoomPlayer can't leak by default.
      players: room.players.map((player) => ({
        playerId: player.playerId,
        displayName: player.displayName,
        ready: player.ready,
        connected: player.connected,
      })),
      status: roomStatus(room),
      phase: room.phase,
      game: active && game ? viewFor(game, active.session, playerId) : null,
      result:
        active && game?.isFinished(active.session.state)
          ? game.result(active.session.state)
          : null,
      rematchVotes: active?.rematchVotes ?? [],
      serverTime: this.options.now(),
      // Converted from game time to real time. No countdown while paused.
      deadline:
        active && deadline !== null && active.pausedAt === null
          ? deadline + active.pausedMs
          : null,
    };
  }

  /** Stops all timers, so nothing fires during shutdown. */
  dispose(): void {
    this.#disposed = true;
    for (const timers of [
      this.#idleTimers,
      this.#graceTimers,
      this.#gameTimers,
    ]) {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    }
  }

  #game(room: RoomRecord): AnyGame {
    const game = this.options.games.get(room.gameId);
    if (!game) throw new Error(`Game is not registered: ${room.gameId}`);
    return game;
  }

  async #startIfReady(code: string): Promise<void> {
    const { store, now } = this.options;
    const room = await store.get(code);
    if (!room || room.players.length !== MAX_PLAYERS) return;
    if (room.players.some((player) => !player.connected)) return;

    const active = activeGame(room);
    const canStart =
      room.phase === "LOBBY"
        ? room.players.every((player) => player.ready)
        : room.phase === "REMATCH" &&
          active?.rematchVotes.length === MAX_PLAYERS;
    if (!canStart) return;

    const [first, second] = room.players as [RoomPlayer, RoomPlayer];
    const game = this.#game(room);
    const session = startGame(game, {
      playerIds: [first.playerId, second.playerId],
      seed: randomInt(MAX_SEED),
      now: now(),
    });
    await store.update(code, {
      players: room.players.map((player) => ({ ...player, ready: false })),
    });
    const updated = await store.get(code);
    if (!updated) return;
    await this.#saveGame(updated, game, {
      session,
      pausedMs: 0,
      pausedAt: null,
      rematchVotes: [],
    });
  }

  async #saveGame(
    room: RoomRecord,
    game: AnyGame,
    active: ActiveGame,
  ): Promise<void> {
    await this.options.store.update(room.code, {
      gameState: active,
      phase: game.phase(active.session.state),
    });
    this.#scheduleGameTimer(room.code, game, active);
  }

  // Only reached when every player is back, or the room isn't paused any more.
  async #resumeIfPossible(code: string): Promise<void> {
    const room = await this.options.store.get(code);
    if (!room) return;
    const active = activeGame(room);
    if (!active || active.pausedAt === null || roomStatus(room) === "paused") {
      return;
    }
    await this.#saveGame(room, this.#game(room), {
      ...active,
      pausedMs: active.pausedMs + this.options.now() - active.pausedAt,
      pausedAt: null,
    });
  }

  async #pauseIfNeeded(code: string): Promise<void> {
    const room = await this.options.store.get(code);
    if (!room || roomStatus(room) !== "paused") return;
    const active = activeGame(room);
    if (!active || active.pausedAt !== null) return;

    this.#clearGameTimer(code);
    await this.options.store.update(code, {
      gameState: { ...active, pausedAt: this.options.now() },
    });
  }

  #scheduleGameTimer(code: string, game: AnyGame, active: ActiveGame): void {
    this.#clearGameTimer(code);
    if (this.#disposed || active.pausedAt !== null) return;
    const deadline = game.deadline(active.session.state);
    if (deadline === null) return;

    const delay = deadline - gameClock(active, this.options.now());
    const timer: Timer = setTimeout(
      () => {
        this.#onGameTimer(code, timer)
          .then((changed) => {
            if (changed) return this.options.onGameChanged(code);
          })
          .catch(this.options.onTimerError);
      },
      Math.max(delay, 1),
    );
    timer.unref();
    this.#gameTimers.set(code, timer);
  }

  #onGameTimer(code: string, timer: Timer): Promise<boolean> {
    return this.#withLock(code, async () => {
      // An action while this was queued replaced the timer, so this one is stale.
      if (this.#gameTimers.get(code) !== timer) return false;
      this.#gameTimers.delete(code);

      const room = await this.options.store.get(code);
      if (!room) return false;
      const active = activeGame(room);
      if (!active || active.pausedAt !== null) return false;

      const game = this.#game(room);
      const session = applyTimeout(
        game,
        active.session,
        gameClock(active, this.options.now()),
      );
      await this.#saveGame(room, game, { ...active, session });
      return session !== active.session;
    });
  }

  #clearGameTimer(code: string): void {
    clearTimeout(this.#gameTimers.get(code));
    this.#gameTimers.delete(code);
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
      this.#clearGameTimer(code);
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
      await this.#pauseIfNeeded(code);
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
