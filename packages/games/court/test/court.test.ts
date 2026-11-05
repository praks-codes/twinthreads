import {
  applyAction,
  applyEffectResult,
  applyTimeout,
  pendingEffects,
  startGame,
  viewFor,
  type GameSession,
} from "@twinthreads/engine";
import { describe, expect, it } from "vitest";
import {
  cleanText,
  createCourt,
  DEFAULT_TIMINGS,
  parseReaction,
  type CourtState,
} from "../src/index.js";

const game = createCourt();
const A = "player-a";
const B = "player-b";

function begin(): GameSession<CourtState> {
  return startGame(game, { playerIds: [A, B], seed: 7, now: 0 });
}

function act(
  session: GameSession<CourtState>,
  player: string,
  type: string,
  payload: unknown = {},
  now = 1,
): GameSession<CourtState> {
  const result = applyAction(game, session, player, { type, payload }, now);
  if (!result.ok) throw new Error(`${type}: ${result.error.message}`);
  return result.value;
}

function bothContinue(session: GameSession<CourtState>) {
  return act(act(session, A, "continue"), B, "continue");
}

/** Answers every waiting AI request, with null meaning the AI failed. */
function settle(
  session: GameSession<CourtState>,
  output: unknown = null,
  now = 1,
) {
  let current = session;
  for (const { id } of pendingEffects(game, session)) {
    current = applyEffectResult(game, current, { id, output }, now);
  }
  return current;
}

function toHearing(text = "I did it for us.") {
  let session = bothContinue(begin());
  session = act(session, A, "accuse", { text: "Stole the duvet." });
  return act(session, B, "defend", { text });
}

describe("Court setup", () => {
  it("starts on setup, then both players start the first case", () => {
    const session = begin();
    expect(session.state.stage).toBe("setup");
    const once = act(session, A, "continue");
    expect(once.state.stage).toBe("setup");
    expect(act(once, B, "continue").state.stage).toBe("accuse");
  });

  it("lets a player choose the judge and turn off cross-examination", () => {
    const session = act(begin(), B, "setup", {
      judge: "dramatic",
      crossExam: false,
    });
    expect(session.state.judge).toBe("dramatic");
    expect(session.state.crossExamOn).toBe(false);
  });

  it("rejects a judge that doesn't exist", () => {
    const result = applyAction(
      game,
      begin(),
      A,
      { type: "setup", payload: { judge: "toString-ish" } },
      1,
    );
    expect(result.ok).toBe(false);
  });
});

describe("statements", () => {
  it("only lets the prosecutor accuse and the defendant defend", () => {
    const session = bothContinue(begin());
    expect(
      applyAction(
        game,
        session,
        B,
        { type: "accuse", payload: { text: "Nope" } },
        1,
      ).ok,
    ).toBe(false);
    const accused = act(session, A, "accuse", { text: "Stole the duvet." });
    expect(
      applyAction(
        game,
        accused,
        A,
        { type: "defend", payload: { text: "Nope" } },
        1,
      ).ok,
    ).toBe(false);
  });

  it("rejects empty and overlong text", () => {
    const session = bothContinue(begin());
    for (const text of ["   ", "x".repeat(141), 5, null]) {
      const result = applyAction(
        game,
        session,
        A,
        { type: "accuse", payload: { text } },
        1,
      );
      expect(result.ok).toBe(false);
    }
  });

  it("removes control characters from text", () => {
    expect(cleanText("hi\u0000 there\n", 20)).toBe("hi there");
  });

  it("asks the AI to react once both statements are in", () => {
    const session = toHearing();
    expect(session.state.stage).toBe("hearing");
    expect(session.state.deadline).toBeNull();
    expect(pendingEffects(game, session).map((e) => e.kind)).toEqual([
      "hearing",
    ]);
    expect(viewFor(game, session, A).judgeThinking).toBe(true);
  });

  it("picks for a player who runs out of time", () => {
    const session = bothContinue(begin());
    const deadline = session.state.deadline ?? 0;
    const timedOut = applyTimeout(game, session, deadline);
    expect(timedOut.state.accusation).toEqual(expect.any(String));
    expect(timedOut.state.stage).toBe("defend");
  });
});

