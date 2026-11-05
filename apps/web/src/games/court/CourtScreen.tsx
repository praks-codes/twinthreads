import {
  EMOTES,
  EXAMPLE_DEFENSES,
  FILL_IN_ACCUSATIONS,
  JUDGES,
  MAX_STATEMENT,
  OBJECTION_GROUNDS,
  READY_ACCUSATIONS,
  type CourtView,
  type JudgeId,
  type JudgeMood,
  type RecordEntry,
} from "@twinthreads/court";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Countdown } from "../../components/Countdown.js";
import type { GameScreenProps } from "../registry.js";
import { HEART_PATH } from "./characters.js";
import "./court.css";
import { drawCaseCard, shareCard } from "./shareCard.js";
import { Stage } from "./Stage.js";

const THINKING: Partial<Record<CourtView["stage"], readonly string[]>> = {
  hearing: [
    "Judge Cupid is reading this very slowly...",
    "The Court is pretending to take notes...",
  ],
  ruling: ["Judge Cupid is considering your objection...", "Order! Order..."],
  replyReact: ["Judge Cupid is thinking about that...", "Hmm..."],
  crossExam: ["Judge Cupid is preparing one last question..."],
  crossReact: ["Judge Cupid is studying your face..."],
  deliberating: [
    "Judge Cupid is deciding...",
    "The Court is consulting the ancient texts...",
    "Asking the gummies what they think...",
    "Polishing the gavel...",
    "This could change everything. Or nothing...",
  ],
};

const LAWYER_WAIT = [
  "Your lawyer is reading your case...",
  "Your lawyer is looking for a good excuse...",
  "Your lawyer is asking a friend for help...",
] as const;

function useRotatingLine(lines: readonly string[] | undefined): string {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
    if (!lines || lines.length < 2) return;
    const timer = setInterval(() => setIndex((i) => i + 1), 2600);
    return () => clearInterval(timer);
  }, [lines]);
  return lines?.[index % lines.length] ?? "";
}

function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: [T, string][];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="court-tabs">
      {tabs.map(([id, label]) => (
        <button
          key={id}
          type="button"
          className="court-tab"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Cards({
  items,
  selected,
  onPick,
}: {
  items: { key: string; title?: string; text: string; badge?: string }[];
  selected: string | null;
  onPick: (key: string) => void;
}) {
  return (
    <div className="court-cards">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className="court-card"
          aria-pressed={selected === item.key}
          onClick={() => onPick(item.key)}
        >
          {item.badge && <em className="court-badge">{item.badge}</em>}
          {item.title && <strong>{item.title}</strong>}
          <span>{item.text}</span>
        </button>
      ))}
    </div>
  );
}

function Waiting({ children }: { children: ReactNode }) {
  return <p className="court-waiting">{children}</p>;
}

function AccusePanel({ onFile }: { onFile: (text: string) => void }) {
  const [tab, setTab] = useState<"write" | "pick" | "fill">("pick");
  const [own, setOwn] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [template, setTemplate] = useState(0);
  const [blankA, setBlankA] = useState("");
  const [blankB, setBlankB] = useState("");
  const parts = FILL_IN_ACCUSATIONS[template] ?? FILL_IN_ACCUSATIONS[0];
  const filled = `${parts?.[0]} ${blankA.trim()} ${parts?.[1]} ${blankB.trim()}${parts?.[2]}`;
  const text =
    tab === "write"
      ? own.trim()
      : tab === "pick"
        ? (picked ?? "")
        : blankA.trim() && blankB.trim()
          ? filled
          : "";
  return (
    <>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          ["write", "Write it"],
          ["pick", "Pick one"],
          ["fill", "Fill blanks"],
        ]}
      />
      {tab === "write" && (
        <label className="court-field">
          In your own petty words
          <textarea
            maxLength={MAX_STATEMENT}
            value={own}
            onChange={(event) => setOwn(event.target.value)}
            placeholder="Eats the good biscuits and hides the empty packet..."
          />
        </label>
      )}
      {tab === "pick" && (
        <Cards
          items={READY_ACCUSATIONS.map((item) => ({ key: item, text: item }))}
          selected={picked}
          onPick={setPicked}
        />
      )}
      {tab === "fill" && (
        <div className="court-fill">
          <button
            type="button"
            className="court-plain"
            onClick={() =>
              setTemplate((template + 1) % FILL_IN_ACCUSATIONS.length)
            }
          >
            Different card
          </button>
          <label className="court-field">
            {parts?.[0]}...
            <input
              maxLength={45}
              value={blankA}
              onChange={(event) => setBlankA(event.target.value)}
            />
          </label>
          <label className="court-field">
            ...{parts?.[1]}...
            <input
              maxLength={45}
              value={blankB}
              onChange={(event) => setBlankB(event.target.value)}
            />
          </label>
        </div>
      )}
      <button
        type="button"
        className="court-big"
        disabled={!text}
        onClick={() => onFile(text)}
      >
        File it!
      </button>
    </>
  );
}

