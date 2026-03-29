# OpenClaw Bootstrap Contract (OpenLinks)

This document is the canonical runbook for OpenClaw agents that bootstrap and maintain a user's OpenLinks fork.

Use this contract as authoritative behavior for:

- repository bootstrap,
- profile/social personalization,
- validation/build/push,
- deployment verification,
- URL reporting,
- README deployment URL block updates.

After first successful deploy, use `docs/openclaw-update-crud.md` for ongoing day-2 maintenance and CRUD sessions.

## Scope and Non-Goals

In scope:

- End-to-end automation for GitHub-hosted OpenLinks forks.
- Markdown-only process contract (no repo-local skill package format).
- Structured deployment URL reporting that supports future targets.

Out of scope:

- Runtime app code changes.
- New CI/CD workflows.
- Interactive checkpoints or approval pauses other than:
  - a single route-confirmation prompt when an existing setup is detected,
  - a single fork-workflow-enable prompt when GitHub has not enabled Actions runs for the new fork,
  - a single identity-confirmation prompt when confidence is low.

Bootstrap must normalize a fresh fork to a clean starter baseline before personalization begins.
Do not personalize on top of inherited upstream identity, cached rich metadata, badges, or README deploy URLs.

## Required Execution Policy

- Git flow: commit and push directly to `main`.
- Pause policy: no pauses by default; allow:
  - one route-confirmation prompt if existing fork/local setup is detected,
  - one fork-workflow-enable prompt only when GitHub shows the disabled-fork Actions gate,
  - one identity-confirmation prompt only when identity confidence is low.
- Retry policy: bounded deployment verification retries only.
- Source trust policy: high-confidence social discovery from authoritative-chain sources only.
- Payment/crypto policy: do not infer or add payment links or crypto addresses unless the user explicitly requests them.
- Fork reset policy:
  - for first-time fork bootstrap, run `bun run fork:reset` after clone/install and before any identity/link/site personalization,
  - treat `bun run fork:reset --check` as the dry-run diagnostic when you need to explain what inherited seed state will be cleared,
  - do not skip the reset step just because the repo validates or builds before personalization.

If auth/permission or environment blockers occur, fail fast with remediation instructions in final output.

## End-to-End OpenClaw Sequence

Execute in this exact order.

1. Check whether user already appears to have an existing OpenLinks fork and/or local repository.
2. If existing setup is detected, ask one route-confirmation question:
   - continue bootstrap, or
   - switch to `docs/openclaw-update-crud.md` for day-2 maintenance.
3. If user selects day-2 maintenance, stop bootstrap and hand off to `docs/openclaw-update-crud.md`.
4. Ensure user fork exists.
5. Ensure fork workflows are enabled when bootstrap is targeting a fork:
   - detect the disabled-fork Actions gate before deployment verification,
   - if GitHub shows "Workflows aren’t being run on this forked repository", ask the user to click **Enable workflows** in the fork’s **Actions** tab,
   - after the user enables workflows, create or request one fresh push event on `main` before continuing CI/deploy verification.
6. Clone user fork and enter repository root.
7. Install dependencies (`bun install` or `bun install --frozen-lockfile`).
8. Run `bun run fork:reset`.
9. Resolve user identity using the precedence rules in this document.
10. If the user explicitly provided a Linktree URL, run `bun run bootstrap:linktree -- --url <linktree-url>` and use the extracted profile/avatar/social/content links as bootstrap candidates before asking for manual link entry.
11. Personalize data files:
   - `data/profile.json`
   - `data/links.json`
   - `data/site.json`
12. Validate and build:
   - `bun run validate:data`
   - `bun run build`
   - `bun run quality:check`
13. Commit and push directly to `main`.
14. Resolve deployment target selection and primary host:
   - upstream default: `aws` primary + `github-pages` mirror
   - fork default: `github-pages` primary
   - optional fork additions: `render`, `railway`
15. Verify GitHub Pages source is set to **GitHub Actions**.
16. For the upstream repo, verify AWS deploy settings are present (`OPENLINKS_ENABLE_AWS_DEPLOY=true` and `AWS_DEPLOY_ROLE_ARN`).
17. Poll CI and all relevant deploy surfaces for the pushed SHA.
18. On success, collect deployment URLs.
19. Post structured URL summary in chat using the schema in this file.
20. Update the README deploy URL marker block only if normalized URL/status values changed.
21. Commit/push README update if and only if step 20 changed file content.

## Automation and Identity Confirmation Rule

OpenClaw should not request user confirmation mid-run except for setup routing and identity ambiguity.