describe("the AI's replies", () => {
  it("applies a valid reaction to the stage, meter and moods", () => {
    const session = settle(toHearing(), {
      line: "A travesty.",
      score: 8,
      crowd: "boo",
      judgeMood: "shocked",
      prosecutorMood: "smug",
      defendantMood: "cry",
    });
    expect(session.state.reaction).toEqual({
      line: "A travesty.",
      crowd: "boo",
      judgeMood: "shocked",
    });
    expect(session.state.meter).toBe(58);
    expect(session.state.moods[B]).toBe("cry");
    expect(session.state.deadline).not.toBeNull();
  });

  it("uses backup lines when the AI fails, so the game carries on", () => {
    for (const output of [null, "nonsense", { line: 5 }, []]) {
      const session = settle(toHearing(), output);
      expect(session.state.stage).toBe("hearing");
      expect(session.state.reaction?.line).toEqual(expect.any(String));
      expect(session.state.deadline).not.toBeNull();
    }
  });

  it("limits how far one reply can move the meter", () => {
    expect(parseReaction({ line: "Hi", score: 9000 })?.score).toBe(12);
    expect(parseReaction({ line: "Hi", score: -9000 })?.score).toBe(-12);
    expect(parseReaction({ line: "Hi", score: "lots" })?.score).toBe(0);
    expect(parseReaction({ line: "Hi", crowd: "riot" })?.crowd).toBe("gasp");
  });

  it("ignores a late reply for something no longer pending", () => {
    const session = settle(toHearing());
    const late = applyEffectResult(
      game,
      session,
      { id: "hearing-1", output: { line: "Late!" } },
      5,
    );
    expect(late).toBe(session);
  });

  it("dismisses a serious case without asking the AI, or scoring", () => {
    const session = toHearing("You hit me last year.");
    expect(session.state.stage).toBe("caseFile");
    expect(session.state.ending).toBe("dismissed");
    expect(pendingEffects(game, session)).toEqual([]);
    expect(session.state.scores).toEqual({ [A]: 0, [B]: 0 });
  });

  it("dismisses a case the AI marks as serious", () => {
    const session = settle(toHearing(), {
      line: "Please talk to each other.",
      serious: true,
    });
    expect(session.state.ending).toBe("dismissed");
    expect(session.state.cases[0]?.ending).toBe("dismissed");
  });
});

describe("the AI lawyer", () => {
  it("keeps suggestions private to the defendant", () => {
    let session = bothContinue(begin());
    session = act(session, A, "accuse", { text: "Stole the duvet." });
    session = act(session, B, "askLawyer");
    session = settle(session, {
      suggestions: [{ style: "Sincere", text: "Secret idea" }],
    });
    expect(viewFor(game, session, B).lawyerSuggestions[0]?.text).toBe(
      "Secret idea",
    );
    expect(JSON.stringify(viewFor(game, session, A))).not.toContain(
      "Secret idea",
    );
  });

  it("offers backup suggestions when the AI fails", () => {
    let session = bothContinue(begin());
    session = act(session, A, "accuse", { text: "Stole the duvet." });
    session = settle(act(session, B, "askLawyer"), null);
    expect(viewFor(game, session, B).lawyerSuggestions).toHaveLength(3);
  });

  it("hides the defense from the prosecutor until it's filed", () => {
    let session = bothContinue(begin());
    session = act(session, A, "accuse", { text: "Stole the duvet." });
    expect(viewFor(game, session, A).defense).toBeNull();
    session = act(session, B, "defend", { text: "Was asleep." });
    expect(viewFor(game, session, A).defense).toBe("Was asleep.");
  });
});

