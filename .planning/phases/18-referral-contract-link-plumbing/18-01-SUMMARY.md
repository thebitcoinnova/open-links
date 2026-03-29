---
phase: 18-referral-contract-link-plumbing
plan: 01
subsystem: referral-contract
tags: [referral, schema, runtime-types, contract, validation]
requires: []
provides:
  - additive `links[].referral` schema support for simple and rich links
  - runtime referral typing on `OpenLink`
  - shared referral field helpers for later merge and validation work
  - focused additive-contract regression coverage for soft markers and one-sided benefits
affects: [phase-18-contract, links-schema, runtime-content-model]
tech-stack:
  added: []
  patterns: [additive-link-contract, field-helper-centralization, soft-marker-referral-support]
key-files:
  created:
    - src/lib/content/referral-fields.ts
    - src/lib/content/referral-fields.test.ts
  modified:
    - schema/links.schema.json
    - src/lib/content/load-content.ts
key-decisions:
  - "Referral data now lives on the top-level link object as `links[].referral` instead of a new link type or rich-only metadata nesting."
  - "The shared helper module trims blank strings, preserves soft markers, and keeps manual-over-generated merge semantics ready for later plans."
patterns-established:
  - "Use top-level additive link objects when a feature must span both simple and rich links."
  - "Keep contract field lists and merge semantics in a dedicated helper module before extending generated or validation flows."
requirements-completed:
  - REF-01
duration: not-tracked
completed: 2026-03-29
---

# Phase 18 Plan 01 Summary

**The referral contract now exists as an additive top-level link surface with shared helper logic and focused regression coverage**

## Performance

- **Duration:** not-tracked
- **Completed:** 2026-03-29
- **Tasks:** 3
- **Files modified:** 4
- **Files created:** 2

## Accomplishments

- Added a first-class `links[].referral` schema object with the approved neutral fields: `kind`, `visitorBenefit`, `ownerBenefit`, `offerSummary`, `termsSummary`, `termsUrl`, `code`, and `custom`.
- Extended the runtime `OpenLink` model so referral data is available for both `simple` and `rich` links without creating a new `link.type`.
- Created `src/lib/content/referral-fields.ts` as the shared seam for referral kinds, meaningful-field detection, normalization, and manual-over-generated merge behavior.
- Added `src/lib/content/referral-fields.test.ts` coverage for soft markers, kind-only non-disclosure, one-sided benefits, blank-string normalization, and manual override behavior.

## Task Commits

1. **Task 1: Extend the manual link schema and runtime types for `links[].referral`** - `65264f3` (`feat`)
2. **Task 2: Create shared referral field and merge helpers** - `64a0c8b` (`feat`)
3. **Task 3: Prove the contract is additive and soft-marker-safe** - `5aba470` (`test`)

## Files Created/Modified

- `schema/links.schema.json` - additive referral contract on link entries
- `src/lib/content/load-content.ts` - runtime `OpenLink.referral` support and type re-export
- `src/lib/content/referral-fields.ts` - canonical referral field helpers
- `src/lib/content/referral-fields.test.ts` - additive-contract regression tests

## Decisions Made

- Kept referral support on the top-level link object so the feature can apply equally to `simple` and `rich` links.
- Did not add `disclosureLabel`; later UI work will derive labels from `kind` and populated referral fields unless proven insufficient.
- Preserved soft-marker behavior by keeping `referral: {}` valid while leaving disclosure completeness enforcement to warning-level validation in later plans.

## Deviations from Plan

None. The plan stayed within the intended contract-only scope and did not leak into generated augmentation or warning policy work.

## Issues Encountered

- Biome rejected an initial `delete`-based normalization approach in `referral-fields.ts`; the helper was rewritten to build normalized objects explicitly instead of mutating and deleting keys.
- Repo-wide build/validation flows continued to emit the existing non-blocking warnings about stale LinkedIn authenticated cache, Rumble partial metadata, and fallback social preview imagery.

## User Setup Required

None.

## Next Phase Readiness

- Phase 18 now has a stable manual referral contract and helper seam for Wave 2’s generated augmentation work.
- The next plan can extend the existing generated metadata manifest and runtime merge path without reopening the manual schema design.

## Verification

- `bun run typecheck`
- `bun run validate:data`
- `bun test src/lib/content/referral-fields.test.ts`
- `bun run build`

---
*Phase: 18-referral-contract-link-plumbing*
*Completed: 2026-03-29*
