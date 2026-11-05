import { describe, expect, it } from "vitest";
import { RateLimiter } from "../src/rate-limit.js";

describe("RateLimiter", () => {
  it("blocks attempts over the limit until the window resets", () => {
    let now = 0;
    const limiter = new RateLimiter(2, 1000, () => now);
    expect(limiter.allow("a")).toBe(true);
    expect(limiter.allow("a")).toBe(true);
    expect(limiter.allow("a")).toBe(false);
    now = 1000;
    expect(limiter.allow("a")).toBe(true);
  });

  it("counts each key separately", () => {
    const limiter = new RateLimiter(1, 1000, () => 0);
    expect(limiter.allow("a")).toBe(true);
    expect(limiter.allow("b")).toBe(true);
    expect(limiter.allow("a")).toBe(false);
  });
});