function DefendPanel({
  game,
  onAction,
}: {
  game: CourtView;
  onAction: GameScreenProps["onAction"];
}) {
  const [tab, setTab] = useState<"write" | "examples" | "lawyer">("examples");
  const [own, setOwn] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const text = tab === "write" ? own.trim() : (picked ?? "");
  return (
    <>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          ["write", "Write it"],
          ["examples", "Examples"],
          ["lawyer", "AI lawyer"],
        ]}
      />
      {tab === "write" && (
        <label className="court-field">
          In your own words
          <textarea
            maxLength={MAX_STATEMENT}
            value={own}
            onChange={(event) => setOwn(event.target.value)}
            placeholder="I can explain..."
          />
        </label>
      )}
      {tab === "examples" && (
        <Cards
          items={EXAMPLE_DEFENSES.map((item) => ({ key: item, text: item }))}
          selected={picked}
          onPick={setPicked}
        />
      )}
      {tab === "lawyer" && (
        <LawyerCards
          game={game}
          selected={picked}
          onPick={setPicked}
          onAsk={() => onAction("askLawyer", {})}
        />
      )}
      <button
        type="button"
        className="court-big"
        disabled={!text}
        onClick={() => onAction("defend", { text })}
      >
        Tell it to the judge
      </button>
    </>
  );
}

function LawyerCards({
  game,
  selected,
  onPick,
  onAsk,
}: {
  game: CourtView;
  selected: string | null;
  onPick: (text: string) => void;
  onAsk: () => void;
}) {
  const waiting = useRotatingLine(
    game.lawyerStatus === "pending" ? LAWYER_WAIT : undefined,
  );
  if (game.lawyerStatus === "idle") {
    return (
      <button type="button" className="court-lawyer" onClick={onAsk}>
        Ask my AI lawyer
      </button>
    );
  }
  if (game.lawyerStatus === "pending") {
    return <Waiting>{waiting}</Waiting>;
  }
  return (
    <Cards
      items={game.lawyerSuggestions.map((item) => ({
        key: item.text,
        title: item.style,
        text: item.text,
      }))}
      selected={selected}
      onPick={onPick}
    />
  );
}

