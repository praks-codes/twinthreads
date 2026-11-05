import type {
  GameDefinition,
  GameError,
  GameResult,
  Phase,
  PlayerId,
  Result,
} from "@twinthreads/engine";

// Number Duel exists only to exercise the phase engine. Real players never see it.

export const TEST_GAME_ID = "test-game";
export const TOTAL_ROUNDS = 3;
export const MIN_PICK = 1;
export const MAX_PICK = 5;

export interface NumberDuelTimings {
  pickMs: number;
  revealMs: number;
  scoreMs: number;
  nextRoundMs: number;
}

const DEFAULT_TIMINGS: NumberDuelTimings = {
  pickMs: 30_000,
  revealMs: 3_000,
  scoreMs: 3_000,
  nextRoundMs: 2_000,
};

export interface NumberDuelState {
  playerIds: [PlayerId, PlayerId];
  phase: Phase;
  deadline: number | null;
  round: number;
  picks: Record<PlayerId, number | null>;
  target: number | null;
  scores: Record<PlayerId, number>;
}

export interface NumberDuelAction {
  type: "pick";
  payload: { value: number };
}

/** Only what one player may see. The partner's pick stays hidden until REVEAL. */
export interface NumberDuelView {
  round: number;
  totalRounds: number;
  myPick: number | null;
  partnerHasPicked: boolean;
  partnerPick: number | null;
  target: number | null;
  scores: Record<PlayerId, number>;
}

const rejected = (
  code: string,
  message: string,
): { ok: false; error: GameError } => ({
  ok: false,
  error: { code, message },
});

function emptyPicks([a, b]: [PlayerId, PlayerId]) {
  return { [a]: null, [b]: null };
}

function closestPlayers(state: NumberDuelState): PlayerId[] {
  const { target } = state;
  if (target === null) return [];
  const distances = state.playerIds.flatMap((playerId) => {
    const pick = state.picks[playerId];
    return pick === null || pick === undefined
      ? []
      : [{ playerId, distance: Math.abs(pick - target) }];
  });
  const best = Math.min(...distances.map((entry) => entry.distance));
  return distances
    .filter((entry) => entry.distance === best)
    .map((entry) => entry.playerId);
}

export function createNumberDuel(
  timings: NumberDuelTimings = DEFAULT_TIMINGS,
): GameDefinition<NumberDuelState, NumberDuelAction, NumberDuelView> {
  const toReveal = (
    state: NumberDuelState,
    now: number,
    rng: { int(min: number, max: number): number },
  ): NumberDuelState => ({
    ...state,
    phase: "REVEAL",
    deadline: now + timings.revealMs,
    target: rng.int(MIN_PICK, MAX_PICK),
  });

  return {
    id: TEST_GAME_ID,
    players: 2,

    init: ({ playerIds, now }) => ({
      playerIds,
      phase: "PRIVATE_INPUT",
      deadline: now + timings.pickMs,
      round: 1,
      picks: emptyPicks(playerIds),
      target: null,
      scores: { [playerIds[0]]: 0, [playerIds[1]]: 0 },
    }),

    parseAction(input): Result<NumberDuelAction, GameError> {
      const candidate = input as Partial<NumberDuelAction> | null;
      const value = candidate?.payload?.value;
      if (
        candidate?.type !== "pick" ||
        typeof value !== "number" ||
        !Number.isInteger(value) ||
        value < MIN_PICK ||
        value > MAX_PICK
      ) {
        return rejected("BAD_ACTION", "Pick a whole number from 1 to 5.");
      }
      return { ok: true, value: { type: "pick", payload: { value } } };
    },

    reduce(state, action, { playerId, now, rng }) {
      if (state.phase !== "PRIVATE_INPUT") {
        return rejected("WRONG_PHASE", "You can't pick right now.");
      }
      if (!state.playerIds.includes(playerId)) {
        return rejected("NOT_A_PLAYER", "You aren't in this game.");
      }
      if (state.picks[playerId] !== null) {
        return rejected("ALREADY_PICKED", "You've already picked this round.");
      }
      const next = {
        ...state,
        picks: { ...state.picks, [playerId]: action.payload.value },
      };
      const bothPicked = next.playerIds.every((id) => next.picks[id] !== null);
      return { ok: true, value: bothPicked ? toReveal(next, now, rng) : next };
    },

    view(state, playerId) {
      const partner = state.playerIds.find((id) => id !== playerId);
      const partnerPick = partner ? (state.picks[partner] ?? null) : null;
      const revealed = state.phase !== "PRIVATE_INPUT";
      return {
        round: state.round,
        totalRounds: TOTAL_ROUNDS,
        myPick: state.picks[playerId] ?? null,
        partnerHasPicked: partnerPick !== null,
        partnerPick: revealed ? partnerPick : null,
        target: state.target,
        scores: state.scores,
      };
    },

    phase: (state) => state.phase,
    deadline: (state) => state.deadline,

    onTimeout(state, now, rng) {
      switch (state.phase) {
        case "PRIVATE_INPUT":
          return toReveal(state, now, rng);
        case "REVEAL": {
          const scores = { ...state.scores };
          for (const playerId of closestPlayers(state)) {
            scores[playerId] = (scores[playerId] ?? 0) + 1;
          }
          return {
            ...state,
            phase: "SCORE",
            deadline: now + timings.scoreMs,
            scores,
          };
        }
        case "SCORE":
          return state.round >= TOTAL_ROUNDS
            ? { ...state, phase: "RESULTS", deadline: null }
            : {
                ...state,
                phase: "NEXT_ROUND",
                deadline: now + timings.nextRoundMs,
              };
        case "NEXT_ROUND":
          return {
            ...state,
            phase: "PRIVATE_INPUT",
            deadline: now + timings.pickMs,
            round: state.round + 1,
            picks: emptyPicks(state.playerIds),
            target: null,
          };
        default:
          return state;
      }
    },

    isFinished: (state) => state.phase === "RESULTS",

    result(state): GameResult {
      const [a, b] = state.playerIds;
      const scoreA = state.scores[a] ?? 0;
      const scoreB = state.scores[b] ?? 0;
      const winner = scoreA === scoreB ? null : scoreA > scoreB ? a : b;
      return {
        scores: state.scores,
        winner,
        summary: `Final score: ${scoreA} to ${scoreB}`,
      };
    },
  };
}

export const numberDuel = createNumberDuel();