- Low-confidence social candidates: skip and report in `Not Applied` section.
- Missing credentials/permissions: stop run, report blocker, provide concrete remediation.
- Validation/build/deploy failures: follow retry policy where applicable, then exit with terminal summary.
- If an existing fork/local repo is detected during bootstrap, ask one route-confirmation question about switching to `docs/openclaw-update-crud.md`.
- If a fork exists but GitHub still shows the disabled-fork Actions banner, ask one explicit prompt telling the user to click **Enable workflows** in the fork’s **Actions** tab, then resume only after a fresh push event exists for verification.
- If identity confidence is low, ask one explicit identity confirmation question before writing identity fields.
- If identity cannot be confirmed (no response channel), stop with a blocker summary instead of assuming.

## Social Discovery and Inference Contract

### Allowed discovery sources only

Use only this authoritative chain:

1. Existing repo data (`data/profile.json`, `data/links.json`).
2. Fork owner identity and repository metadata.
3. GitHub profile fields/links for that owner.
4. Verified personal website links reachable from items 1-3.

Do not use broad web search as a primary discovery method.

If the user explicitly provides a Linktree URL, treat that URL as an allowed bootstrap seed. You may run `bun run bootstrap:linktree -- --url <linktree-url>` and use the extracted output as candidate profile/link data, but still apply it conservatively and do not invent extra links beyond the extractor output plus the authoritative chain above.

### Excluded by default (explicit opt-in required)

Do not auto-add payment or financial endpoints unless the user explicitly asks.

Examples:

- payment links (for example PayPal, Stripe payment links, Buy Me a Coffee, Patreon),
- donation links,
- crypto wallet addresses (for example BTC, ETH, SOL, Lightning).

If these are discovered incidentally, place them in `Not Applied` with reason `explicit_request_required`.

### Fork seed-data identity guardrail

This repository may contain starter identity data from the upstream author, including `Peter Ryszkiewicz` and associated links.

Treat forked `data/profile.json` and `data/links.json` identity values as template defaults, not user truth.
Treat inherited badges, generated rich metadata, follower history, cached avatars/images, and README deploy URLs the same way.

- Do not assume the OpenClaw user is `Peter Ryszkiewicz` unless explicitly confirmed by the user.
- Prefer the fork owner's GitHub identity and explicitly user-provided identity over seeded file content.
- Run `bun run fork:reset` before discovery/personalization so those inherited seed values are cleared instead of selectively patched.
- If seeded identity conflicts with higher-authority identity signals, replace seeded identity fields and personal links.
- If confidence remains low after authoritative checks, run the single identity-confirmation prompt described above.

### Acceptance rule

- Auto-apply only high-confidence profile URLs derived from the authoritative chain.
- Skip uncertain candidates.
- Payment links and crypto addresses are never auto-applied without explicit user request, even when confidence is high.
- Include skipped candidates in final summary under `Not Applied` with reason.

### Deterministic field mapping

- Identity profile fields -> `data/profile.json`.
- Social/profile endpoints -> `data/links.json` links and optional `profileLinks` in `data/profile.json`.
- Payment links and crypto addresses -> include only when explicitly requested by the user.
- For explicitly requested branded payment/tip cards, verify card-shell icon resolution and QR badge resolution separately. `badge.items.asset` only changes the QR center badge; shared card chrome still follows known-site icon resolution from `links[].icon` or `payment.rails[].icon`.
- Preserve unknown extension fields under `custom`.
- Never drop existing `custom` keys unless explicitly invalid and replaced with documented remediation.

### Identity resolution precedence

Resolve identity in this order:

1. Explicit user-provided identity in current session.
2. Authenticated GitHub actor/fork owner profile.
3. Authoritative links reachable from (1) or (2).
4. Existing fork data values as fallback defaults only.

Never let step 4 override steps 1-3.

## Deployment Verification Contract

### Targets in scope now

- `aws`
- `github-pages`
- `render`
- `railway`

### Workflow evidence sources

- CI workflow: `.github/workflows/ci.yml`
- Deploy workflow: `.github/workflows/deploy-pages.yml`
- AWS deployment evidence: `Deploy AWS Canonical Site` job summary and `deploy:aws:publish` step summary.
- Pages deployment URL source: `steps.deployment.outputs.page_url` in `Deploy GitHub Pages Mirror`.
- Render deployment evidence: live `build-info.json` at the deployed public URL plus the Render deploy logs/dashboard.
- Railway deployment evidence: live `build-info.json` at the deployed public URL plus the Railway deploy logs/dashboard.

### Fork workflow activation gate

For first-time fork bootstrap, GitHub may block all Actions runs until the fork owner clicks **Enable workflows** in the fork’s **Actions** tab.

