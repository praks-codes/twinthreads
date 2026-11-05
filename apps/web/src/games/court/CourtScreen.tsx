import {
  BRIBES,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  EMOTES,
  EXAMPLE_DEFENSES,
  FILL_IN_ACCUSATIONS,
  JUDGES,
  MAX_CAPTION,
  MAX_STATEMENT,
  OBJECTION_GROUNDS,
  READY_ACCUSATIONS,
  WITNESSES,
  type CourtView,
  type JudgeId,
  type JudgeMood,
  type MoveKind,
  type RecordEntry,
} from "@twinthreads/court";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Countdown } from "../../components/Countdown.js";
import type { GameScreenProps } from "../registry.js";
import { HEART_PATH, strokesToPath } from "./characters.js";
import "./court.css";
import { drawCaseCard, shareCard } from "./shareCard.js";
import { Stage } from "./Stage.js";

const THINKING: Partial<Record<CourtView["stage"], readonly string[]>> = {
  hearing: [
    "Judge Cupid is reading this very slowly...",
    "The Court is pretending to take notes...",
  ],
  moveReact: [
    "Judge Cupid is examining this closely...",
    "The Court adjusts its wig...",
  ],
  ruling: ["Judge Cupid is considering your objection...", "Order! Order..."],
  crossExam: ["Judge Cupid is preparing a question..."],
  crossReact: ["Judge Cupid is studying your face..."],
  deliberating: [
    "Judge Cupid is deciding...",
    "The Court is consulting the ancient texts...",
    "Asking the gummies what they think...",
    "Polishing the gavel...",
    "This could change everything. Or nothing...",
  ],
};

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
  if (game.lawyerStatus === "idle") {
    return (
      <button type="button" className="court-lawyer" onClick={onAsk}>
        Ask my AI lawyer
      </button>
    );
  }
  if (game.lawyerStatus === "pending") {
    return (
      <Waiting>Your lawyer is frantically searching the fridge...</Waiting>
    );
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

function DrawPad({
  strokes,
  onChange,
}: {
  strokes: number[][];
  onChange: (strokes: number[][]) => void;
}) {
  const drawing = useRef(false);
  const point = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [
      Math.round(
        Math.min(
          CANVAS_WIDTH,
          Math.max(
            0,
            ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
          ),
        ),
      ),
      Math.round(
        Math.min(
          CANVAS_HEIGHT,
          Math.max(
            0,
            ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
          ),
        ),
      ),
    ];
  };
  const total = strokes.reduce((sum, stroke) => sum + stroke.length, 0);
  return (
    <svg
      className="court-drawpad"
      viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
      role="img"
      aria-label="Drawing area for Exhibit A"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        drawing.current = true;
        onChange([...strokes, point(event)]);
      }}
      onPointerMove={(event) => {
        if (!drawing.current || total > 1100) return;
        const last = strokes[strokes.length - 1] ?? [];
        onChange([...strokes.slice(0, -1), [...last, ...point(event)]]);
      }}
      onPointerUp={() => {
        drawing.current = false;
      }}
    >
      <path d={strokesToPath(strokes)} />
    </svg>
  );
}

