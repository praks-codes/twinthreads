import {
  MOOD_EMOJI,
  WITNESSES,
  type Crowd,
  type CourtView,
  type JudgeMood,
} from "@twinthreads/court";
import { useEffect, useRef, useState } from "react";
import {
  Blob,
  Cupid,
  Gummy,
  HEART_PATH,
  KISS_PATH,
  strokesToPath,
} from "./characters.js";

export const SEAT_COLORS = ["#FFE27A", "#8FD9FF"] as const;
const GUMMY_COLORS = ["#8FD9FF", "#FFE27A", "#B9F2C8", "#FFB070", "#D7B8FF"];
const CROWD_WORD: Record<Crowd, string> = {
  calm: "",
  gasp: "GASP!",
  boo: "BOOOHOOO!",
  aww: "AWWWW!",
  laugh: "HAHAHA!",
};

/** Reveals text a little at a time, restarting whenever the text changes. */
function useTypewriter(text: string): string {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
    if (!text) return;
    const timer = setInterval(() => {
      setShown((count) => {
        if (count >= text.length) clearInterval(timer);
        return count + 2;
      });
    }, 40);
    return () => clearInterval(timer);
  }, [text]);
  return text.slice(0, shown);
}

function Bubble({ text, side }: { text: string; side: "left" | "right" }) {
  const typed = useTypewriter(text);
  if (!text) return null;
  return <div className={`court-bubble court-bubble--${side}`}>{typed}</div>;
}

function seatSpeech(game: CourtView, playerId: string): string {
  const { stage, currentMove, objection } = game;
  const says: string[] = [];
  if (stage === "ruling" && objection?.by === playerId && objection.argument) {
    says.push(objection.argument);
  } else if (stage === "crossReact" && playerId === game.defendant) {
    says.push(game.crossAnswer ?? "");
  } else if (stage === "moveReact" && currentMove?.by === playerId) {
    const witness =
      currentMove.kind === "witness" ? WITNESSES[currentMove.option] : null;
    says.push(
      witness ? `${witness.name}: ${currentMove.says}` : currentMove.says,
    );
  } else if (stage === "aftermath" && game.take !== null) {
    if (playerId === game.verdict?.loser) {
      says.push(
        game.take === 0 ? "I accept, with dignity." : "*sulks dramatically*",
      );
    }
  } else if (
    stage === "defend" ||
    stage === "hearing" ||
    stage === "objection"
  ) {
    if (playerId === game.prosecutor) says.push(game.accusation ?? "");
    if (playerId === game.defendant && stage !== "defend") {
      says.push(game.defense ?? "");
    }
  }
  return says.join(" ");
}

function stageCrowd(game: CourtView): { crowd: Crowd; word: string } {
  if (game.stage === "closing") return { crowd: "gasp", word: "GO GO GO!" };
  if (game.stage === "objection") return { crowd: "gasp", word: "OOOH!" };
  const reaction =
    game.stage === "ruling" ? game.objection?.reaction : game.reaction;
  const showing = [
    "hearing",
    "moveReact",
    "ruling",
    "crossReact",
    "verdict",
    "punishment",
    "aftermath",
  ].includes(game.stage);
  const crowd =
    game.stage === "punishment" ? "boo" : (reaction?.crowd ?? "calm");
  return showing && crowd !== "calm"
    ? { crowd, word: CROWD_WORD[crowd] }
    : { crowd: "calm", word: "" };
}

/** Floats a player's emoji up whenever their emote count changes. */
function EmoteFloat({ count, emoji }: { count: number; emoji: string }) {
  const [items, setItems] = useState<{ id: number; emoji: string }[]>([]);
  const lastCount = useRef(count);
  useEffect(() => {
    if (count === lastCount.current) return;
    lastCount.current = count;
    setItems((current) => [...current, { id: count, emoji }]);
    const timer = setTimeout(
      () => setItems((current) => current.filter((i) => i.id !== count)),
      1800,
    );
    return () => clearTimeout(timer);
  }, [count, emoji]);
  return (
    <>
      {items.map((item) => (
        <span key={item.id} className="court-emote" aria-hidden="true">
          {item.emoji}
        </span>
      ))}
    </>
  );
}

