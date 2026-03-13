# Studio Launch Checklist and Production Incident Playbook

This document is the operational launch checklist and availability-focused production playbook for OpenLinks Studio.

Use it:

- before the first public Studio launch
- before any significant Studio deployment affecting auth, onboarding, save, deploy visibility, or sync
- during non-security production incidents

For secret compromise, suspicious auth activity, or credential rotation, use `docs/studio-security-review.md`.

## Scope

- `packages/studio-web`
- `packages/studio-api`
- `packages/studio-worker`
- the Studio PostgreSQL database
- the GitHub App used by Studio onboarding, saves, and sync

## Current Production Model

The current implementation assumes:

- `studio-web` serves the marketing page, onboarding flow, and editor UI.
- `studio-api` handles auth, onboarding status, repo provisioning, validation, saves, deploy-status polling, webhooks, and internal sync.
- `studio-worker` is a one-shot process that calls `POST /api/v1/internal/sync/run`.
- the Studio API exposes `GET /health`.
- the API container runs DB migrations at startup before serving traffic.
- onboarding is strict fork-first and production auth start requires Turnstile.
- saves commit directly to the user fork default branch, typically `main`.

## Launch Preconditions

Do not launch until all of these are true:

- [ ] `docs/studio-security-review.md` has been completed for the target environment.
- [ ] GitHub App callback, setup, and webhook URLs match the deployed Studio hosts.
- [ ] PostgreSQL is reachable from `studio-api`.
- [ ] `studio-api`, `studio-web`, and `studio-worker` have their production env values set.
- [ ] The launch owner has one GitHub test account that can complete the full onboarding and editor flow.
- [ ] Operators have PostgreSQL access for manual repo/session recovery if needed.

## Pre-Launch Verification

Run from the repo before promoting the release candidate:

```bash
bun run studio:check
bun run studio:env:check:prod
bun run studio:build:prod
```

Confirm:

- [ ] `studio:check` passes.
- [ ] `studio:env:check:prod` passes with real non-placeholder env values.
- [ ] `studio:build:prod` passes for `web`, `api`, and `worker`.
- [ ] The release candidate contains the latest Studio docs and roadmap status.

If `studio:env:check:prod` or `studio:build:prod` cannot run locally because the production secret source is unavailable, record that explicitly and run the same commands in CI or the deployment environment before go-live.

## Deployment Sequence

Recommended order:

1. Ensure PostgreSQL is up and reachable.
2. Deploy `studio-api`.
3. Confirm API health and migration success.
4. Deploy `studio-web`.
5. Load the public Studio landing page and onboarding page in a browser.
6. Deploy or schedule `studio-worker`.
7. Trigger one manual sync execution to confirm the worker-to-API path.

## Immediate Post-Deploy Checks

### 1. API Health

Run:

```bash
curl -sS "$STUDIO_API_URL/health"
```

Expected:

```json
{"ok":true,"service":"studio-api"}
```

### 2. Web Reachability

Check:

- [ ] `GET /` on `STUDIO_WEB_URL` loads the Studio marketing page.
- [ ] `GET /onboarding` loads without client-side boot failure.
- [ ] The browser console shows no blocking startup errors during the smoke pass.

### 3. Worker Path

Use one of these:

```bash
curl -i \
  -X POST \
  -H "x-internal-secret: $INTERNAL_CRON_SECRET" \
  "$STUDIO_API_URL/api/v1/internal/sync/run"
```

or

```bash
bun run --filter @openlinks/studio-worker start
```

Expected:

- `200 OK`
- JSON response with `scanned`, `processed`, and `results`
- no unexpected unauthorized errors

## Go-Live Smoke Test

Use a real test user and one disposable fork before inviting production users.

### 1. Onboarding Flow