function MovesPanel({
  game,
  isMine,
  moverName,
  onAction,
}: {
  game: CourtView;
  isMine: boolean;
  moverName: string;
  onAction: GameScreenProps["onAction"];
}) {
  const [view, setView] = useState<MoveKind | null>(null);
  const [strokes, setStrokes] = useState<number[][]>([]);
  const [caption, setCaption] = useState("");

  useEffect(() => {
    setView(null);
    setStrokes([]);
    setCaption("");
  }, [game.turn]);

  if (!isMine) {
    return (
      <Waiting>{moverName} is plotting a way to tip the scales...</Waiting>
    );
  }
  const send = (kind: MoveKind, option: number) =>
    onAction("move", { kind, option, caption: caption.trim(), strokes });

  if (view === "evidence") {
    return (
      <>
        <DrawPad strokes={strokes} onChange={setStrokes} />
        <input
          aria-label="Caption for Exhibit A"
          maxLength={MAX_CAPTION}
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          placeholder="Caption: the carton, moments before..."
        />
        <button
          type="button"
          className="court-big"
          disabled={strokes.length === 0 && !caption.trim()}
          onClick={() => send("evidence", 0)}
        >
          Submit Exhibit A
        </button>
        <button
          type="button"
          className="court-plain"
          onClick={() => setView(null)}
        >
          Back
        </button>
      </>
    );
  }
  if (view === "witness" || view === "bribe") {
    const list = view === "witness" ? WITNESSES : BRIBES;
    return (
      <>
        <Cards
          items={list.map((item, index) => ({
            key: String(index),
            title: item.name,
            text: item.note,
          }))}
          selected={null}
          onPick={(key) => send(view, Number(key))}
        />
        <button
          type="button"
          className="court-plain"
          onClick={() => setView(null)}
        >
          Back
        </button>
      </>
    );
  }
  const options: { kind: MoveKind; title: string; text: string }[] = [
    { kind: "evidence", title: "Present evidence", text: "Draw Exhibit A" },
    {
      kind: "witness",
      title: "Call a witness",
      text: "A gummy takes the stand. It could backfire",
    },
    { kind: "bribe", title: "Bribe the judge", text: "Risky. Very risky" },
  ];
  return (
    <>
      <Cards
        items={options
          .filter((option) => !game.myUsedMoves.includes(option.kind))
          .map((option) => ({
            key: option.kind,
            title: option.title,
            text: option.text,
          }))}
        selected={null}
        onPick={(key) => setView(key as MoveKind)}
      />
      <button
        type="button"
        className="court-plain"
        onClick={() => onAction("pass", {})}
      >
        Rest for now
      </button>
    </>
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

function AnswerPanel({
  game,
  onAction,
}: {
  game: CourtView;
  onAction: GameScreenProps["onAction"];
}) {
  const [text, setText] = useState("");
  return (
    <>
      <label className="court-field">
        Your answer
        <textarea
          maxLength={MAX_STATEMENT}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Answer the judge..."
        />
      </label>
      {game.lawyerStatus === "idle" ? (
        <button
          type="button"
          className="court-lawyer"
          onClick={() => onAction("askLawyer", {})}
        >
          Whisper from my AI lawyer
        </button>
      ) : (
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
        onClick={() => onAction("answer", { text: text.trim() })}
      >
        Answer the judge
      </button>
    </>
  );
}

function ClosingPanel({
  game,
  deadline,
  serverTime,
  onAction,
}: {
  game: CourtView;
  deadline: number | null;
  serverTime: number;
  onAction: GameScreenProps["onAction"];
}) {
  const skew = useMemo(() => serverTime - Date.now(), [serverTime]);
  const [now, setNow] = useState(() => Date.now() + skew);
  const buffer = useRef(0);
  const [myTaps, setMyTaps] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now() + skew);
      if (buffer.current > 0) {
        onAction("tap", { count: Math.min(buffer.current, 20) });
        buffer.current = Math.max(0, buffer.current - 20);
      }
    }, 300);
    return () => clearInterval(timer);
  }, [skew, onAction]);

  const left = deadline === null ? 0 : Math.max(0, deadline - now);
  const countingDown = left > game.tapWindowMs;
  return (
    <>
      <p className="court-waiting">
        {countingDown
          ? `Get ready: ${Math.ceil((left - game.tapWindowMs) / 1000)}`
          : `${(left / 1000).toFixed(1)} seconds left. ${myTaps} taps`}
      </p>
      <button
        type="button"
        className="court-plead court-pulse"
        disabled={countingDown || left === 0}
        onPointerDown={() => {
          buffer.current += 1;
          setMyTaps((taps) => taps + 1);
        }}
      >
        {countingDown ? "WAIT" : "PLEAD!"}
      </button>
    </>
  );
}

