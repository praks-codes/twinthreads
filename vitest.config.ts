import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    // Tests run against workspace source, so no build is needed first.
    alias: {
      "@twinthreads/engine": source("./packages/engine/src/index.ts"),
      "@twinthreads/court": source("./packages/games/court/src/index.ts"),
      "@twinthreads/test-game": source(
        "./packages/games/test-game/src/index.ts",
      ),
    },
  },
  test: {
    include: ["apps/*/test/**/*.test.ts", "packages/**/test/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
