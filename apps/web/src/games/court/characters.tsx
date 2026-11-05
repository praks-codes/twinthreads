import type { Crowd, JudgeMood, Mood } from "@twinthreads/court";

const INK = "#3D0D33";
const line = { fill: "none", stroke: INK, strokeLinecap: "round" } as const;

export function Cupid({ mood }: { mood: JudgeMood }) {
  return (
    <svg
      viewBox="0 0 200 220"
      role="img"
      aria-label={`Judge Cupid, looking ${mood}`}
    >
      <g fill="#fff" stroke={INK} strokeWidth="4">
        <path d="M42 132 C8 112 8 74 22 70 C30 92 44 100 58 106 Z" />
        <path d="M158 132 C192 112 192 74 178 70 C170 92 156 100 142 106 Z" />
      </g>
      <path
        d="M58 216 C54 170 70 146 100 146 C130 146 146 170 142 216 Z"
        fill="#6B2E8F"
        stroke={INK}
        strokeWidth="4"
      />
      <circle
        cx="100"
        cy="96"
        r="54"
        fill="#FFD3B6"
        stroke={INK}
        strokeWidth="4"
      />
      <g fill="#fff" stroke={INK} strokeWidth="4">
        <circle cx="46" cy="96" r="17" />
        <circle cx="154" cy="96" r="17" />
        <circle cx="50" cy="66" r="19" />
        <circle cx="150" cy="66" r="19" />
        <circle cx="72" cy="42" r="21" />
        <circle cx="128" cy="42" r="21" />
        <circle cx="100" cy="34" r="22" />
      </g>
      <circle cx="66" cy="118" r="12" fill="#FF8FB8" />
      <circle cx="134" cy="118" r="12" fill="#FF8FB8" />
      <circle cx="78" cy="96" r={mood === "shocked" ? 12 : 9} fill={INK} />
      <circle cx="122" cy="96" r={mood === "shocked" ? 12 : 9} fill={INK} />
      {mood === "tired" && (
        <g>
          <path
            d="M66 86 H90 V96 H66 Z M110 86 H134 V96 H110 Z"
            fill="#FFD3B6"
          />
          <path
            d="M65 96 H91 M109 96 H135 M90 128 Q100 122 110 128"
            {...line}
            strokeWidth="4"
          />
        </g>
      )}
      {mood === "stern" && (
        <path
          d="M62 76 L90 86 M138 76 L110 86 M88 128 H112"
          {...line}
          strokeWidth="6"
        />
      )}
      {mood === "pleased" && (
        <path d="M84 122 Q100 142 116 122" {...line} strokeWidth="4" />
      )}
      {mood === "shocked" && (
        <ellipse cx="100" cy="130" rx="9" ry="12" fill={INK} />
      )}
      <g transform="rotate(32 158 170)">
        <rect x="154" y="150" width="8" height="58" rx="3" fill={INK} />
        <path
          d="M158 158 C146 142 130 150 136 132 C140 120 154 124 158 134 C162 124 176 120 180 132 C186 150 170 142 158 158 Z"
          fill="#FF3B6B"
          stroke={INK}
          strokeWidth="4"
        />
      </g>
    </svg>
  );
}

