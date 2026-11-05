import type { AnyGame } from "@twinthreads/engine";
import { court } from "@twinthreads/court";
import { numberDuel } from "@twinthreads/test-game";
import type { Config } from "./config.js";

export type GameRegistry = ReadonlyMap<string, AnyGame>;

/** The games this server can run. The test game never runs in production. */
export function createGameRegistry(nodeEnv: Config["NODE_ENV"]): GameRegistry {
  const games = [
    court,
    ...(nodeEnv === "production" ? [] : [numberDuel]),
  ] as AnyGame[];
  return new Map(games.map((game) => [game.id, game]));
}
