import { describe, expect, it } from "vitest";
import { InMemoryRoomStore } from "../src/in-memory-room-store.js";
import type { RoomRecord } from "../src/types.js";

const room: RoomRecord = {
  code: "ABC234",
  gameId: "court",
  players: [],
  phase: "LOBBY",
  gameState: null,
  lastActiveAt: 0,
};

describe("InMemoryRoomStore", () => {
  it("creates, reads, updates and deletes a room", async () => {
    const store = new InMemoryRoomStore(() => 0);
    await store.create(room);
    expect(store.size).toBe(1);
    await store.update(room.code, { phase: "REVEAL" });
    expect((await store.get(room.code))?.phase).toBe("REVEAL");
    await store.delete(room.code);
    expect(await store.get(room.code)).toBeNull();
    expect(store.size).toBe(0);
  });

  it("refuses a duplicate code", async () => {
    const store = new InMemoryRoomStore(() => 0);
    await store.create(room);
    await expect(store.create(room)).rejects.toThrow("already exists");
  });

  it("touch refreshes lastActiveAt from the injected clock", async () => {
    const store = new InMemoryRoomStore(() => 1234);
    await store.create(room);
    await store.touch(room.code);
    expect((await store.get(room.code))?.lastActiveAt).toBe(1234);
  });

  it("rejects updates to a missing room", async () => {
    const store = new InMemoryRoomStore(() => 0);
    await expect(store.touch("NOPE22")).rejects.toThrow("not found");
  });
});
