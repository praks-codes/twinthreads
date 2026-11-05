import { createSeededRng } from "./rng.js";
import type {
  GameDefinition,
  GameEffect,
  GameError,
  GameSession,
  Phase,
  PlayerId,
  Result,
  Rng,
} from "./types.js";

/** A game moved between phases in an impossible way. This is a bug in the game. */
export class IllegalPhaseTransitionError extends Error {
  constructor(gameId: string, from: Phase, to: Phase) {
    super(`Game "${gameId}" made an illegal phase change: ${from} to ${to}`);
    this.name = "IllegalPhaseTransitionError";
  }
}

const ROUND_PHASES: readonly Phase[] = [
  "PRIVATE_INPUT",
  "REVEAL",
  "SCORE",
  "NEXT_ROUND",
];

function isLegalTransition(from: Phase, to: Phase): boolean {
  if (from === to) return true;
  const fromIndex = ROUND_PHASES.indexOf(from);
  if (fromIndex === -1) return false; // Nothing leaves RESULTS. LOBBY and REMATCH aren't the game's.
  if (to === "RESULTS") return true;
  const toIndex = ROUND_PHASES.indexOf(to);
  if (toIndex === -1) return false;
  return toIndex > fromIndex || from === "NEXT_ROUND"; // Games may skip phases, but only a new round goes back.
}

function assertLegalState<State>(
  game: GameDefinition<State, unknown, unknown>,
  from: Phase | null,
  state: State,
): void {
  const to = game.phase(state);
  const startsLegally = from === null && ROUND_PHASES.includes(to);
  if (from === null ? !startsLegally : !isLegalTransition(from, to)) {
    throw new IllegalPhaseTransitionError(game.id, from ?? "LOBBY", to);
  }
  if (game.isFinished(state) !== (to === "RESULTS")) {
    throw new IllegalPhaseTransitionError(game.id, from ?? "LOBBY", to);
  }
}

// Each step gets its own generator from the seed and step number, so a session is
// plain data: saving it loses nothing, and replaying it gives the same numbers.
function rngForStep(seed: number, step: number): Rng {
  return createSeededRng((seed ^ Math.imul(step + 1, 0x9e3779b1)) >>> 0);
}

export function startGame<State, Action, View>(
  game: GameDefinition<State, Action, View>,
  ctx: {
    playerIds: [PlayerId, PlayerId];
    seed: number;
    now: number;
    options?: unknown;
  },
): GameSession<State> {
  const state = game.init({
    playerIds: ctx.playerIds,
    rng: rngForStep(ctx.seed, 0),
    now: ctx.now,
    ...(ctx.options === undefined ? {} : { options: ctx.options }),
  });
  assertLegalState(
    game as GameDefinition<State, unknown, unknown>,
    null,
    state,
  );
  return { gameId: game.id, seed: ctx.seed, step: 1, state };
}

/** Takes untrusted input. A rejected action returns an error and changes nothing. */
export function applyAction<State, Action, View>(
  game: GameDefinition<State, Action, View>,
  session: GameSession<State>,
  playerId: PlayerId,
  input: unknown,
  now: number,
): Result<GameSession<State>, GameError> {
  if (game.isFinished(session.state)) {
    return {
      ok: false,
      error: { code: "GAME_FINISHED", message: "This game has finished." },
    };
  }
  const action = game.parseAction(input);
  if (!action.ok) return action;

  const result = game.reduce(session.state, action.value, {
    playerId,
    now,
    rng: rngForStep(session.seed, session.step),
  });
  if (!result.ok) return result;

  assertLegalState(
    game as GameDefinition<State, unknown, unknown>,
    game.phase(session.state),
    result.value,
  );
  return {
    ok: true,
    value: { ...session, step: session.step + 1, state: result.value },
  };
}

/** Does nothing unless the deadline has passed, so a stale timer is harmless. */
export function applyTimeout<State, Action, View>(
  game: GameDefinition<State, Action, View>,
  session: GameSession<State>,
  now: number,
): GameSession<State> {
  const deadline = game.deadline(session.state);
  if (deadline === null || now < deadline) return session;

  const state = game.onTimeout(
    session.state,
    now,
    rngForStep(session.seed, session.step),
  );
  assertLegalState(
    game as GameDefinition<State, unknown, unknown>,
    game.phase(session.state),
    state,
  );
  return { ...session, step: session.step + 1, state };
}

export function pendingEffects<State, Action, View>(
  game: GameDefinition<State, Action, View>,
  session: GameSession<State>,
): GameEffect[] {
  return game.pendingEffects?.(session.state) ?? [];
}

/** Does nothing if the effect is no longer pending, so a late result is harmless. */
export function applyEffectResult<State, Action, View>(
  game: GameDefinition<State, Action, View>,
  session: GameSession<State>,
  effect: { id: string; output: unknown },
  now: number,
): GameSession<State> {
  const isPending = pendingEffects(game, session).some(
    ({ id }) => id === effect.id,
  );
  if (!isPending || !game.applyEffect) return session;

  const state = game.applyEffect(session.state, effect, {
    now,
    rng: rngForStep(session.seed, session.step),
  });
  assertLegalState(
    game as GameDefinition<State, unknown, unknown>,
    game.phase(session.state),
    state,
  );
  return { ...session, step: session.step + 1, state };
}

export function viewFor<State, Action, View>(
  game: GameDefinition<State, Action, View>,
  session: GameSession<State>,
  playerId: PlayerId,
): View {
  return game.view(session.state, playerId);
}
