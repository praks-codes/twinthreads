# ARCHITECTURE.md

**TwinThreads** is a browser-based platform of two-player games for couples. This file describes its architecture. This is the source of truth for technical decisions. Product direction and milestones live in [docs/ROADMAP.md](docs/ROADMAP.md). When a decision changes, update this file in the same pull request as the code.

Last updated: 2026-11-05

---

## 1. Product constraints that shape the architecture

- Every game is for **exactly two players**. No spectators, no matchmaking, no jury.
- Players join a **private room** with a six-character code. **No signup, no login.**
- Runs in any modern browser, **mobile-first**. Not a native app.
- Each game gets its own fast, indexable web page (SEO matters).
- Solo developer, built mostly with Claude Code, so the code must be simple, typed and testable.
- The platform must be able to scale if a game goes viral, without a rewrite.
- First version should cost nothing to build and run locally. Hosting is decided later (see section 12).

## 2. Game lineup

The game lineup and build order live in [docs/ROADMAP.md](docs/ROADMAP.md).

Architecture consequence: only Our Little Monster needs persistence. Everything else is ephemeral room state.

## 3. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript everywhere | Strict mode. Shared types between client and server. |
| Runtime | Node.js (current LTS) | Not Next.js. |
| Package manager | pnpm workspaces | Monorepo. |
| Server | Fastify + Socket.IO | Fastify for HTTP, Socket.IO for live connections and reconnection. |
| Client | React + Vite | Mobile-first. |
| Animation | CSS first, Framer Motion at polish time | Added in milestone 4, not before. |
| Real-time games | Phaser, loaded only inside Love Kitchen | Lazy-loaded so other games never download it. |
| SEO pages | Astro (static site) | Landing page and one page per game. |
| Testing | Vitest | Game logic is tested without a browser or server. |
| Lint and format | ESLint + Prettier | Enforced in CI. |
| Containers | Docker | Same server image on any host. |
| CI | GitHub Actions | Lint, typecheck and test on every pull request. |

Not used: Three.js (no 3D needed), Next.js, a database (until Our Little Monster).

## 4. Repository layout

```
twinthreads/
  apps/
    web/              React client (lobby, room, game screens)
    server/           Fastify + Socket.IO room server
    site/             Astro static site (landing + per-game SEO pages)
  packages/
    engine/           Room model, phase engine, shared types, RoomStore interface
    games/
      court/          Relationship Court: rules, cards, scoring (pure logic)
      mystery/        Added later
  docs/               Game specs, decisions
  ARCHITECTURE.md
  SETUP.md
  CLAUDE.md           Conventions for Claude Code
```

Dependency direction (never reverse it):

```
apps/web  ─┐
           ├─►  packages/engine  ◄──  packages/games/*
apps/server┘
```

- `packages/games/*` depend only on `packages/engine`'s types. They know nothing about sockets, HTTP or React.
- `packages/engine` knows nothing about Node, browsers or any host.
- Only `apps/server` touches the network and the clock.

## 5. Core model

### 5.1 Concepts

- **Room:** a two-player session. Has a code, two player slots, one active game, and a state.
- **Player:** identified by a `playerId` and a secret `playerToken` stored in the browser. No account.
- **Game:** a plug-in that supplies rules. It never sees sockets.
- **Phase:** the platform's loop. Every round moves through the phases below.

### 5.2 Phase loop

```
LOBBY → PRIVATE_INPUT → REVEAL → SCORE → NEXT_ROUND → … → RESULTS → REMATCH
```

Games can use the phases they need and skip the rest. Court, for example, uses PRIVATE_INPUT (card choice), REVEAL, SCORE and NEXT_ROUND (role swap).

### 5.3 Game plug-in interface

Each game exports one object that implements this contract (in `packages/engine`):

```ts
export interface GameDefinition<State, Action, View> {
  id: string;                      // "court", "mystery", ...
  players: 2;

  // Create the starting state. Randomness comes from the supplied seeded rng.
  init(ctx: { playerIds: [PlayerId, PlayerId]; rng: Rng; options?: unknown }): State;

  // Pure function. Returns a new state or an error. No side effects, no Date.now(), no Math.random().
  reduce(state: State, action: Action, ctx: { playerId: PlayerId; now: number; rng: Rng }):
    Result<State, GameError>;

  // What ONE player is allowed to see. This is the only data sent to that player.
  view(state: State, playerId: PlayerId): View;

  // Used by the platform to schedule timers and detect the end.
  phase(state: State): Phase;
  deadline(state: State): number | null;   // epoch ms, or null
  onTimeout(state: State, now: number, rng: Rng): State;
  isFinished(state: State): boolean;
  result(state: State): GameResult;        // scores, winner, shareable summary
}
```

Rules for implementers:

