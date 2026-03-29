---
phase: 18-referral-contract-link-plumbing
plan: 02
subsystem: generated-referral-augmentation
tags: [referral, generated-metadata, provenance, runtime-merge, enrichment]
requires:
  - phase: 18-referral-contract-link-plumbing
    plan: 01
    provides: additive manual referral contract and shared helper seam
provides:
  - optional generated `referral` entries beside generated `metadata`
  - runtime field-by-field referral merge with manual precedence
  - per-field referral provenance on merged runtime links
  - backward-compatible generated-metadata regression coverage
affects: [phase-18-generated-augmentation, load-content, generated-manifest]
tech-stack:
  added: []
  patterns: [single-generated-manifest, field-level-referral-provenance, blank-fill-only-generated-merge]
key-files:
  created: []
  modified:
    - scripts/enrichment/types.ts
    - scripts/enrichment/generated-metadata.ts
    - scripts/enrichment/generated-metadata.test.ts
    - src/lib/content/load-content.ts
    - src/lib/content/referral-fields.ts
    - src/lib/content/referral-fields.test.ts
key-decisions:
  - "Generated referral data now lives beside generated rich metadata in the existing per-link manifest instead of a second generated file."
  - "Merged runtime referral data carries per-field provenance so later validation and UI layers can explain where values came from."
patterns-established:
  - "Reuse the existing generated metadata manifest when a new per-link augmentation surface is needed."
  - "Carry provenance through shared field helpers instead of recomputing it independently in runtime and validation code."
requirements-completed:
  - REF-02
duration: not-tracked
completed: 2026-03-29
---

# Phase 18 Plan 02 Summary

**The existing generated metadata manifest now supports referral augmentation with per-field provenance, and runtime loading merges it safely with manual referral data**

## Performance

- **Duration:** not-tracked
- **Completed:** 2026-03-29
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Extended `scripts/enrichment/types.ts` and `scripts/enrichment/generated-metadata.ts` so each generated per-link entry can optionally include `referral` beside `metadata`.
- Kept metadata-only manifests backward compatible while normalizing optional referral data and provenance.
- Updated `src/lib/content/load-content.ts` so runtime links merge generated referral data field-by-field with manual values still taking precedence and generated values filling blanks only.
- Extended `src/lib/content/referral-fields.ts` and `src/lib/content/referral-fields.test.ts` so merged referral data now carries per-field provenance (`manual` vs `generated`).
- Added `scripts/enrichment/generated-metadata.test.ts` coverage for referral-entry stabilization and continued metadata-only equality behavior.

## Task Commits

1. **Task 1: Extend the generated per-link augmentation shape for referral data** + **Task 2: Merge manual and generated referral fields with blank-fill-only behavior** + **Task 3: Prove backward compatibility and manual precedence** - `b8eebba` (`feat`)

## Files Created/Modified

- `scripts/enrichment/types.ts` - generated referral augmentation typing
- `scripts/enrichment/generated-metadata.ts` - optional referral normalization and stabilization in the existing manifest
- `scripts/enrichment/generated-metadata.test.ts` - metadata-only compatibility plus referral-entry regression coverage
- `src/lib/content/load-content.ts` - merged runtime referral loading
- `src/lib/content/referral-fields.ts` - provenance-aware referral merge semantics
- `src/lib/content/referral-fields.test.ts` - provenance-aware referral merge assertions

## Decisions Made

- Kept the existing `data/generated/rich-metadata.json` path and entry shape, adding `referral` as an optional sibling instead of introducing a new generated file.
- Let runtime `OpenLink.referral` carry merged provenance information so later validation/UI steps can inspect origins without reparsing raw manifests.
- Preserved the approved policy that manual referral values always win field-by-field and generated values only fill blanks.

## Deviations from Plan

- **[Rule 3 - Blocking] Required-lane parity guard**: the repo’s pre-commit required-lane checks refused a partial generated-metadata-only commit while tracked runtime helper files were still unstaged, so Tasks 1-3 landed together in one feature commit instead of three smaller commits.

## Issues Encountered

- The first implementation dropped `referral` during generated-metadata stabilization when only `metadata.enrichedAt` changed; an additional regression test exposed the bug and the stabilization path was fixed before the final commit.
- Repo-wide build/quality flows continued to emit the existing non-blocking warnings about stale LinkedIn authenticated cache, Rumble partial metadata, and fallback social preview imagery.

## User Setup Required

None.

## Next Phase Readiness

- Phase 18 now has a stable generated referral augmentation path and runtime merge behavior, so Phase 18 Plan 03 can focus on warnings, conflicts, and examples instead of reopening manifest shape questions.
- Phase 19 can later plug extracted referral data into the established `{ metadata, referral }` manifest shape.

## Verification

- `bun test scripts/enrichment/generated-metadata.test.ts`
- `bun test src/lib/content/referral-fields.test.ts`
- `bun run typecheck`
- `bun run build`

---
*Phase: 18-referral-contract-link-plumbing*
*Completed: 2026-03-29*
