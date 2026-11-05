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
  CROWDS,
  EMOTES,
  EXAMPLE_DEFENSES,
  FALLBACK,
  JUDGES,
  JUDGE_MOODS,
  MOODS,
  OBJECTION_GROUNDS,
  READY_ACCUSATIONS,
  type Crowd,
  type JudgeId,
  type JudgeMood,
  type Mood,
} from "./content.js";

export const COURT_GAME_ID = "court";
export const TOTAL_CASES = 3;
export const MAX_STATEMENT = 140;
export const OBJECTIONS_PER_GAME = 3;
/** Whose turn each one is. The last is the judge's question to the defendant. */
const TURN_ROLES = [
  "prosecutor",
  "defendant",
  "prosecutor",
  "defendant",
  "defendant",
] as const;
export const TURNS_PER_CASE = TURN_ROLES.length;
const MAX_METER_STEP = 12;
const OBJECTION_STEP = 6;
const CLOSE_CASE_MARGIN = 15;
const VERDICT_METER = 42;
const NOT_CONVERSATION = [
  "Setup",
  "Guilty",
  "Not guilty",
  "Punishment",
  "Mercy",
];
const MAX_HISTORY_CHARS = 8000;

export interface CourtTimings {
  setupMs: number;
  writeMs: number;
  showMs: number;
  objectionMs: number;
  answerMs: number;
  sealMs: number;
  verdictMs: number;
  mercyMs: number;
  aftermathMs: number;
  caseFileMs: number;
}

export const DEFAULT_TIMINGS: CourtTimings = {
  setupMs: 90_000,
  writeMs: 90_000,
  showMs: 20_000,
  objectionMs: 45_000,
  answerMs: 45_000,
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
  | "objection"
  | "ruling"
  | "reply"
  | "replyReact"
  | "crossExam"
  | "crossReact"
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
  objection: "PRIVATE_INPUT",
  ruling: "PRIVATE_INPUT",
  reply: "PRIVATE_INPUT",
  replyReact: "PRIVATE_INPUT",
  crossExam: "PRIVATE_INPUT",
  crossReact: "PRIVATE_INPUT",
  deliberating: "REVEAL",
  sealed: "REVEAL",
  verdict: "REVEAL",
  punishment: "SCORE",
  aftermath: "SCORE",
  caseFile: "NEXT_ROUND",
  finished: "RESULTS",
};

export interface Reaction {
  line: string;
  crowd: Crowd;
  judgeMood: JudgeMood;
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
  /** Everything said in this case. The verdict and punishment are kept apart. */
  conversation: RecordEntry[];
}

/** One line of the court record, which both players can always read back. */
export interface RecordEntry {
  caseNumber: number;
  speaker: PlayerId | "judge";
  label: string;
  text: string;
}

export interface CourtState {
  playerIds: [PlayerId, PlayerId];
  stage: Stage;
  deadline: number | null;
  caseNumber: number;
  judge: JudgeId;
  judgeChoices: Record<PlayerId, JudgeId | null>;
  scores: Record<PlayerId, number>;
  objectionsLeft: Record<PlayerId, number>;
  /** 0 to 100, and above 50 favours this case's prosecutor. */
  meter: number;
  accusation: string | null;
  defense: string | null;
  autoPicked: boolean;
  /** The turn being played, from 1. Past the last one once they're all used. */
  turn: number;
  lastSpeech: { by: PlayerId; text: string } | null;
  lawyerStatus: "idle" | "pending" | "ready";
  lawyerSuggestions: Suggestion[];
  reaction: Reaction | null;
  moods: Record<PlayerId, Mood>;
  objection: {
    by: PlayerId;
    ground: number;
    argument: string;
    returnTo: "hearing" | "replyReact" | "crossReact";
    sustained: boolean | null;
    reaction: Reaction | null;
  } | null;
  objectionCount: number;
  crossQuestion: string | null;
  crossAnswer: string | null;
  verdict: VerdictRecord | null;
  /** Held back until the seal is broken, so nothing gives the verdict away. */
  verdictReaction: Reaction | null;
  ending: CaseRecord["ending"] | null;
  take: number | null;
  record: RecordEntry[];
  cases: CaseRecord[];
  emotes: Record<PlayerId, { emoji: string; count: number }>;
  continueVotes: PlayerId[];
  effectCounter: number;
  pending: GameEffect[];
}