1. `reduce`, `view` and `onTimeout` are pure functions. They are fully unit-tested.
2. All randomness goes through the injected seeded `rng`, so tests and replays are deterministic.
3. All time goes through the `now` argument.
4. A game never sends or receives anything itself. The platform does that.

### 5.4 Per-player views (security rule)

The server never sends raw game state to a client. It sends only `view(state, playerId)`. This protects secret clues in Couple's Mystery, hidden defense cards in Court, and incomplete information in Trust Fall. If a secret is in the payload, assume the other player can read it.

## 6. Server architecture

### 6.1 Rules for rooms and scaling

1. **One room lives on exactly one server process.** Room state is in that process's memory. Everything that touches a room goes to that process.
2. **Rooms never share state.** No globals, no cross-room lookups, so rooms can be spread across servers later.
3. **Storage behind an interface.** Game and server code use `RoomStore`, never a raw Map:

```ts
export interface RoomStore {
  create(room: RoomRecord): Promise<void>;
  get(code: string): Promise<RoomRecord | null>;
  update(code: string, patch: Partial<RoomRecord>): Promise<void>;
  delete(code: string): Promise<void>;
  touch(code: string): Promise<void>;     // refresh expiry
}
```

   Today: `InMemoryRoomStore`. Later: a Redis implementation, so a crashed or restarted server can recover rooms and rooms can move between servers.

4. **Config only through environment variables.** Ports, URLs, secrets, limits. Nothing hardcoded. Validate them at startup and fail fast.
5. **Graceful shutdown.** On SIGTERM, stop accepting new rooms, notify connected players, let active rounds finish or snapshot them, then exit.
6. **Health endpoint.** `GET /health` returns 200 with uptime and room count.
7. **Structured logs.** JSON logs, with `roomCode` and `playerId` on every line that has them. Never log secret clues or tokens.
8. **Reconnect is a first-class feature** (see section 8).

### 6.2 Room codes

- Six characters from the alphabet `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (no 0, O, 1, I or L).
- Generated with a cryptographically secure random source. Checked for collisions.
- Expire when a room is empty or idle (default 30 minutes idle, configurable).
- Join attempts are rate limited per IP to stop code guessing.

### 6.3 Message protocol (Socket.IO events)

Client to server:

| Event | Payload | Purpose |
|---|---|---|
| `room:create` | `{ gameId, displayName }` | Create a room, receive a code and token |
| `room:join` | `{ code, displayName, playerToken? }` | Join or rejoin |
| `room:ready` | `{ ready: boolean }` | Lobby readiness |
| `game:action` | `{ type, payload }` | Any game action, validated by `reduce` |
| `room:rematch` | `{}` | Vote to play again |

Server to client:

| Event | Payload | Purpose |
|---|---|---|
| `room:joined` | `{ code, playerId, playerToken }` | Sent once, token stored in the browser |
| `room:state` | `{ players, phase, game: View, serverTime, deadline }` | Full current state, sent on every change and on reconnect |
| `room:error` | `{ code, message }` | Clear, user-safe errors |

Design choice: send **full view snapshots**, not diffs. Messages are small in two-player turn-based games, and snapshots make reconnects trivial and bugs rarer. Real-time games (Love Kitchen) can add an event channel later.

### 6.4 Timers

The server owns all timers. The state carries an absolute `deadline` (epoch ms). Clients display a countdown using `serverTime` to correct for clock drift, but never decide an outcome. When the deadline passes, the server calls `onTimeout`.

## 7. Client architecture

- One shared `useRoom()` hook owns the socket connection, the token, reconnection and the latest `room:state`.
- Each game provides a screen component that takes its `View` and sends actions. Screens are **lazy-loaded** per game.
- State shown on screen comes from the server snapshot. Local state is only for UI details like which card is hovered.
- Mobile-first: a single column, large tap targets, no hover-only interactions, tested on real iPhone and Android devices.
- Audio starts only after a first user tap (iOS Safari rule).
- Phaser is imported only inside Love Kitchen's screen.

### 7.1 Shared and game-specific UI

```
apps/web/src/
  components/    Platform UI, plus anything two games actually use
  room/          Home, lobby, in-room screens and useRoom()
  games/
    court/       Court's screens, components and theme
