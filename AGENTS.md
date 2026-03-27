<!-- coding-and-architecture-requirements:begin -->
<!-- source-repository: https://github.com/bright-builds-llc/coding-and-architecture-requirements -->
<!-- version-pin: main -->
<!-- canonical-entrypoint: https://github.com/bright-builds-llc/coding-and-architecture-requirements/blob/main/standards/index.md -->
<!-- audit-manifest: coding-and-architecture-requirements.audit.md -->
<!-- coding-and-architecture-requirements:end -->

# AGENTS: OpenLinks Local Adoption Layer

This repository adopts the Bright Builds coding and architecture requirements.
This file is the local OpenLinks supplement and operational policy layer.

Read this file first, then the pinned canonical standards entrypoint, then any
relevant canonical standards pages, and finally apply `standards-overrides.md`
for deliberate local deviations.

## Repo-Local Guidance

The managed Bright Builds baseline now lives in `AGENTS.bright-builds.md`.
Everything below this heading is OpenLinks-specific local guidance that takes
precedence when it is more specific.

## Canonical Standards Source

- Standards repository: `https://github.com/bright-builds-llc/coding-and-architecture-requirements`
- Version pin: `main`
- Canonical entrypoint: `https://github.com/bright-builds-llc/coding-and-architecture-requirements/blob/main/standards/index.md`
- Local overrides: `standards-overrides.md`
- Audit manifest: `coding-and-architecture-requirements.audit.md`

## Local Precedence

- This file wins when it is more specific than the canonical standards.
- `standards-overrides.md` records explicit local deviations from the canonical standards.
- OpenLinks-specific operational rules for rich enrichment, Studio delivery tracking, and task hygiene remain mandatory for this repo.

## Downstream Consumer Awareness