function ObjectionPanel({
  onArgue,
}: {
  onArgue: (ground: number, argument: string) => void;
}) {
  const [ground, setGround] = useState(0);
  const [argument, setArgument] = useState("");
  return (
    <>
      <div className="court-grounds">
        {OBJECTION_GROUNDS.map((label, index) => (
          <button
            key={label}
            type="button"
            className="court-tab"
            aria-pressed={ground === index}
            onClick={() => setGround(index)}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="court-field">
        Now argue it. Why should the judge agree?
        <textarea
          maxLength={MAX_STATEMENT}
          value={argument}
          onChange={(event) => setArgument(event.target.value)}
          placeholder="Your Honor, nobody has ever..."
        />
      </label>
      <button
        type="button"
        className="court-big"
        disabled={!argument.trim()}
        onClick={() => onArgue(ground, argument.trim())}
      >
        Argue it
      </button>
    </>
  );
}

function TurnPanel({
  game,
  label,
  action,
  button,
  canRest,
  onAction,
}: {
  game: CourtView;
  label: string;
  action: "reply" | "answer";
  button: string;
  canRest: boolean;
  onAction: GameScreenProps["onAction"];
}) {
  const [text, setText] = useState("");
  return (
    <>
      <label className="court-field">
        {label}
        <textarea
          maxLength={MAX_STATEMENT}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      {game.mover === game.defendant && (
        <LawyerCards
          game={game}
          selected={text}
          onPick={setText}
          onAsk={() => onAction("askLawyer", {})}
        />
      )}
      <button
        type="button"
        className="court-big"
        disabled={!text.trim()}
        onClick={() => onAction(action, { text: text.trim() })}
      >
        {button}
      </button>
      {canRest && (
        <button
          type="button"
          className="court-plain"
          onClick={() => onAction("rest", {})}
        >
          Rest my case
        </button>
      )}
    </>
  );
}

function CaseFilePanel({
  game,
  displayNameOf,
  named,
  onAction,
}: {
  game: CourtView;
  displayNameOf: (playerId: string) => string;
  named: (text: string) => string;
  onAction: GameScreenProps["onAction"];
}) {
  const record = game.latestCase;
  const [card, setCard] = useState<{ blob: Blob; url: string } | null>(null);
  const nameOfRef = useRef(displayNameOf);
  const namedRef = useRef(named);

  useEffect(() => {
    if (!record) return;
    let cancelled = false;
    let url = "";
    drawCaseCard(
      {
        ...record,
        headline: namedRef.current(record.headline),
        quote: namedRef.current(record.quote),
        punishment: record.punishment && namedRef.current(record.punishment),
        conversation: record.conversation.map((entry) => ({
          ...entry,
          text: namedRef.current(entry.text),
        })),
      },
      nameOfRef.current,
    )
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setCard({ blob, url });
      })
      .catch(() => setCard(null));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [record]);

  return (
    <>
      {card ? (
        <div className="court-card-scroll" tabIndex={0}>
          <img
            className="court-card-preview"
            src={card.url}
            alt={`Case ${record?.caseNumber} card: ${record?.headline}`}
          />
        </div>
      ) : (
        <Waiting>The court artist is drawing your case...</Waiting>
      )}
      {card && record && (
        <button
          type="button"
          className="court-plain"
          onClick={() => void shareCard(card.blob, record.caseNumber)}
        >
          Share this case
        </button>
      )}
      <ContinueButton
        game={game}
        label={
          game.caseNumber >= game.totalCases
            ? "See the final score"
            : "Swap seats: next case"
        }
        onAction={onAction}
      />
    </>
  );
}

/** Names the next step, so players always know what the button will do. */
function nextStep(game: CourtView): string {
  if (game.turn > game.totalTurns) return "Next: the verdict";
  return game.turn === game.totalTurns
    ? "Next: cross-examination"
    : `Next: turn ${game.turn} of ${game.totalTurns}`;
}

function CourtRecord({
  record,
  nameOf,
  named,
}: {
  record: RecordEntry[];
  nameOf: (playerId: string) => string;
  named: (text: string) => string;
}) {
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [record.length]);

  if (record.length === 0) return null;
  return (
    <section className="court-record">
      <h2>Court record</h2>
      <ol ref={list} tabIndex={0} aria-label="Everything said in court so far">
        {record.map((entry, index) => {
          const judge = entry.speaker === "judge";
          const newCase = record[index - 1]?.caseNumber !== entry.caseNumber;
          return (
            <li key={index}>
              {newCase && (
                <div className="court-record__case">
                  Case {entry.caseNumber}
                </div>
              )}
              <div
                className={
                  judge
                    ? "court-record__entry court-record__entry--judge"
                    : "court-record__entry"
                }
              >
                <strong>
                  {judge ? "Judge Cupid" : nameOf(entry.speaker)}
                  {entry.label === "Judge" ? "" : `: ${entry.label}`}
                </strong>
                <span>{named(entry.text)}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ContinueButton({
  game,
  label,
  onAction,
}: {
  game: CourtView;
  label: string;
  onAction: GameScreenProps["onAction"];
}) {
  return (
    <button
      type="button"
      className="court-big"
      disabled={game.haveContinued || !game.canContinue}
      onClick={() => onAction("continue", {})}
    >
      {game.haveContinued ? "Waiting for your partner..." : label}
    </button>
  );
}

function ObjectButton({
  game,
  onAction,
}: {
  game: CourtView;
  onAction: GameScreenProps["onAction"];
}) {
  if (!game.canObject) return null;
  return (
    <>
      <button
        type="button"
        className="court-red"
        onClick={() => onAction("object", {})}
      >
        OBJECTION! ({game.myObjections} left)
      </button>
      {game.objectionUsesTurn && (
        <p className="court-note">Objecting uses your next turn.</p>
      )}
    </>
  );
}

export default function CourtScreen({
  state,
  myPlayerId,
  paused,
  onAction,
}: GameScreenProps) {
  const game = state.game as CourtView;
  const { stage } = game;
  const nameOf = (playerId: string) =>
    playerId === myPlayerId
      ? "You"
      : (state.players.find((p) => p.playerId === playerId)?.displayName ??
        "Your partner");
  const partnerId = game.playerIds.find((id) => id !== myPlayerId) ?? "";
  const partner = nameOf(partnerId);
  const displayNameOf = (playerId: string) =>
    state.players.find((p) => p.playerId === playerId)?.displayName ??
    "Partner";
  // The AI only knows "Player 1" and "Player 2", and sometimes says so out loud.
  const named = (text: string) =>
    text
      .replace(/\bPlayer 1\b/g, displayNameOf(game.playerIds[0]))
      .replace(/\bPlayer 2\b/g, displayNameOf(game.playerIds[1]));
  const partnerAway = state.status === "reconnecting";
  const iAmProsecutor = game.prosecutor === myPlayerId;
  const iAmDefendant = game.defendant === myPlayerId;
  const thinkingLine = useRotatingLine(
    game.judgeThinking ? THINKING[stage] : undefined,
  );

  const isRuling = stage === "ruling";
  const reaction = isRuling ? game.objection?.reaction : game.reaction;
  const judgeMood: JudgeMood =
    (game.judgeThinking ? null : reaction?.judgeMood) ??
    JUDGES[game.judge].mood;

  // Your own side is always on the left, on the stage and on the meter.
  const myMeter =
    game.playerIds[0] === myPlayerId ? game.meter : 100 - game.meter;
  const waitOn = (text: string) =>
    partnerAway ? `${partner}'s phone has dozed off. Reconnecting...` : text;

  let judgeLine = reaction?.line ?? "";
  if (game.judgeThinking) judgeLine = thinkingLine;
  else if (stage === "setup")
    judgeLine = game.setupAgreed
      ? "Agreed! Both of you tap to begin."
      : "You must both agree on a judge. Good luck.";
  else if (stage === "accuse")
    judgeLine = iAmProsecutor
      ? `What did ${partner} do this time?`
      : `${partner} is preparing the charges.`;
  else if (stage === "defend")
    judgeLine = iAmDefendant
      ? "Your defense? Choose your words poorly."
      : `${partner} is building a defense.`;
  else if (stage === "objection") judgeLine = "On what grounds?";
  else if (stage === "reply")
    judgeLine =
      game.mover === myPlayerId
        ? "Your turn. What do you say to that?"
        : `${partner} is replying.`;
  else if (stage === "crossExam") judgeLine = game.crossQuestion ?? "";
  else if (stage === "sealed") judgeLine = "My verdict is under this seal.";
  else if (stage === "punishment") judgeLine = "And now, the price.";

  let panel: ReactNode = null;
  switch (stage) {
    case "setup": {
      const mine = game.judgeChoices[myPlayerId] ?? null;
      const theirs = game.judgeChoices[partnerId] ?? null;
      const badgeFor = (id: JudgeId) => {
        const me = mine === id;
        const them = theirs === id;
        if (me && them) return "You both";
        if (me) return "You";
        return them ? partner : undefined;
      };
      panel = (
        <>
          <Cards
            items={(Object.keys(JUDGES) as JudgeId[]).map((id) => {
              const badge = badgeFor(id);
              return {
                key: id,
                title: JUDGES[id].name,
                text: JUDGES[id].tagline,
                ...(badge ? { badge } : {}),
              };
            })}
            selected={mine}
            onPick={(judge) => onAction("setup", { judge })}
          />
          <ContinueButton
            game={game}
            label={
              game.setupAgreed
                ? "Court is in session"
                : "Agree on a judge first"
            }
            onAction={onAction}
          />
        </>
      );
      break;
    }
    case "accuse":
      panel = iAmProsecutor ? (
        <AccusePanel
          key={game.caseNumber}
          onFile={(text) => onAction("accuse", { text })}
        />
      ) : (
        <Waiting>{waitOn(`${partner} is deciding what you did...`)}</Waiting>
      );
      break;
    case "defend":
      panel = iAmDefendant ? (
        <DefendPanel key={game.caseNumber} game={game} onAction={onAction} />
      ) : (
        <Waiting>{waitOn(`${partner} is working on an excuse...`)}</Waiting>
      );
      break;
    case "hearing":
    case "replyReact":
    case "crossReact":
      panel = !game.judgeThinking && (
        <>
          <ObjectButton game={game} onAction={onAction} />
          <ContinueButton
            game={game}
            label={nextStep(game)}
            onAction={onAction}
          />
        </>
      );
      break;
    case "objection":
      panel =
        game.objection?.by === myPlayerId ? (
          <ObjectionPanel
            onArgue={(ground, argument) =>
              onAction("argue", { ground, argument })
            }
          />
        ) : (
          <Waiting>{waitOn(`${partner} objects! Arguing it now...`)}</Waiting>
        );
      break;
    case "ruling":
      panel = !game.judgeThinking && (
        <>
          <div className="court-word court-stamp">
            {game.objection?.sustained ? "SUSTAINED!" : "OVERRULED!"}
          </div>
          <ContinueButton
            game={game}
            label={nextStep(game)}
            onAction={onAction}
          />
        </>
      );
      break;
    case "reply":
      panel =
        game.mover === myPlayerId ? (
          <TurnPanel
            key={game.turn}
            game={game}
            label="Your reply"
            action="reply"
            button="Say it"
            canRest
            onAction={onAction}
          />
        ) : (
          <Waiting>{waitOn(`${partner} is writing a reply...`)}</Waiting>
        );
      break;
    case "crossExam":
      panel =
        game.crossQuestion === null ? null : iAmDefendant ? (
          <TurnPanel
            game={game}
            label="Your answer"
            action="answer"
            button="Answer the judge"
            canRest={false}
            onAction={onAction}
          />
        ) : (
          <Waiting>{waitOn(`${partner} is sweating...`)}</Waiting>
        );
      break;
    case "deliberating":
      panel = (
        <div className="court-deciding">
          <svg className="court-pulse" viewBox="0 0 24 24" aria-hidden="true">
            <path d={HEART_PATH} />
          </svg>
          <p>Nobody breathe.</p>
        </div>
      );
      break;
    case "sealed":
      panel = (
        <div className="court-envelope-wrap court-pop">
          <div className="court-envelope">
            <div className="court-envelope__flap" />
            <button
              type="button"
              className="court-seal court-pulse"
              aria-label="Break the wax seal"
              onClick={() => onAction("breakSeal", {})}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={HEART_PATH} />
              </svg>
            </button>
          </div>
          <p>Tap the wax seal to break it</p>
        </div>
      );
      break;
    case "verdict":
      panel = (
        <>
          <div className="court-word court-word--big court-stamp">
            {game.verdict?.guilty ? "GUILTY!" : "NOT GUILTY!"}
          </div>
          <ContinueButton
            game={game}
            label="Hear the punishment"
            onAction={onAction}
          />
        </>
      );
      break;
    case "punishment": {
      const iWon = game.verdict?.winner === myPlayerId;
      panel = (
        <>
          <div className="court-sentence">
            <strong>
              {nameOf(game.verdict?.loser ?? "")}{" "}
              {game.verdict?.loser === myPlayerId ? "are" : "is"} sentenced to
            </strong>
            <span>{named(game.verdict?.punishment ?? "")}</span>
          </div>
          {iWon ? (
            <>
              <button
                type="button"
                className="court-red"
                onClick={() => onAction("mercy", { pardon: true })}
              >
                Pardon with a kiss
              </button>
              <button
                type="button"
                className="court-plain"
                onClick={() => onAction("mercy", { pardon: false })}
              >
                No mercy. Punishment stands.
              </button>
            </>
          ) : (
            <Waiting>{waitOn(`${partner} is deciding your fate...`)}</Waiting>
          )}
        </>
      );
      break;
    }
    case "aftermath":
      panel = (
        <>
          {game.ending === "pardoned" ? (
            <div className="court-word court-word--white court-pop">
              PARDONED
            </div>
          ) : (
            game.verdict?.loser === myPlayerId &&
            game.take === null && (
              <div className="court-takes">
                <span>How do you take it?</span>
                <button
                  type="button"
                  className="court-plain"
                  onClick={() => onAction("take", { option: 0 })}
                >
                  Accept with dignity
                </button>
                <button
                  type="button"
                  className="court-plain"
                  onClick={() => onAction("take", { option: 1 })}
                >
                  Sulk dramatically
                </button>
              </div>
            )
          )}
          <ContinueButton game={game} label="Case file" onAction={onAction} />
        </>
      );
      break;
    case "caseFile":
      panel = (
        <CaseFilePanel
          game={game}
          displayNameOf={displayNameOf}
          named={named}
          onAction={onAction}
        />
      );
      break;
    default:
      break;
  }

  return (
    <section className="court" aria-disabled={paused}>
      <div className="court__top">
        <div className="court__status">
          <span>
            Case {game.caseNumber} of {game.totalCases}
          </span>
          {state.deadline !== null && (
            <Countdown
              deadline={state.deadline}
              serverTime={state.serverTime}
            />
          )}
          <span>
            You {game.scores[myPlayerId] ?? 0} · {partner}{" "}
            {game.scores[partnerId] ?? 0}
          </span>
        </div>
        <div
          className="court-meter"
          role="img"
          aria-label={`Case meter, you against ${partner}: ${Math.round(myMeter)} out of 100`}
        >
          <span className="court-meter__name court-meter__name--left">You</span>
          <span className="court-meter__name court-meter__name--right">
            {partner}
          </span>
          <div className="court-meter__fill" style={{ width: `${myMeter}%` }} />
          <div className="court-meter__spark" style={{ left: `${myMeter}%` }}>
            <svg viewBox="0 0 36 36" aria-hidden="true">
              <path d="M18 1 L22 14 L35 18 L22 22 L18 35 L14 22 L1 18 L14 14 Z" />
            </svg>
          </div>
        </div>
      </div>
      <div className="court__layout">
        <Stage
          game={game}
          myPlayerId={myPlayerId}
          partnerId={partnerId}
          nameOf={nameOf}
          judgeMood={judgeMood}
        />
        <div className="court__panel">
          <div className="court-emotes">
            {EMOTES.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`React with ${emoji}`}
                onClick={() => onAction("emote", { emoji })}
              >
                {emoji}
              </button>
            ))}
          </div>
          {["accuse", "defend", "reply", "crossExam"].includes(stage) ||
          ([
            "hearing",
            "replyReact",
            "crossReact",
            "ruling",
            "objection",
          ].includes(stage) &&
            !game.judgeThinking) ? (
            <p className="court-turns">
              {game.turn > game.totalTurns ? (
                <strong>All turns used</strong>
              ) : (
                <strong>
                  Turn {game.turn} of {game.totalTurns}
                </strong>
              )}
              <span>
                {iAmProsecutor ? "Prosecutor" : "Defendant"}: you have{" "}
                {game.turnsLeft[myPlayerId] ?? 0} left, {partner} has{" "}
                {game.turnsLeft[partnerId] ?? 0}
              </span>
            </p>
          ) : null}
          {judgeLine && (
            <div
              key={judgeLine}
              className={
                game.judgeThinking
                  ? "court-line court-line--thinking court-pop"
                  : "court-line court-pop"
              }
            >
              {named(judgeLine)}
            </div>
          )}
          {game.autoPicked && stage === "hearing" && (
            <Waiting>Time ran out, so the Court picked something.</Waiting>
          )}
          {panel}
        </div>
        <CourtRecord record={game.record} nameOf={nameOf} named={named} />
      </div>
      {stage === "aftermath" && game.ending === "pardoned" && (
        <div className="court-hearts" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <svg
              key={i}
              viewBox="0 0 24 24"
              style={{
                left: `${(i * 37) % 96}%`,
                width: 20 + ((i * 7) % 26),
                animationDelay: `${i * 0.17}s`,
              }}
            >
              <path d={HEART_PATH} />
            </svg>
          ))}
        </div>
      )}
    </section>
  );
}
