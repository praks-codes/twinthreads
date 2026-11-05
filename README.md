# TwinThreads

TwinThreads is a platform of two-player browser games for couples. Players join a private room with a six-character code, with no signup or login, and play on any modern browser, phone first. The first game is Relationship Court, a silly trial judged by an AI. See `ARCHITECTURE.md` for technical decisions and `docs/court.md` for the game.

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

To open the web app on a phone or tablet, use the Network address Vite prints, with the device on the same network.

Relationship Court's judge uses a local model by default, so install [Ollama](https://ollama.com) and run `ollama pull gemma3:4b`. Without it the game still works, using backup lines.

To try two players on one computer, use a private window for the second player. Normal tabs share browser storage, so they count as the same player.

Other commands: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm format`.

## Environment variables

The server refuses to start if any required server variable is missing or invalid. "Default" is the value in `.env.example`, and only the optional AI variables have built-in defaults.

### `apps/server/.env`

| Variable                  | Purpose                                                        | Default                 |
| ------------------------- | -------------------------------------------------------------- | ----------------------- |
| `NODE_ENV`                | `development`, `test` or `production`                          | `development`           |
| `PORT`                    | Port the server listens on                                     | `3001`                  |
| `CLIENT_ORIGIN`           | Browser origin allowed by CORS                                 | `http://localhost:5173` |
| `ROOM_IDLE_MINUTES`       | Minutes of inactivity before a room expires                    | `30`                    |
| `RECONNECT_GRACE_SECONDS` | Seconds a disconnected player's slot stays reserved            | `60`                    |
| `LOG_LEVEL`               | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent` | `info`                  |

Optional AI settings:

| Variable             | Purpose                                                      | Default                  |
| -------------------- | ------------------------------------------------------------ | ------------------------ |
| `AI_PROVIDER`        | `ollama`, `openai-compatible`, or `none` to use backup lines | `ollama`                 |
| `AI_MODEL`           | The model's name for that provider                           | `gemma3:4b`              |
| `AI_BASE_URL`        | Provider URL. Required for `openai-compatible`               | `http://127.0.0.1:11434` |
| `AI_API_KEY`         | Sent as a bearer token to `openai-compatible` providers      | None                     |
| `AI_TIMEOUT_SECONDS` | How long to wait before using backup lines                   | `45`                     |

### `apps/web/.env`

| Variable          | Purpose                                                                       | Default                 |
| ----------------- | ----------------------------------------------------------------------------- | ----------------------- |
| `VITE_SERVER_URL` | Server URL. Production builds call it directly; the dev server proxies to it. | `http://localhost:3001` |
