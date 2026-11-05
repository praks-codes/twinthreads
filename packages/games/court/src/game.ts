import type {
  GameDefinition,
  GameEffect,
  GameError,
  GameResult,
  Phase,
  PlayerId,
  Result,
  Rng,
} from "@twinthreads/engine";
import {
  BRIBES,
  CROWDS,
  EMOTES,
  EXAMPLE_DEFENSES,
  FALLBACK,
  JUDGES,
  JUDGE_MOODS,
  MOODS,
  OBJECTION_GROUNDS,
  READY_ACCUSATIONS,
  WITNESSES,
  type Crowd,
  type JudgeId,
  type JudgeMood,
  type Mood,
} from "./content.js";

export const COURT_GAME_ID = "court";
export const TOTAL_CASES = 3;
export const MAX_STATEMENT = 140;
export const MAX_CAPTION = 60;
export const OBJECTIONS_PER_GAME = 3;
export const MOVE_TURNS = 4;
export const CANVAS_WIDTH = 340;
export const CANVAS_HEIGHT = 150;
const MAX_STROKE_NUMBERS = 1200;
const MAX_TAPS_PER_MESSAGE = 20;
const MAX_METER_STEP = 12;
const OBJECTION_STEP = 6;
const CLOSE_CASE_MARGIN = 15;
const VERDICT_METER = 42;

export interface CourtTimings {
  setupMs: number;
  writeMs: number;
  moveMs: number;
  showMs: number;
  objectionMs: number;
  answerMs: number;
  closingLeadMs: number;
  closingTapMs: number;
  sealMs: number;
  verdictMs: number;
  mercyMs: number;
  aftermathMs: number;
  caseFileMs: number;
}

export const DEFAULT_TIMINGS: CourtTimings = {
  setupMs: 60_000,
  writeMs: 90_000,
  moveMs: 60_000,
  showMs: 20_000,
  objectionMs: 45_000,
  answerMs: 45_000,
  closingLeadMs: 3_000,
  closingTapMs: 6_000,
  sealMs: 20_000,
  verdictMs: 8_000,
  mercyMs: 30_000,
  aftermathMs: 15_000,
  caseFileMs: 60_000,
};

export type Stage =
  | "setup"
  | "accuse"
  | "defend"
  | "hearing"
  | "moves"
  | "moveReact"
  | "objection"
  | "ruling"
  | "crossExam"
  | "crossReact"
  | "closing"
  | "deliberating"
  | "sealed"
  | "verdict"
  | "punishment"
  | "aftermath"
  | "caseFile"
  | "finished";

const STAGE_PHASE: Record<Stage, Phase> = {
  setup: "PRIVATE_INPUT",
  accuse: "PRIVATE_INPUT",
  defend: "PRIVATE_INPUT",
  hearing: "PRIVATE_INPUT",
  moves: "PRIVATE_INPUT",
  moveReact: "PRIVATE_INPUT",
  objection: "PRIVATE_INPUT",
  ruling: "PRIVATE_INPUT",
  crossExam: "PRIVATE_INPUT",
  crossReact: "PRIVATE_INPUT",
  closing: "PRIVATE_INPUT",
  deliberating: "REVEAL",
  sealed: "REVEAL",
  verdict: "REVEAL",
  punishment: "SCORE",
  aftermath: "SCORE",
  caseFile: "NEXT_ROUND",
  finished: "RESULTS",
};

export type MoveKind = "evidence" | "witness" | "bribe";

export interface Reaction {
  line: string;
  crowd: Crowd;
  judgeMood: JudgeMood;
}

export interface MoveRecord {
  by: PlayerId;
  kind: MoveKind;
  option: number;
  caption: string;
  strokes: number[][];
  says: string;
}

export interface Suggestion {
  style: string;
  text: string;
}

export interface VerdictRecord {
  guilty: boolean;
  winner: PlayerId;
  loser: PlayerId;
  line: string;
  punishment: string;
  headline: string;
}

export interface CaseRecord {
  caseNumber: number;
  prosecutor: PlayerId;
  defendant: PlayerId;
  accusation: string;
  defense: string;
  headline: string;
  quote: string;
  guilty: boolean | null;
  punishment: string | null;
  ending: "pardoned" | "punished" | "dismissed";
  meterForPlayerOne: number;
  exhibit: MoveRecord | null;
}

export interface CourtState {
  playerIds: [PlayerId, PlayerId];
  stage: Stage;
  deadline: number | null;
  caseNumber: number;
  judge: JudgeId;
  crossExamOn: boolean;
  scores: Record<PlayerId, number>;
  objectionsLeft: Record<PlayerId, number>;
  /** 0 to 100, and above 50 favours this case's prosecutor. */
  meter: number;
  accusation: string | null;
  defense: string | null;
  autoPicked: boolean;
  lawyerStatus: "idle" | "pending" | "ready";
  lawyerSuggestions: Suggestion[];
  turn: number;
  usedMoves: Record<PlayerId, MoveKind[]>;
  moveLog: MoveRecord[];
  currentMove: MoveRecord | null;
  reaction: Reaction | null;
  moods: Record<PlayerId, Mood>;
  objection: {
    by: PlayerId;
    ground: number;
    argument: string;
    returnTo: "hearing" | "moveReact" | "crossReact";
    sustained: boolean | null;
    reaction: Reaction | null;
  } | null;
  objectionCount: number;
  crossQuestion: string | null;
  crossAnswer: string | null;
  taps: Record<PlayerId, number>;
  verdict: VerdictRecord | null;
  ending: CaseRecord["ending"] | null;
  take: number | null;
  transcript: string[];
  cases: CaseRecord[];
  emotes: Record<PlayerId, { emoji: string; count: number }>;
  continueVotes: PlayerId[];
  effectCounter: number;
  pending: GameEffect[];
}

