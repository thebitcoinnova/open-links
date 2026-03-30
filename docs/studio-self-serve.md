# OpenLinks Studio (Self-Serve Control Plane)

This document describes the new multi-service control plane for non-technical OpenLinks users.

Prefer Studio when you want the browser-based CRUD path and the current self-serve onboarding/editor covers your workflow. For repo-native changes or workflows not yet exposed in Studio, prefer the checked-in AI workflows/skills and automation docs first, then fall back to manual JSON edits only when you need lower-level control.

Current referral status:

- Studio can edit referral links today through the Advanced JSON editor for `data/links.json`.
- First-class referral/disclosure form controls and referral-specific previews are not shipped yet.
- When you want guided referral authoring, field examples, or warning interpretation, prefer `docs/openclaw-update-crud.md`, `docs/ai-guided-customization.md`, and `docs/data-model.md` first.

Phase tracking lives in:

- `docs/studio-phase-checklist.md` (canonical implementation checklist)
- `packages/studio-web/src/lib/phase-checklist.ts` (in-app roadmap data)
- `docs/studio-security-review.md` (security review checklist + incident runbook)
- `docs/studio-launch-playbook.md` (launch checklist + availability incident playbook)

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

If your remote shell does not provide Docker, skip Compose and use the manual path in the next step.

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

### Production Env Preflight

Studio production builds now support a fail-fast preflight that validates required env values and blocks known placeholder values before the build starts.

Run the full Studio preflight:

```bash
bun run studio:env:check:prod
```

Run all Studio production builds with preflight checks:

```bash
bun run studio:build:prod
```

Target-specific checks:

```bash
bun run studio:env:check:prod -- --target web
bun run studio:env:check:prod -- --target api
bun run studio:env:check:prod -- --target worker
```

Example failure output:

```text
Studio production environment preflight
Target: api
Source: /path/to/.env.studio + process.env overrides

Status: FAIL (2 issue(s))
Detected issues:
- [api] SESSION_SECRET (placeholder): SESSION_SECRET contains placeholder token "replace".
- [api] TURNSTILE_SECRET_KEY (missing): TURNSTILE_SECRET_KEY is required for api production builds but is missing or empty.

How to fix:
- [api] Replace SESSION_SECRET with a non-placeholder value.
- [api] Set TURNSTILE_SECRET_KEY to a real value in your env source and rerun the preflight.
- Rerun: bun run studio:env:check:prod
```

The existing non-production build scripts (`studio:web:build`, `studio:api:build`, `studio:worker:build`) are intentionally unchanged. Use `studio:*:build:prod` when you want enforced production env validation.

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
- Fork provisioning also reconciles GitHub repository metadata so the fork does not keep the upstream repo homepage in the GitHub **About** sidebar; the default homepage becomes the fork's GitHub Pages URL.
- Deploy-status refresh should keep the repo homepage aligned with the verified primary host when the default fork Pages path is in use.
- Studio sync first attempts GitHub's normal `merge-upstream` path.
- If GitHub reports conflicts and every overlapping path is declared fork-owned in `config/fork-owned-paths.json`, Studio uses the shared fork-sync preservation helper to create a merge commit that keeps the fork's current personalized files while still syncing shared upstream code/docs/tooling.
- If any overlapping conflict touches a shared path outside that contract, Studio still disables auto-sync and requires manual intervention.
- Use `docs/studio-security-review.md` before production launch and after any auth/session/webhook security change.
- Use `docs/studio-launch-playbook.md` for go-live sequencing, smoke tests, rollback, and non-security production incidents.
- Update `docs/studio-phase-checklist.md` whenever Studio scope/status changes.
