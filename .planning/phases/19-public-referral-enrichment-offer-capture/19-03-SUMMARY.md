---
phase: 19-public-referral-enrichment-offer-capture
plan: 03
subsystem: referral-regression-and-report-hardening
tags: [referral, regressions, cluborange, reporting, guardrails]
requires:
  - phase: 19-public-referral-enrichment-offer-capture
    plan: 01
    provides: shared referral-target normalization
  - phase: 19-public-referral-enrichment-offer-capture
    plan: 02
    provides: generated referral extraction output and report fields
provides:
  - explicit `partial` and `none` referral regression coverage
  - auth-gated referral extraction guardrails
  - final report/test coverage for referral completeness/provenance
affects: [phase-19-regressions, cluborange, referral-reporting]
tech-stack:
  added: []
  patterns: [explicit-public-only-guardrails, partial-vs-none-referral-reporting, seeded-known-family-regression]
key-files:
  created: []
  modified:
    - scripts/enrichment/public-augmentation.ts
    - scripts/enrichment/public-augmentation.test.ts
    - scripts/enrichment/report.test.ts
key-decisions:
  - "Auth-gated resolved URLs now stop public referral extraction instead of producing misleading generated referral data."
  - "The regression surface now makes `full`, `partial`, and `none` outcomes explicit instead of leaving the limits implicit."
  - "Club Orange remains the seeded known-family regression case, but it now sits inside a broader shape-based referral extraction surface."
patterns-established:
  - "Use focused regression fixtures to prove omission-over-inference and public-only bounds."
  - "Keep report tests aligned with parser tests so completeness/provenance semantics do not drift."
requirements-completed:
  - ENR-01
  - ENR-02
  - ENR-03
duration: not-tracked
completed: 2026-03-30
---

# Phase 19 Plan 03 Summary

**The public referral extraction surface is now regression-hardened around Club Orange, broad URL shapes, and explicit `full` / `partial` / `none` reporting**

## Performance

- **Duration:** not-tracked
- **Completed:** 2026-03-30
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added regression coverage for `partial` referral extraction when only public promo headline copy is clear.
- Added regression coverage for `none` referral outcomes when direct pages are ambiguous and omission should beat inference.
- Added an explicit auth-gated guard in `resolvePublicReferralAugmentation(...)` so public referral extraction does not quietly produce data from login walls or gated redirect destinations.
- Extended `scripts/enrichment/report.test.ts` so the report layer explicitly preserves `none` completeness and generated referral provenance.
- Kept Club Orange as the seeded full referral extraction example while broadening the surrounding regression surface.

## Task Commits

1. **Task 1: Generalize the existing Club Orange referral flow into the new referral-target system** + **Task 2: Add broad-shape regression coverage for public referral extraction limits** + **Task 3: Make referral extraction limits explicit in the report test surface** - `7c21145` (`test`)

## Files Created/Modified

- `scripts/enrichment/public-augmentation.ts` - auth-gated public referral guard
- `scripts/enrichment/public-augmentation.test.ts` - `full`, `partial`, and auth-gated `none` referral extraction regression cases
- `scripts/enrichment/report.test.ts` - explicit `none` completeness report coverage

## Decisions Made

- Public referral extraction now stops when the resolved target is auth-gated, even if the original link looked referral-like.
- `partial` and `none` are both first-class report/test outcomes, not just incidental parser states.
- The final regression surface deliberately emphasizes limits and omissions so later UI/docs work does not overstate certainty.

## Deviations from Plan

- The broad-shape and report-hardening tasks were coupled enough that they landed together in one regression-focused commit instead of separate code and test commits.

## Issues Encountered

- The initial `offerSummary` heuristic was too permissive for ambiguous direct pages; the tests forced a tighter rule so only obviously promo-oriented copy is extracted.

## User Setup Required

None.

## Next Phase Readiness

- Phase 19 now has the target normalization, generated referral output, and regression/report surface needed to close the phase cleanly.
- Phase 20 can focus on rendering and interaction, not on redefining what a public referral extraction result means.

## Verification

- `bun test scripts/enrichment/public-augmentation.test.ts scripts/enrichment/report.test.ts scripts/enrichment/referral-targets.test.ts scripts/enrichment/strategy-registry.test.ts src/lib/content/referral-fields.test.ts`
- `bun run typecheck`
- `bun run build`

---
*Phase: 19-public-referral-enrichment-offer-capture*
*Completed: 2026-03-30*
