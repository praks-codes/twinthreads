import type { RoomRecord, RoomStore } from "./types.js";

export class InMemoryRoomStore implements RoomStore {
  readonly #rooms = new Map<string, RoomRecord>();
  readonly #now: () => number;

  /** The clock is injected because the engine never reads time itself. */
  constructor(now: () => number) {
    this.#now = now;
  }

  /** Room count for the health endpoint. Not part of RoomStore. */
  get size(): number {
    return this.#rooms.size;
  }

  async create(room: RoomRecord): Promise<void> {
    if (this.#rooms.has(room.code)) {
      throw new Error(`Room already exists: ${room.code}`);
    }
    this.#rooms.set(room.code, { ...room });
  }

  async get(code: string): Promise<RoomRecord | null> {
    const room = this.#rooms.get(code);
    return room ? { ...room } : null;
  }

  async update(code: string, patch: Partial<RoomRecord>): Promise<void> {
    this.#rooms.set(code, { ...this.#require(code), ...patch, code });
  }

  async delete(code: string): Promise<void> {
    this.#rooms.delete(code);
  }

  async touch(code: string): Promise<void> {
    this.#rooms.set(code, {
      ...this.#require(code),
      lastActiveAt: this.#now(),
    });
  }

  #require(code: string): RoomRecord {
    const room = this.#rooms.get(code);
    if (!room) throw new Error(`Room not found: ${code}`);
    return room;
  }
}
