import type { CaseRecord } from "@twinthreads/court";
import { HEART_PATH, KISS_PATH } from "./characters.js";

const WIDTH = 1080;
const HEIGHT = 1350;
const INK = "#3D0D33";

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

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't available");

  ctx.fillStyle = "#FF8FB8";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  [
    [80, 150, 3],
    [930, 90, 4],
    [950, 1130, 3],
    [50, 1190, 4],
  ].forEach(([x, y, scale]) =>
    stamp(ctx, HEART_PATH, x ?? 0, y ?? 0, scale ?? 1, "#FFB3CF"),
  );

  ctx.textAlign = "center";
  ctx.fillStyle = INK;
  ctx.font = "58px Chango, sans-serif";
  ctx.fillText("Relationship Court", WIDTH / 2, 110);
  ctx.font = "700 40px 'Baloo 2', sans-serif";
  ctx.fillText(
    `Case ${record.caseNumber}: ${nameOf(record.prosecutor)} v ${nameOf(record.defendant)}`,
    WIDTH / 2,
    170,
  );

  panel(ctx, 70, 210, 940, 150, "#FFE27A");
  ctx.fillStyle = INK;
  ctx.font = "44px Chango, sans-serif";
  writeLines(ctx, record.headline.toUpperCase(), WIDTH / 2, 268, 860, 56, 2);

  ctx.textAlign = "left";
  panel(ctx, 70, 395, 940, 205, "#FFFFFF");
  ctx.fillStyle = INK;
  ctx.font = "800 32px 'Baloo 2', sans-serif";
  ctx.fillText("THE ACCUSATION", 110, 445);
  ctx.font = "700 38px 'Baloo 2', sans-serif";
  writeLines(ctx, record.accusation, 110, 495, 860, 46, 2);

  panel(ctx, 70, 630, 940, 205, "#FFFFFF");
  ctx.fillStyle = INK;
  ctx.font = "800 32px 'Baloo 2', sans-serif";
  ctx.fillText("THE DEFENSE", 110, 680);
  ctx.font = "700 38px 'Baloo 2', sans-serif";
  writeLines(ctx, record.defense, 110, 730, 860, 46, 2);

  const word =
    record.ending === "dismissed"
      ? "DISMISSED"
      : record.guilty
        ? "GUILTY"
        : "NOT GUILTY";
  ctx.save();
  ctx.translate(WIDTH / 2, 905);
  ctx.rotate(-0.05);
  ctx.textAlign = "center";
  ctx.font = "84px Chango, sans-serif";
  ctx.lineWidth = 12;
  ctx.strokeStyle = INK;
  ctx.strokeText(word, 0, 20);
  ctx.fillStyle = "#FFE27A";
  ctx.fillText(word, 0, 20);
  ctx.restore();

  ctx.textAlign = "center";
  ctx.fillStyle = INK;
  ctx.font = "700 36px 'Baloo 2', sans-serif";
  const quoteEnd = writeLines(
    ctx,
    `"${record.quote}"`,
    WIDTH / 2,
    985,
    900,
    44,
    2,
  );

  const boxTop = Math.max(quoteEnd, 1045);
  if (record.ending === "pardoned") {
    stamp(ctx, KISS_PATH, WIDTH / 2 - 108, boxTop - 25, 1.8, "#FF3B6B");
    ctx.fillStyle = INK;
    ctx.font = "44px Chango, sans-serif";
    ctx.fillText("PARDONED WITH A KISS", WIDTH / 2, boxTop + 160);
  } else if (record.punishment) {
    ctx.font = "800 32px 'Baloo 2', sans-serif";
    ctx.fillText("PUNISHMENT", WIDTH / 2, boxTop + 20);
    ctx.font = "700 36px 'Baloo 2', sans-serif";
    writeLines(ctx, record.punishment, WIDTH / 2, boxTop + 66, 840, 44, 2);
  }

  ctx.fillStyle = INK;
  ctx.font = "800 34px 'Baloo 2', sans-serif";
  ctx.fillText("Judged by Cupid. Played on TwinThreads.", WIDTH / 2, 1305);

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