`open-links` is also an active upstream dependency for
[`open-links-sites`](https://github.com/pRizz/open-links-sites), which uses this
repo as the canonical renderer and shared contract source for multi-site output.

Current downstream usage to keep in mind:

- `open-links-sites` is a control repo for many individual OpenLinks sites.
- It pins this repo's upstream revision in `config/upstream-open-links.json`.
- Its automation clones this repo during scheduled sync and deploy flows.
- It reuses this repo's schemas, support files, enrichment/validation scripts,
  and canonical person-page renderer.

Compatibility-sensitive surfaces include:

- `schema/` and the `data/profile.json`, `data/links.json`, and `data/site.json`
  contract shape
- `data/policy/`, authenticated-cache support files, and
  `public/history/followers`
- upstream script entrypoints and assumptions used by downstream import/build
  flows
- build/render output conventions that downstream smoke checks and site
  assembly rely on

When changes here touch those surfaces, explicitly consider downstream impact
and mention that impact in the final summary, even when no downstream changes
are required.

## Local Scope

This file defines mandatory agent behavior for rich-enrichment failures in this repository.

Scope:

- `bun run build`, `bun run dev`, `bun run enrich:rich*`, and `bun run validate:data*` failures tied to rich metadata policies.
- Known blocked domains, missing authenticated cache, and newly discovered social-domain blockers.

This is orchestration guidance for agents. It does not replace runtime policy sources of truth.

## Non-Negotiables

1. Run diagnostics first using:
   - `bun run enrich:rich:strict`
   - `bun run validate:data`
2. Ask the user to choose a path before mutating policy or link configuration for blocking enrichment failures.
3. Do not silently set `links[].enrichment.allowKnownBlocker=true`.
4. Do not silently use `OPENLINKS_RICH_ENRICHMENT_BYPASS=1`.
5. Use bypass only when the user explicitly asks for an emergency temporary override.

## Payment Card Branding Rule

For branded payment/tip cards, verify card-shell icon resolution and QR badge resolution separately.

- `links[].icon` and `payment.rails[].icon` flow through the shared known-site icon registry and control the card-shell icon.
- `payment.rails[].qr.badge.mode: "auto"` reuses that shared icon identity for QR badge composition when the platform and rail both resolve.
- `badge.items.asset` only changes the QR center badge. It does not change the card-shell icon.
- If a new payment platform should render like an existing first-class brand such as Club Orange, add it to the shared known-site icon pipeline rather than relying on a QR-only asset.

## Pre-Commit Requirements (Mandatory)

Before creating any commit in this repository:

1. Fix all lint and typecheck issues (no outstanding diagnostics).
2. Run all lint/typecheck commands:
   - `bun run biome:check`
   - `bun run studio:lint`
   - `bun run typecheck`
   - `bun run studio:typecheck`
3. Run all tests:
   - `bun run --filter @openlinks/studio-api test`
   - `bun run studio:test:integration`
4. Do not commit while any command above is failing.

## Failure Trigger Matrix

| Trigger reason | Expected default behavior | First diagnostic commands | Agent first action |
| --- | --- | --- | --- |
| `known_blocker` | Blocking failure | `bun run enrich:rich:strict`, `bun run validate:data` | Present options and ask user to choose path before edits |
| `authenticated_cache_missing` | Blocking failure | `bun run enrich:rich:strict`, `bun run validate:data` | Present options and ask user to choose path before edits |
| `fetch_failed` | May block based on `site.ui.richCards.enrichment.failOn` | `bun run enrich:rich:strict`, `bun run validate:data` | Confirm whether failure is policy-blocking, then present options if configuration changes are needed |
| `metadata_missing` | May block based on `site.ui.richCards.enrichment.failOn` and manual fallback policy | `bun run enrich:rich:strict`, `bun run validate:data` | Confirm whether manual fallback exists, then present options if configuration changes are needed |

## Mandatory User Choice Step

For blocking conditions, the agent must present these options and wait for user selection before policy/config mutation:

1. Disable enrichment for the affected link and/or use manual metadata (`links[].metadata` path).
2. Use authenticated cache setup/refresh path (`bun run setup:rich-auth`, targeted sync/clear flows as needed).
3. Start a new authenticated extractor workflow.

When offering option 3, reference and use:

- [`skills/create-new-rich-content-extractor/SKILL.md`](skills/create-new-rich-content-extractor/SKILL.md)

## Known Blocked Domain Flow

When reason is `known_blocker`:

1. Confirm blocker match using:
   - `data/policy/rich-enrichment-blockers.json`
   - `docs/rich-metadata-fetch-blockers.md`
2. Provide remediation commands from current workflow:
   - disable enrichment/manual metadata route, or
   - authenticated route if extractor exists (`bun run setup:rich-auth` / `bun run auth:rich:sync`).
3. Do not default to `allowKnownBlocker=true`; only apply when user explicitly chooses override behavior.
4. Do not default to bypass env var; only use when user explicitly requests emergency bypass.

## Undocumented Social Domain Failure Flow

When enrichment fails for a social domain that is not in blocker registry:

1. Mark the incident as tentative after first failure.
2. Re-run diagnostics to get a second reproducible failure signal before registry mutation.
3. Require two reproducible runs before adding a blocker entry.
4. If second run does not reproduce, keep tentative status and continue investigation.
5. After reproducible confirmation, update in this exact order:
   - `data/policy/rich-enrichment-blockers.json`
   - `docs/rich-metadata-fetch-blockers.md` with UTC timestamped evidence and attempted remediations
   - `data/links.json` remediation (disable enrichment/manual metadata/explicit override) as chosen by user
6. Re-run:
   - `bun run validate:data`
   - `bun run enrich:rich:strict`

## Extractor Escalation Flow

If user chooses extractor path:

1. Execute workflow from:
   - [`skills/create-new-rich-content-extractor/SKILL.md`](skills/create-new-rich-content-extractor/SKILL.md)
2. Ensure follow-through artifacts are updated and validated:
   - `data/policy/rich-authenticated-extractors.json`
   - `data/cache/rich-authenticated-cache.json`
   - `public/cache/rich-authenticated/*`
   - relevant docs updates (including blocker narrative and extractor docs)
3. Keep security boundaries:
   - never commit credentials, cookies, or raw authenticated HTML dumps
   - keep diagnostics metadata-only for committed artifacts

## Mandatory Update Checklist by Path

Use this checklist before closing blocker/extractor incidents:

1. Registry and policy:
   - `data/policy/rich-enrichment-blockers.json`
   - `data/policy/rich-authenticated-extractors.json` (if extractor path selected)
2. Cache and assets (authenticated path):
   - `data/cache/rich-authenticated-cache.json`
   - `public/cache/rich-authenticated/*`
3. Narrative docs:
   - `docs/rich-metadata-fetch-blockers.md`
   - `docs/authenticated-rich-extractors.md`
   - `docs/create-new-rich-content-extractor.md` when authoring process changes
4. Verification:
   - `bun run validate:data`
   - `bun run enrich:rich:strict`
   - `bun run build` (unless user explicitly scopes out full build)

## Agent Output Contract (Blocker Incidents)

Every blocker incident response must include:

1. Detected reason (for example `known_blocker`, `authenticated_cache_missing`, `fetch_failed`, `metadata_missing`).
2. Affected link id and domain.
3. User-selected path (disable/manual metadata, authenticated cache workflow, or new extractor).
4. Commands run and/or exact commands recommended next.
5. Files updated, or explicit statement that files were intentionally not updated.
6. Next user decision required (if any).

## Studio Delivery Tracking (Required for Studio Work)

When implementing or modifying OpenLinks Studio (`packages/studio-*`), agents must keep tracking artifacts current:

1. Update [`docs/studio-phase-checklist.md`](docs/studio-phase-checklist.md):
   - mark task status changes,
   - add/remove tasks when scope changes,
   - keep priority tags (`P0`-`P3`) accurate.
2. Keep in-app roadmap data synchronized:
   - [`packages/studio-web/src/lib/phase-checklist.ts`](packages/studio-web/src/lib/phase-checklist.ts)
3. If Studio status changes materially, include checklist updates in the same change batch.

## Repo Skill Documentation (Required for `skills/`)

When adding, removing, renaming, or materially repurposing a repo-local skill under `skills/`:

1. Update [`README.md`](README.md) in the same change batch.
2. Keep the `Repo Skills` section accurate:
   - add new skills,
   - remove deleted skills,
   - rename entries when skill paths or names change,
   - refresh descriptions when the skill's purpose changes materially.
3. Keep the README docs/discovery references accurate for shipped skills.
4. Do not leave `skills/` changes undocumented in the README.

## TODO Cleanup (Required for Task Tracking)

When updating the active task tracker file (`tasks/todo.md` or `.codex/tasks/todo.md`):

1. Check the file length after recording the current task update.
2. If the file exceeds 300 lines, prune old completed history in the same change batch.
3. A completed block is the checked task list for finished work plus its associated `### Completion Review` section.
4. Delete completed blocks in-place; do not archive them to another file.
5. Remove the oldest completed blocks first and keep the 3 most recent completed blocks in the main TODO file.
6. Never delete unchecked items, the current active/in-progress section, or `lessons.md`.
7. If the TODO file still exceeds 300 lines after keeping all incomplete work and the 3 most recent completed blocks, leave it as-is rather than deleting active context.

## References

- [`README.md`](README.md)
- [`docs/quickstart.md`](docs/quickstart.md)
- [`docs/rich-enrichment-blockers-registry.md`](docs/rich-enrichment-blockers-registry.md)
- [`docs/rich-metadata-fetch-blockers.md`](docs/rich-metadata-fetch-blockers.md)
- [`docs/authenticated-rich-extractors.md`](docs/authenticated-rich-extractors.md)
- [`docs/create-new-rich-content-extractor.md`](docs/create-new-rich-content-extractor.md)
- [`docs/openclaw-update-crud.md`](docs/openclaw-update-crud.md)
- [`docs/ai-guided-customization.md`](docs/ai-guided-customization.md)
- [`docs/downstream-open-links-sites.md`](docs/downstream-open-links-sites.md)
- [`docs/studio-self-serve.md`](docs/studio-self-serve.md)
- [`docs/studio-phase-checklist.md`](docs/studio-phase-checklist.md)


<!-- coding-and-architecture-requirements-managed:begin -->
# Bright Builds Standards

- Study `AGENTS.bright-builds.md` as part of the repository instructions.
- Maintain and study a `## Repo-Local Guidance` section elsewhere in this file for recurring repo-specific workflow facts, commands, and links.
- Study `standards-overrides.md` for deliberate repo-specific exceptions and override decisions.
- If instructions elsewhere in `AGENTS.md` conflict with `AGENTS.bright-builds.md`, follow the repo-local instructions and treat them as an explicit local exception.
<!-- coding-and-architecture-requirements-managed:end -->
