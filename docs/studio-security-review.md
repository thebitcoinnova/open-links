# Studio Security Review Checklist and Runbook

This document is the pre-launch and day-2 security review runbook for OpenLinks Studio.

Use it before a production launch, after any Studio auth/session/webhook changes, and after any suspected security incident involving Studio infrastructure or GitHub App credentials.

Scope:

- `packages/studio-web`
- `packages/studio-api`
- `packages/studio-worker`
- the Studio PostgreSQL database
- the GitHub App used for onboarding, save, and sync

## Current Security Controls

The checklist below is grounded in the controls currently implemented in the Studio codebase:

- Session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- GitHub OAuth state is stored in a short-lived cookie and validated on callback.
- User GitHub tokens are encrypted at rest in PostgreSQL before storage.
- Global rate limiting is enabled on the API, with tighter limits on auth start/callback.
- Production onboarding requires a valid Cloudflare Turnstile token.
- Turnstile responses are hostname-checked against `STUDIO_WEB_URL`.
- GitHub webhooks verify `x-hub-signature-256` against the exact raw request body.
- Internal sync execution requires `x-internal-secret` to match `INTERNAL_CRON_SECRET`.
- Sync conflicts disable further auto-sync for the affected repo until manually resolved.

## Required Inputs

Gather these values before the review:

- deployed `STUDIO_WEB_URL`
- deployed `STUDIO_API_URL`
- deployed `COOKIE_DOMAIN` value, if used
- current GitHub App settings page
- production env source for Studio services
- PostgreSQL access for emergency session/token invalidation

## Pre-Launch Security Review Checklist

### 1. Domain and Transport Review

- [ ] `STUDIO_WEB_URL` and `STUDIO_API_URL` both use `https://`.
- [ ] Browser traffic terminates over TLS only; there is no public `http://` origin for Studio.
- [ ] If `COOKIE_DOMAIN` is set, it matches the deployed Studio hostnames and is not broader than necessary.
- [ ] Studio Web and Studio API are deployed in a same-site configuration that works with `SameSite=Lax` cookies.

Notes:

- The current auth/session flow depends on browser cookies, not bearer tokens.
- Cross-site frontend/API deployments should be treated as suspect unless manually validated in real browsers.

### 2. Environment and Secret Review

Run:

```bash
bun run studio:env:check:prod
```

Confirm:

- [ ] No required Studio env values are missing.
- [ ] No placeholder values remain for `SESSION_SECRET`, `ENCRYPTION_KEY`, `GITHUB_*`, `TURNSTILE_SECRET_KEY`, or `INTERNAL_CRON_SECRET`.
- [ ] `SESSION_SECRET` is at least 32 characters.
- [ ] `ENCRYPTION_KEY` is at least 32 characters.
- [ ] `INTERNAL_CRON_SECRET` is at least 16 characters and is not reused anywhere else.
- [ ] Secret values are injected through deployment secrets, not committed files.

### 3. GitHub App Review

Confirm the GitHub App is configured exactly for Studio:

- [ ] Callback URL is `https://<studio-api-host>/api/v1/auth/github/callback`.
- [ ] Setup URL is `https://<studio-web-host>/onboarding/github-install-complete`.
- [ ] Webhook URL is `https://<studio-api-host>/api/v1/github/webhooks`.
- [ ] App permissions stay limited to `Contents: Read & Write`, `Metadata: Read`, and `Administration: Write`.
- [ ] The app is installed only for the expected owner/account scope.
- [ ] `GITHUB_WEBHOOK_SECRET` is set and recent rotations are documented.
- [ ] `GITHUB_APP_PRIVATE_KEY` is current and old keys have been removed from GitHub when rotated.

### 4. Session and Cookie Review

Manually verify in a production-like browser session:

- [ ] Successful GitHub auth sets a `studio_session` cookie with `HttpOnly`.
- [ ] The session cookie is marked `Secure` in production.
- [ ] Missing or expired session cookies produce `401` responses on protected API routes.
- [ ] Logout clears the session cookie and the backing DB session row.
- [ ] OAuth callback rejects missing or mismatched `state`.

Quick probes:

```bash
curl -i "$STUDIO_API_URL/api/v1/auth/me"
```

Expected:

- `401 Unauthorized` without a valid Studio session cookie.

### 5. CAPTCHA and Abuse Controls Review

Manually verify from the deployed onboarding page:

- [ ] Production onboarding blocks GitHub auth start until Turnstile completes.
- [ ] A missing Turnstile token causes `/api/v1/auth/github/start` to return `400` with `reason: "captcha_missing"`.
- [ ] An invalid token causes `/api/v1/auth/github/start` to return `403` with `reason: "captcha_failed"`.
- [ ] A Turnstile outage causes `/api/v1/auth/github/start` to return `503` with `reason: "captcha_unavailable"`.
- [ ] Turnstile is configured for the exact Studio hostname.

### 6. Webhook and Internal Endpoint Review

Run:

```bash
curl -i -X POST "$STUDIO_API_URL/api/v1/internal/sync/run"
```

Expected:

- `401 Unauthorized`

Run:

```bash
curl -i \
  -X POST \
  -H "x-github-event: installation" \
  -H "x-hub-signature-256: sha256=0000000000000000000000000000000000000000000000000000000000000000" \
  -H "content-type: application/json" \
  --data '{}' \
  "$STUDIO_API_URL/api/v1/github/webhooks"
```