export function Blob({
  mood,
  color,
  label,
}: {
  mood: Mood;
  color: string;
  label: string;
}) {
  const closedEyes = mood === "laugh" || mood === "love" || mood === "happy";
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label={`${label}, ${mood}`}>
      <path
        d="M60 8 C92 6 112 30 110 62 C108 94 90 112 60 112 C30 112 12 96 10 62 C8 30 28 10 60 8 Z"
        fill={color}
        stroke={INK}
        strokeWidth="4"
      />
      <path
        d="M32 30 Q42 18 56 18"
        fill="none"
        stroke="#fff"
        strokeWidth="6"
        strokeLinecap="round"
        opacity=".7"
      />
      {closedEyes ? (
        <path
          d="M34 58 Q42 46 50 58 M70 58 Q78 46 86 58"
          {...line}
          strokeWidth="5"
        />
      ) : (
        <g fill={INK}>
          <circle cx="42" cy="56" r="7" />
          <circle cx="78" cy="56" r="7" />
        </g>
      )}
      {mood === "neutral" && <path d="M48 80 H72" {...line} strokeWidth="4" />}
      {mood === "happy" && (
        <path d="M44 74 Q60 92 76 74" {...line} strokeWidth="4" />
      )}
      {mood === "laugh" && (
        <g>
          <path
            d="M38 70 Q60 106 82 70 Z"
            fill="#FF3B6B"
            stroke={INK}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            className="court-tear"
            d="M22 62 C17 72 17 78 22 80 C27 78 27 72 22 62 Z"
            fill="#8FD9FF"
            stroke={INK}
            strokeWidth="2"
          />
        </g>
      )}
      {mood === "cry" && (
        <g>
          <path d="M44 88 Q60 70 76 88" {...line} strokeWidth="4" />
          <path d="M30 46 L48 42 M90 46 L72 42" {...line} strokeWidth="4" />
          <g fill="#8FD9FF" stroke={INK} strokeWidth="2">
            <rect
              className="court-tear"
              x="37"
              y="62"
              width="9"
              height="34"
              rx="4.5"
            />
            <rect
              className="court-tear"
              x="74"
              y="62"
              width="9"
              height="34"
              rx="4.5"
            />
          </g>
        </g>
      )}
      {mood === "annoyed" && (
        <g>
          <path d="M30 40 L52 50 M90 40 L68 50" {...line} strokeWidth="5" />
          <path d="M46 86 Q60 78 74 86" {...line} strokeWidth="4" />
          <path
            className="court-steam"
            d="M100 22 q6 -6 0 -12 M110 28 q6 -6 0 -12"
            {...line}
            strokeWidth="3"
          />
        </g>
      )}
      {mood === "nervous" && (
        <g>
          <path
            d="M44 80 Q50 74 56 80 Q62 86 68 80 Q72 76 76 80"
            {...line}
            strokeWidth="4"
          />
          <path
            className="court-tear"
            d="M98 28 C92 38 92 44 98 46 C104 44 104 38 98 28 Z"
            fill="#8FD9FF"
            stroke={INK}
            strokeWidth="3"
          />
        </g>
      )}
      {mood === "smug" && (
        <path
          d="M32 44 L50 48 M88 44 L70 48 M46 78 Q64 90 78 72"
          {...line}
          strokeWidth="4"
        />
      )}
      {mood === "love" && (
        <g>
          <path
            d="M46 74 Q60 94 74 74 Z"
            fill="#FF3B6B"
            stroke={INK}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <circle cx="30" cy="72" r="7" fill="#FF8FB8" />
          <circle cx="90" cy="72" r="7" fill="#FF8FB8" />
        </g>
      )}
    </svg>
  );
}

export function Gummy({ color, crowd }: { color: string; crowd: Crowd }) {
  return (
    <svg viewBox="0 0 40 52" aria-hidden="true">
      <g fill={color} stroke={INK} strokeWidth="2">
        <circle cx="10" cy="7" r="5" />
        <circle cx="30" cy="7" r="5" />
        <ellipse cx="20" cy="39" rx="14" ry="12" />
        <circle cx="20" cy="17" r="14" />
      </g>
      <circle cx="15" cy="16" r="2" fill={INK} />
      <circle cx="25" cy="16" r="2" fill={INK} />
      {crowd === "calm" && (
        <path d="M16 23 Q20 26 24 23" {...line} strokeWidth="2" />
      )}
      {crowd === "gasp" && <ellipse cx="20" cy="24" rx="3" ry="4" fill={INK} />}
      {crowd === "boo" && (
        <path d="M15 26 Q20 21 25 26" {...line} strokeWidth="2" />
      )}
      {(crowd === "aww" || crowd === "laugh") && (
        <path d="M15 22 Q20 29 25 22 Z" fill="#FF3B6B" stroke={INK} />
      )}
    </svg>
  );
}

export const KISS_PATH =
  "M10 38 C30 14 48 12 60 24 C72 12 90 14 110 38 C90 40 75 42 60 42 C45 42 30 40 10 38 Z M14 42 C30 46 45 48 60 48 C75 48 90 46 106 42 C92 66 74 74 60 74 C46 74 28 66 14 42 Z";

export const HEART_PATH =
  "M12 21 C4 14 2 10 2 7 C2 4 4.5 2 7 2 C9 2 11 3 12 5 C13 3 15 2 17 2 C19.5 2 22 4 22 7 C22 10 20 14 12 21 Z";

export function strokesToPath(strokes: number[][]): string {
  return strokes
    .map((stroke) => {
      let path = "";
      for (let i = 0; i + 1 < stroke.length; i += 2) {
        path += `${i === 0 ? "M" : "L"}${stroke[i]} ${stroke[i + 1]} `;
      }
      return path;
    })
    .join("");
}
