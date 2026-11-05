import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../src/config.js";

const valid = {
  NODE_ENV: "test",
  PORT: "3001",
  CLIENT_ORIGIN: "http://localhost:5173",
  ROOM_IDLE_MINUTES: "30",
  RECONNECT_GRACE_SECONDS: "60",
  LOG_LEVEL: "info",
};

describe("loadConfig", () => {
  it("parses valid values", () => {
    expect(loadConfig(valid).PORT).toBe(3001);
  });

  it("names the missing variable", () => {
    const missing: Record<string, string | undefined> = {
      ...valid,
      PORT: undefined,
    };
    expect(() => loadConfig(missing)).toThrow(ConfigError);
    expect(() => loadConfig(missing)).toThrow(/PORT/);
  });
});