function CrowdGroup({ crowd, start }: { crowd: Crowd; start: number }) {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={crowd === "calm" ? "court-gummy" : "court-gummy court-hop"}
          style={{ animationDelay: `${-0.13 * i - start * 0.2}s` }}
        >
          <Gummy
            crowd={crowd}
            color={GUMMY_COLORS[(i + start) % 5] ?? "#8FD9FF"}
          />
        </span>
      ))}
    </>
  );
}

export function Stage({
  game,
  nameOf,
  judgeMood,
}: {
  game: CourtView;
  nameOf: (playerId: string) => string;
  judgeMood: JudgeMood;
}) {
  const [left, right] = game.playerIds;
  const { crowd, word } = stageCrowd(game);
  const showExhibit =
    game.stage === "moveReact" &&
    game.currentMove?.kind === "evidence" &&
    game.currentMove.strokes.length > 0;
  const pardoned = game.stage === "aftermath" && game.ending === "pardoned";

  const seat = (playerId: string, side: "left" | "right", color: string) => {
    const mood = game.moods[playerId] ?? "neutral";
    const emote = game.emotes[playerId];
    const name = nameOf(playerId);
    return (
      <>
        <Bubble text={seatSpeech(game, playerId)} side={side} />
        <div className={`court-player court-player--${side}`}>
          {MOOD_EMOJI[mood] && (
            <span className="court-mood-emoji" aria-hidden="true">
              {MOOD_EMOJI[mood]}
            </span>
          )}
          <EmoteFloat count={emote?.count ?? 0} emoji={emote?.emoji ?? ""} />
          <Blob mood={mood} color={color} label={name} />
        </div>
        <div
          className={`court-podium court-podium--${side}`}
          style={{ background: color }}
        >
          {name}
        </div>
      </>
    );
  };

  return (
    <div className="court-stage">
      <div className="court-stage__inner">
        <svg className="court-backheart" viewBox="0 0 24 24" aria-hidden="true">
          <path d={HEART_PATH} />
        </svg>
        <div className="court-floor" />
        <div className="court-crowd court-crowd--left">
          <CrowdGroup crowd={crowd} start={0} />
        </div>
        <div className="court-crowd court-crowd--right">
          <CrowdGroup crowd={crowd} start={2} />
        </div>
        <div className="court-rail court-rail--left" />
        <div className="court-rail court-rail--right" />
        <div className="court-judge court-wobble">
          <Cupid mood={judgeMood} />
        </div>
        <div className="court-bench">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={HEART_PATH} />
          </svg>
        </div>
        <svg
          className="court-curtains"
          viewBox="0 0 390 230"
          aria-hidden="true"
        >
          <path d="M0 0 H62 C58 78 34 150 8 194 C4 200 0 200 0 200 Z" />
          <path d="M390 0 H328 C332 78 356 150 382 194 C386 200 390 200 390 200 Z" />
          <path d="M0 0H390V22Q366 48 341 22Q317 48 292 22Q268 48 243 22Q219 48 195 22Q170 48 146 22Q122 48 97 22Q73 48 48 22Q24 48 0 22Z" />
        </svg>
        {word && (
          <>
            <div key={word} className="court-shout court-shout--left court-pop">
              {word}
            </div>
            <div
              key={`${word}-r`}
              className="court-shout court-shout--right court-pop"
            >
              {word}
            </div>
          </>
        )}
        {seat(left, "left", SEAT_COLORS[0])}
        {seat(right, "right", SEAT_COLORS[1])}
        {showExhibit && game.currentMove && (
          <div className="court-exhibit court-pop">
            <strong>Exhibit A</strong>
            <svg
              viewBox="0 0 340 150"
              role="img"
              aria-label="Exhibit A drawing"
            >
              <path d={strokesToPath(game.currentMove.strokes)} />
            </svg>
          </div>
        )}
        {pardoned && (
          <svg
            className="court-kiss court-stamp"
            viewBox="0 0 120 80"
            role="img"
            aria-label="A lipstick kiss mark"
          >
            <path d={KISS_PATH} />
          </svg>
        )}
      </div>
    </div>
  );
}