Treat the following as positive evidence that the gate is still active:

1. workflow definitions exist and are `active`,
2. repository Actions permissions are enabled,
3. repeated fresh pushes to `main` still produce zero workflow runs, and
4. the Pages URL continues serving GitHub’s default 404 placeholder.

When this state is detected:

1. tell the user to click **Enable workflows**,
2. create or ask for one fresh push on `main`,
3. restart CI/deploy verification from that new SHA.

### Required success checks for pushed SHA

1. CI `required-checks` succeeded on the relevant commit lineage.
2. GitHub Pages deployment succeeded when GitHub Pages is a selected target.
3. AWS canonical deployment succeeded when AWS deploy is enabled.
4. Render deployment serves the pushed SHA when Render is a selected target.
5. Railway deployment serves the pushed SHA when Railway is a selected target.
6. Exactly one selected host is primary/indexable and all other selected hosts canonicalize to it.

### Bounded auto-retry policy

Retry deployment verification at most 3 attempts total with backoff:

1. wait 60 seconds
2. wait 120 seconds
3. wait 240 seconds

After final unsuccessful attempt, terminate with:

- failing check,
- evidence inspected,
- remediation commands/actions.

If the final unsuccessful attempt still shows the fork workflow activation gate symptoms above, report that specific gate as the blocker instead of a generic CI failure.

## Structured URL Reporting Schema

Use this stable schema for chat output and README marker-block updates.

| Field | Description |
|------|-------------|
| `target` | Deployment target id (for example `aws`, `github-pages`, `render`, `railway`) |
| `status` | `success`, `warning`, or `failed` |
| `primary_url` | Main user-facing URL |
| `additional_urls` | Comma-separated auxiliary URLs or `none` |
| `evidence` | Workflow/job/source pointer used to verify |

### Current required rows

For the upstream repo, include both `aws` and `github-pages`.
For forks, include `github-pages` by default plus `render` and/or `railway` when configured.
For forks without AWS opt-in, omit `aws`.

Example format:

| target | status | primary_url | additional_urls | evidence |
|--------|--------|-------------|-----------------|----------|
| aws | success | https://openlinks.us/ | none | deploy-pages.yml -> Deploy AWS Canonical Site |
| github-pages | success | https://<owner>.github.io/<repo>/ | canonical=https://openlinks.us/ | deploy-pages.yml -> Deploy GitHub Pages Mirror -> `steps.deployment.outputs.page_url` |
| render | success | https://<service>.onrender.com/ | canonical=https://<primary-host>/ | Render -> live /build-info.json |
| railway | success | https://<service>.up.railway.app/ | canonical=https://<primary-host>/ | Railway -> live /build-info.json |

## README Deploy URL Marker-Block Contract

OpenClaw must update only the content bounded by these exact markers in `README.md`:

- `OPENCLAW_DEPLOY_URLS_START`
- `OPENCLAW_DEPLOY_URLS_END`

Rules:

1. Rewrite only lines inside marker boundaries.
2. Normalize URL/status values before comparing.
3. Commit only when normalized values changed.
4. Keep markdown table shape stable.

This prevents deploy-update commit loops.

## Final Output Contract (Chat)

End run with a structured summary containing:

- `Applied`:
  - files changed,
  - checks passed,
  - commit SHA(s),
  - deployment URL rows.
- `Not Applied`:
  - skipped low-confidence social candidates,
  - payment/crypto candidates skipped by default unless explicitly requested,
  - unsupported operations,
  - reason per item.
- `Blockers` (if any):
  - exact failure point,
  - minimal remediation steps.

## Recommended Bootstrap Prompt (for OpenClaw)

Use this single-message prompt with OpenClaw:

<!-- OPENCLAW_BOOTSTRAP_PROMPT:start -->
```text
Follow https://raw.githubusercontent.com/pRizz/open-links/main/docs/openclaw-bootstrap.md exactly for this repository. Execute Required Execution Policy, End-to-End OpenClaw Sequence, Automation and Identity Confirmation Rule, Social Discovery and Inference Contract, Deployment Verification Contract, Structured URL Reporting Schema, README Deploy URL Marker-Block Contract, and Final Output Contract exactly as written. If an existing setup is detected, ask the single route-confirmation and switch to https://raw.githubusercontent.com/pRizz/open-links/main/docs/openclaw-update-crud.md when selected.
```
<!-- OPENCLAW_BOOTSTRAP_PROMPT:end -->

## Handoff to Day-2 Updates

Once bootstrap is complete and the first deployment is successful, switch to:

- `docs/openclaw-update-crud.md`

This keeps first-time setup and recurring CRUD workflows separate and predictable.
