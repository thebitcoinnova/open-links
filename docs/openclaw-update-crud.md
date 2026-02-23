# OpenClaw Update/CRUD Contract (OpenLinks)

This document is the canonical runbook for OpenClaw agents that update and maintain an existing OpenLinks setup.

Use this contract when the user likely already has:

- a fork in GitHub,
- a local clone, or
- both.

Use `docs/openclaw-bootstrap.md` for first-time setup when no usable fork/local repo exists.

## Scope and Non-Goals

In scope:

- Day-2 CRUD updates for `data/profile.json`, `data/links.json`, and `data/site.json`.
- Startup interaction-level selection.
- Identity-research on/off control.
- Deterministic local/fork resolution.
- CI/deploy verification and README URL-marker updates.

Out of scope:

- Runtime app code changes.
- Workflow file changes.
- Repo-local executable skill packages.

## Required Startup Handshake (First Step)

OpenClaw must start every Update/CRUD session by asking for:

1. `interaction_mode`: `guided`, `balanced`, or `autopilot`.
2. `identity_research`: `on` or `off`.
3. `seed_identities`: optional plain-text seed list (handles, profile URLs, usernames, emails).

### Defaults

If user does not choose explicitly:

- `interaction_mode`: default to `balanced`.
- `identity_research`: default to `on`.
- `seed_identities`: default to none.

If no seeds are provided and research is enabled, proceed with authoritative-chain identity discovery.

## Repository Resolution (Deterministic Order)

Resolve repository target in this order:

1. Check whether current working directory is a valid OpenLinks repo.
2. If not, check user-provided or known local candidate paths.
3. If no valid local repo is found, look for the user's fork in GitHub.
4. If fork exists and local clone is missing, clone fork and continue.
5. If neither valid local repo nor fork exists:
   - warn user that no valid target was found,
   - ask one confirmation to run auto-bootstrap mode,
   - if confirmed, execute `docs/openclaw-bootstrap.md`, then resume Update/CRUD flow,
   - if not confirmed, stop with blocker summary.

## Dirty Local Repository Handling

If target local repo has uncommitted or untracked changes:

1. Summarize changed and untracked files.
2. Ask one choice:
   - continue in-place, or
   - require clean working tree.
3. Continue only according to user choice.

## Interaction Modes

### `guided`

- Confirm every CRUD action before write.
- Confirm every deletion before write.
- Confirm final apply batch before commit.

### `balanced` (default)

- Confirm per batch:
  - profile batch,
  - links batch,
  - site batch.
- Confirm every deletion before write.
- Skip confirmations for straightforward non-destructive field updates within approved batch.

### `autopilot`

- No per-change confirmations after startup handshake.
- Continue autonomously unless blockers occur.
- Still surface final summary with exact applied/not-applied details.

## Identity and Discovery Policy

### Research ON

When `identity_research=on`, use authoritative-chain sources only:

1. Current repo data (`data/profile.json`, `data/links.json`).
2. Fork owner identity and repository metadata.
3. GitHub profile fields/links for that owner.
4. Verified personal website links reachable from those sources.

### Research OFF (Explicit-Only CRUD)

When `identity_research=off`:

- Apply only explicitly requested CRUD operations.
- Do not infer or add identities/links beyond explicit requests.
- Seed identities are treated as explicit user input and may be used directly.

### Shared discovery guardrails

- Treat upstream seed identity (for example `Peter Ryszkiewicz`) as template data, not user truth.
- Do not infer or add payment/crypto endpoints unless explicitly requested.
- Skip low-confidence inferred candidates.
- Record skipped items in `Not Applied` with reason code.

## Update/CRUD Execution Sequence

Execute in this exact order:

1. Run startup handshake (`interaction_mode`, `identity_research`, `seed_identities`).
2. Resolve repository target using deterministic order above.
3. Handle dirty working tree according to one user choice.
4. Build CRUD change plan from user request, mode, research setting, and seeds.
5. Confirm CRUD plan according to selected interaction mode.
6. Apply changes to:
   - `data/profile.json`
   - `data/links.json`
   - `data/site.json`
7. Validate and build:
   - `npm run validate:data`
   - `npm run build`
   - `npm run quality:check`
8. Commit and push directly to `main`.
9. Verify CI + Deploy Pages success for pushed SHA.
10. Report structured deployment URL table (`target`, `status`, `primary_url`, `additional_urls`, `evidence`).
11. Update README deployment URL marker block only when normalized URL/status values changed.
12. Commit and push README URL update only if step 11 changed file content.

## Final Output Contract (Chat)

End every run with:

- `Applied`:
  - changed files,
  - checks executed,
  - commit SHA(s),
  - deployment URL rows.
- `Not Applied`:
  - skipped candidates and skipped requests with reason code.
- `Blockers`:
  - exact failure point,
  - minimal remediation steps.

### Required reason codes

Use these for skipped discovery/apply outcomes:

- `low_confidence`
- `explicit_request_required`
- `research_disabled`

## Recommended Update/CRUD Prompt (for OpenClaw)

Use this single-message prompt with OpenClaw:

```text
Follow docs/openclaw-update-crud.md exactly for this repository. Start by asking for interaction_mode (guided|balanced|autopilot), identity_research (on|off, default on), and optional seed_identities. Resolve an existing repo by checking current local repo first, then candidate local paths, then my GitHub fork; if none exists, warn and ask once whether to run auto-bootstrap before continuing. If local repo is dirty, summarize changed files and ask once whether to continue in-place or require a clean tree. If identity research is off, run explicit-only CRUD; if on, use authoritative-chain discovery only. Treat upstream starter identity data (for example Peter Ryszkiewicz) as template data, not user truth. Do not infer payment links or crypto addresses unless explicitly requested. Apply CRUD to data/profile.json + data/links.json + data/site.json, run validate/build/quality checks, push directly to main, verify CI + deploy for pushed SHA, report deployment URLs, and update README OPENCLAW_DEPLOY_URLS marker block only when normalized URL/status values changed.
```

## Related Docs

- `docs/openclaw-bootstrap.md`
- `docs/quickstart.md`
- `docs/deployment.md`
- `docs/ai-guided-customization.md`
- `docs/data-model.md`
