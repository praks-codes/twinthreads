import type { GameEffect } from "@twinthreads/engine";
import type { FastifyBaseLogger } from "fastify";
import { COURT_PROMPTS } from "./court-prompts.js";
import type { AiProvider } from "./provider.js";

/** Models sometimes wrap JSON in other text, so this finds the object inside. */
export function parseModelJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Turns a game's effect into an AI request. Every failure becomes null, and the
 * game then uses its backup lines. Logs never include what players wrote.
 */
export function createEffectRunner(options: {
  provider: AiProvider | null;
  timeoutMs: number;
  log: Pick<FastifyBaseLogger, "info" | "warn">;
  now: () => number;
}) {
  const { provider, timeoutMs, log, now } = options;

  return async (gameId: string, effect: GameEffect): Promise<unknown> => {
    const prompt = COURT_PROMPTS.get(gameId)?.(effect);
    if (!provider || !prompt) return null;

    const startedAt = now();
    const context = { gameId, effectKind: effect.kind };
    try {
      const text = await provider.complete({
        ...prompt,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const output = parseModelJson(text);
      log.info(
        { ...context, ms: now() - startedAt, parsed: output !== null },
        "ai reply",
      );
      return output;
    } catch (err) {
      log.warn(
        {
          ...context,
          ms: now() - startedAt,
          reason: err instanceof Error ? err.message : "unknown",
        },
        "ai failed, using backup lines",
      );
      return null;
    }
  };
}