Expected:

- `401 Unauthorized`

Confirm:

- [ ] `INTERNAL_CRON_SECRET` is only present in the worker/scheduler environment that needs it.
- [ ] `/api/v1/internal/sync/run` is not exposed to third-party callers through any public automation without the secret header.
- [ ] Invalid webhook signatures fail closed.
- [ ] Webhook delivery logs do not capture raw secrets or decrypted tokens.

### 7. Data Access and Blast Radius Review

Confirm:

- [ ] PostgreSQL access is restricted to Studio services and operators who need it.
- [ ] The default repo visibility choice is intentional for the deployment (`public` vs `private`).
- [ ] Operators understand that Studio saves commit directly to the fork default branch.
- [ ] Operators understand that deleting `github_tokens` forces re-auth and deleting `auth_sessions` forces logout.
- [ ] Operators understand that sync conflicts disable future auto-sync until intervention.

### 8. Verification Commands

Run the standard Studio verification lane:

```bash
bun run studio:lint
bun run studio:typecheck
bun run --filter @openlinks/studio-api test
bun run studio:test:integration
```

Confirm:

- [ ] All commands pass on the code being deployed.
- [ ] Any auth, webhook, or onboarding security changes are covered by tests before release.

## Incident Runbook

### Session Compromise or Suspected Cookie Theft

Use when:

- a Studio session appears to be hijacked
- a device/browser is lost
- `SESSION_SECRET` may have leaked

Immediate actions:

1. Disable public access to Studio if the compromise is ongoing.
2. Rotate `SESSION_SECRET`.
3. Invalidate active sessions in PostgreSQL:

```sql
DELETE FROM auth_sessions;
```

4. Redeploy `studio-api` so new cookie signing uses the rotated secret.
5. Ask affected users to sign in again.

Targeted invalidation for one GitHub login:

```sql
DELETE FROM auth_sessions
WHERE user_id = (
  SELECT id FROM users WHERE github_login = '<github-login>'
);
```

### GitHub Token or Encryption-Key Compromise

Use when:

- `ENCRYPTION_KEY` may have leaked
- GitHub access/refresh tokens may have been exfiltrated

Immediate actions:

1. Rotate `ENCRYPTION_KEY`.
2. Delete stored GitHub tokens so Studio cannot keep using compromised credentials:

```sql
DELETE FROM github_tokens;
```

Or target one user:

```sql
DELETE FROM github_tokens
WHERE user_id = (
  SELECT id FROM users WHERE github_login = '<github-login>'
);
```

3. Require affected users to re-authenticate through GitHub.
4. If compromise scope is unclear, rotate the GitHub App client secret, private key, and webhook secret as well.

Important:

- Rotating `ENCRYPTION_KEY` without clearing old encrypted tokens will make those stored tokens unreadable.
- Plan rotation as `delete tokens` -> `deploy new key` -> `re-auth users`.

### Webhook Secret Compromise

Use when:

- GitHub webhook deliveries may be forgeable

Immediate actions:

1. Rotate `GITHUB_WEBHOOK_SECRET` in GitHub App settings and deployment secrets.
2. Redeploy `studio-api`.
3. Send a known-invalid signature request and confirm the endpoint returns `401`.
4. Review recent `installation` webhook activity for unexpected app removals or suspensions.

### Internal Sync Secret Compromise

Use when:

- `INTERNAL_CRON_SECRET` may have leaked
- unexpected sync runs are observed

Immediate actions:

1. Rotate `INTERNAL_CRON_SECRET`.
2. Redeploy `studio-api` and any worker/scheduler using that secret.
3. Confirm requests without the new header return `401`.
4. Review recent sync-related operation logs and unexpected repo updates.

Optional containment if repo state looks unsafe:

```sql
UPDATE repos
SET sync_enabled = FALSE,
    last_sync_status = 'manual_lockdown',
    last_sync_message = 'Sync disabled during security incident',
    updated_at = NOW();
```

### Turnstile Outage or Misconfiguration

Use when:

- production onboarding cannot start because CAPTCHA verification is unavailable

Immediate actions:

1. Confirm the configured site key and secret match the deployed hostname.
2. Confirm `/api/v1/auth/github/start` is returning `captcha_unavailable` rather than a broader API failure.
3. If the outage is external, pause public onboarding rather than bypassing CAPTCHA silently.
4. Restore Turnstile service or configuration, then retry onboarding.

### GitHub App Uninstall or Suspension

Use when:

- onboarding status reports the app as not installed
- webhook `installation` events disabled repos unexpectedly

Immediate actions:

1. Confirm the GitHub App installation still exists for the expected owner.
2. Reinstall or unsuspend the app in GitHub.
3. Review affected repos in PostgreSQL; uninstall events disable sync automatically.
4. Re-enable sync only after confirming the installation is healthy and the repo state is expected.

## Post-Incident Review Checklist

- [ ] Incident start/end timestamps captured
- [ ] suspected blast radius documented
- [ ] affected users/repos documented
- [ ] secrets rotated documented
- [ ] invalidation SQL commands recorded
- [ ] follow-up code or runbook gaps added to `docs/studio-phase-checklist.md`