- [ ] Open `STUDIO_WEB_URL/onboarding`.
- [ ] Complete Turnstile in production.
- [ ] Start GitHub auth and return through the callback without a state mismatch.
- [ ] Confirm the status panel reports `GitHub connected: yes`.
- [ ] Install the GitHub App.
- [ ] Confirm the status panel reports `App installed: yes`.
- [ ] Provision a fork.
- [ ] Confirm the status panel reports `Repo provisioned: yes`.
- [ ] Open the editor from onboarding.

### 2. Editor Flow

In the editor for the test repo:

- [ ] Load content successfully from `GET /api/v1/repos/:repoId/content`.
- [ ] Run `Validate` and confirm the validation panel renders a valid result.
- [ ] Make a small reversible content edit.
- [ ] Run `Save to main` and confirm the status notice reports saved files.
- [ ] Click `Refresh status` and confirm the deployment panel shows CI/deploy status values.
- [ ] Confirm `Pages URL` is populated after deploy settles, if GitHub Pages is expected for the fork.
- [ ] Confirm the recent operations list includes `save_content`.
- [ ] Click `Sync upstream` and confirm the status message is not `failed`.

### 3. GitHub/Fork Verification

- [ ] Confirm the test fork received the Studio commit on the default branch.
- [ ] Confirm GitHub Actions for CI and Pages deploy are running or completed for that fork.
- [ ] Confirm the forked site is reachable when Pages deploy is expected.

## Launch Sign-Off

Do not mark launch complete until:

- [ ] API health probe is stable.
- [ ] Web onboarding smoke path passed.
- [ ] One end-to-end save path passed.
- [ ] One sync path passed.
- [ ] At least one operator other than the deployer knows where the security review and launch playbooks live.

## Rollback Checklist

Use rollback when the latest deployment breaks onboarding, saves, or general Studio availability.

1. Pause external announcements or access if users are actively failing.
2. Roll `studio-web`, `studio-api`, and `studio-worker` back to the last known good deployment in the hosting platform.
3. Confirm `GET /health` is healthy again.
4. Re-run the onboarding and editor smoke checks with the test account.
5. If the bad release changed secrets or migrations, document that before reopening traffic.

Important:

- The API auto-runs DB migrations on startup. If a bad deployment introduced a migration problem, rollback may require DB intervention before the old image is healthy again.
- Studio saves are direct-to-main for the fork. Rolling back the app does not undo commits already written to user repos.

## Production Incident Playbook

This section is for availability and operational incidents. For credential or secret incidents, pivot to `docs/studio-security-review.md`.

### 1. `studio-api` Down or Unhealthy

Symptoms:

- `GET /health` fails or times out
- onboarding and editor API calls fail broadly
- the web app loads but cannot authenticate, save, or refresh status

Checks:

```bash
curl -i "$STUDIO_API_URL/health"
```

Actions:

1. Check deployment logs for startup failure, especially env validation and DB migration errors.
2. Confirm PostgreSQL connectivity and `DATABASE_URL`.
3. Confirm the latest deploy included real values for `SESSION_SECRET`, `ENCRYPTION_KEY`, and GitHub secrets.
4. Roll back `studio-api` if the newest release introduced the outage.
5. Re-run the onboarding/editor smoke checks after recovery.

### 2. Web App Loads but Onboarding Is Broken

Symptoms:

- marketing page works but onboarding cannot connect GitHub
- GitHub callback fails
- status panel never advances past GitHub/app-install steps

Checks:

- verify the browser can reach `VITE_STUDIO_API_URL`
- inspect `/api/v1/auth/github/start` and `/api/v1/onboarding/status`
- verify GitHub App callback/setup URLs still match deployment
- verify Turnstile site key and secret match the current host

Actions:

1. If `/api/v1/auth/github/start` returns `captcha_missing`, `captcha_failed`, or `captcha_unavailable`, fix Turnstile config or availability first.
2. If callback fails on state mismatch, verify same-site deployment and cookie behavior before changing auth code.
3. If onboarding status reports `github_app_not_installed`, validate GitHub App installation for the owner.
4. If onboarding status reports `repo_not_provisioned`, retry with the test account and inspect API logs around `POST /api/v1/repos/provision`.

