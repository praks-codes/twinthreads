import { describe, expect, it } from "vitest";
import { generateRoomCode, ROOM_CODE_ALPHABET } from "../src/room-code.js";

describe("generateRoomCode", () => {
  it("produces six characters from the alphabet", () => {
    for (let i = 0; i < 1000; i++) {
      expect(generateRoomCode()).toMatch(
        /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/,
      );
    }
  });

  it("leaves out the confusable characters", () => {
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[01OIL]/);
    expect(ROOM_CODE_ALPHABET).toHaveLength(31);
  });

  it("uses every character in the alphabet", () => {
    const seen = new Set(
      Array.from({ length: 2000 }, generateRoomCode).join(""),
    );
    expect(seen.size).toBe(ROOM_CODE_ALPHABET.length);
  });
});
