FROM oven/bun:1.3.9
WORKDIR /app

COPY bun.lock package.json ./
COPY packages/studio-web/package.json packages/studio-web/package.json
COPY packages/studio-shared/package.json packages/studio-shared/package.json

RUN bun install --frozen-lockfile

COPY packages/studio-web ./packages/studio-web
COPY packages/studio-shared ./packages/studio-shared

RUN bun run --filter @openlinks/studio-web build

EXPOSE 4173
CMD ["sh", "-lc", "bun run --filter @openlinks/studio-web preview --host 0.0.0.0 --port 4173"]