describe("objections", () => {
  it("makes the objector argue, then returns to the case after a ruling", () => {
    let session = settle(toHearing());
    const before = session.state.meter;
    session = act(session, B, "object");
    expect(session.state.stage).toBe("objection");
    expect(viewFor(game, session, B).objection?.by).toBe(B);
    session = act(session, B, "argue", { ground: 1, argument: "All lies." });
    expect(session.state.stage).toBe("ruling");
    session = settle(session, { line: "Fine.", sustained: true });
    expect(session.state.objection?.sustained).toBe(true);
    expect(session.state.meter).toBe(before - 6);
    session = bothContinue(session);
    expect(session.state.stage).toBe("hearing");
    expect(session.state.objection).toBeNull();
  });

  it("limits a player to three objections", () => {
    let session = settle(toHearing());
    for (let used = 0; used < 3; used++) {
      session = act(session, A, "object");
      session = act(session, A, "argue", { ground: 0, argument: "No." });
      session = bothContinue(settle(session));
    }
    expect(viewFor(game, session, A).canObject).toBe(false);
    expect(applyAction(game, session, A, { type: "object" }, 1).ok).toBe(false);
    expect(viewFor(game, session, B).canObject).toBe(true);
  });

  it("overrules an objection nobody argued in time", () => {
    let session = act(settle(toHearing()), A, "object");
    session = applyTimeout(game, session, session.state.deadline ?? 0);
    expect(session.state.stage).toBe("ruling");
    expect(session.state.objection?.sustained).toBe(false);
  });
});

function toMoves() {
  return bothContinue(settle(toHearing()));
}

describe("moves", () => {
  it("alternates turns and allows each kind of move once per player", () => {
    let session = toMoves();
    expect(viewFor(game, session, A).mover).toBe(A);
    expect(
      applyAction(game, session, B, { type: "pass", payload: {} }, 1).ok,
    ).toBe(false);
    session = act(session, A, "move", { kind: "bribe", option: 2 });
    expect(session.state.stage).toBe("moveReact");
    session = bothContinue(settle(session));
    expect(viewFor(game, session, B).mover).toBe(B);
    session = act(session, B, "pass");
    const again = applyAction(
      game,
      session,
      A,
      { type: "move", payload: { kind: "bribe", option: 0 } },
      1,
    );
    expect(again.ok).toBe(false);
  });

  it("makes a bribe of cash backfire when the AI fails", () => {
    let session = toMoves();
    const before = session.state.meter;
    session = act(session, A, "move", { kind: "bribe", option: 2 });
    session = settle(session);
    expect(session.state.meter).toBeLessThan(before);
  });

  it("shows a drawing to both players, and rejects off-canvas points", () => {
    let session = toMoves();
    const bad = applyAction(
      game,
      session,
      A,
      {
        type: "move",
        payload: { kind: "evidence", strokes: [[9999, 1]], caption: "" },
      },
      1,
    );
    expect(bad.ok).toBe(false);
    session = act(session, A, "move", {
      kind: "evidence",
      strokes: [[1, 2, 3, 4]],
      caption: "Exhibit",
    });
    expect(viewFor(game, session, B).currentMove?.strokes).toEqual([
      [1, 2, 3, 4],
    ]);
  });
});

function toClosing(crossExam = false) {
  let session = begin();
  session = act(session, A, "setup", { crossExam });
  session = bothContinue(session);
  session = act(session, A, "accuse", { text: "Stole the duvet." });
  session = act(session, B, "defend", { text: "Was asleep." });
  session = bothContinue(settle(session));
  for (const player of [A, B, A, B]) session = act(session, player, "pass");
  return session;
}

describe("cross-examination", () => {
  it("is skipped when turned off", () => {
    expect(toClosing(false).state.stage).toBe("closing");
  });

  it("waits for a question, takes an answer, then reacts", () => {
    let session = toClosing(true);
    expect(session.state.stage).toBe("crossExam");
    expect(
      applyAction(
        game,
        session,
        B,
        { type: "answer", payload: { text: "A" } },
        1,
      ).ok,
    ).toBe(false);
    session = settle(session, { question: "Why?" });
    expect(session.state.crossQuestion).toBe("Why?");
    session = act(session, B, "answer", { text: "Because." });
    expect(session.state.stage).toBe("crossReact");
    session = bothContinue(settle(session));
    expect(session.state.stage).toBe("closing");
  });
});

function toDeliberating(tapsFor = A, taps = 20) {
  let session = toClosing();
  const deadline = session.state.deadline ?? 0;
  const tapAt = deadline - DEFAULT_TIMINGS.closingTapMs + 1;
  session = act(session, tapsFor, "tap", { count: taps }, tapAt);
  return applyTimeout(game, session, deadline);
}

