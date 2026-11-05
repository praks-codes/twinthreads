export interface AiRequest {
  system: string;
  user: string;
  maxTokens: number;
  signal: AbortSignal;
}

/**
 * A model that returns JSON text. To add a provider, write one function that
 * returns this, then add it to createAiProvider and to AI_PROVIDER in config.ts.
 */
export interface AiProvider {
  complete(request: AiRequest): Promise<string>;
}

export interface AiProviderConfig {
  AI_PROVIDER: "ollama" | "openai-compatible" | "none";
  AI_MODEL: string;
  AI_BASE_URL?: string | undefined;
  AI_API_KEY?: string | undefined;
}

async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw new Error(`AI request failed: ${response.status}`);
  return response.json();
}

function ollamaProvider(baseUrl: string, model: string): AiProvider {
  return {
    async complete({ system, user, maxTokens, signal }) {
      const reply = (await postJson(
        `${baseUrl}/api/chat`,
        {
          model,
          stream: false,
          format: "json",
          keep_alive: "15m",
          // Room for the whole game. A smaller window would silently cut off the start.
          options: { temperature: 0.9, num_predict: maxTokens, num_ctx: 8192 },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        },
        {},
        signal,
      )) as { message?: { content?: unknown } };
      const content = reply.message?.content;
      if (typeof content !== "string") throw new Error("Empty AI reply");
      return content;
    },
  };
}

function openAiCompatibleProvider(
  baseUrl: string,
  model: string,
  apiKey: string | undefined,
): AiProvider {
  return {
    async complete({ system, user, maxTokens, signal }) {
      const reply = (await postJson(
        `${baseUrl}/chat/completions`,
        {
          model,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        },
        apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        signal,
      )) as { choices?: { message?: { content?: unknown } }[] };
      const content = reply.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("Empty AI reply");
      return content;
    },
  };
}

/** Null means no AI, so the game plays with its backup lines. */
export function createAiProvider(config: AiProviderConfig): AiProvider | null {
  switch (config.AI_PROVIDER) {
    case "ollama":
      return ollamaProvider(
        config.AI_BASE_URL ?? "http://127.0.0.1:11434",
        config.AI_MODEL,
      );
    case "openai-compatible":
      if (!config.AI_BASE_URL) {
        throw new Error("AI_BASE_URL is required for openai-compatible.");
      }
      return openAiCompatibleProvider(
        config.AI_BASE_URL,
        config.AI_MODEL,
        config.AI_API_KEY,
      );
    case "none":
      return null;
  }
}
