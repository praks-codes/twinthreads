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
