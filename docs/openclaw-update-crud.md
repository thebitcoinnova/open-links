# OpenClaw Update/CRUD Contract (OpenLinks)

This document is the canonical runbook for OpenClaw agents that update and maintain an existing OpenLinks setup.

Use this contract when the user likely already has:

- a fork in GitHub,
- a local clone, or
- both.

Use `docs/openclaw-bootstrap.md` for first-time setup when no usable fork/local repo exists.

## When to Invoke This Contract

Default to this contract when the user makes a vague repo-maintenance request in
an existing OpenLinks repo or fork, including requests like:

- "help"
- "help me update this repo"
- "customize this"
- "change my links"
- "edit my profile"
- other broad day-2 CRUD or maintenance phrasing

Use `docs/openclaw-bootstrap.md` instead when the request is clearly first-time
setup or no usable fork/local repo exists yet.

Do not use this contract for:

- runtime app or website code changes,
- CI/workflow implementation work,
- new authenticated extractor development,
- other named workflows with a more specific contract or skill.

## Scope and Non-Goals

In scope:

- Day-2 CRUD updates for `data/profile.json`, `data/links.json`, and `data/site.json`.
- Referral authoring through `links[].referral`, including manual disclosures, `catalogRef` adoption, supported-family `non_profile` referral links, and catalog-backed shared-vs-fork decisions.
- Optional full customization-audit path across all data-driven knobs in `docs/customization-catalog.md`.
- Deployment target and primary-host changes when the user wants deployment settings or docs updated.
- Startup interaction-level selection.
- Identity-research on/off control.
- Deterministic local/fork resolution.
- CI/deploy verification and README URL-marker updates.

Out of scope:

- Runtime app code changes.
- Workflow file changes.
- New authenticated extractor development (use dedicated authoring workflow).

## Referral Authoring Guidance

When a requested link is a referral, affiliate, promo, or invite destination:

1. If the request includes a new reusable family, offer variant, matcher/link shape, or a shared-vs-fork decision, start with `skills/referral-management/SKILL.md` before editing files.
2. Treat the catalog as the higher-level authoring layer:
   - shared catalog: `data/policy/referral-catalog.json`
   - fork-owned overlay: `data/policy/referral-catalog.local.json`
3. Keep `links[].referral` as the canonical runtime/render surface, including any manual disclosures and `catalogRef`.
4. Use `docs/data-model.md` for exact field meaning, precedence, and examples.
5. Prefer adding manual disclosure fields first; generated referral data may fill blanks later but is not authoritative.
6. Do not suggest a new extractor by default just because the referral URL is unfamiliar. Manual or catalog-backed referral authoring is a valid first step even when no extractor exists.
7. For supported profile-family URLs acting as referral/promo links, set or preserve `links[].enrichment.profileSemantics="non_profile"` unless the user explicitly wants profile-style rendering.
8. If a fork adds a generic shared catalog item that would help other forks, prompt for a clean upstream PR and keep `data/policy/referral-catalog.local.json` out of that PR scope.
9. If the user prefers Studio for the change, note that referral editing currently relies on Advanced JSON rather than first-class referral controls.

## Required Startup Handshake (First Step)

OpenClaw must start every Update/CRUD session by asking for:

1. `interaction_mode`: `guided`, `balanced`, or `autopilot`.
2. `identity_research`: `on` or `off`.
3. `seed_identities`: optional plain-text seed list (handles, profile URLs, usernames, emails).
4. `customization_path`: `targeted-crud` or `customization-audit`.

`seed_identities` may include a Linktree URL. When present, OpenClaw should use `bun run bootstrap:linktree -- --url <linktree-url>` to prefill profile/avatar/link candidates before asking the user to enumerate links manually.

If `customization_path=customization-audit`, OpenClaw must also ask for:

1. `audit_scope`: `full` or `focused`.
2. `focus_areas`: optional list used when `audit_scope=focused`.

If the request touches deployment settings, OpenClaw must also ask for:

1. `deployment_targets`: any of `github-pages`, `render`, `railway`, `aws`
2. `primary_host`: `github-pages`, `render`, `railway`, `aws`, `custom-domain`, or `unchanged`
3. map the answer into the effective deployment topology (`config/deployment.defaults.json` plus optional fork `config/deployment.json`), then rerun `bun run deploy:setup -- --apply`

## Defaults

If user does not choose explicitly:

- `interaction_mode`: default to `balanced`.
- `identity_research`: default to `on`.
- `seed_identities`: default to none.
- `customization_path`: default to `targeted-crud`.

Conditional defaults when `customization_path=customization-audit`:

