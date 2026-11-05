import { describe, expect, it } from "vitest";
import {
  applyAction,
  applyTimeout,
  IllegalPhaseTransitionError,
  startGame,
} from "../src/session.js";
import type { GameDefinition, Phase } from "../src/types.js";

interface State {
  phase: Phase;
  deadline: number | null;
  rolls: number[];
}

// `next` is the action: the phase to move to.
const game: GameDefinition<State, Phase, State> = {
  id: "fake",
  players: 2,
  init: ({ rng }) => ({
    phase: "PRIVATE_INPUT",
    deadline: 100,
    rolls: [rng.int(1, 1000)],
  }),
  parseAction: (input) =>
    typeof input === "string"
      ? { ok: true, value: input as Phase }
      : { ok: false, error: { code: "BAD", message: "Bad action" } },
  reduce: (state, next, { rng }) =>
    (next as string) === "reject"
      ? { ok: false, error: { code: "NO", message: "Rejected" } }
      : {
          ok: true,
          value: {
            ...state,
            phase: next,
            rolls: [...state.rolls, rng.int(1, 1000)],
          },
        },
  view: (state) => state,
  phase: (state) => state.phase,
  deadline: (state) => state.deadline,
  onTimeout: (state, _now, rng) => ({
    phase: "REVEAL",
    deadline: null,
    rolls: [...state.rolls, rng.int(1, 1000)],
  }),
  isFinished: (state) => state.phase === "RESULTS",
  result: () => ({ scores: {}, winner: null, summary: "" }),
};

const start = (seed = 1) =>
  startGame(game, { playerIds: ["a", "b"], seed, now: 0 });

const moveTo = (phase: string, session = start()) => {
  const result = applyAction(game, session, "a", phase, 0);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

describe("phase checks", () => {
  it.each([
    ["PRIVATE_INPUT", "REVEAL"],
    ["PRIVATE_INPUT", "SCORE"],
    ["PRIVATE_INPUT", "RESULTS"],
    ["NEXT_ROUND", "PRIVATE_INPUT"],
    ["SCORE", "NEXT_ROUND"],
  ])("allows %s to %s", (from, to) => {
    const session = {
      ...start(),
      state: { ...start().state, phase: from as Phase },
    };
    expect(moveTo(to, session).state.phase).toBe(to);
  });

  it.each([
    ["REVEAL", "PRIVATE_INPUT"],
    ["SCORE", "REVEAL"],
    ["PRIVATE_INPUT", "LOBBY"],
    ["PRIVATE_INPUT", "REMATCH"],
  ])("rejects %s to %s", (from, to) => {
    const session = {
      ...start(),
      state: { ...start().state, phase: from as Phase },
    };
    expect(() => moveTo(to, session)).toThrow(IllegalPhaseTransitionError);
  });

  it("rejects a game that starts outside a round phase", () => {
    const broken = {
      ...game,
      init: () => ({ phase: "LOBBY" as Phase, deadline: null, rolls: [] }),
    };
    expect(() =>
      startGame(broken, { playerIds: ["a", "b"], seed: 1, now: 0 }),
    ).toThrow(IllegalPhaseTransitionError);
  });
});

describe("actions", () => {
  it("leaves the session unchanged when input is rejected", () => {
    const session = start();
    expect(applyAction(game, session, "a", 42, 0).ok).toBe(false);
    expect(applyAction(game, session, "a", "reject", 0).ok).toBe(false);
    expect(moveTo("REVEAL", session).step).toBe(session.step + 1);
    expect(session.step).toBe(1);
  });

  it("rejects actions once the game has finished", () => {
    const result = applyAction(game, moveTo("RESULTS"), "a", "REVEAL", 0);
    expect(result).toMatchObject({
      ok: false,
      error: { code: "GAME_FINISHED" },
    });
  });
});

describe("timeouts", () => {
  it("does nothing before the deadline", () => {
    const session = start();
    expect(applyTimeout(game, session, 99)).toBe(session);
  });

  it("advances at the deadline", () => {
    expect(applyTimeout(game, start(), 100).state.phase).toBe("REVEAL");
  });

  it("ignores a timer when there is no deadline", () => {
    const session = applyTimeout(game, start(), 100);
    expect(applyTimeout(game, session, 200)).toBe(session);
  });
});

describe("determinism", () => {
  const play = (seed: number) =>
    applyTimeout(
      game,
      moveTo(
        "NEXT_ROUND",
        moveTo("PRIVATE_INPUT", moveTo("NEXT_ROUND", start(seed))),
      ),
      100,
    );

  it("replays identically with the same seed and actions", () => {
    expect(play(7)).toEqual(play(7));
  });

  it("gives different numbers for a different seed", () => {
    expect(play(7).state.rolls).not.toEqual(play(8).state.rolls);
  });

  it("gives different numbers at each step", () => {
    const { rolls } = play(7).state;
    expect(new Set(rolls).size).toBeGreaterThan(1);
  });

  it("survives saving and restoring as JSON", () => {
    const saved = JSON.parse(JSON.stringify(moveTo("NEXT_ROUND", start(7))));
    const continued = moveTo("PRIVATE_INPUT", saved);
    const direct = moveTo("PRIVATE_INPUT", moveTo("NEXT_ROUND", start(7)));
    expect(continued).toEqual(direct);
  });
});
