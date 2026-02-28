# OpenLinks Studio (Self-Serve Control Plane)

This document describes the new multi-service control plane for non-technical OpenLinks users.

Phase tracking lives in:

- `docs/studio-phase-checklist.md` (canonical implementation checklist)
- `packages/studio-web/src/lib/phase-checklist.ts` (in-app roadmap data)

## Services

- `packages/studio-web`: Marketing site + onboarding + CRUD editor (Solid + Tailwind + shadcn-solid style primitives)
- `packages/studio-api`: Fastify API for auth, fork provisioning, validation, commits, deploy status, webhooks, and internal sync
- `packages/studio-worker`: Scheduled worker entrypoint that triggers sync processing
- `packages/studio-shared`: Shared API contracts/types

## API Endpoints

- `POST /api/v1/auth/github/start`
- `GET /api/v1/auth/github/callback`
- `GET /api/v1/onboarding/status`
- `POST /api/v1/repos/provision`
- `GET /api/v1/repos/:repoId/content`
- `POST /api/v1/repos/:repoId/validate`
- `PUT /api/v1/repos/:repoId/content`
- `GET /api/v1/repos/:repoId/deploy-status`
- `POST /api/v1/repos/:repoId/sync`
- `POST /api/v1/github/webhooks`
- `POST /api/v1/internal/sync/run`

## Local Development

1. Copy env template:

```bash
cp .env.studio.example .env.studio
```

2. Install dependencies:

```bash
bun install
```

3. Start postgres + services (Docker Compose path):

```bash
docker compose -f docker-compose.studio.yml up --build
```

4. Or run services manually:

```bash
bun run studio:db:migrate
bun run studio:api:dev
bun run studio:web:dev
```

5. Run workspace checks:

```bash
bun run studio:typecheck
bun run studio:lint
```

## Troubleshooting: Frozen Lockfile Docker Build Errors

If Docker build fails with:

- `error: lockfile had changes, but lockfile is frozen`

the usual cause is dependency manifest changes without a matching committed `bun.lock`.

Remediation:

1. Refresh dependencies and lockfile at repo root:

```bash
bun install
```

2. Commit updated lockfile and manifests:

```bash
git add bun.lock package.json packages/*/package.json
git commit -m "chore: sync lockfile"
```

3. Retry Studio Docker build:

```bash
docker compose -f docker-compose.studio.yml up --build
```

Guardrails now in place:

- Pre-commit blocks manifest dependency changes when `bun.lock` is not staged.
- CI required lane runs path-scoped Studio Docker builds when Docker/dependency files change.
- Studio Dockerfiles copy all workspace manifests before `bun install --frozen-lockfile` for deterministic installs.

## Railway Deployment Model

Target for phase 1 is Railway with four components:

1. `studio-web` service (from `packages/studio-web/Dockerfile`)
2. `studio-api` service (from `packages/studio-api/Dockerfile`)
3. `studio-worker` service (from `packages/studio-worker/Dockerfile`)
4. Managed PostgreSQL plugin

### Required Environment Variables

- `GITHUB_APP_ID`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_WEBHOOK_SECRET`
- `TURNSTILE_SECRET_KEY`
- `DATABASE_URL`
- `SESSION_SECRET`
- `ENCRYPTION_KEY`
- `INTERNAL_CRON_SECRET`
- `UPSTREAM_REPO_OWNER`
- `UPSTREAM_REPO_NAME`
- `STUDIO_API_URL`
- `STUDIO_WEB_URL`
- `VITE_STUDIO_API_URL`
- `VITE_GITHUB_APP_INSTALL_URL`
- `VITE_TURNSTILE_SITE_KEY`

## Manual GitHub App Setup

Set in GitHub App settings:

- Callback URL: `https://<domain>/api/v1/auth/github/callback`
- Setup URL: `https://<domain>/onboarding/github-install-complete`
- Webhook URL: `https://<domain>/api/v1/github/webhooks`

Required app permissions:

- `Contents`: Read & Write
- `Metadata`: Read
- `Administration`: Write

## Notes

- This implementation is strict `fork-first` and defaults to `public` repository visibility.
- Production onboarding requires a valid Cloudflare Turnstile token before starting GitHub OAuth.
- GitHub webhook verification validates `x-hub-signature-256` against exact raw payload bytes.
- Content saves commit directly to fork default branch (`main` by default).
- Upstream sync conflicts disable auto-sync for the affected repo and require manual intervention.
- Update `docs/studio-phase-checklist.md` whenever Studio scope/status changes.
