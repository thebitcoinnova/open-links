---
phase: 22-source-authored-referral-flow-proof
plan: 01
subsystem: source-authored-referral-proof
tags: [referral, manual-authoring, regression, audit-gap]
requires:
  - 21-02
provides:
  - real source-authored referral proof
  - live-data referral merge regression
  - live card-model referral proof
  - milestone audit gap closure evidence
affects: [phase-22-proof, referral-merge, milestone-audit]
tech-stack:
  added: []
  patterns: [real-data-regression, manual-over-generated-referral-merge, live-dataset-card-proof]
key-files:
  created:
    - src/lib/content/load-content.referral.test.ts
    - .planning/phases/22-source-authored-referral-flow-proof/22-01-SUMMARY.md
  modified:
    - src/lib/ui/rich-card-description-sourcing.test.ts
key-decisions:
  - "Keep Phase 22 narrow and audit-driven: prove the manual-first flow on the existing live Club Orange referral link instead of expanding referral extraction scope."
  - "Use live JSON artifacts in tests instead of importing `loadContent()` so the proof stays compatible with Bun's test runtime and avoids Vite-only `import.meta.glob` behavior."
  - "Treat the already-present source-authored `cluborange-referral.referral` object as the canonical real-data proof and focus the diff on durable regression coverage plus audit closeout."
patterns-established:
  - "Real-data content regressions can read generated manifests directly and exercise merge helpers without depending on the Vite loader seam."
requirements-completed:
  - MAINT-01
  - MAINT-02
duration: not-tracked
completed: 2026-03-30
---

# Phase 22 Plan 01 Summary

**The repo now has a durable real-data proof for the manual-first referral flow**

## Performance

- **Duration:** not-tracked
- **Completed:** 2026-03-30
- **Tasks:** 3
- **Files modified:** 2
- **Files created:** 1

## Accomplishments

- Added a focused real-data regression in `src/lib/content/load-content.referral.test.ts` that reads the live `data/links.json` and `data/generated/rich-metadata.json` artifacts, then proves `cluborange-referral` keeps manual `kind`, `ownerBenefit`, and `termsUrl` while generated `offerSummary`, `termsSummary`, and provenance/completeness fields fill blanks.
- Extended `src/lib/ui/rich-card-description-sourcing.test.ts` so the UI proof uses the same merged live dataset link and confirms the rendered card still surfaces the generated offer summary, the manual owner-benefit row, and the manual `Terms` link together.
- Re-ran the live verification flow (`bun test`, `typecheck`, `validate:data`, `enrich:rich:strict`, and `build`) to confirm the manual-first Club Orange path is exercised end to end on real project data.

## Task Commits

1. **Task 1: Verify the live Club Orange source-authored referral object remains the canonical proof case** + **Task 2: Re-run the live enrichment/build flow** + **Task 3: Add focused real-data merge/render regressions** - not yet committed

## Files Created/Modified

- `src/lib/content/load-content.referral.test.ts` - live artifact merge proof for the source-authored Club Orange referral object
- `src/lib/ui/rich-card-description-sourcing.test.ts` - live card-model proof that merged manual/generated referral data reaches the rich-card view model

## Decisions Made

- Kept Phase 22 tightly scoped to the audit gap instead of folding in future automatic owner/visitor benefit extraction work.
- Avoided a brittle `loadContent()` runtime test because Bun tests do not support the loader's `import.meta.glob` seam; the live JSON artifacts provide the same proof more reliably.
- Preserved the minimal manual source shape (`kind`, `ownerBenefit`, `termsUrl`) and left the generated promo copy/terms extraction as additive blank-fill behavior.

## Deviations from Plan

- **No new source-data mutation was required in this diff**: after syncing with `origin/main`, the live `cluborange-referral` entry in `data/links.json` already contained the approved manual referral object. Phase 22 therefore focused on durable regression coverage, verification, and audit closeout rather than reapplying the same data edit.

## Issues Encountered

- A first test attempt imported `loadContent()` directly and failed under Bun because `src/lib/content/load-content.ts` depends on Vite-only `import.meta.glob`.
- The fix was to convert the regression to a real-data helper pattern that reads `data/links.json` and `data/generated/rich-metadata.json` directly, then exercises `mergeReferralWithManualOverrides()` and the rich-card view-model seam.

## User Setup Required

None.

## Next Phase Readiness

- The milestone's missing manual-first proof is now exercised on a real live link instead of only through fixture coverage.
- The repo is ready for the refreshed milestone audit result and for planning the Phase 23 automatic benefit-extraction follow-on.

## Verification

- `bun test src/lib/content/load-content.referral.test.ts src/lib/ui/rich-card-description-sourcing.test.ts`
- `bun run typecheck`
- `bun run validate:data`
- `bun run enrich:rich:strict`
- `bun run build`

---
*Phase: 22-source-authored-referral-flow-proof*
*Completed: 2026-03-30*