describe("closing and the verdict", () => {
  it("ignores taps during the countdown", () => {
    const session = act(toClosing(), A, "tap", { count: 5 }, 1);
    expect(session.state.taps[A]).toBe(0);
  });

  it("moves the meter with taps, and shows them live", () => {
    let session = toClosing();
    const tapAt = (session.state.deadline ?? 0) - 1000;
    session = act(session, A, "tap", { count: 20 }, tapAt);
    expect(viewFor(game, session, A).meter).toBe(60);
    expect(viewFor(game, session, B).meter).toBe(60);
  });

  it("shows the judge deciding while waiting for the verdict", () => {
    const session = toDeliberating();
    expect(session.state.stage).toBe("deliberating");
    expect(viewFor(game, session, A).judgeThinking).toBe(true);
    expect(game.phase(session.state)).toBe("REVEAL");
  });

  it("lets the AI decide a close case, but not a clear one", () => {
    const close = settle(toDeliberating(A, 2), {
      line: "Close call.",
      guilty: false,
    });
    expect(close.state.verdict?.guilty).toBe(false);
    expect(close.state.verdict?.winner).toBe(B);

    let clear = toDeliberating(A, 20);
    clear = {
      ...clear,
      state: { ...clear.state, meter: 90 },
    };
    clear = settle(clear, { line: "Hmm.", guilty: false });
    expect(clear.state.verdict?.guilty).toBe(true);
  });

  it("awards the point, then the winner chooses a kiss or no mercy", () => {
    let session = settle(toDeliberating(), {
      line: "Guilty!",
      guilty: true,
      punishment: "Apologize to the duvet.",
      headline: "Duvet Thief Caught",
    });
    expect(session.state.stage).toBe("sealed");
    expect(session.state.scores[A]).toBe(1);
    session = act(session, B, "breakSeal");
    expect(session.state.stage).toBe("verdict");
    session = bothContinue(session);
    expect(session.state.stage).toBe("punishment");
    expect(
      applyAction(
        game,
        session,
        B,
        { type: "mercy", payload: { pardon: true } },
        1,
      ).ok,
    ).toBe(false);
    session = act(session, A, "mercy", { pardon: true });
    expect(session.state.moods).toEqual({ [A]: "love", [B]: "love" });
    expect(session.state.scores[A]).toBe(1);
    session = bothContinue(session);
    expect(session.state.stage).toBe("caseFile");
    expect(session.state.cases[0]).toMatchObject({
      ending: "pardoned",
      headline: "Duvet Thief Caught",
      punishment: "Apologize to the duvet.",
    });
  });

  it("makes the loser cry when there's no mercy, and lets them respond", () => {
    let session = settle(toDeliberating(), { line: "Guilty!", guilty: true });
    session = act(session, A, "breakSeal");
    session = bothContinue(session);
    session = act(session, A, "mercy", { pardon: false });
    expect(session.state.moods[B]).toBe("cry");
    session = act(session, B, "take", { option: 1 });
    expect(session.state.moods[B]).toBe("annoyed");
    expect(viewFor(game, session, A).take).toBe(1);
  });
});

describe("a full game", () => {
  it("swaps roles each case and finishes after three, on timers alone", () => {
    let session = begin();
    const seen: number[] = [];
    let now = 0;
    for (let step = 0; step < 300 && !game.isFinished(session.state); step++) {
      session = settle(session, null, now);
      if (session.state.stage === "accuse") {
        seen[session.state.caseNumber] ??= 1;
        expect(viewFor(game, session, A).prosecutor).toBe(
          session.state.caseNumber % 2 === 1 ? A : B,
        );
      }
      now = session.state.deadline ?? now;
      session = applyTimeout(game, session, now);
    }
    expect(game.isFinished(session.state)).toBe(true);
    expect(game.phase(session.state)).toBe("RESULTS");
    expect(session.state.cases).toHaveLength(3);
    const { scores } = game.result(session.state);
    expect((scores[A] ?? 0) + (scores[B] ?? 0)).toBe(3);
  });
});
