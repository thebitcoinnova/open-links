# AGENTS: Rich Enrichment Failure Triage and Extractor Escalation

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

## References

- [`README.md`](README.md)
- [`docs/quickstart.md`](docs/quickstart.md)
- [`docs/rich-enrichment-blockers-registry.md`](docs/rich-enrichment-blockers-registry.md)
- [`docs/rich-metadata-fetch-blockers.md`](docs/rich-metadata-fetch-blockers.md)
- [`docs/authenticated-rich-extractors.md`](docs/authenticated-rich-extractors.md)
- [`docs/create-new-rich-content-extractor.md`](docs/create-new-rich-content-extractor.md)
- [`docs/openclaw-update-crud.md`](docs/openclaw-update-crud.md)
- [`docs/ai-guided-customization.md`](docs/ai-guided-customization.md)
- [`docs/studio-self-serve.md`](docs/studio-self-serve.md)
- [`docs/studio-phase-checklist.md`](docs/studio-phase-checklist.md)
