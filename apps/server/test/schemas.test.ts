import { describe, expect, it } from "vitest";
import {
  roomCreateSchema,
  roomJoinSchema,
  roomLeaveSchema,
} from "../src/schemas.js";

describe("roomCreateSchema", () => {
  it("trims the display name", () => {
    const parsed = roomCreateSchema.parse({
      gameId: "court",
      displayName: "  Sam ",
    });
    expect(parsed.displayName).toBe("Sam");
  });

  it.each([
    [{ gameId: "mystery", displayName: "Sam" }],
    [{ gameId: "court", displayName: "   " }],
    [{ gameId: "court", displayName: "x".repeat(25) }],
    [{ gameId: "court", displayName: "a\u0000b" }],
    [{ gameId: "court", displayName: "Sam", extra: true }],
    ["not an object"],
    [undefined],
  ])("rejects %j", (payload) => {
    expect(roomCreateSchema.safeParse(payload).success).toBe(false);
  });
});

describe("roomJoinSchema", () => {
  it("normalises a lower-case code", () => {
    const parsed = roomJoinSchema.parse({ code: "k7m2qx", displayName: "Sam" });
    expect(parsed.code).toBe("K7M2QX");
  });

  it.each(["K7M2Q", "K7M2QXX", "O7M2QX", "17M2QX", "K7-2QX"])(
    "rejects the code %s",
    (code) => {
      const result = roomJoinSchema.safeParse({ code, displayName: "Sam" });
      expect(result.success).toBe(false);
    },
  );
});

describe("roomLeaveSchema", () => {
  it("accepts only an empty object", () => {
    expect(roomLeaveSchema.safeParse({}).success).toBe(true);
    expect(roomLeaveSchema.safeParse({ playerId: "x" }).success).toBe(false);
  });
});
