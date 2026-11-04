import type { Rng } from "./types.js";

/** Small deterministic generator (mulberry32). Not for secrets such as room codes. */
export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
        throw new RangeError(`Invalid int range: ${min}..${max}`);
      }
      return min + Math.floor(next() * (max - min + 1));
    },
  };
}
