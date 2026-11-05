import {
  applyAction,
  applyTimeout,
  startGame,
  type GameSession,
  type Phase,
} from "@twinthreads/engine";
import { describe, expect, it } from "vitest";
import { numberDuel, type NumberDuelState } from "../src/index.js";

const start = (seed = 1, now = 0) =>
  startGame(numberDuel, { playerIds: ["a", "b"], seed, now });

const pick = (
  session: GameSession<NumberDuelState>,
  playerId: string,
  value: number,
  now = 0,
) => {
  const result = applyAction(
    numberDuel,
    session,
    playerId,
    { type: "pick", payload: { value } },
    now,
  );
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
};

const errorCode = (
  session: GameSession<NumberDuelState>,
  playerId: string,
  input: unknown,
) => {
  const result = applyAction(numberDuel, session, playerId, input, 0);
  return result.ok ? null : result.error.code;
};

const tick = (session: GameSession<NumberDuelState>) => {
  const deadline = session.state.deadline;
  if (deadline === null) throw new Error("No deadline");
  return applyTimeout(numberDuel, session, deadline);
};

describe("picking", () => {
  it.each([
    [{ type: "pick", payload: { value: 0 } }],
    [{ type: "pick", payload: { value: 6 } }],
    [{ type: "pick", payload: { value: 2.5 } }],
    [{ type: "pick", payload: { value: "3" } }],
    [{ type: "other", payload: { value: 3 } }],
    [{ type: "pick" }],
    [null],
    ["pick"],
  ])("rejects %j", (input) => {
    expect(errorCode(start(), "a", input)).toBe("BAD_ACTION");
  });

  it("rejects a second pick and a non-player", () => {
    const action = { type: "pick", payload: { value: 2 } };
    expect(errorCode(pick(start(), "a", 1), "a", action)).toBe(
      "ALREADY_PICKED",
    );
    expect(errorCode(start(), "z", action)).toBe("NOT_A_PLAYER");
  });

  it("rejects picks outside the input phase", () => {
    const revealed = pick(pick(start(), "a", 1), "b", 2);
    expect(revealed.state.phase).toBe("REVEAL");
    expect(
      errorCode(revealed, "a", { type: "pick", payload: { value: 3 } }),
    ).toBe("WRONG_PHASE");
  });
});

describe("secrets", () => {
  it("hides the partner's pick until REVEAL", () => {
    const session = pick(start(), "a", 4);
    const view = numberDuel.view(session.state, "b");
    expect(view.partnerPick).toBeNull();
    expect(view.partnerHasPicked).toBe(true);
    expect(view.target).toBeNull();
    expect(JSON.stringify(view)).not.toContain("4");
    expect(numberDuel.view(session.state, "a").myPick).toBe(4);
  });

  it("shows both picks and the target from REVEAL on", () => {
    const session = pick(pick(start(), "a", 4), "b", 2);
    const view = numberDuel.view(session.state, "b");
    expect(view.partnerPick).toBe(4);
    expect(view.myPick).toBe(2);
    expect(view.target).toEqual(expect.any(Number));
  });
});

describe("timers", () => {
  it("moves on when nobody picks, and nobody scores", () => {
    const revealed = tick(start());
    expect(revealed.state.phase).toBe("REVEAL");
    const scored = tick(revealed);
    expect(scored.state.scores).toEqual({ a: 0, b: 0 });
  });

  it("gives the point to the only player who picked", () => {
    const scored = tick(tick(pick(start(), "a", 3)));
    expect(scored.state.scores).toEqual({ a: 1, b: 0 });
  });

  it("gives both players a point on a tie", () => {
    const scored = tick(pick(pick(start(), "a", 3), "b", 3));
    expect(scored.state.scores).toEqual({ a: 1, b: 1 });
  });
});

describe("full game", () => {
  const play = (seed: number) => {
    const phases: Phase[] = [];
    let session = start(seed);
    while (session.state.phase !== "RESULTS") {
      phases.push(session.state.phase);
      session =
        session.state.phase === "PRIVATE_INPUT"
          ? pick(pick(session, "a", 1), "b", 5)
          : tick(session);
    }
    return { session, phases };
  };

  it("goes through every game phase for three rounds, then results", () => {
    const { phases, session } = play(3);
    const round = ["PRIVATE_INPUT", "REVEAL", "SCORE"];
    expect(phases).toEqual([
      ...round,
      "NEXT_ROUND",
      ...round,
      "NEXT_ROUND",
      ...round,
    ]);
    expect(session.state.round).toBe(3);
    expect(numberDuel.isFinished(session.state)).toBe(true);
    expect(session.state.deadline).toBeNull();
  });

  it("replays identically from the same seed", () => {
    expect(play(9).session).toEqual(play(9).session);
  });

  it("reports the winner, or a draw", () => {
    const { session } = play(3);
    const { a = 0, b = 0 } = session.state.scores;
    const result = numberDuel.result(session.state);
    expect(result.scores).toEqual(session.state.scores);
    expect(result.winner).toBe(a === b ? null : a > b ? "a" : "b");
  });
});
