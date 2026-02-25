# LinkedIn Authenticated Metadata PoC

This runbook validates a local-only workaround for LinkedIn rich metadata by using an authenticated browser session.

Scope:

- LinkedIn only
- one-off/local workflow
- no CI usage in this phase

Production workflow now uses authenticated extractor cache integration:

- configure `links[].enrichment.authenticatedExtractor`
- capture with `npm run setup:rich-auth` (or `npm run auth:rich:sync`)
- commit `data/cache/rich-authenticated-cache.json` and `public/cache/rich-authenticated/*`
- enrichment/build consumes cache (no direct LinkedIn fetch for that link)

## Security and Handling Policy

- Keep credentials local-only.
- Do not commit auth state, cookies, or raw secrets.
- Use encrypted agent-browser session persistence:
  - `AGENT_BROWSER_SESSION_NAME`
  - `AGENT_BROWSER_ENCRYPTION_KEY` (64-char hex)
- Artifacts are written under `output/playwright/linkedin-poc/` (gitignored).

## Preconditions

1. `npx` is available.
2. `agent-browser` can be executed through `npx`.
3. `AGENT_BROWSER_ENCRYPTION_KEY` is set to a 64-character hex value.

Optional auth wait tuning:

- `OPENLINKS_AUTH_SESSION_TIMEOUT_MS` (default `600000`)
- `OPENLINKS_AUTH_SESSION_POLL_MS` (default `2000`)

Example local shell setup:

```bash
export AGENT_BROWSER_SESSION="openlinks-linkedin-poc"
export AGENT_BROWSER_SESSION_NAME="openlinks-linkedin-poc"
export AGENT_BROWSER_ENCRYPTION_KEY="<64-char-hex>"
```

## Run Sequence

1. Bootstrap and install binaries if needed:

```bash
npm run poc:linkedin:bootstrap
```

2. Start autonomous headed login watcher:

```bash
npm run poc:linkedin:login
```

Optional overrides:

```bash
npm run poc:linkedin:login -- --url "https://www.linkedin.com/in/your-profile/"
npm run poc:linkedin:login -- --auth-timeout-ms 900000 --poll-ms 1500
```

This command opens a browser and waits for auth progression (`login`/`mfa_challenge`/`authwall`/`authenticated`) automatically.
No Enter checkpoint is required.

3. Run authenticated metadata validation:

```bash
npm run poc:linkedin:validate
```

Optional diagnostics:

```bash
npm run poc:linkedin:validate -- --headed
npm run poc:linkedin:validate -- --auth-timeout-ms 900000 --poll-ms 1500
npm run poc:linkedin:validate:cookie-bridge
```

4. Review artifacts:

- `output/playwright/linkedin-poc/session-check-<timestamp>.json`
- `output/playwright/linkedin-poc/page-<timestamp>.html`
- `output/playwright/linkedin-poc/metadata-<timestamp>.json`
- `output/playwright/linkedin-poc/summary-<timestamp>.json`

5. Promote validated extraction into committed cache:

```bash
npm run setup:rich-auth
```

Optional one-link capture:

```bash
npm run auth:rich:sync -- --only-link linkedin
```

6. Cleanup (optional):

```bash
npx --yes agent-browser --session "${AGENT_BROWSER_SESSION:-openlinks-linkedin-poc}" close --json
```

## Pass / Fail Criteria

Pass:

- parser completeness is not `none`
- metadata is not classified as placeholder/authwall/signup content

Fail:

- parser completeness is `none`, or
- placeholder signals are detected (`Sign Up | LinkedIn`, authwall/challenge indicators, etc.), or
- session auth precheck times out without `authenticated` state

## Troubleshooting Matrix

| Symptom | Likely Cause | Remediation |
|---|---|---|
| Bootstrap reports missing browser executable | Browser binaries not installed | Re-run `npm run poc:linkedin:bootstrap` (auto-installs) |
| Login script times out | Login or MFA/challenge not completed | Re-run `npm run poc:linkedin:login`, finish prompts in browser, or increase `--auth-timeout-ms` |
| Validator fails with `reauth_required` | Session expired or auth not established | Run `npm run poc:linkedin:login` first, then re-run validator |
| Validator returns placeholder signals | Session redirected to authwall/signup or non-profile target | Re-run login, verify final URL, then re-run validator |
| Cookie-bridge check fails but browser parse succeeds | Cookies do not translate to raw HTTP fetch path | Use browser-session extraction as source of truth |

## Updating Findings

After each meaningful run, update `docs/rich-metadata-fetch-blockers.md` with:

1. UTC timestamp.
2. Session mode (`manual`, `hybrid`, or `automated`).
3. Result (`pass`/`fail`).
4. Metadata quality (`full`/`partial`/`none`, placeholder signals).
5. Cookie-bridge result (if run).
6. Next action/remediation.
