---
phase: 19-public-referral-enrichment-offer-capture
plan: 01
subsystem: referral-target-resolution
tags: [referral, public-augmentation, redirects, provenance, normalization]
requires: []
provides:
  - reusable referral-target normalization helpers
  - original-url plus source-url support in public strategy contracts
  - final public URL capture in fetch metadata results
  - regression coverage for query-param, path-based, shortener, and known-family targets
affects: [phase-19-target-resolution, public-augmentation, fetch-metadata]
tech-stack:
  added: []
  patterns: [shape-based-referral-targets, bounded-public-redirect-provenance, known-family-rewrite-centralization]
key-files:
  created:
    - scripts/enrichment/referral-targets.ts
    - scripts/enrichment/referral-targets.test.ts
  modified:
    - scripts/enrichment/fetch-metadata.ts
    - scripts/enrichment/fetch-metadata.test.ts
    - scripts/enrichment/public-augmentation.ts
    - scripts/enrichment/public-augmentation.test.ts
    - scripts/enrichment/strategy-types.ts
    - scripts/enrichment/strategy-registry.ts
    - scripts/enrichment/strategy-registry.test.ts
    - scripts/shared/remote-cache-fetch.ts
key-decisions:
  - "Referral target normalization is now shape-based and reusable instead of being implicit inside isolated provider logic."
  - "Known-family canonical rewrites like Club Orange live in the referral-target helper layer, not in user-authored JSON."
  - "The fetch layer now exposes final public URL information so later phases can preserve redirect-backed provenance."
patterns-established:
  - "Use `originalUrl` + `sourceUrl` on public strategy requests when public enrichment rewrites or normalizes the target."
  - "Use one shared helper for analytics-param stripping, referral-param preservation, path-shape recognition, and known-family rewrites."
requirements-completed:
  - ENR-01
duration: not-tracked
completed: 2026-03-30
---

# Phase 19 Plan 01 Summary

**The public enrichment layer now has a reusable referral-target normalization seam with final-url provenance support**

## Performance

- **Duration:** not-tracked
- **Completed:** 2026-03-30
- **Tasks:** 3
- **Files modified:** 8
- **Files created:** 2

## Accomplishments

- Added `scripts/enrichment/referral-targets.ts` and `scripts/enrichment/referral-targets.test.ts` to normalize referral targets by URL shape rather than brittle brand lists.
- Centralized Club Orange referral canonicalization into the shared helper while preserving the existing signup landing behavior.
- Added public-direct strategy support for preserving `originalUrl` while normalizing `sourceUrl`.
- Extended the shared remote-cache fetch path and `fetch-metadata.ts` wrapper so successful public fetches can report the final public URL after redirects.
- Added regression coverage for direct, query-param, path-based, shortener-backed, and known-family referral target resolution.

## Task Commits

1. **Task 1: Add a reusable referral target normalization helper** + **Task 2: Extend fetch and strategy contracts for bounded redirect provenance** + **Task 3: Lock the target-resolution regression surface before term extraction begins** - `b43c5df` (`feat`)

## Files Created/Modified

- `scripts/enrichment/referral-targets.ts` - shared referral target resolver
- `scripts/enrichment/referral-targets.test.ts` - broad target-shape regression coverage
- `scripts/enrichment/fetch-metadata.ts` - final public URL support in fetch results
- `scripts/enrichment/fetch-metadata.test.ts` - final-url fetch regression
- `scripts/enrichment/public-augmentation.ts` - Club Orange strategy now reuses the shared referral-target helper
- `scripts/enrichment/public-augmentation.test.ts` - target adapter alignment for the Club Orange path
- `scripts/enrichment/strategy-types.ts` - `originalUrl` support on public source requests
- `scripts/enrichment/strategy-registry.ts` - default public-direct strategy now preserves original referral URLs while normalizing the fetch target
- `scripts/enrichment/strategy-registry.test.ts` - strategy-layer alignment for normalized direct referral targets
- `scripts/shared/remote-cache-fetch.ts` - redirect/final-url propagation from the shared fetch layer

## Decisions Made

- Kept shortener and redirect handling public-only and bounded through the fetch/target-resolution seam rather than introducing authenticated fallback behavior.
- Applied analytics-param stripping only within the referral-target helper so the policy stays centralized and testable.
- Let the default public-direct strategy reuse the referral-target helper, which means common referral URLs benefit from canonical target cleanup without bespoke strategy additions.

## Deviations from Plan

- **[Rule 3 - Blocking] Coupled wave-1 seams**: the referral-target helper, fetch final-url support, and strategy/public-augmentation alignment all needed to land together to keep the test surface coherent, so the three tasks shipped in one feature commit instead of multiple smaller commits.

## Issues Encountered

- The first referral-param stripping implementation mutated `searchParams` while iterating and skipped one analytics key; the targeted tests caught it and the helper was corrected to iterate over a stable key list.
- The existing strategy-list test in `scripts/enrichment/strategy-registry.test.ts` needed to be updated to reflect the already-shipped Club Orange public augmentation strategy.

## User Setup Required

None.

## Next Phase Readiness

- Phase 19 now has the target-resolution and final-url provenance seam needed for actual offer/terms extraction.
- Wave 2 can build generated referral output and reporting on top of a stable original-vs-resolved public target model.

## Verification

- `bun test scripts/enrichment/referral-targets.test.ts scripts/enrichment/fetch-metadata.test.ts scripts/enrichment/public-augmentation.test.ts scripts/enrichment/strategy-registry.test.ts`
- `bun run typecheck`
- pre-commit required lanes also passed during `b43c5df`, including deploy tests and build

---
*Phase: 19-public-referral-enrichment-offer-capture*
*Completed: 2026-03-30*
