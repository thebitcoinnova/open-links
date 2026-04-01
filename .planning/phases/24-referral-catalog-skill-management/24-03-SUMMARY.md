---
phase: 24-referral-catalog-skill-management
plan: 03
subsystem: enrichment
tags: [referral, catalog, enrichment, generated-output, downstream]
requires:
  - phase: 24-referral-catalog-skill-management
    provides: "Shared referral catalog contract, runtime matcher resolution, and catalog/manual/generated referral precedence"
provides:
  - "Catalog-aware referral target resolution for enrichment scripts"
  - "Club Orange migration onto explicit catalog-backed enrichment output"
  - "Generated referral metadata/report provenance for catalog, generated, and manual fields"
affects: [open-links-sites, referral-management-skill, rich-enrichment-reporting]
tech-stack:
  added: []
  patterns:
    - "Enrichment target resolution consults catalog refs and matcher metadata before family-specific canonicalization"
    - "Catalog-backed generated referral output records field provenance while respecting manual overrides"
key-files:
  created:
    - .planning/phases/24-referral-catalog-skill-management/24-03-SUMMARY.md
  modified:
    - scripts/enrichment/referral-targets.ts
    - scripts/enrichment/public-augmentation.ts
    - scripts/enrichment/generated-metadata.ts
    - scripts/enrichment/report.ts
    - data/links.json
key-decisions:
  - "Use the shared catalog matcher layer to identify and explain referral targets, then keep the remaining Club Orange URL canonicalization as a narrow family-specific normalization step."
  - "Emit catalog contribution details and field-level provenance in generated referral payloads so maintainers can inspect which fields came from explicit refs, catalog defaults, public extraction, or manual overrides."
  - "Keep the real Club Orange link on an explicit catalogRef with manual termsUrl/ownerBenefit preserved, so open-links-sites-compatible runtime behavior stays on the existing links[].referral contract."
patterns-established:
  - "Referral enrichment target resolution exposes a catalog explanation object instead of only a low-level known-family marker."
  - "Catalog-backed generated referral payloads may be refreshed locally in ignored data/generated JSON files while tracked code/data changes stay upstream-safe."
requirements-completed: []
duration: 2h 10m
completed: 2026-03-31
---

# Phase 24 Plan 03 Summary

**Catalog-backed referral matching now drives enrichment and reporting, with Club Orange migrated onto an explicit catalog ref while preserving manual override precedence**

## Accomplishments

- Routed `scripts`-side referral target resolution through the shared catalog matcher layer, including explicit-ref precedence, explainable matcher metadata, and no-guess fallback behavior.
- Migrated the real `cluborange-referral` link in [data/links.json](/Users/peterryszkiewicz/.codex/worktrees/a075/open-links/data/links.json) onto an explicit `catalogRef` while keeping the manual `ownerBenefit` and `termsUrl` authoritative.
- Extended generated referral metadata/report normalization so catalog contribution and field provenance survive round-trips in [scripts/enrichment/generated-metadata.ts](/Users/peterryszkiewicz/.codex/worktrees/a075/open-links/scripts/enrichment/generated-metadata.ts) and [scripts/enrichment/report.ts](/Users/peterryszkiewicz/.codex/worktrees/a075/open-links/scripts/enrichment/report.ts).
- Refreshed the real Club Orange enrichment artifacts locally via `bun run enrich:rich:strict` and `bun run build`; the refreshed JSON lives at ignored paths under `data/generated/`, so it was verified but not committed.

## Task Commits

1. **Task 1: Route enrichment through the shared catalog matcher layer** - `6dc4714`
2. **Task 2: Migrate Club Orange and refresh generated report/artifact proof** - `1dca5d3`

Plan metadata is recorded in the commit that adds this summary.

## Decisions Made

- Preserved current Club Orange output quality by letting catalog data seed generated referral fields while stronger public page copy still wins for `offerSummary`, `termsSummary`, and `visitorBenefit`.
- Reflected manual precedence in catalog-backed generated referral output so the generated/report surfaces show the same authoritative `termsUrl`/`ownerBenefit` values the runtime will honor.
- Kept downstream compatibility explicit for `open-links-sites`: `links[].referral` remains the runtime/render contract, catalog data remains additive, and the local generated JSON refresh stays out of tracked upstream diffs because `data/generated/*.json` is ignored.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `bun test scripts/enrichment/referral-targets.test.ts scripts/enrichment/public-augmentation.test.ts`
- `bun test scripts/enrichment/generated-metadata.test.ts scripts/enrichment/report.test.ts`
- `bun run enrich:rich:strict`
- `bun run validate:data`
- `bun run test:deploy`
- `bun run build`
- `bun run biome:check`
- `bun run studio:lint`
- `bun run typecheck`
- `bun run studio:typecheck`
- `bun run --filter @openlinks/studio-api test`
- `bun run studio:test:integration`

## Issues Encountered

- Startup sync on a detached worktree moved the workspace off the locally completed 24-01/24-02 commits. I restored those waves onto `codex/phase-24-plan-03` by replaying the existing local commits before implementing Plan 03.
- The repo pre-commit hook requires no unstaged CI-relevant tracked files. I split the two task commits by staging task-specific files and temporarily stashing the second task’s tracked changes.

## User Setup Required

None.

## Next Phase Readiness

- Phase 24-04 can now document a real explicit-catalog maintainer flow instead of only a theoretical data model, because Club Orange is exercising the shared catalog in runtime, enrichment, and reporting.
- `open-links-sites` remains downstream-safe after this wave: the tracked contract changes stay additive, manual precedence is still explicit, and the refreshed local `data/generated/` proof was verified without introducing new tracked shared-output files.

---
*Phase: 24-referral-catalog-skill-management*
*Completed: 2026-03-31*
