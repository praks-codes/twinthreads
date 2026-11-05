// Contracts from ARCHITECTURE.md sections 5 and 6. Types only.

export type PlayerId = string;

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export interface GameError {
  code: string;
  message: string;
}

export type Phase =
  | "LOBBY"
  | "PRIVATE_INPUT"
  | "REVEAL"
  | "SCORE"
  | "NEXT_ROUND"
  | "RESULTS"
  | "REMATCH";

/** Seeded random source. All game randomness goes through this. */
export interface Rng {
  /** Float in the range [0, 1). */
  next(): number;
  /** Integer between min and max, both inclusive. */
  int(min: number, max: number): number;
}

export interface GameResult {
  scores: Record<PlayerId, number>;
  winner: PlayerId | null;
  summary: string;
}

export interface GameDefinition<State, Action, View> {
  id: string;
  players: 2;
  init(ctx: {
    playerIds: [PlayerId, PlayerId];
    rng: Rng;
    now: number;
    options?: unknown;
  }): State;
  /** Checks untrusted input from a client. Engine and games can't use Zod. */
  parseAction(input: unknown): Result<Action, GameError>;
  reduce(
    state: State,
    action: Action,
    ctx: { playerId: PlayerId; now: number; rng: Rng },
  ): Result<State, GameError>;
  view(state: State, playerId: PlayerId): View;
  phase(state: State): Phase;
  deadline(state: State): number | null;
  onTimeout(state: State, now: number, rng: Rng): State;
  isFinished(state: State): boolean;
  result(state: State): GameResult;
}

/** Any game, for code that handles games without knowing their types. */
export type AnyGame = GameDefinition<unknown, unknown, unknown>;

/** A running game. Plain data, so it can be saved and replayed. */
export interface GameSession<State> {
  gameId: string;
  seed: number;
  step: number;
  state: State;
}

export interface RoomPlayer {
  playerId: PlayerId;
  playerToken: string;
  displayName: string;
  ready: boolean;
  connected: boolean;
  /** True once a disconnected player's reconnect grace period has run out. */
  graceExpired: boolean;
}

export interface RoomRecord {
  code: string;
  gameId: string;
  players: RoomPlayer[];
  phase: Phase;
  gameState: unknown;
  lastActiveAt: number;
  /** True after a player left on purpose, until someone takes the free slot. */
  partnerLeft: boolean;
}

export interface RoomStore {
  create(room: RoomRecord): Promise<void>;
  get(code: string): Promise<RoomRecord | null>;
  update(code: string, patch: Partial<RoomRecord>): Promise<void>;
  delete(code: string): Promise<void>;
  touch(code: string): Promise<void>;
}

// Client to server payloads
export interface RoomCreatePayload {
  gameId: string;
  displayName: string;
}
export interface RoomJoinPayload {
  code: string;
  displayName: string;
  playerToken?: string;
}
export interface RoomReadyPayload {
  ready: boolean;
}
export interface GameActionPayload {
  type: string;
  payload: unknown;
}
export type RoomRematchPayload = Record<string, never>;
export type RoomLeavePayload = Record<string, never>;

// Server to client payloads
export interface RoomJoinedPayload {
  code: string;
  playerId: PlayerId;
  playerToken: string;
}
export type RoomStatus =
  "waiting" | "active" | "reconnecting" | "paused" | "partner_left";

/** `players` deliberately omits playerToken: tokens never go to the other player. */
export interface RoomStatePayload<View = unknown> {
  code: string;
  gameId: string;
  players: Omit<RoomPlayer, "playerToken" | "graceExpired">[];
  status: RoomStatus;
  phase: Phase;
  game: View;
  /** Set once the game has finished. */
  result: GameResult | null;
  rematchVotes: PlayerId[];
  serverTime: number;
  deadline: number | null;
}
export type RoomErrorCode =
  | "INVALID"
  | "NOT_FOUND"
  | "ROOM_FULL"
  | "BAD_TOKEN"
  | "ALREADY_IN_ROOM"
  | "RATE_LIMITED"
  | "ROOM_EXPIRED"
  | "REPLACED"
  | "SHUTTING_DOWN"
  | "GAME_ERROR"
  | "ROOM_PAUSED"
  | "INTERNAL";

export interface RoomErrorPayload {
  code: RoomErrorCode;
  message: string;
}

export interface ClientToServerEvents {
  "room:create": (payload: RoomCreatePayload) => void;
  "room:join": (payload: RoomJoinPayload) => void;
  "room:leave": (payload: RoomLeavePayload) => void;
  "room:ready": (payload: RoomReadyPayload) => void;
  "game:action": (payload: GameActionPayload) => void;
  "room:rematch": (payload: RoomRematchPayload) => void;
}

export interface ServerToClientEvents {
  "room:joined": (payload: RoomJoinedPayload) => void;
  "room:state": (payload: RoomStatePayload) => void;
  "room:error": (payload: RoomErrorPayload) => void;
}