export type CourtAction =
  | { type: "setup"; payload: { judge?: JudgeId; crossExam?: boolean } }
  | { type: "continue"; payload: Record<string, never> }
  | { type: "accuse"; payload: { text: string } }
  | { type: "defend"; payload: { text: string } }
  | { type: "askLawyer"; payload: Record<string, never> }
  | {
      type: "move";
      payload: {
        kind: MoveKind;
        option: number;
        caption: string;
        strokes: number[][];
      };
    }
  | { type: "pass"; payload: Record<string, never> }
  | { type: "object"; payload: Record<string, never> }
  | { type: "argue"; payload: { ground: number; argument: string } }
  | { type: "answer"; payload: { text: string } }
  | { type: "tap"; payload: { count: number } }
  | { type: "breakSeal"; payload: Record<string, never> }
  | { type: "mercy"; payload: { pardon: boolean } }
  | { type: "take"; payload: { option: number } }
  | { type: "emote"; payload: { emoji: string } };

export interface CourtView {
  stage: Stage;
  caseNumber: number;
  totalCases: number;
  playerIds: [PlayerId, PlayerId];
  prosecutor: PlayerId;
  defendant: PlayerId;
  judge: JudgeId;
  crossExamOn: boolean;
  scores: Record<PlayerId, number>;
  myObjections: number;
  canObject: boolean;
  canContinue: boolean;
  haveContinued: boolean;
  /** 0 to 100, and above 50 favours playerIds[0]. */
  meter: number;
  accusation: string | null;
  defense: string | null;
  autoPicked: boolean;
  lawyerStatus: CourtState["lawyerStatus"];
  lawyerSuggestions: Suggestion[];
  turn: number;
  mover: PlayerId | null;
  myUsedMoves: MoveKind[];
  currentMove: MoveRecord | null;
  reaction: Reaction | null;
  moods: Record<PlayerId, Mood>;
  objection: CourtState["objection"];
  crossQuestion: string | null;
  crossAnswer: string | null;
  taps: Record<PlayerId, number>;
  tapWindowMs: number;
  verdict: VerdictRecord | null;
  ending: CourtState["ending"];
  take: number | null;
  latestCase: CaseRecord | null;
  emotes: CourtState["emotes"];
  /** True while the AI is working on something this stage is waiting for. */
  judgeThinking: boolean;
}

const rejected = (
  code: string,
  message: string,
): { ok: false; error: GameError } => ({
  ok: false,
  error: { code, message },
});

const WRONG_TIME = () =>
  rejected("WRONG_STAGE", "That can't be done right now.");
const NOT_YOURS = () => rejected("NOT_YOUR_TURN", "It isn't your turn.");

const prosecutorOf = (state: CourtState): PlayerId =>
  state.playerIds[(state.caseNumber - 1) % 2] as PlayerId;
const defendantOf = (state: CourtState): PlayerId =>
  state.playerIds[state.caseNumber % 2] as PlayerId;
const otherPlayer = (state: CourtState, playerId: PlayerId): PlayerId =>
  state.playerIds[0] === playerId ? state.playerIds[1] : state.playerIds[0];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const pick = <T>(items: readonly T[], rng: Rng): T =>
  items[rng.int(0, items.length - 1)] as T;

const SERIOUS =
  /\b(abus\w*|hit(s|ting)? me|cheat(s|ed|ing)? on|affair|divorce|rap(e|ed)|suicid\w*|kill (myself|me)|violen\w*)\b/i;

/** Text that's safe to store: no control characters, within the limit. */
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length === 0 || text.length > max ? null : text;
}

const bumpMeter = (state: CourtState, helpsProsecutor: number) =>
  clamp(state.meter + helpsProsecutor, 0, 100);

function addEffect(
  state: CourtState,
  kind: string,
  input: unknown,
): CourtState {
  const effectCounter = state.effectCounter + 1;
  return {
    ...state,
    effectCounter,
    pending: [
      ...state.pending,
      { id: `${kind}-${effectCounter}`, kind, input },
    ],
  };
}

const names = (state: CourtState) => ({
  judge: state.judge,
  caseNumber: state.caseNumber,
});

function toStage(
  state: CourtState,
  stage: Stage,
  deadline: number | null,
): CourtState {
  return { ...state, stage, deadline, continueVotes: [] };
}

function neutralMoods(state: CourtState): Record<PlayerId, Mood> {
  const [a, b] = state.playerIds;
  return { [a]: "neutral", [b]: "neutral" };
}

function closeCase(
  state: CourtState,
  now: number,
  timings: CourtTimings,
  ending: CaseRecord["ending"],
): CourtState {
  const meter = meterForPlayerOne(state);
  const record: CaseRecord = {
    caseNumber: state.caseNumber,
    prosecutor: prosecutorOf(state),
    defendant: defendantOf(state),
    accusation: state.accusation ?? "",
    defense: state.defense ?? "",
    headline: state.verdict?.headline ?? "Case Dismissed With Love",
    quote: state.verdict?.line ?? FALLBACK.dismissed,
    guilty: state.verdict?.guilty ?? null,
    punishment: state.verdict?.punishment ?? null,
    ending,
    meterForPlayerOne: meter,
    exhibit: state.moveLog.find((move) => move.kind === "evidence") ?? null,
  };
  return toStage(
    { ...state, ending, cases: [...state.cases, record] },
    "caseFile",
    now + timings.caseFileMs,
  );
}

