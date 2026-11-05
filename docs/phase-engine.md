# Milestone 2: Phase engine

**Status:** draft, awaiting review. No code is written until this is approved.

## Goal

A fake test game runs through every phase, on two real devices.

The phase engine is the shared game loop. A new game should only need to supply its rules and its screens, while the engine and server handle turns, timers, secrets, reconnecting and rematches. Court is built on this in milestone 3.

## The test game

**Number Duel** exists only to exercise the engine, and is never shown to real players. It lives in `packages/games/test-game`.

Each of its 3 rounds works like this:

| Phase           | What happens                                                                            | How it ends                       |
| --------------- | --------------------------------------------------------------------------------------- | --------------------------------- |
| `PRIVATE_INPUT` | Each player secretly picks a number from 1 to 5. Neither can see the other's pick       | Both picked, or a 30-second timer |
| `REVEAL`        | Both picks and a random target number are shown                                         | 3-second timer                    |
| `SCORE`         | The player closest to the target gets a point, and a player who didn't pick can't score | 3-second timer                    |
| `NEXT_ROUND`    | Shows the upcoming round number                                                         | 2-second timer                    |

Why this game: the secret picks prove players can't see each other's data, the target proves seeded randomness, and the timers prove the server owns time.

## User flow

1. Both players are in a room, in `LOBBY`, and each taps **Ready**. They can undo it.
2. When both are ready and connected, the game starts.
3. They play 3 rounds through the phases above, with a countdown on screen.
4. `RESULTS` shows the scores and the winner.
5. Each player can tap **Play again**. The room is in `REMATCH` until both have, then a new game starts with fresh randomness.

## Who owns each phase

| Phase                                            | Owner                                                   |
| ------------------------------------------------ | ------------------------------------------------------- |
| `LOBBY`, `REMATCH`                               | The platform, the same for every game                   |
| `PRIVATE_INPUT`, `REVEAL`, `SCORE`, `NEXT_ROUND` | The game, and it can skip any it doesn't need           |
| `RESULTS`                                        | The game supplies the result, and the platform shows it |

The engine rejects impossible moves between phases, such as going backwards without passing through `NEXT_ROUND`. Those are bugs in a game, so they should fail loudly.

## In scope

### Engine (`packages/engine`)

Pure functions, with no sockets, no clock and no Node features:

- **Start a game:** builds the first state from the game definition, the players and a seed.
- **Apply an action:** checks and runs one player's action.
- **Apply a timeout:** runs when a deadline passes.
- **View for a player:** returns only what that player may see.
- **Phase checks:** reject impossible transitions.
- **Saveable randomness:** each step's random numbers come from the game's seed plus a step counter, so a game can be saved and replayed exactly.

### Server (`apps/server`)

- **Game registry:** the list of games the server can run. The test game is registered only outside production. `room:create` accepts only registered games.
- **New events:** `room:ready`, `game:action` and `room:rematch`, each validated.
- **Per-player state:** `room:state` is built separately for each player, using the game's `view`. This replaces today's single broadcast, and is what protects secrets.
- **Timers:** the server schedules each deadline, and ignores a timer that an action has already overtaken.
- **Room rules during a game:** see [Decisions to approve](#decisions-to-approve).
- **Secure seed:** generated with `crypto` for each new game.

### Web (`apps/web`)

- **Lobby:** a Ready button on the room screen.
- **Game screen loading:** each game's screen loads only when needed, which sets the pattern for later games.
- **Test game screen:** deliberately plain, and only available in development. It lives in `apps/web/src/games/test-game`.
- **Shared components:** `Countdown` goes in `components/` only if something outside the test game needs it, following `ARCHITECTURE.md` section 7.1. A countdown that corrects for clock differences using `serverTime` would be the first candidate, as Court needs one.

### Tests

- **Test game unit tests:** every action and timeout, plus a scripted full game.
- **Engine unit tests:** phase checks, and a replay with the same seed and actions giving an identical game.
- **Integration test with two clients:**
  - a full game through every phase, including rematch
  - a player's secret pick never appearing in the other player's messages
  - wrong-phase and bad actions rejected, and a game's state left unchanged
  - a timer firing when a player doesn't act
  - reconnecting mid-game restores the correct view
  - pausing stops the timers, and resuming continues them
  - leaving mid-game ends the game

## Contract changes

`GameDefinition` in `ARCHITECTURE.md` section 5.3 needs two changes. The current design can't do these:

```ts
// 1. Games check their own actions. The engine can't use Zod, because engine and
//    game packages have no dependencies. Bad input returns an error.
parseAction(input: unknown): Result<Action, GameError>;

// 2. init gets the time, or a game's first phase can't have a deadline.
init(ctx: { playerIds; rng; now: number; options?: unknown }): State;
```

`room:error` also gets two new codes:

| Code          | Shown when                                             |
| ------------- | ------------------------------------------------------ |
| `GAME_ERROR`  | The game rejected an action, with its own safe message |
| `ROOM_PAUSED` | An action arrived while the room is paused             |

No new dependencies are needed.

## Decisions to approve

| #   | Question                                       | Recommendation                                                                                   | Why                                                                                                                                                       |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | What if a player taps Leave mid-game?          | The game ends, and the room returns to the lobby with `partner_left`.                            | A two-player game can't continue with one, and someone new shouldn't inherit a half-played game.                                                          |
| 2   | Do timers run while a partner is reconnecting? | Yes, for the 60-second grace period.                                                             | Otherwise a player could stall by dropping their connection. The cost is that a player who drops can miss a turn.                                         |
| 3   | Do timers run once the room is paused?         | No. They stop, and the remaining time continues on return. No actions are accepted while paused. | Nobody should lose a game because their partner's phone died. Games need no extra code, because the platform runs a game clock that stops during a pause. |
| 4   | Does the test game need a screen?              | Yes, a plain one, in development only.                                                           | The test game could run in automated tests alone, but a screen lets you see the loop on real devices, including reconnecting mid-game.                    |
| 5   | What if someone leaves during `REMATCH`?       | The other player returns to the lobby with `partner_left`.                                       | Same reason as decision 1.                                                                                                                                |
| 6   | Must players be connected to start?            | Yes, both ready and both connected.                                                              | A game shouldn't start its timers for an absent player.                                                                                                   |

## Out of scope

- Court's rules, cards or scoring
- Final visuals, animation and sound
- Save and recovery after a server restart. The game's state can be saved by design, but rooms stay in memory until a Redis store is added
- Event streaming for real-time games such as Love Kitchen
- Hosting or public access

## Build order

Small commits on `feat/phase-engine`:

1. Contract changes and engine functions, with unit tests
2. Test game, with unit tests and a scripted full game
3. Game registry and `room:ready`
4. Per-player `room:state` and `game:action`
5. Server timers and the game clock
6. Results, rematch, and leaving mid-game
7. Lobby, game screen loading and test game screen
8. Integration tests
9. Update `ARCHITECTURE.md`, then open the pull request

## Done when

Automated: lint, typecheck, tests and build pass in CI.

On two devices on the same Wi-Fi, such as a phone and a laptop:

- [ ] Both players tap Ready and the game starts
- [ ] A pick isn't visible on the other device until `REVEAL`
- [ ] The countdown matches on both devices
- [ ] Not picking in time still moves the game on
- [ ] A full game reaches `RESULTS` with the right scores
- [ ] Both tapping Play again starts a new game
- [ ] Refreshing mid-game returns to the right phase and picks
- [ ] Locking a phone for over a minute pauses the game, and it continues on return
- [ ] Leaving mid-game ends the game and tells the other player
