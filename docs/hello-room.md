# Milestone 1: Hello Room

**Status:** approved, in progress.

## Goal

Two phones share a room code, see each other live, and survive a refresh. The same must work on tablets and laptops, in any mix of devices.

This is the room system every game will sit on. Nothing is playable yet.

## User flow

1. Player A enters a display name and taps **Create room**, then sees a code such as `K7M2QX` and "Waiting for your partner...".
2. Player B enters a display name and the code, then taps **Join room**.
3. Both screens show both names, live.
4. If either player refreshes, they land back in the same room automatically.
5. If either player drops, the other sees "Partner reconnecting...". When they return, the message clears.
6. **Leave** on the room screen asks "Are you sure?", then removes the player from the room and returns them to the home screen.
7. The partner immediately sees "Your partner left". The room code still works, so the player who left can rejoin by entering a name and the code again, or someone else with the code can take the free slot.
8. If the last player leaves, the room is deleted and its code stops working.

## In scope

### Server (`apps/server`)

- **Room codes:** see [Room codes](#room-codes).
- **Events:** `room:create`, `room:join`, `room:leave`, `room:joined`, `room:state` and `room:error`.
- **Validation:** a Zod schema for every incoming message. Unknown shapes are rejected.
- **Identity:** the server issues `playerId` and a secret `playerToken`. A rejoin needs a token that matches that room.
- **Snapshots:** `room:state` goes to both players on every change, and never contains a token.
- **Reconnect:** a disconnect keeps the slot for `RECONNECT_GRACE_SECONDS`. After that the room pauses, and it resumes if the player returns before it expires. If the same player connects twice, the newest connection replaces the older one.
- **Leave:** `room:leave` frees that player's slot and invalidates their token immediately. Unlike a dropped connection, there is no grace period. The room is deleted once no players remain.
- **Expiry:** see [Idle expiry](#idle-expiry).
- **Shutdown:** on SIGTERM, connected players are notified before the server exits.
- **Logs:** include `roomCode` and `playerId`, and never tokens.

Room logic stays in `apps/server` for this milestone, because it needs the clock and secure randomness. Anything pure can move to `packages/engine` in milestone 2.

### Web (`apps/web`)

- **`useRoom()` hook:** owns the socket, the stored token, reconnection and the latest `room:state`.
- **Home screen:** display name, create, or join with a code.
- **Room screen:** code, both players, connection status and Leave.
- **Shared platform components:** `Button`, `TextField`, `RoomCode`, `PlayerList` and `ConnectionBanner`, placed as described in `ARCHITECTURE.md` section 7.1.
- **Design foundations:** see below.

### Tests

- Unit tests for code generation, validation and rate limits.
- An integration test with two Socket.IO clients covering:
  - create and join
  - live updates to both players
  - reconnecting with a token
  - leaving: the partner is notified, the slot is freed, the code still works, and the old token is rejected
  - the room is deleted when the last player leaves
  - rejecting a wrong code, a third player and a wrong token
  - tokens never appearing in `room:state`
  - grace period and expiry, using short configured times

### Cleanup

- Delete the empty `.prettierrc.json`.

## Room codes

Each of the six characters is picked independently with Node's `crypto.randomInt`, from the 31-character alphabet in `ARCHITECTURE.md` section 6.2. That gives about 887 million codes, and `randomInt` avoids the bias of taking a random byte modulo 31.

Uniqueness comes from the room store: `create` refuses a code already in use, and the server retries with a new code up to 5 times, then returns an error. Letting `create` do the check is safer than looking the code up first, because two requests arriving together could both see a code as free. A code can be reused once its room is gone.

The generator lives in `apps/server`, because the engine can't use Node features. Not used: `Math.random()` and the seeded `Rng` (both predictable), counters (guessable), and trimmed UUIDs or hashes (wrong alphabet, no benefit).

## Idle expiry

A room expires after `ROOM_IDLE_MINUTES` with no valid event from a player's device. Connected players are told, and return to the home screen.

| Activity                                                                     | Keeps the room alive? |
| ---------------------------------------------------------------------------- | --------------------- |
| Successful `room:create`, `room:join` (including rejoining) and `room:leave` | Yes                   |
| `game:action`, `room:ready`, `room:rematch` (later milestones)               | Yes                   |
| Rejected messages (bad format, wrong token, over the rate limit)             | No                    |
| Server to device: `room:state`, `room:error`                                 | No                    |
| Socket.IO's automatic heartbeat                                              | No                    |
| Game state changing because a timer ran out (from milestone 3)               | No                    |

So two connected players who send nothing are expired, even in the middle of a pause. We can revisit the 30-minute default after real play at milestone 3.

## Accepted side effects of leaving

- Anyone with the code can take a free slot, not just the player who left.
- The code only survives while someone is in the room. If the last player leaves, the room is deleted and a new one is needed.

## Limits

These are starting values, kept as constants in the server unless we need to change them per environment.

| Limit                | Value              |
| -------------------- | ------------------ |
| Display name         | 1 to 24 characters |
| Message size         | 16 KB              |
| Messages per socket  | 20 per second      |
| Room creates per IP  | 10 per minute      |
| Join attempts per IP | 20 per minute      |

Rate limits are in memory, with no new dependency, and reset when the server restarts.

During local development every phone connects through the Vite proxy, so all of them count as one IP. Real per-IP limiting needs the proxy settings of the eventual host, which is a milestone 5 task.

## Errors

`room:error` sends a code and a user-safe message:

| Code            | Shown when                                    |
| --------------- | --------------------------------------------- |
| `INVALID`       | The message failed validation                 |
| `NOT_FOUND`     | The code is wrong or the room has expired     |
| `ROOM_FULL`     | Two players are already in the room           |
| `BAD_TOKEN`     | The token doesn't match a player in this room |
| `RATE_LIMITED`  | Too many attempts                             |
| `SHUTTING_DOWN` | The server is restarting                      |

## Design foundations

Shared CSS variables for colour, font, spacing and corner radius, in one file in `apps/web`.

- Mobile-first and responsive: a single column on phones, with the layout adapting for tablets and laptops.
- Tap targets at least 44px, no hover-only interactions, and keyboard and mouse work as well as touch.
- Follows the system light or dark setting.
- System fonts and a neutral palette as placeholders. The real look is decided in milestone 2a.
- No animation and no new styling dependency.

## Out of scope

- `room:ready`, `game:action` and `room:rematch` (milestone 2 or later)
- The phase engine and any game logic
- Profanity filtering
- Redis or any database
- Hosting or public access

## Decisions

| Decision               | Choice                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| New dependency         | `socket.io-client`, in `apps/web` and as a dev dependency of `apps/server` for tests. No other new ones |
| Rate limits            | Included now, in memory                                                                                 |
| `room:ready`           | Left for later, because this milestone doesn't need a ready button                                      |
| `gameId`               | Only `"court"` is accepted. No game logic runs and `game` in `room:state` is `null`                     |
| Different-network test | Deferred to milestone 5. Two phones on the same Wi-Fi pass for now. No tunnel                           |

## Contract changes

A new client-to-server event, with an empty payload, for a player leaving on purpose:

```ts
"room:leave": {}
```

`room:state` needs one new field, because the client must not decide this itself:

```ts
status: "waiting" | "active" | "reconnecting" | "paused" | "partner_left";
```

- `waiting`: only one player has joined.
- `active`: both players are connected.
- `reconnecting`: a player dropped and the grace period is running.
- `paused`: the grace period ended.
- `partner_left`: the other player left on purpose. It changes to `active` when someone joins.

`ARCHITECTURE.md` section 6.3 gets both changes in the same pull request as the code.

## Build order

Small commits on `feat/hello-room`:

1. Cleanup and design foundations
2. Room codes
3. Message schemas and limits
4. Create and join
5. Live `room:state`
6. Refresh, reconnect and leave
7. Expiry and shutdown
8. `useRoom()` hook
9. Home and room screens
10. Integration test
11. Docs, then open the pull request

## Done when

Automated: lint, typecheck, tests and build pass in CI.

On two devices on the same Wi-Fi, first two phones, then a phone and a laptop:

- [ ] Create a room on one phone and join from the other
- [ ] Both names appear on both screens without a refresh
- [ ] Refreshing either phone returns it to the same room
- [ ] Locking a phone for a minute, then returning, reconnects it
- [ ] The other phone shows "Partner reconnecting..." during a drop
- [ ] Tapping Leave shows "Your partner left" on the other phone
- [ ] The player who left can rejoin with the same code
- [ ] A wrong code shows a clear error
- [ ] A third device can't join a full room

iOS and Android treat background tabs differently, so this checklist may turn up reconnect bugs that need another round of fixes.
