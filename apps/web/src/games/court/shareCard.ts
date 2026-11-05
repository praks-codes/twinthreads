import type { CaseRecord } from "@twinthreads/court";
import { HEART_PATH, KISS_PATH } from "./characters.js";

const WIDTH = 1080;
const INK = "#3D0D33";
const BODY_FONT = "700 34px 'Baloo 2', sans-serif";
const CONVERSATION_TOP = 395;
const BUBBLE_WIDTH = 860;
const BUBBLE_TEXT_WIDTH = 800;
const BUBBLE_LINE = 42;
const BUBBLE_GAP = 22;

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function writeLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): number {
  const lines = wrap(ctx, text, maxWidth);
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) shown[maxLines - 1] += "...";
  shown.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  return y + shown.length * lineHeight;
}

function panel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 36);
  ctx.fillStyle = INK;
  ctx.translate(0, 10);
  ctx.fill();
  ctx.translate(0, -10);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function stamp(
  ctx: CanvasRenderingContext2D,
  path: string,
  x: number,
  y: number,
  scale: number,
  fill: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = fill;
  ctx.fill(new Path2D(path));
  ctx.restore();
}

/** Draws one case as a picture, with no server involved. */
export async function drawCaseCard(
  record: CaseRecord,
  nameOf: (playerId: string) => string,
): Promise<Blob> {
  await Promise.all([
    document.fonts.load("60px Chango"),
    document.fonts.load("700 40px 'Baloo 2'"),
    document.fonts.load("800 34px 'Baloo 2'"),
  ]).catch(() => undefined);

  // The card is as tall as the case, so nothing that was said gets cut off.
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("Canvas isn't available");
  measure.font = BODY_FONT;
  const bubbles = record.conversation.map((entry) => {
    const lines = wrap(measure, entry.text, BUBBLE_TEXT_WIDTH);
    return { entry, lines, height: 82 + lines.length * BUBBLE_LINE };
  });
  const conversationHeight = bubbles.reduce(
    (sum, bubble) => sum + bubble.height + BUBBLE_GAP,
    0,
  );
  const quoteLines = wrap(measure, `"${record.quote}"`, 900);
  const punishmentLines = wrap(measure, record.punishment ?? "", 840);
  const endingHeight =
    record.ending === "pardoned"
      ? 240
      : record.punishment
        ? 70 + punishmentLines.length * BUBBLE_LINE
        : 0;
  const height =
    CONVERSATION_TOP +
    conversationHeight +
    130 +
    quoteLines.length * BUBBLE_LINE +
    endingHeight +
    110;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't available");

  ctx.fillStyle = "#FF8FB8";
  ctx.fillRect(0, 0, WIDTH, height);
  [
    [20, 150, 3],
    [960, 90, 4],
    [960, height - 200, 3],
    [20, height - 160, 4],
  ].forEach(([x, y, scale]) =>
    stamp(ctx, HEART_PATH, x ?? 0, y ?? 0, scale ?? 1, "#FFB3CF"),
  );

  ctx.textAlign = "center";
  ctx.fillStyle = INK;
  ctx.font = "58px Chango, sans-serif";
  ctx.fillText("Relationship Court", WIDTH / 2, 110);
  ctx.font = BODY_FONT;
  ctx.fillText(
    `Case ${record.caseNumber}: ${nameOf(record.prosecutor)} v ${nameOf(record.defendant)}`,
    WIDTH / 2,
    170,
  );
  panel(ctx, 70, 205, 940, 150, "#FFF4F9");
  ctx.fillStyle = INK;
  ctx.font = "44px Chango, sans-serif";
  writeLines(ctx, record.headline.toUpperCase(), WIDTH / 2, 263, 860, 56, 2);

  // The prosecutor sits on the left, the defendant on the right, the judge between.
  let y = CONVERSATION_TOP;
  ctx.textAlign = "left";
  for (const { entry, lines, height: bubbleHeight } of bubbles) {
    const judge = entry.speaker === "judge";
    const prosecutor = entry.speaker === record.prosecutor;
    const x = judge ? 110 : prosecutor ? 70 : 150;
    panel(
      ctx,
      x,
      y,
      BUBBLE_WIDTH,
      bubbleHeight,
      judge ? "#FFFFFF" : prosecutor ? "#FFE27A" : "#8FD9FF",
    );
    const speaker = judge ? "Judge Cupid" : nameOf(entry.speaker);
    const label =
      entry.label === "Judge" ? speaker : `${speaker}: ${entry.label}`;
    ctx.fillStyle = INK;
    ctx.font = "800 28px 'Baloo 2', sans-serif";
    ctx.fillText(label, x + 30, y + 42);
    ctx.font = BODY_FONT;
    lines.forEach((line, index) =>
      ctx.fillText(line, x + 30, y + 88 + index * BUBBLE_LINE),
    );
    y += bubbleHeight + BUBBLE_GAP;
  }

  const word =
    record.ending === "dismissed"
      ? "DISMISSED"
      : record.guilty
        ? "GUILTY"
        : "NOT GUILTY";
  ctx.save();
  ctx.translate(WIDTH / 2, y + 60);
  ctx.rotate(-0.05);
  ctx.textAlign = "center";
  ctx.font = "84px Chango, sans-serif";
  ctx.lineWidth = 12;
  ctx.strokeStyle = INK;
  ctx.strokeText(word, 0, 20);
  ctx.fillStyle = "#FFE27A";
  ctx.fillText(word, 0, 20);
  ctx.restore();
  y += 130;

  ctx.textAlign = "center";
  ctx.fillStyle = INK;
  ctx.font = BODY_FONT;
  quoteLines.forEach((line, index) =>
    ctx.fillText(line, WIDTH / 2, y + index * BUBBLE_LINE),
  );
  y += quoteLines.length * BUBBLE_LINE;

  if (record.ending === "pardoned") {
    stamp(ctx, KISS_PATH, WIDTH / 2 - 108, y, 1.8, "#FF3B6B");
    ctx.fillStyle = INK;
    ctx.font = "44px Chango, sans-serif";
    ctx.fillText("PARDONED WITH A KISS", WIDTH / 2, y + 185);
  } else if (record.punishment) {
    ctx.font = "800 30px 'Baloo 2', sans-serif";
    ctx.fillText("PUNISHMENT", WIDTH / 2, y + 30);
    ctx.font = BODY_FONT;
    punishmentLines.forEach((line, index) =>
      ctx.fillText(line, WIDTH / 2, y + 76 + index * BUBBLE_LINE),
    );
  }

  ctx.fillStyle = INK;
  ctx.font = "800 34px 'Baloo 2', sans-serif";
  ctx.fillText(
    "Judged by Cupid. Played on TwinThreads.",
    WIDTH / 2,
    height - 45,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No image"))),
      "image/png",
    );
  });
}

/** Opens the phone's share sheet where it exists, and downloads otherwise. */
export async function shareCard(blob: Blob, caseNumber: number): Promise<void> {
  const name = `relationship-court-case-${caseNumber}.png`;
  const file = new File([blob], name, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Relationship Court" });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