export type CourtAction =
  | { type: "setup"; payload: { judge: JudgeId } }
  | { type: "continue"; payload: Record<string, never> }
  | { type: "accuse"; payload: { text: string } }
  | { type: "defend"; payload: { text: string } }
  | { type: "askLawyer"; payload: Record<string, never> }
  | { type: "object"; payload: Record<string, never> }
  | { type: "argue"; payload: { ground: number; argument: string } }
  | { type: "reply"; payload: { text: string } }
  | { type: "rest"; payload: Record<string, never> }
  | { type: "answer"; payload: { text: string } }
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
  judgeChoices: Record<PlayerId, JudgeId | null>;
  setupAgreed: boolean;
  scores: Record<PlayerId, number>;
  myObjections: number;
  canObject: boolean;
  objectionUsesTurn: boolean;
  canContinue: boolean;
  haveContinued: boolean;
  /** 0 to 100, and above 50 favours playerIds[0]. */
  meter: number;
  accusation: string | null;
  defense: string | null;
  autoPicked: boolean;
  turn: number;
  totalTurns: number;
  turnsLeft: Record<PlayerId, number>;
  /** Whose turn it is to say something, if anyone's. */
  mover: PlayerId | null;
  lastSpeech: CourtState["lastSpeech"];
  lawyerStatus: CourtState["lawyerStatus"];
  lawyerSuggestions: Suggestion[];
  reaction: Reaction | null;
  moods: Record<PlayerId, Mood>;
  objection: CourtState["objection"];
  crossQuestion: string | null;
  crossAnswer: string | null;
  verdict: VerdictRecord | null;
  ending: CourtState["ending"];
  take: number | null;
  latestCase: CaseRecord | null;
  record: RecordEntry[];
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

