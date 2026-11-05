import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().int().min(1).max(65535),
  CLIENT_ORIGIN: z.url(),
  ROOM_IDLE_MINUTES: z.coerce.number().positive(),
  RECONNECT_GRACE_SECONDS: z.coerce.number().positive(),
  LOG_LEVEL: z.enum([
    "fatal",
    "error",
    "warn",
    "info",
    "debug",
    "trace",
    "silent",
  ]),
  // Optional, so existing .env files keep working. "none" plays with backup lines.
  AI_PROVIDER: z
    .enum(["ollama", "openai-compatible", "none"])
    .default("ollama"),
  AI_MODEL: z.string().min(1).default("gemma3:4b"),
  AI_BASE_URL: z.url().optional(),
  AI_API_KEY: z.string().min(1).optional(),
  AI_TIMEOUT_SECONDS: z.coerce.number().positive().default(45),
});

export type Config = z.infer<typeof schema>;

export class ConfigError extends Error {}

/** Throws naming the invalid variables. Never includes their values. */
export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const parsed = schema.safeParse(env);
  if (parsed.success) return parsed.data;
  const names = parsed.error.issues.map((issue) => issue.path.join("."));
  throw new ConfigError(
    `Invalid or missing environment variables: ${[...new Set(names)].join(", ")}. ` +
      "Copy apps/server/.env.example to apps/server/.env and check the values.",
  );
}
