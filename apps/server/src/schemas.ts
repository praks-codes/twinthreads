import { z } from "zod";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "./room-code.js";

const displayName = z
  .string()
  .trim()
  .min(1)
  .max(24)
  .regex(/^[^\p{C}]+$/u, "No control characters");

const roomCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`));

export const roomCreateSchema = z.strictObject({
  gameId: z.string().min(1).max(64),
  displayName,
});

export const roomJoinSchema = z.strictObject({
  code: roomCode,
  displayName,
  playerToken: z.string().min(1).max(128).optional(),
});

export const roomLeaveSchema = z.strictObject({});

export const roomReadySchema = z.strictObject({ ready: z.boolean() });

// The payload is left to the game's own parseAction.
export const gameActionSchema = z.strictObject({
  type: z.string().min(1).max(64),
  payload: z.unknown(),
});

export const roomRematchSchema = z.strictObject({});
