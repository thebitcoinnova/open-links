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
- Optional full customization-audit path across all data-driven knobs in `docs/customization-catalog.md`.
- Startup interaction-level selection.
- Identity-research on/off control.
- Deterministic local/fork resolution.
- CI/deploy verification and README URL-marker updates.

Out of scope:

- Runtime app code changes.
- Workflow file changes.
- New authenticated extractor development (use dedicated authoring workflow).

## Required Startup Handshake (First Step)

OpenClaw must start every Update/CRUD session by asking for:

1. `interaction_mode`: `guided`, `balanced`, or `autopilot`.
2. `identity_research`: `on` or `off`.
3. `seed_identities`: optional plain-text seed list (handles, profile URLs, usernames, emails).
4. `customization_path`: `targeted-crud` or `customization-audit`.

If `customization_path=customization-audit`, OpenClaw must also ask for:

1. `audit_scope`: `full` or `focused`.
2. `focus_areas`: optional list used when `audit_scope=focused`.

## Defaults

If user does not choose explicitly:

- `interaction_mode`: default to `balanced`.
- `identity_research`: default to `on`.
- `seed_identities`: default to none.
- `customization_path`: default to `targeted-crud`.

Conditional defaults when `customization_path=customization-audit`:

- `audit_scope`: default to `full`.
- `focus_areas`: default to none.

If no seeds are provided and research is enabled, proceed with authoritative-chain identity discovery.

## Customization Audit Path (Optional)

When `customization_path=customization-audit`, OpenClaw must use `docs/customization-catalog.md` as a checklist source and allow user edits in any/all selected categories.

### Required behavior

1. Build an explicit category checklist from `docs/customization-catalog.md`.
2. If `audit_scope=full`, review all categories.
3. If `audit_scope=focused`, review only selected `focus_areas` and mark all others as skipped with reason `not_selected`.
4. For runtime/code-level customization requests during the audit path, do not apply code changes; report as `out_of_scope_runtime_code` and point user to `docs/theming-and-layouts.md`.

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
- In `customization-audit`, confirm each selected category before write.

### `balanced` (default)

- Confirm per batch:
  - profile batch,
  - links batch,
  - site batch.
- Confirm every deletion before write.
- Skip confirmations for straightforward non-destructive field updates within approved batch.
- In `customization-audit`, confirm per file-domain batch (`profile`, `links`, `site`) before write.

### `autopilot`

- No per-change confirmations after startup handshake.
- Continue autonomously unless blockers occur.
- In `customization-audit`, no per-category confirmations after startup handshake.
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

1. Run startup handshake (`interaction_mode`, `identity_research`, `seed_identities`, `customization_path`).
2. If `customization_path=customization-audit`, run conditional selectors (`audit_scope`, `focus_areas`).
3. Resolve repository target using deterministic order above.
4. Handle dirty working tree according to one user choice.
5. Branch flow by `customization_path`:
   - `targeted-crud`: build CRUD change plan from user request, mode, research setting, and seeds.
   - `customization-audit`: build category checklist and change plan from `docs/customization-catalog.md`, selected scope, and focus areas.
6. Confirm change plan according to selected interaction mode.
7. Apply approved changes to:
   - `data/profile.json`
   - `data/links.json`
   - `data/site.json`
8. Refresh caches, validate, and build:
   - `bun run enrich:rich:strict`
   - `bun run images:sync`
   - `bun run validate:data`
   - `bun run build`
   - `bun run quality:check`
   - include committed cache outputs in the same change batch when they change:
     - `data/cache/content-images.json`
     - `public/cache/content-images/*`
     - `data/cache/rich-authenticated-cache.json`
     - `public/cache/rich-authenticated/*`
9. Commit and push directly to `main`.
10. Verify CI + Deploy Pages success for pushed SHA.
11. Report structured deployment URL table (`target`, `status`, `primary_url`, `additional_urls`, `evidence`).
12. Update README deployment URL marker block only when normalized URL/status values changed.
13. Commit and push README URL update only if step 12 changed file content.

## Final Output Contract (Chat)

End every run with:

- `Applied`:
  - changed files,
  - checks executed,
  - commit SHA(s),
  - deployment URL rows.
- `Customization Coverage`:
  - one row per catalog area,
  - status must be one of `changed`, `unchanged`, or `skipped`,
  - short note for each row.
- `Not Applied`:
  - skipped candidates and skipped requests with reason code.
- `Blockers`:
  - exact failure point,
  - minimal remediation steps.

## Required reason codes

Use these for skipped discovery/apply outcomes:

- `low_confidence`
- `explicit_request_required`
- `research_disabled`
- `not_selected`
- `out_of_scope_runtime_code`

## Recommended Update/CRUD Prompt (for OpenClaw)

Use this single-message prompt with OpenClaw:

```text
Follow docs/openclaw-update-crud.md exactly for this repository. Execute Required Startup Handshake (including conditional customization-audit selectors), Defaults, Customization Audit Path (Optional), Repository Resolution, Dirty Local Repository Handling, Interaction Modes, Identity and Discovery Policy, Update/CRUD Execution Sequence, Final Output Contract, and Required reason codes exactly as written. When customization_path=customization-audit, use docs/customization-catalog.md as the checklist source.
```

## Related Docs

- `docs/customization-catalog.md`
- `docs/openclaw-bootstrap.md`
- `docs/quickstart.md`
- `docs/deployment.md`
- `docs/ai-guided-customization.md`
- `AGENTS.md`
- `docs/data-model.md`
- `docs/theming-and-layouts.md`
- `docs/create-new-rich-content-extractor.md`
- `skills/create-new-rich-content-extractor/SKILL.md`
