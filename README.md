# TwinThreads

TwinThreads is a platform of two-player browser games for couples. Players join a private room with a six-character code, with no signup or login, and play on any modern browser, phone first. See `ARCHITECTURE.md` for technical decisions.

## Run locally

Requires Node 26 and pnpm (`corepack enable pnpm`).

```sh
pnpm install
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
pnpm dev
```

| App    | Address                 |
| ------ | ----------------------- |
| Web    | <http://localhost:5173> |
| Server | <http://localhost:3001> |
| Site   | <http://localhost:4321> |

To open the web app on a phone, use the Network address Vite prints, with the phone on the same network.

Other commands: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm format`.

## Environment variables

The server refuses to start if any server variable is missing or invalid. "Default" is the value in `.env.example`; the code has no built-in defaults.

### `apps/server/.env`

| Variable                  | Purpose                                                        | Default                 |
| ------------------------- | -------------------------------------------------------------- | ----------------------- |
| `NODE_ENV`                | `development`, `test` or `production`                          | `development`           |
| `PORT`                    | Port the server listens on                                     | `3001`                  |
| `CLIENT_ORIGIN`           | Browser origin allowed by CORS                                 | `http://localhost:5173` |
| `ROOM_IDLE_MINUTES`       | Minutes of inactivity before a room expires                    | `30`                    |
| `RECONNECT_GRACE_SECONDS` | Seconds a disconnected player's slot stays reserved            | `60`                    |
| `LOG_LEVEL`               | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent` | `info`                  |

### `apps/web/.env`

| Variable          | Purpose                                                                       | Default                 |
| ----------------- | ----------------------------------------------------------------------------- | ----------------------- |
| `VITE_SERVER_URL` | Server URL. Production builds call it directly; the dev server proxies to it. | `http://localhost:3001` |
