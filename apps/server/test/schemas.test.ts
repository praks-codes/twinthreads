import { describe, expect, it } from "vitest";
import {
  gameActionSchema,
  roomCreateSchema,
  roomJoinSchema,
  roomLeaveSchema,
  roomReadySchema,
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
    [{ gameId: "", displayName: "Sam" }],
    [{ gameId: 5, displayName: "Sam" }],
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

describe("gameActionSchema", () => {
  it("needs a type and rejects extra fields", () => {
    const valid = { type: "pick", payload: { value: 1 } };
    expect(gameActionSchema.safeParse(valid).success).toBe(true);
    expect(gameActionSchema.safeParse({ payload: 1 }).success).toBe(false);
    expect(gameActionSchema.safeParse({ ...valid, x: 1 }).success).toBe(false);
  });
});

describe("roomReadySchema", () => {
  it("needs a boolean", () => {
    expect(roomReadySchema.safeParse({ ready: true }).success).toBe(true);
    expect(roomReadySchema.safeParse({ ready: "yes" }).success).toBe(false);
  });
});

describe("roomLeaveSchema", () => {
  it("accepts only an empty object", () => {
    expect(roomLeaveSchema.safeParse({}).success).toBe(true);
    expect(roomLeaveSchema.safeParse({ playerId: "x" }).success).toBe(false);
  });
});
