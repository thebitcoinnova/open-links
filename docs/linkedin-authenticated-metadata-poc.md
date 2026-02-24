# LinkedIn Authenticated Metadata PoC

This runbook validates a local-only workaround for LinkedIn rich metadata by using an authenticated browser session.

Scope:

- LinkedIn only
- one-off/manual workflow
- no default build pipeline integration
- no CI usage in this phase

## Security and Handling Policy

- Keep credentials local-only.
- Do not commit auth state, cookies, or raw secrets.
- Use encrypted agent-browser session persistence:
  - `AGENT_BROWSER_SESSION_NAME`
  - `AGENT_BROWSER_ENCRYPTION_KEY` (64-char hex)
- Artifacts are written under `output/playwright/linkedin-poc/` (already gitignored).

## Preconditions

1. `npx` is available.
2. `agent-browser` can be executed through `npx`.
3. `AGENT_BROWSER_ENCRYPTION_KEY` is set to a 64-character hex value.

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

2. Start headed browser and complete manual login/MFA:

```bash
npm run poc:linkedin:login
```

Optional URL override:

```bash
npm run poc:linkedin:login -- --url "https://www.linkedin.com/in/your-profile/"
```

3. Run authenticated metadata validation:

```bash
npm run poc:linkedin:validate
```

Optional diagnostics:

```bash
npm run poc:linkedin:validate -- --headed
npm run poc:linkedin:validate:cookie-bridge
```

4. Review artifacts:

- `output/playwright/linkedin-poc/session-check-<timestamp>.json`
- `output/playwright/linkedin-poc/page-<timestamp>.html`
- `output/playwright/linkedin-poc/metadata-<timestamp>.json`
- `output/playwright/linkedin-poc/summary-<timestamp>.json`

5. Cleanup (optional):

```bash
npx --yes agent-browser --session "${AGENT_BROWSER_SESSION:-openlinks-linkedin-poc}" close --json
```

## Pass / Fail Criteria

Pass:

- parser completeness is not `none`
- metadata is not classified as placeholder/authwall/signup content

Fail:

- parser completeness is `none`, or
- placeholder signals are detected (`Sign Up | LinkedIn`, authwall/challenge indicators, etc.)

## Troubleshooting Matrix

| Symptom | Likely Cause | Remediation |
|---|---|---|
| Bootstrap reports missing browser executable | Browser binaries not installed | Re-run `npm run poc:linkedin:bootstrap` (auto-installs) |
| Login script fails verification (`li_at` missing) | Login incomplete or challenge not finished | Re-run login script, complete all prompts/MFA, verify signed-in landing page |
| Validator returns placeholder signals | Session is unauthenticated or redirected to authwall/signup | Re-run login session, then re-run validator |
| Validator fails with metadata missing | Authenticated page still lacks OG metadata | Treat LinkedIn as blocked for direct enrichment, keep manual metadata fallback |
| Cookie-bridge check fails but browser parse succeeds | Cookies do not translate to raw HTTP fetch path | Use browser-session extraction as PoC source of truth |

## Updating Findings

After each meaningful run, update `docs/rich-metadata-fetch-blockers.md` with:

1. UTC timestamp.
2. Session mode (`manual`, `hybrid`, or future `automated`).
3. Result (`pass`/`fail`).
4. Metadata quality (`full`/`partial`/`none`, placeholder signals).
5. Cookie-bridge result (if run).
6. Next action/remediation.

## Future Phases (Not Implemented Here)

### Phase 2: Credential Fill + Hybrid MFA

- Add local-only env vars:
  - `LINKEDIN_USERNAME`
  - `LINKEDIN_PASSWORD`
- Attempt automated credential fill first.
- If MFA/challenge detected, pause for manual completion and continue in hybrid mode.

### Phase 3: CI Targeting (Opt-in, Not Default)

- Add explicit gated workflow for authenticated metadata collection.
- Use ephemeral secret injection and strict secret handling boundaries.
- Require compliance/risk review before enabling for shared CI.
