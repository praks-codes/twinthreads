# SETUP.md: Instructions for Claude Code

You are setting up the project scaffold for **TwinThreads**, a platform of two-player browser games for couples. Read `ARCHITECTURE.md` in this folder first. It is the source of truth for decisions. This file only covers **initial setup**. Do not build any game features.

## Ground rules

- Work in the current folder. If it already contains files, list them and ask before changing anything.
- Do not delete files or force-push anything.
- Never print, commit or log secrets, tokens or `.env` values.
- Ask me before any action that costs money or needs an account I haven't given you.
- Use the **latest stable** versions of tools and libraries. Check the current version rather than relying on memory.
- Commit in small steps with clear messages, on a feature branch for the scaffold, then merge to `main` via a pull request.
- Stop when the checklist at the end passes. Do not start milestone 1.

## Settings (edit these before running, or tell Claude Code to change them)

```
PROJECT_NAME=TwinThreads
REPO_NAME=twinthreads
PACKAGE_SCOPE=@twinthreads
GITHUB_VISIBILITY=private
DEFAULT_BRANCH=main
SERVER_PORT=3001
WEB_PORT=5173
SITE_PORT=4321
```

## Step 1: Check the machine

Verify these are installed and report any that are missing, with the install command for my OS. Do not install system tools without asking.

- Node.js (current LTS)
- pnpm (enable via Corepack if available)
- git
- GitHub CLI (`gh`), and confirm `gh auth status` is logged in
- Docker (optional now, needed later; just report whether it is present)

## Step 2: Create the repository

1. Initialize git with `main` as the default branch.
2. Create a **private** GitHub repository named `REPO_NAME` with `gh repo create` and set it as `origin`.
3. Add a `.gitignore` for Node, TypeScript, build output, `.env*` (except `.env.example`), editor folders and OS files.
4. Add a short `README.md` (project name, one-paragraph description, how to run locally).
5. Make the first commit and push `main`. Then create a branch `chore/scaffold` for everything else.

## Step 3: Workspace and tooling

1. Create a pnpm workspace (`pnpm-workspace.yaml`) covering `apps/*`, `packages/*` and `packages/games/*`.
2. Root `package.json` with scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `format`. Pin the Node version with `engines` and a `.nvmrc`.
3. TypeScript in **strict mode** with a shared base `tsconfig.base.json` that every package extends.
4. ESLint and Prettier with one shared config at the root.
5. Vitest configured for the whole workspace.
6. Add `.editorconfig`.

## Step 4: Folder scaffold

Create exactly this structure (see `ARCHITECTURE.md` section 4):

```
apps/
  web/              React + Vite + TypeScript
  server/           Fastify + Socket.IO + TypeScript
  site/             Astro (static) with one placeholder landing page
packages/
  engine/           shared types, RoomStore interface, InMemoryRoomStore
  games/
    court/          empty package with a placeholder export
docs/
```

Requirements:

- Each package has its own `package.json`, `tsconfig.json` and `src/index.ts`.
- Name workspace packages with `PACKAGE_SCOPE`, for example `@twinthreads/engine`, `@twinthreads/court`, `@twinthreads/server`, `@twinthreads/web` and `@twinthreads/site`.
- Respect the dependency direction in `ARCHITECTURE.md` section 4. Add a lint rule or a simple script that fails if `packages/*` imports from `apps/*`, or if `packages/games/*` imports anything except `packages/engine`.
- `packages/engine` contains **only** the types and interfaces from `ARCHITECTURE.md` (`GameDefinition`, `RoomStore`, `Phase`, `Result`, `Rng`, and the message payload types) plus `InMemoryRoomStore`. Do not implement the phase engine yet.
- Include a small seeded `Rng` implementation in `packages/engine` with a unit test.

## Step 5: Minimal running apps (smoke tests only)

- **server:** Fastify app with `GET /health` returning `{ status: "ok", uptime, rooms }`. Socket.IO attached. Reads config from environment variables validated at startup (use Zod); fails fast with a clear message if something is missing. Structured JSON logging. Handles SIGTERM gracefully.
- **web:** a Vite React page that shows "TwinThreads" and the server health status fetched from the server. Mobile viewport meta tag set. Dev server reachable on the local network (host enabled) so I can open it from my phone.
- **site:** a placeholder Astro page.
- All three start together with one command: `pnpm dev`.

## Step 6: Environment variables

Create `.env.example` files (committed) and tell me to copy them to `.env` (never committed):

Root or `apps/server/.env.example`:

```
NODE_ENV=development
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
ROOM_IDLE_MINUTES=30
RECONNECT_GRACE_SECONDS=60
LOG_LEVEL=info
```

`apps/web/.env.example`:

```
VITE_SERVER_URL=http://localhost:3001
```

Rules:

- Real `.env` files are in `.gitignore`.
- No secret values are needed for now. Do not invent any.
- Document every variable in `README.md` with its purpose and default.

## Step 7: Docker

- Add a multi-stage `Dockerfile` for `apps/server` that builds from the workspace and runs as a non-root user.
- Add a `.dockerignore`.
- Do not deploy anything. Just make sure the image builds if Docker is present; if Docker is not installed, say so and skip the build.

## Step 8: CI

Add `.github/workflows/ci.yml` that runs on pull requests and pushes to `main`:

1. Install with pnpm (with caching)
2. Lint
3. Typecheck
4. Test
5. Build

## Step 9: Conventions file

Create `CLAUDE.md` at the repo root containing:

- A short project summary and a pointer to `ARCHITECTURE.md`
- The commands to run, test, lint and typecheck
- These rules for future work:
  - Game logic stays pure, with no sockets, no `Date.now()` and no `Math.random()`
  - Never send raw state to clients, only `view(state, playerId)`
  - Validate every incoming message with a schema
  - Config only through environment variables
  - Update `ARCHITECTURE.md` when a decision changes
  - Small commits, feature branches, pull requests into `main`
  - Ask before adding a new dependency

## Step 10: Repository protection

Try to enable branch protection on `main` (require pull requests and passing CI). Private repositories on a free GitHub plan may not support this. If it fails, say so, do not work around it, and note it in the final report.

## Step 11: Verify

Run each of these and fix anything that fails:

```
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm dev
```

Confirm with real output, not assumptions, that:

- `http://localhost:3001/health` returns the health JSON
- the web app loads at `http://localhost:5173` and shows the server status
- the web app is reachable from another device on the same network (print the local address for me, but do not expose anything publicly)

## Step 12: Finish

1. Push `chore/scaffold` and open a pull request into `main` with a short description.
2. Do not merge it. I will review and merge.
3. Report back with:
   - what was created
   - the exact commands to start the project
   - anything that failed or was skipped, and why
   - any decision you had to make that isn't in `ARCHITECTURE.md`

## Done checklist

- [ ] Private GitHub repo exists and `origin` is set
- [ ] pnpm workspace with `apps/web`, `apps/server`, `apps/site`, `packages/engine`, `packages/games/court`
- [ ] Strict TypeScript, ESLint, Prettier and Vitest all work
- [ ] Dependency-direction check exists and passes
- [ ] `pnpm dev` starts server, web and site
- [ ] `/health` works and the web page shows it
- [ ] `.env.example` files committed, real `.env` ignored
- [ ] Dockerfile present (and builds if Docker is installed)
- [ ] CI workflow present
- [ ] `CLAUDE.md` present
- [ ] Pull request open, not merged
