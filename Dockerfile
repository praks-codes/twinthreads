# Builds apps/server from the workspace. Build from the repo root:
#   docker build -t twinthreads-server .
FROM node:26-slim AS build
WORKDIR /repo
RUN npm install --global pnpm@12.16.1
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter "@twinthreads/server..." run build
RUN pnpm --filter @twinthreads/server deploy --prod /prod

FROM node:26-slim AS run
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /prod .
USER node
EXPOSE 3001
CMD ["node", "dist/index.js"]
