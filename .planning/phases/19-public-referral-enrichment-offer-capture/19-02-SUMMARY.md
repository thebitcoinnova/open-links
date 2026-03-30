---
phase: 19-public-referral-enrichment-offer-capture
plan: 02
subsystem: referral-offer-extraction
tags: [referral, extraction, completeness, provenance, reporting]
requires:
  - phase: 19-public-referral-enrichment-offer-capture
    plan: 01
    provides: reusable target normalization and final-url provenance
provides:
  - generated referral completeness/provenance fields
  - conservative `offerSummary` / `termsSummary` extraction from public targets
  - referral payloads written into generated metadata entries
  - enrichment report support for referral completeness and provenance
affects: [phase-19-generated-referral-output, enrich-rich-links, reports]
tech-stack:
  added: []
  patterns: [offer-vs-terms-split, omission-over-inference, structured-referral-provenance]
key-files:
  created:
    - scripts/enrichment/report.test.ts
  modified:
    - src/lib/content/referral-fields.ts
    - src/lib/content/referral-fields.test.ts
    - scripts/enrichment/strategy-types.ts
    - scripts/enrichment/types.ts
    - scripts/enrichment/public-augmentation.ts
    - scripts/enrichment/public-augmentation.test.ts
    - scripts/enrichment/report.ts
    - scripts/enrich-rich-links.ts
key-decisions:
  - "Generated referral output now carries structured provenance and a `full` / `partial` / `none` completeness status instead of any confidence score."
  - "`offerSummary` may use public promo headline copy, but `termsSummary` is restricted to clearly stated conditions."
  - "Referral extraction now prefers omission over inference for ambiguous direct pages."
patterns-established:
  - "Carry referral completeness and source URLs directly in generated referral output so later validation and UI work can explain what was found."
  - "Use the public augmentation layer to derive referral offer/terms payloads from parsed public metadata instead of inventing a second parser path in `enrich-rich-links`."
requirements-completed:
  - ENR-02
  - ENR-03
duration: not-tracked
completed: 2026-03-30
---

# Phase 19 Plan 02 Summary

**Public referral extraction now emits generated offer/terms data with explicit provenance and completeness**

## Performance

- **Duration:** not-tracked
- **Completed:** 2026-03-30
- **Tasks:** 3
- **Files modified:** 8
- **Files created:** 1

## Accomplishments

- Extended `src/lib/content/referral-fields.ts` so generated/runtime referral data can carry `completeness`, `originalUrl`, `resolvedUrl`, `strategyId`, and `termsSourceUrl`.
- Added `resolvePublicReferralAugmentation(...)` in `scripts/enrichment/public-augmentation.ts`, which:
  - uses public promo headlines for `offerSummary`
  - limits `termsSummary` to clearly stated conditions
  - omits ambiguous terms instead of inferring them
- Updated `scripts/enrich-rich-links.ts` so public enrichment branches can write `{ metadata, referral }` into generated output and attach referral completeness to enrichment report entries.
- Extended `scripts/enrichment/report.ts` and added `scripts/enrichment/report.test.ts` so report entries preserve referral completeness and provenance when written/read.
- Added focused tests for Club Orange referral extraction and ambiguous direct-page omission behavior.

## Task Commits

1. **Task 1: Extend generated referral typing for provenance and completeness** + **Task 2: Extract conservative offer and term data from public referral targets** + **Task 3: Surface referral completeness and provenance in the enrichment report** - `6d6d955` (`feat`)

## Files Created/Modified

- `src/lib/content/referral-fields.ts` - generated referral completeness/provenance fields
- `src/lib/content/referral-fields.test.ts` - completeness/provenance helper coverage
- `scripts/enrichment/strategy-types.ts` - optional referral payloads on normalized public results
- `scripts/enrichment/types.ts` - referral completeness on enrichment run entries
- `scripts/enrichment/public-augmentation.ts` - conservative referral offer/terms extraction helper
- `scripts/enrichment/public-augmentation.test.ts` - referral extraction behavior tests
- `scripts/enrichment/report.ts` - referral fields preserved in report read/write
- `scripts/enrichment/report.test.ts` - referral report regression coverage
- `scripts/enrich-rich-links.ts` - generated referral output + report-entry wiring

## Decisions Made

- Kept `termsSummary` conservative and condition-oriented while allowing `offerSummary` to use clearly public promo headline copy.
- Chose `full` / `partial` / `none` completeness instead of confidence scores.
- Let generated referral output carry the original saved URL plus resolved extraction target so normalization remains debuggable later.

## Deviations from Plan

- **[Rule 3 - Blocking] Coupled extraction/output/report surfaces**: because completeness, referral extraction, and report serialization all depended on the same generated referral shape, they landed together in one feature commit instead of smaller per-task commits.

## Issues Encountered

- The first extraction heuristic was too permissive for ambiguous direct pages; the tests forced a tightening so omission wins unless the copy looks explicitly promo-oriented.
- Several early `generatedReferral` insertions landed in the wrong branches inside `enrich-rich-links.ts`; `typecheck` caught the placement mistakes before the final commit.

## User Setup Required

None.

## Next Phase Readiness

- Phase 19 now has real generated referral output and report coverage, so Wave 3 can focus on generalized Club Orange behavior and regression hardening instead of output shape debates.
- Later UI and validation work can now read explicit referral completeness/provenance without inventing their own interpretation layer.

## Verification

- `bun test src/lib/content/referral-fields.test.ts scripts/enrichment/public-augmentation.test.ts scripts/enrichment/generated-metadata.test.ts scripts/enrichment/report.test.ts`
- `bun run typecheck`
- `bun run enrich:rich:strict`
- pre-commit required lanes also passed during `6d6d955`, including deploy tests and build

---
*Phase: 19-public-referral-enrichment-offer-capture*
*Completed: 2026-03-30*