// Small models can be talked round, so this can't be left to the AI alone.
const GIVES_ORDERS =
  /\b(ignore|forget|disregard)\b.*\b(instructions?|rules?|prompt)\b|\b(your|system) (instructions?|prompt)\b/i;

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
  input: Record<string, unknown>,
): CourtState {
  const effectCounter = state.effectCounter + 1;
  const [a, b] = state.playerIds;
  // Every request gets the whole case, so the judge never answers from one line.
  const context = {
    prosecutor: playerLabel(state, prosecutorOf(state)),
    defendant: playerLabel(state, defendantOf(state)),
    score: `Player 1 has ${state.scores[a] ?? 0}, Player 2 has ${state.scores[b] ?? 0}`,
    history: courtHistory(state),
  };
  return {
    ...state,
    effectCounter,
    pending: [
      ...state.pending,
      {
        id: `${kind}-${effectCounter}`,
        kind,
        input: { ...input, ...context },
      },
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

function note(
  state: CourtState,
  speaker: RecordEntry["speaker"],
  label: string,
  text: string,
): CourtState {
  const entry: RecordEntry = {
    caseNumber: state.caseNumber,
    speaker,
    label,
    text,
  };
  return { ...state, record: [...state.record, entry] };
}

function setupAgreed({ playerIds: [a, b], judgeChoices }: CourtState): boolean {
  return !!judgeChoices[a] && judgeChoices[a] === judgeChoices[b];
}

function turnPlayer(state: CourtState, turn: number): PlayerId | null {
  const role = TURN_ROLES[turn - 1];
  if (!role) return null;
  return role === "prosecutor" ? prosecutorOf(state) : defendantOf(state);
}

/** An objection is the objector speaking, so it uses their next turn if it's up. */
function turnAfterObjection(state: CourtState, by: PlayerId): number {
  return turnPlayer(state, state.turn) === by ? state.turn + 1 : state.turn;
}

function turnsLeftFor(state: CourtState, playerId: PlayerId): number {
  let left = 0;
  for (let turn = state.turn; turn <= TURNS_PER_CASE; turn++) {
    if (turnPlayer(state, turn) === playerId) left += 1;
  }
  return left;
}

/** If time runs out on a disagreement, the Court picks one partner's choice. */
function resolveSetup(state: CourtState, rng: Rng): CourtState {
  const [a, b] = state.playerIds;
  const judges = [state.judgeChoices[a], state.judgeChoices[b]].filter(
    (judge): judge is JudgeId => !!judge,
  );
  const judge = judges.length > 0 ? pick(judges, rng) : state.judge;
  const next = { ...state, judge };
  return setupAgreed(state)
    ? next
    : note(
        next,
        "judge",
        "Setup",
        "You two couldn't agree, so the Court flipped a coin.",
      );
}

function fileAccusation(
  state: CourtState,
  text: string,
  autoPicked: boolean,
  now: number,
  timings: CourtTimings,
): CourtState {
  return toStage(
    note(
      {
        ...state,
        accusation: text,
        autoPicked,
        turn: 2,
        lastSpeech: { by: prosecutorOf(state), text },
      },
      prosecutorOf(state),
      autoPicked ? "Accusation, picked by the Court" : "Accusation",
      text,
    ),
    "defend",
    now + timings.writeMs,
  );
}

function fileDefense(
  state: CourtState,
  text: string,
  autoPicked: boolean,
  now: number,
  timings: CourtTimings,
): CourtState {
  return startHearing(
    note(
      {
        ...state,
        defense: text,
        autoPicked,
        turn: 3,
        lastSpeech: { by: defendantOf(state), text },
      },
      defendantOf(state),
      autoPicked ? "Defense, picked by the Court" : "Defense",
      text,
    ),
    now,
    timings,
  );
}

function playerLabel(state: CourtState, playerId: PlayerId): string {
  return playerId === state.playerIds[0] ? "Player 1" : "Player 2";
}

/**
 * The current case as readable lines. Earlier cases stay out, so each case is judged
 * on its own. Private things, like lawyer ideas, are never here.
 */
export function courtHistory(state: CourtState): string[] {
  const accuser = playerLabel(state, prosecutorOf(state));
  const accused = playerLabel(state, defendantOf(state));
  const lines = [`Case ${state.caseNumber}: ${accuser} accuses ${accused}.`];
  for (const entry of state.record) {
    if (entry.caseNumber !== state.caseNumber || entry.label === "Setup") {
      continue;
    }
    const speaker =
      entry.speaker === "judge" ? "Judge" : playerLabel(state, entry.speaker);
    const label = entry.label === "Judge" ? "" : ` (${entry.label})`;
    lines.push(`${speaker}${label}: ${entry.text}`);
  }

  // Keeps the newest lines if a very long case wouldn't fit in a small model.
  let total = 0;
  let start = lines.length;
  while (
    start > 0 &&
    total + (lines[start - 1]?.length ?? 0) < MAX_HISTORY_CHARS
  ) {
    start -= 1;
    total += lines[start]?.length ?? 0;
  }
  return start === 0
    ? lines
    : ["(The start of the case was left out.)", ...lines.slice(start)];
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
    conversation: state.record.filter(
      (entry) =>
        entry.caseNumber === state.caseNumber &&
        !NOT_CONVERSATION.includes(entry.label),
    ),
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
  if (SERIOUS.test(text)) return dismissSerious(state, now, timings);
  return addEffect(toStage(state, "hearing", null), "hearing", {
    ...names(state),
    accusation: state.accusation,
    defense: state.defense,
  });
}

/** Moves to whichever turn is next, or to the verdict once they're all used. */
function startNextTurn(
  state: CourtState,
  now: number,
  timings: CourtTimings,
): CourtState {
  if (state.turn > TURNS_PER_CASE) return startDeliberating(state);
  if (TURN_ROLES[state.turn - 1] !== undefined && state.turn < TURNS_PER_CASE) {
    return toStage(
      {
        ...state,
        reaction: null,
        lawyerStatus: "idle",
        lawyerSuggestions: [],
      },
      "reply",
      now + timings.writeMs,
    );
  }
  return addEffect(
    toStage(
      {
        ...state,
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

function startDeliberating(state: CourtState): CourtState {
  const next = { ...state, reaction: null };
  return addEffect(toStage(next, "deliberating", null), "verdict", {
    ...names(state),
    meter: state.meter,
    accusation: state.accusation,
    defense: state.defense,
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
  const next: CourtState = {
    ...state,
    caseNumber: state.caseNumber + 1,
    meter: 50,
    accusation: null,
    defense: null,
    autoPicked: false,
    turn: 1,
    lastSpeech: null,
    lawyerStatus: "idle",
    lawyerSuggestions: [],
    reaction: null,
    moods: neutralMoods(state),
    objection: null,
    objectionCount: 0,
    crossQuestion: null,
    crossAnswer: null,
    verdict: null,
    verdictReaction: null,
    ending: null,
    take: null,
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
    case "setup": {
      const judge = state.judgeChoices[state.playerIds[0]] ?? state.judge;
      return toStage({ ...state, judge }, "accuse", now + timings.writeMs);
    }
    case "hearing":
      return startNextTurn(state, now, timings);
    case "ruling": {
      // Straight to what comes next, so a statement can only be objected to once.
      const stage = state.objection?.returnTo ?? "hearing";
      return advance({ ...state, stage, objection: null }, now, timings);
    }
    case "replyReact":
    case "crossReact":
      return startNextTurn(state, now, timings);
    case "sealed":
      return toStage(revealVerdict(state), "verdict", now + timings.verdictMs);
    case "verdict":
      return toStage(
        state.verdict
          ? note(state, "judge", "Punishment", state.verdict.punishment)
          : state,
        "punishment",
        now + timings.mercyMs,
      );
    case "aftermath":
      return closeCase(state, now, timings, state.ending ?? "punished");
    case "caseFile":
      return startNextCase(state, now, timings);
    default:
      return state;
  }
}

// The score, moods and meter all change here, so the seal really hides the result.
function revealVerdict(state: CourtState): CourtState {
  const { verdict } = state;
  if (!verdict) return state;
  const { winner, loser, guilty } = verdict;
  return note(
    {
      ...state,
      // So the meter never shows the loser ahead once the verdict is in.
      meter: guilty
        ? Math.max(state.meter, 100 - VERDICT_METER)
        : Math.min(state.meter, VERDICT_METER),
      scores: { ...state.scores, [winner]: (state.scores[winner] ?? 0) + 1 },
      moods: { [winner]: "laugh", [loser]: "cry" },
      reaction: state.verdictReaction,
    },
    "judge",
    guilty ? "Guilty" : "Not guilty",
    verdict.line,
  );
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
  const noted = note(
    state,
    verdict.winner,
    "Mercy",
    pardon ? "Pardoned with a kiss." : "No mercy. The punishment stands.",
  );
  return toStage(
    {
      ...noted,
      ending: pardon ? "pardoned" : "punished",
      moods,
      reaction: {
        line: pardon ? "Aww. Fine. Case closed." : "OK. A deal is a deal.",
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
  "replyReact",
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
  // Only the side that didn't just speak can object to what was said.
  if (state.stage === "hearing") return prosecutorOf(state) === playerId;
  if (state.stage === "replyReact") return state.lastSpeech?.by !== playerId;
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

function parseCourtAction(input: unknown): Result<CourtAction, GameError> {
  const { type, payload: rawPayload } = asObject(input);
  const payload = asObject(rawPayload);
  const bad = rejected("BAD_ACTION", "Check that and try again.");
  const ok = (value: CourtAction) => ({ ok: true as const, value });

  switch (type) {
    case "continue":
    case "askLawyer":
    case "object":
    case "breakSeal":
    case "rest":
      return ok({ type, payload: {} });
    case "setup": {
      const { judge } = payload;
      return typeof judge === "string" && Object.hasOwn(JUDGES, judge)
        ? ok({ type, payload: { judge: judge as JudgeId } })
        : bad;
    }
    case "accuse":
    case "defend":
    case "reply":
    case "answer": {
      const text = cleanText(payload.text, MAX_STATEMENT);
      return text === null
        ? rejected("BAD_TEXT", `Write 1 to ${MAX_STATEMENT} characters.`)
        : ok({ type, payload: { text } });
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
            ...note(state, "judge", "Dismissed", reaction.line),
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
          ...note(state, "judge", "Judge", line),
          meter: bumpMeter(state, reaction?.score ?? 0),
          moods: reaction
            ? setMoods(state, reaction.prosecutorMood, reaction.defendantMood)
            : setMoods(state, "smug", "nervous"),
          reaction: {
            line,
            crowd: reaction?.crowd ?? "gasp",
            judgeMood: reaction?.judgeMood ?? JUDGES[state.judge].mood,
          },
        },
        "hearing",
        now + timings.showMs,
      );
    }
    case "reply": {
      if (reaction?.serious) {
        return closeCase(
          {
            ...note(state, "judge", "Dismissed", reaction.line),
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
      const line = reaction?.line ?? pick(FALLBACK.reply, rng);
      const score = reaction?.score ?? 0;
      const byProsecutor = state.lastSpeech?.by === prosecutorOf(state);
      return toStage(
        {
          ...note(state, "judge", "Judge", line),
          meter: bumpMeter(state, byProsecutor ? score : -score),
          moods: reaction
            ? setMoods(state, reaction.prosecutorMood, reaction.defendantMood)
            : state.moods,
          reaction: {
            line,
            crowd: reaction?.crowd ?? "gasp",
            judgeMood: reaction?.judgeMood ?? "stern",
          },
        },
        "replyReact",
        now + timings.showMs,
      );
    }
    case "ruling": {
      const objection = state.objection;
      if (!objection) return state;
      const sustained =
        !GIVES_ORDERS.test(objection.argument) &&
        (typeof raw.sustained === "boolean"
          ? raw.sustained
          : objection.argument.length >= 15);
      const step = sustained ? OBJECTION_STEP : -OBJECTION_STEP;
      const line =
        reaction?.line ?? (sustained ? FALLBACK.sustained : FALLBACK.overruled);
      return toStage(
        {
          ...note(state, "judge", sustained ? "Sustained" : "Overruled", line),
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
        },
        "ruling",
        now + timings.showMs,
      );
    }
    case "crossQuestion": {
      const question =
        cleanText(raw.question, 200) ?? pick(FALLBACK.crossQuestions, rng);
      return toStage(
        {
          ...note(state, "judge", "Cross-examination", question),
          crossQuestion: question,
        },
        "crossExam",
        now + timings.answerMs,
      );
    }
    case "crossReact": {
      const line = reaction?.line ?? pick(FALLBACK.crossReact, rng);
      return toStage(
        {
          ...note(state, "judge", "Judge", line),
          meter: bumpMeter(state, reaction?.score ?? 0),
          moods: reaction
            ? setMoods(state, reaction.prosecutorMood, reaction.defendantMood)
            : state.moods,
          reaction: {
            line,
            crowd: reaction?.crowd ?? "gasp",
            judgeMood: reaction?.judgeMood ?? "stern",
          },
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
          : raw.winner === "prosecutor" || raw.winner === "defendant"
            ? raw.winner === "prosecutor"
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
          verdictReaction: {
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
        judgeChoices: { [a]: null, [b]: null },
        scores: { [a]: 0, [b]: 0 },
        objectionsLeft: { [a]: OBJECTIONS_PER_GAME, [b]: OBJECTIONS_PER_GAME },
        meter: 50,
        accusation: null,
        defense: null,
        autoPicked: false,
        turn: 1,
        lastSpeech: null,
        lawyerStatus: "idle",
        lawyerSuggestions: [],
        reaction: null,
        moods: { [a]: "neutral", [b]: "neutral" },
        objection: null,
        objectionCount: 0,
        crossQuestion: null,
        crossAnswer: null,
        verdict: null,
        verdictReaction: null,
        ending: null,
        take: null,
        record: [],
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
          // Changing their mind means both partners have to agree again.
          return done({
            ...state,
            judgeChoices: {
              ...state.judgeChoices,
              [playerId]: action.payload.judge,
            },
            continueVotes: [],
          });
        case "continue": {
          if (state.stage === "setup" && !setupAgreed(state)) {
            return rejected("NOT_AGREED", "You both need to agree first.");
          }
          // The other player may have moved things on a moment earlier.
          if (
            !CONTINUE_STAGES.includes(state.stage) ||
            state.deadline === null
          ) {
            return done(state);
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
            fileAccusation(state, action.payload.text, false, now, timings),
          );
        case "askLawyer": {
          const answering = state.stage === "crossExam";
          if (
            state.stage !== "defend" &&
            state.stage !== "reply" &&
            !answering
          ) {
            return WRONG_TIME();
          }
          if (turnPlayer(state, state.turn) !== playerId) return NOT_YOURS();
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
            fileDefense(state, action.payload.text, false, now, timings),
          );
        case "reply": {
          if (state.stage !== "reply") return WRONG_TIME();
          if (turnPlayer(state, state.turn) !== playerId) return NOT_YOURS();
          return done(
            fileReply(state, playerId, action.payload.text, now, timings),
          );
        }
        case "rest": {
          if (state.stage !== "reply") return WRONG_TIME();
          if (turnPlayer(state, state.turn) !== playerId) return NOT_YOURS();
          return done(
            startNextTurn(
              {
                ...note(state, playerId, "Reply", "Rested their case."),
                turn: state.turn + 1,
              },
              now,
              timings,
            ),
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
              toStage(
                {
                  ...note(
                    state,
                    playerId,
                    `Objection: ${OBJECTION_GROUNDS[updated.ground] ?? ""}`,
                    updated.argument,
                  ),
                  objection: updated,
                  turn: turnAfterObjection(state, playerId),
                  lastSpeech: { by: playerId, text: updated.argument },
                },
                "ruling",
                null,
              ),
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
          return done(submitAnswer(state, action.payload.text, now, timings));
        }
        case "breakSeal":
          // Both players can tap the seal at once, and the first one wins.
          if (state.stage !== "sealed") return done(state);
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
            ...note(
              state,
              playerId,
              "Reaction",
              action.payload.option === 0
                ? "Accepted, with dignity."
                : "Sulked dramatically.",
            ),
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
        judgeChoices: state.judgeChoices,
        setupAgreed: setupAgreed(state),
        scores: state.scores,
        myObjections: state.objectionsLeft[playerId] ?? 0,
        canObject: canObject(state, playerId),
        objectionUsesTurn:
          canObject(state, playerId) &&
          turnPlayer(state, state.turn) === playerId,
        canContinue:
          CONTINUE_STAGES.includes(state.stage) &&
          state.deadline !== null &&
          (state.stage !== "setup" || setupAgreed(state)),
        haveContinued: state.continueVotes.includes(playerId),
        meter: meterForPlayerOne(state),
        accusation: state.accusation,
        defense: state.defense,
        autoPicked: state.autoPicked,
        turn: state.turn,
        totalTurns: TURNS_PER_CASE,
        turnsLeft: {
          [prosecutor]: turnsLeftFor(state, prosecutor),
          [defendant]: turnsLeftFor(state, defendant),
        },
        mover: ["accuse", "defend", "reply", "crossExam"].includes(state.stage)
          ? turnPlayer(state, state.turn)
          : null,
        lastSpeech: state.lastSpeech,
        lawyerStatus: isDefendant ? state.lawyerStatus : "idle",
        // A defense idea is private until the defendant actually uses one.
        lawyerSuggestions: isDefendant ? state.lawyerSuggestions : [],
        reaction: state.reaction,
        moods: state.moods,
        objection: state.objection,
        crossQuestion: state.crossQuestion,
        crossAnswer: state.crossAnswer,
        // Hidden until the seal is broken, even though the server already knows.
        verdict: state.stage === "sealed" ? null : state.verdict,
        ending: state.ending,
        take: state.take,
        latestCase: state.cases[state.cases.length - 1] ?? null,
        record: state.record,
        emotes: state.emotes,
        judgeThinking: state.pending.some((effect) => effect.kind !== "lawyer"),
      };
    },

    phase: (state) => STAGE_PHASE[state.stage],
    deadline: (state) => state.deadline,

    onTimeout(state, now, rng) {
      switch (state.stage) {
        case "setup": {
          const resolved = resolveSetup(state, rng);
          return toStage(resolved, "accuse", now + timings.writeMs);
        }
        case "accuse":
          return fileAccusation(
            state,
            pick(READY_ACCUSATIONS, rng),
            true,
            now,
            timings,
          );
        case "defend":
          return fileDefense(
            state,
            pick(EXAMPLE_DEFENSES, rng),
            true,
            now,
            timings,
          );
        case "reply": {
          const mover = turnPlayer(state, state.turn) ?? defendantOf(state);
          return startNextTurn(
            {
              ...note(state, mover, "Reply", "Ran out of time."),
              turn: state.turn + 1,
            },
            now,
            timings,
          );
        }
        case "objection": {
          const objection = state.objection;
          if (!objection) return advance(state, now, timings);
          return toStage(
            {
              ...note(state, "judge", "Overruled", FALLBACK.overruled),
              turn: turnAfterObjection(state, objection.by),
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
          return submitAnswer(state, "...", now, timings);
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

function fileReply(
  state: CourtState,
  playerId: PlayerId,
  text: string,
  now: number,
  timings: CourtTimings,
): CourtState {
  const noted = {
    ...note(state, playerId, "Reply", text),
    turn: state.turn + 1,
    lastSpeech: { by: playerId, text },
  };
  // Checked here as well as by the AI, so it still holds if the AI is down.
  if (SERIOUS.test(text)) return dismissSerious(noted, now, timings);
  return addEffect(toStage(noted, "replyReact", null), "reply", {
    ...names(state),
    accusation: state.accusation,
    defense: state.defense,
    speakerRole: playerId === prosecutorOf(state) ? "prosecutor" : "defendant",
  });
}

function dismissSerious(
  state: CourtState,
  now: number,
  timings: CourtTimings,
): CourtState {
  return closeCase(
    {
      ...note(state, "judge", "Dismissed", FALLBACK.dismissed),
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

function submitAnswer(
  state: CourtState,
  text: string,
  now: number,
  timings: CourtTimings,
): CourtState {
  const by = defendantOf(state);
  const noted = {
    ...note(state, by, "Answer", text),
    turn: state.turn + 1,
    lastSpeech: { by, text },
    crossAnswer: text,
  };
  if (SERIOUS.test(text)) return dismissSerious(noted, now, timings);
  return addEffect(toStage(noted, "crossReact", null), "crossReact", {
    ...names(state),
    accusation: state.accusation,
    defense: state.defense,
    question: state.crossQuestion,
    answer: text,
  });
}

export const court = createCourt();
