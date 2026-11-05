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
- Exception: until the first playable game (Court v0, milestone 3), changes that only touch documents go straight to `main`, with no branch or pull request
- Platform UI is built once in `apps/web`. Game screens and themes stay in that game's folder, UI moves to `components/` only when a second game needs it, and games never copy from each other (`ARCHITECTURE.md` section 7.1)
- Ask before adding a new dependency
- Never add Claude attribution, such as a `Co-Authored-By` line or a "Generated with Claude Code" footer, to commits, pull requests or merge descriptions
- Tests live in a `test/` folder beside `src/` in each package, never inside `src/`