function CaseFilePanel({
  game,
  displayNameOf,
  onAction,
}: {
  game: CourtView;
  displayNameOf: (playerId: string) => string;
  onAction: GameScreenProps["onAction"];
}) {
  const record = game.latestCase;
  const [card, setCard] = useState<{ blob: Blob; url: string } | null>(null);
  const nameOfRef = useRef(displayNameOf);

  useEffect(() => {
    if (!record) return;
    let cancelled = false;
    let url = "";
    drawCaseCard(record, nameOfRef.current)
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
        <img
          className="court-card-preview"
          src={card.url}
          alt={`Case ${record?.caseNumber} card: ${record?.headline}`}
        />
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

function CourtRecord({
  record,
  nameOf,
}: {
  record: RecordEntry[];
  nameOf: (playerId: string) => string;
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
                <span>{entry.text}</span>
                {entry.strokes && (
                  <svg
                    viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
                    role="img"
                    aria-label="The drawing submitted as Exhibit A"
                  >
                    <path d={strokesToPath(entry.strokes)} />
                  </svg>
                )}
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
    <button
      type="button"
      className="court-red"
      onClick={() => onAction("object", {})}
    >
      OBJECTION! ({game.myObjections} left)
    </button>
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

  // The first player's bar is yellow, and fills from the left.
  const meterName = `${nameOf(game.playerIds[0])} against ${nameOf(game.playerIds[1])}`;
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
  else if (stage === "moves")
    judgeLine = `Tip the scales, round ${game.moveRound} of ${game.moveRounds}. If you dare.`;
  else if (stage === "objection") judgeLine = "On what grounds?";
  else if (stage === "crossExam") judgeLine = game.crossQuestion ?? "";
  else if (stage === "closing") judgeLine = "Closing arguments. Plead for it!";
  else if (stage === "sealed") judgeLine = "My verdict is under this seal.";
  else if (stage === "punishment") judgeLine = "And now, the price.";

  const mover = game.mover;

  let panel: ReactNode = null;
  switch (stage) {
    case "setup": {
      const mine = game.setupChoices[myPlayerId];
      const theirs = game.setupChoices[partnerId];
      const badgeFor = (id: JudgeId) => {
        const me = mine?.judge === id;
        const them = theirs?.judge === id;
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
            selected={mine?.judge ?? null}
            onPick={(judge) => onAction("setup", { judge })}
          />
          <button
            type="button"
            className="court-plain"
            aria-pressed={mine?.crossExam ?? true}
            onClick={() =>
              onAction("setup", { crossExam: !(mine?.crossExam ?? true) })
            }
          >
            Cross-examination: you {mine?.crossExam ? "on" : "off"}, {partner}{" "}
            {theirs?.crossExam ? "on" : "off"}
          </button>
          <ContinueButton
            game={game}
            label={
              game.setupAgreed ? "Court is in session" : "Agree on both first"
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
    case "moveReact":
    case "crossReact":
      panel = !game.judgeThinking && (
        <>
          <ObjectButton game={game} onAction={onAction} />
          <ContinueButton game={game} label="Carry on" onAction={onAction} />
        </>
      );
      break;
    case "moves":
      panel = (
        <MovesPanel
          game={game}
          isMine={mover === myPlayerId}
          moverName={partner}
          onAction={onAction}
        />
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
            label="Back to the case"
            onAction={onAction}
          />
        </>
      );
      break;
    case "crossExam":
      panel =
        game.crossQuestion === null ? null : iAmDefendant ? (
          <AnswerPanel game={game} onAction={onAction} />
        ) : (
          <Waiting>{waitOn(`${partner} is sweating...`)}</Waiting>
        );
      break;
    case "closing":
      panel = (
        <ClosingPanel
          game={game}
          deadline={state.deadline}
          serverTime={state.serverTime}
          onAction={onAction}
        />
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
            <span>{game.verdict?.punishment}</span>
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
          displayNameOf={(playerId) =>
            state.players.find((p) => p.playerId === playerId)?.displayName ??
            "Partner"
          }
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
          {state.deadline !== null && stage !== "closing" && (
            <Countdown
              deadline={state.deadline}
              serverTime={state.serverTime}
            />
          )}
          <span>
            {nameOf(game.playerIds[0])} {game.scores[game.playerIds[0]] ?? 0} ·{" "}
            {nameOf(game.playerIds[1])} {game.scores[game.playerIds[1]] ?? 0}
          </span>
        </div>
        <div
          className="court-meter"
          role="img"
          aria-label={`Case meter, ${meterName}: ${Math.round(game.meter)} out of 100`}
        >
          <div
            className="court-meter__fill"
            style={{ width: `${game.meter}%` }}
          />
          <div
            className="court-meter__spark"
            style={{ left: `${game.meter}%` }}
          >
            <svg viewBox="0 0 36 36" aria-hidden="true">
              <path d="M18 1 L22 14 L35 18 L22 22 L18 35 L14 22 L1 18 L14 14 Z" />
            </svg>
          </div>
        </div>
      </div>
      <div className="court__layout">
        <Stage game={game} nameOf={nameOf} judgeMood={judgeMood} />
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
          {judgeLine && (
            <div
              key={judgeLine}
              className={
                game.judgeThinking
                  ? "court-line court-line--thinking court-pop"
                  : "court-line court-pop"
              }
            >
              {judgeLine}
            </div>
          )}
          {game.autoPicked && stage === "hearing" && (
            <Waiting>Time ran out, so the Court picked something.</Waiting>
          )}
          {panel}
        </div>
        <CourtRecord record={game.record} nameOf={nameOf} />
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