### 3. Save Path Fails or Deploy Status Is Stale

Symptoms:

- `Save to main` fails
- deploy panel never updates
- Pages URL remains unset when Pages should be enabled

Checks:

- editor validation panel result
- `GET /api/v1/repos/:repoId/deploy-status`
- `GET /api/v1/repos/:repoId/operations`
- fork GitHub Actions runs for CI and Pages deploy

Actions:

1. If validation fails with `422`, fix the content issue first; this is not a deployment incident.
2. If save fails after validation passes, inspect API logs and the recent operations list for `save_content`.
3. Confirm the GitHub App still has `Contents` write access.
4. Confirm the fork default branch still matches the repo record.
5. Use `Refresh status` in the editor to force a deploy-status poll after GitHub Actions changes.
6. If GitHub Actions or Pages are failing in the fork, treat the fork pipeline as the incident surface and fix it there before blaming Studio.

Useful SQL:

```sql
SELECT id, owner, name, default_branch, pages_url, last_sync_status, last_sync_message
FROM repos
ORDER BY updated_at DESC
LIMIT 20;
```

```sql
SELECT operation, status, created_at, detail_json
FROM repo_operations
WHERE repo_id = '<repo-id>'
ORDER BY created_at DESC
LIMIT 20;
```

### 4. Sync Failures or Conflict Backlog

Symptoms:

- `Sync upstream` returns `failed` or `conflict`
- onboarding status shows `sync_conflict`
- scheduled syncs stop progressing for an affected repo

Checks:

- editor status message after `Sync upstream`
- repo `last_sync_status`, `last_sync_message`, `sync_enabled`, and `sync_conflict`
- recent `sync_fork` operations
- recent `sync_jobs`

Actions:

1. If the result is `failed`, inspect API logs and GitHub upstream merge behavior first.
2. If the result is `conflict`, resolve the fork conflict in GitHub manually.
3. After manual resolution, clear the repo conflict lock in PostgreSQL because there is not yet a dedicated UI helper for this workflow.

Manual recovery SQL:

```sql
UPDATE repos
SET sync_enabled = TRUE,
    sync_conflict = FALSE,
    last_sync_status = 'manual_recovered',
    last_sync_message = 'Sync re-enabled after manual conflict resolution',
    updated_at = NOW()
WHERE id = '<repo-id>';
```

Audit queries:

```sql
SELECT status, message, created_at
FROM sync_jobs
WHERE repo_id = '<repo-id>'
ORDER BY created_at DESC
LIMIT 20;
```

### 5. Internal Sync Path Fails

Symptoms:

- scheduled worker executions fail
- manual `POST /api/v1/internal/sync/run` returns `401` or `5xx`

Checks:

- `studio-worker` logs
- `studio-api` logs around `/api/v1/internal/sync/run`
- `INTERNAL_CRON_SECRET` value in both worker and API environments

Actions:

1. If the endpoint returns `401`, fix secret drift between API and worker.
2. If the endpoint returns `5xx`, inspect DB connectivity and GitHub token refresh issues.
3. After recovery, trigger one manual run and confirm the response includes processed results.

### 6. Database Outage or Migration Failure

Symptoms:

- API health is down after deploy
- API logs fail during startup migration
- auth, onboarding status, save, and operations fail together

Actions:

1. Restore PostgreSQL availability first.
2. Verify the API service can run migrations successfully.
3. Roll back the API deployment if the latest code or migration introduced the failure.
4. Do not reopen traffic until `GET /health` succeeds and the onboarding/editor smoke checks pass.

## Post-Incident Checklist

- [ ] Incident start/end time captured
- [ ] Affected services captured (`web`, `api`, `worker`, GitHub App, PostgreSQL, fork pipeline)
- [ ] User-visible symptoms recorded
- [ ] Rollback or fix path recorded
- [ ] SQL/manual interventions recorded
- [ ] Follow-up checklist or product gaps added back to `docs/studio-phase-checklist.md`
