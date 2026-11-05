# TwinThreads

Two-player browser games for couples, played in private rooms with a six-character code and no accounts. `ARCHITECTURE.md` is the source of truth for technical decisions. `docs/ROADMAP.md` holds the game lineup and milestones.

## Commands

- Start server, web and site: `pnpm dev`
- Test: `pnpm test`
- Lint, including the dependency-direction check: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Build: `pnpm build`
- Format: `pnpm format`

## Rules

- Game logic stays pure, with no sockets, no `Date.now()` and no `Math.random()`
- Never send raw state to clients, only `view(state, playerId)`
- Validate every incoming message with a schema
- Config only through environment variables
- Update `ARCHITECTURE.md` when a decision changes
- Update `docs/ROADMAP.md` when milestones or the direction of the games change; keep them out of `ARCHITECTURE.md`
- Small commits, feature branches, pull requests into `main`
- Ask before adding a new dependency
- Tests live in a `test/` folder beside `src/` in each package, never inside `src/`
