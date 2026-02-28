# LinkedIn Authenticated Metadata Debug Runbook

This runbook is the ongoing local debug workflow for LinkedIn authenticated rich metadata extraction using browser session state.

Scope:

- LinkedIn only
- one-off/local workflow
- no CI usage in this phase

Production workflow now uses authenticated extractor cache integration:

- configure `links[].enrichment.authenticatedExtractor`
- capture with `bun run setup:rich-auth` (or `bun run auth:rich:sync`)
- commit `data/cache/rich-authenticated-cache.json` and `public/cache/rich-authenticated/*`
- enrichment/build consumes cache (no direct LinkedIn fetch for that link)

## Security and Handling Policy

- Keep credentials local-only.
- Do not commit auth state, cookies, or raw secrets.
- Use encrypted agent-browser session persistence:
  - `AGENT_BROWSER_SESSION_NAME`
  - `AGENT_BROWSER_ENCRYPTION_KEY` (64-char hex)
- Artifacts are written under `output/playwright/linkedin-debug/` (gitignored).

## Preconditions

1. `npx` is available.
2. `agent-browser` can be executed through `npx`.
3. `AGENT_BROWSER_ENCRYPTION_KEY` is set to a 64-character hex value.

Optional auth wait tuning:

- `OPENLINKS_AUTH_SESSION_TIMEOUT_MS` (default `600000`)
- `OPENLINKS_AUTH_SESSION_POLL_MS` (default `2000`)

Example local shell setup:

```bash
export AGENT_BROWSER_SESSION="openlinks-linkedin-debug"
export AGENT_BROWSER_SESSION_NAME="openlinks-linkedin-debug"
export AGENT_BROWSER_ENCRYPTION_KEY="<64-char-hex>"
```

## Run Sequence

1. Bootstrap and install binaries if needed:

```bash
bun run linkedin:debug:bootstrap
```

2. Start autonomous headed login watcher:

```bash
bun run linkedin:debug:login
```

Optional overrides:

```bash
bun run linkedin:debug:login -- --url "https://www.linkedin.com/in/your-profile/"
bun run linkedin:debug:login -- --auth-timeout-ms 900000 --poll-ms 1500
```

This command opens a browser and waits for auth progression (`login`/`mfa_challenge`/`authwall`/`authenticated`) automatically.
Multi-factor authentication is optional; the flow continues as soon as authenticated state is detected.
No Enter checkpoint is required.

3. Run authenticated metadata validation:

```bash
bun run linkedin:debug:validate
```

Optional diagnostics:

```bash
bun run linkedin:debug:validate -- --headed
bun run linkedin:debug:validate -- --auth-timeout-ms 900000 --poll-ms 1500
bun run linkedin:debug:validate:cookie-bridge
```

4. Review artifacts:

- `output/playwright/linkedin-debug/session-check-<timestamp>.json`
- `output/playwright/linkedin-debug/page-<timestamp>.html`
- `output/playwright/linkedin-debug/metadata-<timestamp>.json`
- `output/playwright/linkedin-debug/summary-<timestamp>.json`

5. Promote validated extraction into committed cache:

```bash
bun run setup:rich-auth
```

Optional one-link capture:

```bash
bun run auth:rich:sync -- --only-link linkedin
```

Optional forced refresh (even when cache is already valid):

```bash
bun run auth:rich:sync -- --only-link linkedin --force
```

Optional cache clear before recapture:

```bash
bun run auth:rich:clear -- --only-link linkedin
```

6. Cleanup (optional):

```bash
npx --yes agent-browser --session "${AGENT_BROWSER_SESSION:-openlinks-linkedin-debug}" close --json
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
| Bootstrap reports missing browser executable | Browser binaries not installed | Re-run `bun run linkedin:debug:bootstrap` (auto-installs) |
| Login script times out | Login or challenge not completed before timeout | Re-run `bun run linkedin:debug:login`, finish prompts in browser, or increase `--auth-timeout-ms` |
| Validator fails with `reauth_required` | Session expired or auth not established | Run `bun run linkedin:debug:login` first, then re-run validator |
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