- `audit_scope`: default to `full`.
- `focus_areas`: default to none.

Conditional deployment defaults when deployment settings are in scope:

- forks: `deployment_targets=github-pages`, `primary_host=github-pages`
- upstream repo: `deployment_targets=aws,github-pages`, `primary_host=aws`

If no seeds are provided and research is enabled, proceed with authoritative-chain identity discovery.

If a Linktree URL is included in `seed_identities`, treat it as the preferred bootstrap seed for link gathering in both `guided` and `autopilot` modes.

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
- If the repo still looks like inherited starter state and the user is effectively doing first personalization cleanup, run `bun run fork:reset` before other CRUD writes.
- Do not silently reset an already personalized repo; if starter-state signals are gone, use `bun run fork:reset --check` for evidence and require an explicit user request before using `--force`.
- Do not infer or add payment/crypto endpoints unless explicitly requested.
- Skip low-confidence inferred candidates.
- Record skipped items in `Not Applied` with reason code.
- For explicitly requested branded payment/tip cards, verify card-shell icon resolution and QR badge resolution separately. `badge.items.asset` only changes the QR center badge; shared card chrome still follows known-site icon resolution from `links[].icon` or `payment.rails[].icon`.

## Update/CRUD Execution Sequence

Execute in this exact order:

1. Run startup handshake (`interaction_mode`, `identity_research`, `seed_identities`, `customization_path`).
2. If `customization_path=customization-audit`, run conditional selectors (`audit_scope`, `focus_areas`).
3. Resolve repository target using deterministic order above.
4. Handle dirty working tree according to one user choice.
5. If current repo data still reflects inherited upstream starter state and the requested work is first-time cleanup/personalization, run `bun run fork:reset` before building the CRUD plan.
6. Branch flow by `customization_path`:
   - `targeted-crud`: build CRUD change plan from user request, mode, research setting, and seeds.
   - `customization-audit`: build category checklist and change plan from `docs/customization-catalog.md`, selected scope, and focus areas.
7. Confirm change plan according to selected interaction mode.
8. Apply approved changes to:
   - `data/profile.json`
   - `data/links.json`
   - `data/site.json`
9. Refresh caches, validate, and build:
   - `bun run enrich:rich:strict`
   - ensure any newly introduced remote fetch domains are covered by `data/policy/remote-cache-policy.json`
   - `bun run images:sync`
   - `bun run validate:data`
   - `bun run build`
   - `bun run quality:check`
   - include committed cache outputs in the same change batch when they change:
     - `data/cache/profile-avatar.json`
     - `public/cache/profile-avatar/*`
     - `data/cache/content-images.json`
     - `public/cache/content-images/*`
     - `data/cache/rich-authenticated-cache.json`
     - `public/cache/rich-authenticated/*`
10. Commit and push directly to `main`.
11. If deployment verification is in scope for a fork, ensure GitHub is actually running workflows for that fork:
   - if the fork’s Actions tab shows "Workflows aren’t being run on this forked repository", tell the user to click **Enable workflows**,
   - after that one-time enablement, create or request one fresh push on `main` before checking CI/deploy results.
12. Verify CI plus the relevant selected deployment targets for the pushed SHA.
13. Reconcile GitHub repository metadata to the selected primary host:
   - if the repo homepage/website still points at the upstream site or otherwise mismatches the selected primary host, update it,
   - when the fork is still on the default hosting path, use the verified GitHub Pages URL as the homepage,
   - if the homepage cannot be updated automatically, report a manual remediation note.
14. Report structured deployment URL table (`target`, `status`, `primary_url`, `additional_urls`, `evidence`).
15. Update README deployment URL marker block only when normalized URL/status values changed.
16. Commit and push README URL update only if step 15 changed file content.

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

<!-- OPENCLAW_UPDATE_PROMPT:start -->
```text
Follow https://raw.githubusercontent.com/pRizz/open-links/main/docs/openclaw-update-crud.md exactly for this repository. Execute Required Startup Handshake (including conditional customization-audit selectors), Defaults, Customization Audit Path (Optional), Repository Resolution, Dirty Local Repository Handling, Interaction Modes, Identity and Discovery Policy, Update/CRUD Execution Sequence, Final Output Contract, and Required reason codes exactly as written. When customization_path=customization-audit, use https://raw.githubusercontent.com/pRizz/open-links/main/docs/customization-catalog.md as the checklist source.
```
<!-- OPENCLAW_UPDATE_PROMPT:end -->

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
- `skills/referral-management/SKILL.md`
- `skills/create-new-rich-content-extractor/SKILL.md`