function meterForPlayerOne(state: CourtState): number {
  return prosecutorOf(state) === state.playerIds[0]
    ? state.meter
    : 100 - state.meter;
}

function startHearing(
  state: CourtState,
  now: number,
  timings: CourtTimings,
): CourtState {
  const text = `${state.accusation ?? ""} ${state.defense ?? ""}`;
  // Checked here as well as by the AI, so it still holds if the AI is down.
  if (SERIOUS.test(text)) {
    return closeCase(
      {
        ...state,
        reaction: {
          line: FALLBACK.dismissed,
          crowd: "aww",
          judgeMood: "pleased",
        },
      },
      now,
      timings,
      "dismissed",
    );
  }
  return addEffect(toStage(state, "hearing", null), "hearing", {
    ...names(state),
    accusation: state.accusation,
    defense: state.defense,
  });
}

function startMoveTurn(
  state: CourtState,
  now: number,
  timings: CourtTimings,
): CourtState {
  if (state.turn >= MOVE_TURNS) return afterMoves(state, now, timings);
  return toStage(
    { ...state, currentMove: null, reaction: null },
    "moves",
    now + timings.moveMs,
  );
}

function afterMoves(
  state: CourtState,
  now: number,
  timings: CourtTimings,
): CourtState {
  if (!state.crossExamOn) return startClosing(state, now, timings);
  return addEffect(
    toStage(
      {
        ...state,
        currentMove: null,
        reaction: null,
        crossQuestion: null,
        crossAnswer: null,
        lawyerStatus: "idle",
        lawyerSuggestions: [],
      },
      "crossExam",
      null,
    ),
    "crossQuestion",
    { ...names(state), accusation: state.accusation, defense: state.defense },
  );
}

function startClosing(
  state: CourtState,
  now: number,
  timings: CourtTimings,
): CourtState {
  const [a, b] = state.playerIds;
  return toStage(
    { ...state, reaction: null, taps: { [a]: 0, [b]: 0 } },
    "closing",
    now + timings.closingLeadMs + timings.closingTapMs,
  );
}

function startDeliberating(state: CourtState): CourtState {
  const prosecutorTaps = state.taps[prosecutorOf(state)] ?? 0;
  const defendantTaps = state.taps[defendantOf(state)] ?? 0;
  const meter = bumpMeter(
    state,
    clamp(
      Math.round((prosecutorTaps - defendantTaps) / 2),
      -MAX_METER_STEP,
      MAX_METER_STEP,
    ),
  );
  const next = { ...state, meter };
  return addEffect(toStage(next, "deliberating", null), "verdict", {
    ...names(state),
    meter,
    accusation: state.accusation,
    defense: state.defense,
    transcript: state.transcript,
  });
}

function startNextCase(
  state: CourtState,
  now: number,
  timings: CourtTimings,
): CourtState {
  if (state.caseNumber >= TOTAL_CASES) {
    return toStage(state, "finished", null);
  }
  const [a, b] = state.playerIds;
  const next: CourtState = {
    ...state,
    caseNumber: state.caseNumber + 1,
    meter: 50,
    accusation: null,
    defense: null,
    autoPicked: false,
    lawyerStatus: "idle",
    lawyerSuggestions: [],
    turn: 0,
    usedMoves: { [a]: [], [b]: [] },
    moveLog: [],
    currentMove: null,
    reaction: null,
    moods: neutralMoods(state),
    objection: null,
    objectionCount: 0,
    crossQuestion: null,
    crossAnswer: null,
    taps: { [a]: 0, [b]: 0 },
    verdict: null,
    ending: null,
    take: null,
    transcript: [],
    pending: [],
  };
  return toStage(next, "accuse", now + timings.writeMs);
}

// Moves a stage that's only showing something on to whatever comes next.
function advance(
  state: CourtState,
  now: number,
  timings: CourtTimings,
): CourtState {
  switch (state.stage) {
    case "setup":
      return toStage(state, "accuse", now + timings.writeMs);
    case "hearing":
      return startMoveTurn(state, now, timings);
    case "moveReact":
      return startMoveTurn({ ...state, turn: state.turn + 1 }, now, timings);
    case "ruling": {
      const returnTo = state.objection?.returnTo ?? "hearing";
      return toStage(
        { ...state, objection: null },
        returnTo,
        now + timings.showMs,
      );
    }
    case "crossReact":
      return startClosing(state, now, timings);
    case "sealed":
      return toStage(state, "verdict", now + timings.verdictMs);
    case "verdict":
      return toStage(state, "punishment", now + timings.mercyMs);
    case "aftermath":
      return closeCase(state, now, timings, state.ending ?? "punished");
    case "caseFile":
      return startNextCase(state, now, timings);
    default:
      return state;
  }
}

function applyMercy(
  state: CourtState,
  pardon: boolean,
  now: number,
  timings: CourtTimings,
): CourtState {
  const { verdict } = state;
  if (!verdict) return state;
  const moods: Record<PlayerId, Mood> = pardon
    ? { [verdict.winner]: "love", [verdict.loser]: "love" }
    : { [verdict.winner]: "smug", [verdict.loser]: "cry" };
  return toStage(
    {
      ...state,
      ending: pardon ? "pardoned" : "punished",
      moods,
      reaction: {
        line: pardon
          ? "Disgusting. Case closed."
          : "So be it. Justice is cold.",
        crowd: pardon ? "aww" : "boo",
        judgeMood: pardon ? "pleased" : "stern",
      },
    },
    "aftermath",
    now + timings.aftermathMs,
  );
}

