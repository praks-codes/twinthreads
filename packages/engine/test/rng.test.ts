import { describe, expect, it } from "vitest";
import { createSeededRng } from "../src/rng.js";

describe("createSeededRng", () => {
  it("repeats the same sequence for the same seed", () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    const sequence = Array.from({ length: 100 }, () => a.next());
    expect(sequence).toEqual(Array.from({ length: 100 }, () => b.next()));
  });

  it("produces a different sequence for a different seed", () => {
    expect(createSeededRng(1).next()).not.toBe(createSeededRng(2).next());
  });

  it("keeps next() within [0, 1)", () => {
    const rng = createSeededRng(7);
    for (let i = 0; i < 10_000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("returns every integer in an inclusive range and nothing else", () => {
    const rng = createSeededRng(7);
    const seen = new Set(Array.from({ length: 1000 }, () => rng.int(1, 6)));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("rejects an invalid range", () => {
    expect(() => createSeededRng(1).int(5, 1)).toThrow(RangeError);
  });
});
