FROM oven/bun:1.3.9
WORKDIR /app

COPY bun.lock package.json ./
COPY packages/studio-api/package.json packages/studio-api/package.json
COPY packages/studio-web/package.json packages/studio-web/package.json
COPY packages/studio-worker/package.json packages/studio-worker/package.json
COPY packages/studio-shared/package.json packages/studio-shared/package.json

RUN HUSKY=0 bun install --frozen-lockfile

COPY config ./config
COPY packages/studio-api ./packages/studio-api
COPY packages/studio-shared ./packages/studio-shared

RUN bun run --filter @openlinks/studio-api build

EXPOSE 4000
CMD ["sh", "-lc", "bun run --filter @openlinks/studio-api db:migrate && bun run --filter @openlinks/studio-api start"]