const CONTINUE_STAGES: readonly Stage[] = [
  "setup",
  "hearing",
  "moveReact",
  "ruling",
  "crossReact",
  "verdict",
  "aftermath",
  "caseFile",
];

function canObject(state: CourtState, playerId: PlayerId): boolean {
  if ((state.objectionsLeft[playerId] ?? 0) <= 0 || state.deadline === null) {
    return false;
  }
  if (state.stage === "hearing") return true;
  if (state.stage === "moveReact") return state.currentMove?.by !== playerId;
  if (state.stage === "crossReact") return prosecutorOf(state) === playerId;
  return false;
}

function asObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

const isOption = (value: unknown, count: number): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value < count;

function parseStrokes(value: unknown): number[][] | null {
  if (!Array.isArray(value)) return null;
  let total = 0;
  for (const stroke of value) {
    if (!Array.isArray(stroke) || stroke.length % 2 !== 0) return null;
    total += stroke.length;
    if (total > MAX_STROKE_NUMBERS) return null;
    for (const [index, number] of stroke.entries()) {
      const limit = index % 2 === 0 ? CANVAS_WIDTH : CANVAS_HEIGHT;
      if (
        typeof number !== "number" ||
        !Number.isInteger(number) ||
        number < 0 ||
        number > limit
      ) {
        return null;
      }
    }
  }
  return value as number[][];
}

function parseCourtAction(input: unknown): Result<CourtAction, GameError> {
  const { type, payload: rawPayload } = asObject(input);
  const payload = asObject(rawPayload);
  const bad = rejected("BAD_ACTION", "Check that and try again.");
  const ok = (value: CourtAction) => ({ ok: true as const, value });

  switch (type) {
    case "continue":
    case "askLawyer":
    case "pass":
    case "object":
    case "breakSeal":
      return ok({ type, payload: {} });
    case "setup": {
      const { judge, crossExam } = payload;
      if (judge !== undefined && !(String(judge) in JUDGES)) return bad;
      if (crossExam !== undefined && typeof crossExam !== "boolean") return bad;
      return ok({
        type,
        payload: {
          ...(judge === undefined ? {} : { judge: judge as JudgeId }),
          ...(crossExam === undefined ? {} : { crossExam }),
        },
      });
    }
    case "accuse":
    case "defend":
    case "answer": {
      const text = cleanText(payload.text, MAX_STATEMENT);
      return text === null
        ? rejected("BAD_TEXT", `Write 1 to ${MAX_STATEMENT} characters.`)
        : ok({ type, payload: { text } });
    }
    case "move": {
      const { kind, option } = payload;
      const strokes = parseStrokes(payload.strokes ?? []);
      const caption =
        payload.caption === undefined || payload.caption === ""
          ? ""
          : cleanText(payload.caption, MAX_CAPTION);
      if (strokes === null || caption === null) return bad;
      if (kind === "evidence") {
        return ok({
          type,
          payload: { kind, option: 0, caption, strokes },
        });
      }
      if (
        (kind === "witness" && isOption(option, WITNESSES.length)) ||
        (kind === "bribe" && isOption(option, BRIBES.length))
      ) {
        return ok({
          type,
          payload: { kind, option, caption: "", strokes: [] },
        });
      }
      return bad;
    }
    case "argue": {
      const argument = cleanText(payload.argument, MAX_STATEMENT);
      if (
        argument === null ||
        !isOption(payload.ground, OBJECTION_GROUNDS.length)
      ) {
        return rejected("BAD_TEXT", "Pick your grounds and argue them.");
      }
      return ok({ type, payload: { ground: payload.ground, argument } });
    }
    case "tap":
      return isOption(payload.count, MAX_TAPS_PER_MESSAGE + 1)
        ? ok({ type, payload: { count: payload.count } })
        : bad;
    case "mercy":
      return typeof payload.pardon === "boolean"
        ? ok({ type, payload: { pardon: payload.pardon } })
        : bad;
    case "take":
      return isOption(payload.option, 2)
        ? ok({ type, payload: { option: payload.option } })
        : bad;
    case "emote":
      return typeof payload.emoji === "string" && EMOTES.includes(payload.emoji)
        ? ok({ type, payload: { emoji: payload.emoji } })
        : bad;
    default:
      return bad;
  }
}

/** The AI's reply is untrusted. Null means "use the backup lines instead". */
export function parseReaction(output: unknown): {
  line: string;
  score: number;
  crowd: Crowd;
  judgeMood: JudgeMood;
  prosecutorMood: Mood;
  defendantMood: Mood;
  serious: boolean;
} | null {
  const raw = asObject(output);
  const line = cleanText(raw.line, 240);
  if (line === null) return null;
  const score = typeof raw.score === "number" ? raw.score : 0;
  const oneOf = <T extends string>(
    value: unknown,
    allowed: readonly T[],
    backup: T,
  ) => (allowed.includes(value as T) ? (value as T) : backup);
  return {
    line,
    score: Number.isFinite(score)
      ? clamp(Math.round(score), -MAX_METER_STEP, MAX_METER_STEP)
      : 0,
    crowd: oneOf(raw.crowd, CROWDS, "gasp"),
    judgeMood: oneOf(raw.judgeMood, JUDGE_MOODS, "stern"),
    prosecutorMood: oneOf(raw.prosecutorMood, MOODS, "neutral"),
    defendantMood: oneOf(raw.defendantMood, MOODS, "neutral"),
    serious: raw.serious === true,
  };
}

