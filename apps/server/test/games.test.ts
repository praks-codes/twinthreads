import { describe, expect, it } from "vitest";
import { createGameRegistry } from "../src/games.js";

describe("createGameRegistry", () => {
  it("has the test game in development", () => {
    expect(createGameRegistry("development").has("test-game")).toBe(true);
  });

  it("never has the test game in production", () => {
    expect(createGameRegistry("production").has("test-game")).toBe(false);
  });
});