```

- **Platform UI is shared.** Everything around a game, such as creating and joining rooms, the room code, the player list and reconnect messages, is built once.
- **Each game owns its screens and look.** A game's screens and theme live in its own folder, and games don't have to look alike.
- **Share game UI only on real reuse.** Build a game's UI in its own folder. When a second game needs the same thing, move it to `components/`. Games never copy from or import from one another.
- **Shared components are themed.** They take colours and fonts from CSS variables, and each game sets its own values.

## 8. Reconnection and resilience

Mobile browsers pause background tabs and drop connections often. This is the most likely source of real-world bugs.

- The `playerToken` is stored in `localStorage`. On reconnect the client sends `room:join` with it.
- The server reattaches the socket to the same player slot and resends the full `room:state`.
- A short grace period (default 60 seconds, configurable) keeps a disconnected player's slot reserved. The other player sees "Partner reconnecting...".
- If the grace period ends, the room pauses. It is not destroyed immediately.
- The server never trusts a client's claim of identity without the token.

## 9. Security and abuse basics

- Validate every incoming message with a schema (for example Zod). Reject unknown shapes.
- Authorize every action: right player, right phase, right turn.
- Limit message size and message rate per socket.
- Rate limit room creation and join attempts per IP.
- Escape or sanitize all user-supplied text (display names, custom accusations) before rendering. Add a length limit and a basic profanity filter for shared content later.
- Secrets live in environment variables only. `.env` is never committed.
- CORS and allowed origins come from configuration.

## 10. Testing strategy

- **Game logic:** Vitest unit tests on `reduce`, `view`, `onTimeout` and scoring. These are the most valuable tests. Add scripted full-game playthroughs.
- **Engine:** tests for room lifecycle, join and rejoin, phase transitions and expiry.
- **Server:** a small integration test using two Socket.IO test clients (create, join, play a round, reconnect).
- **Client:** minimal at first. Add component tests for critical screens.
- **Manual:** two real phones, on different networks, every milestone.
- CI blocks merges when lint, typecheck or tests fail.

## 11. Observability

- JSON logs with room and player identifiers.
- `/health` for uptime checks.
- Later: counters for rooms created, rooms completed, average session length and reconnect rate. These show whether couples actually finish games.

## 12. Hosting decision (deferred on purpose)

The host is chosen at milestone 5, before public launch. The architecture keeps the choice open:

- The server is a standard Node process in a Docker image.
- Game logic has no host dependencies.
- State sits behind `RoomStore`.

Free Node hosts with WebSockets often sleep when idle, which hurts a first impression. Verify current free offers and prices before choosing. A small paid VPS or container host is the realistic floor for launch.

Scaling path, in order:

1. One server process (enough for early traffic).
2. Redis-backed `RoomStore` plus a few server instances, with routing by room code or sticky sessions so both players of a room reach the same process.
3. Autoscaling and regional deployment if needed.

If Node hosting proves painful, the game packages can be moved to a different runtime (for example Cloudflare Durable Objects) behind a thin adapter, because they contain no server code.

## 13. Milestones

Milestones live in [docs/ROADMAP.md](docs/ROADMAP.md).

## 14. Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-11-05 | Node + Fastify + Socket.IO instead of Durable Objects | Easier local debugging, no vendor lock-in, familiar to the developer |
| 2026-11-05 | No Phaser, Three.js or Framer Motion at the start | Early games are 2D UI screens, keep the bundle small |
| 2026-11-05 | Two players only | Simpler rooms, simpler sync, matches the couples focus |
| 2026-11-05 | Hosting decided at milestone 5 | Architecture keeps the choice open |
| 2026-11-05 | Game Master judges Court | No jury is possible with two players |
| 2026-11-05 | Platform name is TwinThreads (briefly considered TwinStrings) | Repo is `twinthreads`, workspace packages use the `@twinthreads/*` scope |
| 2026-11-05 | TypeScript 6.0.x instead of 7 | typescript-eslint does not support TypeScript 7 yet. Upgrade when it does |
| 2026-11-05 | Vite dev server proxies `/health` and `/socket.io` | Phones on the local network reach the server through one origin, without CORS changes. Production builds call `VITE_SERVER_URL` directly |
| 2026-11-05 | `/health` reads a `size` property on `InMemoryRoomStore` | Keeps the `RoomStore` interface as designed. A Redis store will need its own way to count rooms |
| 2026-11-05 | `InMemoryRoomStore` takes an injected clock | The engine never reads time itself |
| 2026-11-05 | Server listens on `0.0.0.0` | Needed for Docker and local network access |
| 2026-11-05 | Tests live in a `test/` folder beside `src/` | Builds only ever see `src/` |
| 2026-11-05 | `.astro` files are not typechecked | `@astrojs/check` would be an extra dependency for a placeholder page. Revisit at milestone 5 |
| 2026-11-05 | Platform UI is shared, game UI is shared only on real reuse | Games have different screens and themes, so building shared game UI up front would be guesswork. No `packages/ui`, because only `apps/web` would use it |
| 2026-11-05 | Milestones and game lineup moved to `docs/ROADMAP.md` | This file covers architecture and design decisions only, so product direction can change independently |

## 15. Open questions

- Court verdict: pure skill-based scoring, or also include each partner's private rating of the other's argument?
- Should Secret Missions be its own Love Quest theme pack or a bonus mode over any theme?
- Launch timeline and whether early monetization is planned.
- Final hosting provider (milestone 5).