function withoutEffect(state: CourtState, id: string): CourtState {
  return { ...state, pending: state.pending.filter((e) => e.id !== id) };
}

function setMoods(
  state: CourtState,
  prosecutorMood: Mood,
  defendantMood: Mood,
): Record<PlayerId, Mood> {
  return {
    [prosecutorOf(state)]: prosecutorMood,
    [defendantOf(state)]: defendantMood,
  };
}

function applyEffectOutput(
  state: CourtState,
  effect: GameEffect,
  output: unknown,
  now: number,
  rng: Rng,
  timings: CourtTimings,
): CourtState {
  const reaction = parseReaction(output);
  const raw = asObject(output);

  switch (effect.kind) {
    case "lawyer": {
      const suggestions = (
        Array.isArray(raw.suggestions) ? raw.suggestions : []
      )
        .map((entry: unknown) => {
          const item = asObject(entry);
          const text = cleanText(item.text, MAX_STATEMENT);
          return text === null
            ? null
            : { style: cleanText(item.style, 24) ?? "Lawyer", text };
        })
        .filter((item): item is Suggestion => item !== null)
        .slice(0, 3);
      return {
        ...state,
        lawyerStatus: "ready",
        lawyerSuggestions:
          suggestions.length > 0 ? suggestions : [...FALLBACK.lawyer],
      };
    }
    case "hearing": {
      if (reaction?.serious) {
        return closeCase(
          {
            ...state,
            reaction: {
              line: reaction.line,
              crowd: "aww",
              judgeMood: "pleased",
            },
          },
          now,
          timings,
          "dismissed",
        );
      }
      const line = reaction?.line ?? pick(FALLBACK.hearing, rng);
      return toStage(
        {
          ...state,
          meter: bumpMeter(state, reaction?.score ?? 0),
          moods: reaction
            ? setMoods(state, reaction.prosecutorMood, reaction.defendantMood)
            : setMoods(state, "smug", "nervous"),
          reaction: {
            line,
            crowd: reaction?.crowd ?? "gasp",
            judgeMood: reaction?.judgeMood ?? JUDGES[state.judge].mood,
          },
          transcript: [...state.transcript, `Judge on the opening: ${line}`],
        },
        "hearing",
        now + timings.showMs,
      );
    }
    case "move": {
      const move = state.currentMove;
      if (!move) return state;
      const backup = moveBackup(move);
      const line = reaction?.line ?? backup.line;
      const score = reaction?.score ?? backup.delta;
      const says = cleanText(raw.says, 200) ?? move.says;
      const helpsProsecutor = move.by === prosecutorOf(state) ? score : -score;
      return toStage(
        {
          ...state,
          meter: bumpMeter(state, helpsProsecutor),
          currentMove: { ...move, says },
          moveLog: state.moveLog.map((m) => (m === move ? { ...m, says } : m)),
          moods: reaction
            ? setMoods(state, reaction.prosecutorMood, reaction.defendantMood)
            : state.moods,
          reaction: {
            line,
            crowd: reaction?.crowd ?? backup.crowd,
            judgeMood: reaction?.judgeMood ?? "stern",
          },
          transcript: [
            ...state.transcript,
            `${move.by === prosecutorOf(state) ? "Prosecutor" : "Defendant"} used ${move.kind}: "${says}". Judge: ${line}`,
          ],
        },
        "moveReact",
        now + timings.showMs,
      );
    }
    case "ruling": {
      const objection = state.objection;
      if (!objection) return state;
      const sustained =
        typeof raw.sustained === "boolean"
          ? raw.sustained
          : objection.argument.length >= 15;
      const step = sustained ? OBJECTION_STEP : -OBJECTION_STEP;
      const line =
        reaction?.line ?? (sustained ? FALLBACK.sustained : FALLBACK.overruled);
      return toStage(
        {
          ...state,
          meter: bumpMeter(
            state,
            objection.by === prosecutorOf(state) ? step : -step,
          ),
          moods: reaction
            ? setMoods(state, reaction.prosecutorMood, reaction.defendantMood)
            : state.moods,
          objection: {
            ...objection,
            sustained,
            reaction: {
              line,
              crowd: reaction?.crowd ?? (sustained ? "gasp" : "boo"),
              judgeMood: reaction?.judgeMood ?? "stern",
            },
          },
          transcript: [
            ...state.transcript,
            `Objection (${OBJECTION_GROUNDS[objection.ground] ?? ""}): "${objection.argument}". ${sustained ? "Sustained" : "Overruled"}.`,
          ],
        },
        "ruling",
        now + timings.showMs,
      );
    }
    case "crossQuestion": {
      const question =
        cleanText(raw.question, 200) ?? pick(FALLBACK.crossQuestions, rng);
      return toStage(
        { ...state, crossQuestion: question },
        "crossExam",
        now + timings.answerMs,
      );
    }
    case "crossReact": {
      const line = reaction?.line ?? pick(FALLBACK.crossReact, rng);
      return toStage(
        {
          ...state,
          meter: bumpMeter(state, reaction?.score ?? 0),
          moods: reaction
            ? setMoods(state, reaction.prosecutorMood, reaction.defendantMood)
            : state.moods,
          reaction: {
            line,
            crowd: reaction?.crowd ?? "gasp",
            judgeMood: reaction?.judgeMood ?? "stern",
          },
          transcript: [
            ...state.transcript,
            `Cross-examination. Q: ${state.crossQuestion ?? ""} A: ${state.crossAnswer ?? ""}. Judge: ${line}`,
          ],
        },
        "crossReact",
        now + timings.showMs,
      );
    }
    case "verdict": {
      const lean = state.meter - 50;
      const guilty =
        Math.abs(lean) >= CLOSE_CASE_MARGIN
          ? lean > 0
          : typeof raw.guilty === "boolean"
            ? raw.guilty
            : lean === 0
              ? rng.int(0, 1) === 1
              : lean > 0;
      const winner = guilty ? prosecutorOf(state) : defendantOf(state);
      const loser = otherPlayer(state, winner);
      const verdict: VerdictRecord = {
        guilty,
        winner,
        loser,
        line:
          reaction?.line ??
          pick(guilty ? FALLBACK.guiltyLines : FALLBACK.innocentLines, rng),
        punishment:
          cleanText(raw.punishment, MAX_STATEMENT) ??
          pick(FALLBACK.punishments, rng),
        headline: cleanText(raw.headline, 60) ?? pick(FALLBACK.headlines, rng),
      };
      return toStage(
        {
          ...state,
          verdict,
          // So the meter never shows the loser ahead once the verdict is in.
          meter: guilty
            ? Math.max(state.meter, 100 - VERDICT_METER)
            : Math.min(state.meter, VERDICT_METER),
          scores: {
            ...state.scores,
            [winner]: (state.scores[winner] ?? 0) + 1,
          },
          moods: { [winner]: "laugh", [loser]: "cry" },
          reaction: {
            line: verdict.line,
            crowd: reaction?.crowd ?? (guilty ? "boo" : "aww"),
            judgeMood: reaction?.judgeMood ?? "stern",
          },
        },
        "sealed",
        now + timings.sealMs,
      );
    }
    default:
      return state;
  }
}

