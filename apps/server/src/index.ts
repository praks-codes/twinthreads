import { InMemoryRoomStore } from "@twinthreads/engine";
import { createEffectRunner } from "./ai/effects.js";
import { createAiProvider } from "./ai/provider.js";
import { buildApp } from "./app.js";
import { createGameRegistry } from "./games.js";
import { ConfigError, loadConfig, type Config } from "./config.js";

function readConfig(): Config {
  try {
    return loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}

const config = readConfig();
const now = () => Date.now();
const store = new InMemoryRoomStore(now);
const { app } = buildApp(config, {
  store,
  games: createGameRegistry(config.NODE_ENV),
  countRooms: () => store.size,
  now,
  // Named so it can use the app's logger, which only exists once this returns.
  runEffect: (gameId, effect) => runner(gameId, effect),
});
const runner = createEffectRunner({
  provider: createAiProvider(config),
  timeoutMs: config.AI_TIMEOUT_SECONDS * 1000,
  log: app.log,
  now,
});

let shuttingDown = false;
const shutdown = async (signal: NodeJS.Signals) => {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, "shutting down");
  await app.close();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

try {
  // All interfaces, so the container port and local network access work.
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
} catch (error) {
  app.log.fatal(error);
  process.exit(1);
}
