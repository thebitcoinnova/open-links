FROM oven/bun:1.3.9
WORKDIR /app

COPY bun.lock package.json ./
COPY packages/studio-worker/package.json packages/studio-worker/package.json

RUN bun install --frozen-lockfile

COPY packages/studio-worker ./packages/studio-worker

RUN bun run --filter @openlinks/studio-worker build

CMD ["bun", "run", "--filter", "@openlinks/studio-worker", "start"]