function moveBackup(move: MoveRecord): {
  line: string;
  delta: number;
  crowd: Crowd;
} {
  if (move.kind === "witness") {
    const witness = WITNESSES[move.option];
    return {
      line: witness?.line ?? FALLBACK.evidence,
      delta: witness?.delta ?? 0,
      crowd: witness?.crowd ?? "gasp",
    };
  }
  if (move.kind === "bribe") {
    const bribe = BRIBES[move.option];
    return {
      line: bribe?.line ?? FALLBACK.evidence,
      delta: bribe?.delta ?? 0,
      crowd: bribe?.crowd ?? "gasp",
    };
  }
  return { line: FALLBACK.evidence, delta: 5, crowd: "gasp" };
}

function moveSays(move: {
  kind: MoveKind;
  option: number;
  caption: string;
}): string {
  if (move.kind === "witness") return WITNESSES[move.option]?.says ?? "";
  if (move.kind === "bribe") return BRIBES[move.option]?.says ?? "";
  return move.caption || "I present Exhibit A.";
}

export function createCourt(
  timings: CourtTimings = DEFAULT_TIMINGS,
): GameDefinition<CourtState, CourtAction, CourtView> {
  return {
    id: COURT_GAME_ID,
    players: 2,

    init({ playerIds, now }) {
      const [a, b] = playerIds;
      return {
        playerIds,
        stage: "setup",
        deadline: now + timings.setupMs,
        caseNumber: 1,
        judge: "tired",
        crossExamOn: true,
        scores: { [a]: 0, [b]: 0 },
        objectionsLeft: { [a]: OBJECTIONS_PER_GAME, [b]: OBJECTIONS_PER_GAME },
        meter: 50,
        accusation: null,
        defense: null,
        autoPicked: false,
        lawyerStatus: "idle",
        lawyerSuggestions: [],
        turn: 0,
        usedMoves: { [a]: [], [b]: [] },
        moveLog: [],
        currentMove: null,
        reaction: null,
        moods: { [a]: "neutral", [b]: "neutral" },
        objection: null,
        objectionCount: 0,
        crossQuestion: null,
        crossAnswer: null,
        taps: { [a]: 0, [b]: 0 },
        verdict: null,
        ending: null,
        take: null,
        transcript: [],
        cases: [],
        emotes: {},
        continueVotes: [],
        effectCounter: 0,
        pending: [],
      };
    },

    parseAction: parseCourtAction,

    reduce(state, action, { playerId, now }) {
      if (!state.playerIds.includes(playerId)) {
        return rejected("NOT_A_PLAYER", "You aren't in this game.");
      }
      const done = (value: CourtState) => ({ ok: true as const, value });
      const prosecutor = prosecutorOf(state);
      const defendant = defendantOf(state);

      switch (action.type) {
        case "emote": {
          const count = (state.emotes[playerId]?.count ?? 0) + 1;
          return done({
            ...state,
            emotes: {
              ...state.emotes,
              [playerId]: { emoji: action.payload.emoji, count },
            },
          });
        }
        case "setup":
          if (state.stage !== "setup") return WRONG_TIME();
          return done({
            ...state,
            judge: action.payload.judge ?? state.judge,
            crossExamOn: action.payload.crossExam ?? state.crossExamOn,
            continueVotes: [],
          });
        case "continue": {
          if (
            !CONTINUE_STAGES.includes(state.stage) ||
            state.deadline === null
          ) {
            return WRONG_TIME();
          }
          const continueVotes = [
            ...new Set([...state.continueVotes, playerId]),
          ];
          return done(
            continueVotes.length === 2
              ? advance(state, now, timings)
              : { ...state, continueVotes },
          );
        }
        case "accuse":
          if (state.stage !== "accuse") return WRONG_TIME();
          if (playerId !== prosecutor) return NOT_YOURS();
          return done(
            toStage(
              { ...state, accusation: action.payload.text },
              "defend",
              now + timings.writeMs,
            ),
          );
        case "askLawyer": {
          const answering = state.stage === "crossExam";
          if (state.stage !== "defend" && !answering) return WRONG_TIME();
          if (playerId !== defendant) return NOT_YOURS();
          if (state.lawyerStatus !== "idle") return WRONG_TIME();
          if (answering && state.crossQuestion === null) return WRONG_TIME();
          return done(
            addEffect({ ...state, lawyerStatus: "pending" }, "lawyer", {
              ...names(state),
              accusation: state.accusation,
              question: answering ? state.crossQuestion : null,
              defense: answering ? state.defense : null,
            }),
          );
        }
        case "defend":
          if (state.stage !== "defend") return WRONG_TIME();
          if (playerId !== defendant) return NOT_YOURS();
          return done(
            startHearing(
              { ...state, defense: action.payload.text },
              now,
              timings,
            ),
          );
        case "move": {
          if (state.stage !== "moves") return WRONG_TIME();
          const mover = state.turn % 2 === 0 ? prosecutor : defendant;
          if (playerId !== mover) return NOT_YOURS();
          const { kind } = action.payload;
          const used = state.usedMoves[playerId] ?? [];
          if (used.includes(kind)) {
            return rejected("MOVE_USED", "You've used that move in this case.");
          }
          const record: MoveRecord = {
            by: playerId,
            ...action.payload,
            says: moveSays(action.payload),
          };
          const witness =
            kind === "witness" ? WITNESSES[record.option] : undefined;
          return done(
            addEffect(
              toStage(
                {
                  ...state,
                  currentMove: record,
                  moveLog: [...state.moveLog, record],
                  usedMoves: {
                    ...state.usedMoves,
                    [playerId]: [...used, kind],
                  },
                  reaction: null,
                },
                "moveReact",
                null,
              ),
              "move",
              {
                ...names(state),
                accusation: state.accusation,
                defense: state.defense,
                kind,
                moverRole: playerId === prosecutor ? "prosecutor" : "defendant",
                says: record.says,
                hasDrawing: record.strokes.length > 0,
                witness: witness
                  ? { name: witness.name, persona: witness.persona }
                  : null,
                bribe: kind === "bribe" ? BRIBES[record.option]?.name : null,
              },
            ),
          );
        }
        case "pass": {
          if (state.stage !== "moves") return WRONG_TIME();
          const mover = state.turn % 2 === 0 ? prosecutor : defendant;
          if (playerId !== mover) return NOT_YOURS();
          return done(
            startMoveTurn({ ...state, turn: state.turn + 1 }, now, timings),
          );
        }
        case "object": {
          if (!canObject(state, playerId)) return WRONG_TIME();
          return done(
            toStage(
              {
                ...state,
                objectionsLeft: {
                  ...state.objectionsLeft,
                  [playerId]: (state.objectionsLeft[playerId] ?? 0) - 1,
                },
                objectionCount: state.objectionCount + 1,
                objection: {
                  by: playerId,
                  ground: 0,
                  argument: "",
                  returnTo: state.stage as "hearing",
                  sustained: null,
                  reaction: null,
                },
              },
              "objection",
              now + timings.objectionMs,
            ),
          );
        }
        case "argue": {
          const objection = state.objection;
          if (state.stage !== "objection" || !objection) return WRONG_TIME();
          if (playerId !== objection.by) return NOT_YOURS();
          const updated = {
            ...objection,
            ground: action.payload.ground,
            argument: action.payload.argument,
          };
          return done(
            addEffect(
              toStage({ ...state, objection: updated }, "ruling", null),
              "ruling",
              {
                ...names(state),
                accusation: state.accusation,
                defense: state.defense,
                objectorRole:
                  playerId === prosecutor ? "prosecutor" : "defendant",
                ground: OBJECTION_GROUNDS[updated.ground],
                argument: updated.argument,
              },
            ),
          );
        }
        case "answer": {
          if (state.stage !== "crossExam" || state.crossQuestion === null) {
            return WRONG_TIME();
          }
          if (playerId !== defendant) return NOT_YOURS();
          return done(submitAnswer(state, action.payload.text));
        }
        case "tap": {
          if (state.stage !== "closing" || state.deadline === null) {
            return WRONG_TIME();
          }
          // Taps during the countdown don't count.
          if (now < state.deadline - timings.closingTapMs) return done(state);
          return done({
            ...state,
            taps: {
              ...state.taps,
              [playerId]: (state.taps[playerId] ?? 0) + action.payload.count,
            },
          });
        }
        case "breakSeal":
          if (state.stage !== "sealed") return WRONG_TIME();
          return done(advance(state, now, timings));
        case "mercy":
          if (state.stage !== "punishment") return WRONG_TIME();
          if (playerId !== state.verdict?.winner) return NOT_YOURS();
          return done(applyMercy(state, action.payload.pardon, now, timings));
        case "take":
          if (state.stage !== "aftermath" || state.ending !== "punished") {
            return WRONG_TIME();
          }
          if (playerId !== state.verdict?.loser) return NOT_YOURS();
          return done({
            ...state,
            take: action.payload.option,
            moods: {
              ...state.moods,
              [playerId]: action.payload.option === 0 ? "neutral" : "annoyed",
            },
          });
      }
    },

    view(state, playerId): CourtView {
      const prosecutor = prosecutorOf(state);
      const defendant = defendantOf(state);
      const isDefendant = playerId === defendant;
      return {
        stage: state.stage,
        caseNumber: state.caseNumber,
        totalCases: TOTAL_CASES,
        playerIds: state.playerIds,
        prosecutor,
        defendant,
        judge: state.judge,
        crossExamOn: state.crossExamOn,
        scores: state.scores,
        myObjections: state.objectionsLeft[playerId] ?? 0,
        canObject: canObject(state, playerId),
        canContinue:
          CONTINUE_STAGES.includes(state.stage) && state.deadline !== null,
        haveContinued: state.continueVotes.includes(playerId),
        meter: liveMeter(state),
        accusation: state.accusation,
        defense: state.defense,
        autoPicked: state.autoPicked,
        lawyerStatus: isDefendant ? state.lawyerStatus : "idle",
        // A defense idea is private until the defendant actually uses one.
        lawyerSuggestions: isDefendant ? state.lawyerSuggestions : [],
        turn: state.turn,
        mover:
          state.stage === "moves"
            ? state.turn % 2 === 0
              ? prosecutor
              : defendant
            : null,
        myUsedMoves: state.usedMoves[playerId] ?? [],
        currentMove: state.currentMove,
        reaction: state.reaction,
        moods: state.moods,
        objection: state.objection,
        crossQuestion: state.crossQuestion,
        crossAnswer: state.crossAnswer,
        taps: state.taps,
        tapWindowMs: timings.closingTapMs,
        verdict: state.verdict,
        ending: state.ending,
        take: state.take,
        latestCase: state.cases[state.cases.length - 1] ?? null,
        emotes: state.emotes,
        judgeThinking: state.pending.some((effect) => effect.kind !== "lawyer"),
      };
    },

    phase: (state) => STAGE_PHASE[state.stage],
    deadline: (state) => state.deadline,

    onTimeout(state, now, rng) {
      switch (state.stage) {
        case "accuse":
          return toStage(
            {
              ...state,
              accusation: pick(READY_ACCUSATIONS, rng),
              autoPicked: true,
            },
            "defend",
            now + timings.writeMs,
          );
        case "defend":
          return startHearing(
            {
              ...state,
              defense: pick(EXAMPLE_DEFENSES, rng),
              autoPicked: true,
            },
            now,
            timings,
          );
        case "moves":
          return startMoveTurn(
            { ...state, turn: state.turn + 1 },
            now,
            timings,
          );
        case "objection": {
          const objection = state.objection;
          if (!objection) return advance(state, now, timings);
          return toStage(
            {
              ...state,
              meter: bumpMeter(
                state,
                objection.by === prosecutorOf(state)
                  ? -OBJECTION_STEP
                  : OBJECTION_STEP,
              ),
              objection: {
                ...objection,
                sustained: false,
                reaction: {
                  line: FALLBACK.overruled,
                  crowd: "boo",
                  judgeMood: "stern",
                },
              },
            },
            "ruling",
            now + timings.showMs,
          );
        }
        case "crossExam":
          return submitAnswer(state, "...");
        case "closing":
          return startDeliberating(state);
        case "punishment":
          return applyMercy(state, false, now, timings);
        default:
          return advance(state, now, timings);
      }
    },

    isFinished: (state) => state.stage === "finished",

    result(state): GameResult {
      const [a, b] = state.playerIds;
      const scoreA = state.scores[a] ?? 0;
      const scoreB = state.scores[b] ?? 0;
      return {
        scores: state.scores,
        winner: scoreA === scoreB ? null : scoreA > scoreB ? a : b,
        summary: `Final score: ${scoreA} to ${scoreB}, pending appeal.`,
      };
    },

    pendingEffects: (state) => state.pending,

    applyEffect(state, { id, output }, { now, rng }) {
      const effect = state.pending.find((candidate) => candidate.id === id);
      if (!effect) return state;
      return applyEffectOutput(
        withoutEffect(state, id),
        effect,
        output,
        now,
        rng,
        timings,
      );
    },
  };
}

function submitAnswer(state: CourtState, text: string): CourtState {
  return addEffect(
    toStage({ ...state, crossAnswer: text }, "crossReact", null),
    "crossReact",
    {
      ...names(state),
      accusation: state.accusation,
      defense: state.defense,
      question: state.crossQuestion,
      answer: text,
    },
  );
}

/** The closing taps show on the meter as they happen, before they're applied. */
function liveMeter(state: CourtState): number {
  if (state.stage !== "closing") return meterForPlayerOne(state);
  const swing = clamp(
    Math.round(
      ((state.taps[prosecutorOf(state)] ?? 0) -
        (state.taps[defendantOf(state)] ?? 0)) /
        2,
    ),
    -MAX_METER_STEP,
    MAX_METER_STEP,
  );
  const meter = bumpMeter(state, swing);
  return prosecutorOf(state) === state.playerIds[0] ? meter : 100 - meter;
}

export const court = createCourt();
