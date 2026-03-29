---
phase: 18-referral-contract-link-plumbing
plan: 03
subsystem: referral-validation-and-examples
tags: [referral, validation, examples, warnings, conflict-detection]
requires:
  - phase: 18-referral-contract-link-plumbing
    plan: 01
    provides: additive manual referral contract
  - phase: 18-referral-contract-link-plumbing
    plan: 02
    provides: generated referral augmentation and runtime merge/provenance
provides:
  - referral-specific warning rules for disclosure-light entries
  - manual/generated referral drift warnings in validate-data
  - example referral data for soft markers and supported-family non_profile usage
affects: [phase-18-validation, examples, validate-data]
tech-stack:
  added: []
  patterns: [warning-not-error-referral-policy, supported-family-non-profile-nudge, example-driven-contract-proof]
key-files:
  created: []
  modified:
    - scripts/validation/rules.ts
    - scripts/validation/rules.test.ts
    - scripts/validate-data.ts
    - data/examples/minimal/links.json
    - data/examples/grouped/links.json
key-decisions:
  - "Soft referral markers and one-sided disclosures stay valid, but disclosure-light referral entries now warn."
  - "Supported profile-family referral links now get an explicit nudge toward `enrichment.profileSemantics='non_profile'`."
  - "Manual/generated referral mismatches stay warning-level and do not override the manual source of truth."
patterns-established:
  - "Use warning-level policy rules rather than schema hard-fails when maintainers need flexibility plus guidance."
  - "Seed example datasets with additive contract shapes once the core schema and merge path are in place."
requirements-completed:
  - REF-02
  - REF-03
duration: not-tracked
completed: 2026-03-29
---

# Phase 18 Plan 03 Summary

**Referral validation now nudges maintainers toward transparent, non-profile-safe authoring, and the example datasets demonstrate both soft markers and fuller referral shapes**

## Performance

- **Duration:** not-tracked
- **Completed:** 2026-03-29
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Added warning-level referral disclosure checks in `scripts/validation/rules.ts` for empty or `kind`-only referral objects.
- Added a warning for supported profile-family referral links that do not explicitly set `enrichment.profileSemantics="non_profile"`.
- Extended `scripts/validate-data.ts` so the full validation pass can warn when manual referral fields drift from generated referral augmentation data.
- Added targeted regression coverage in `scripts/validation/rules.test.ts` for disclosure-light warnings, one-sided referral acceptance, and the supported-family non_profile nudge.
- Updated `data/examples/minimal/links.json` and `data/examples/grouped/links.json` with additive referral examples, including a supported-family Club Orange referral that opts into `non_profile`.

## Task Commits

1. **Task 1: Add referral-specific validation warnings for disclosure-light entries** + **Task 2: Surface manual/generated referral conflicts in the full validation pass** + **Task 3: Seed example data and regression coverage for the additive referral contract** - `35ecaa3` (`feat`)

## Files Created/Modified

- `scripts/validation/rules.ts` - referral-specific warning policy
- `scripts/validation/rules.test.ts` - targeted referral warning and non_profile tests
- `scripts/validate-data.ts` - manual/generated referral drift warnings
- `data/examples/minimal/links.json` - soft referral marker example
- `data/examples/grouped/links.json` - fuller referral example including supported-family `non_profile`

## Decisions Made

- Kept referral disclosure guidance at warning level so maintainers can still save placeholder or partial referral entries.
- Treated one-sided referral benefits as valid and explicit rather than requiring both sides of the deal.
- Chose example-driven proof for the additive contract instead of expanding README/docs early; maintainer-facing docs remain Phase 21 work.

## Deviations from Plan

- **[Rule 3 - Blocking] Tight coupling across warnings, conflicts, and examples**: because the referral warning rules, drift checks, and example data all relied on the same finalized contract semantics, they landed together in one feature commit instead of smaller per-task commits.

## Issues Encountered

- Biome rejected initial string-concatenation warning messages in `rules.ts`; the messages were rewritten as template literals before the final commit.
- Repo-wide validation/build flows continued to emit the existing non-blocking warnings about stale LinkedIn authenticated cache, Rumble partial metadata, and fallback social preview imagery.

## User Setup Required

None.

## Next Phase Readiness

- Phase 18 now has the contract, generated merge path, warnings, and examples needed to close the phase.
- Phase 19 can focus on actual public referral extraction behavior rather than reopening policy or schema questions.

## Verification

- `bun test scripts/validation/rules.test.ts scripts/enrichment/generated-metadata.test.ts src/lib/content/referral-fields.test.ts`
- `bun run validate:data`
- `bun run typecheck`
- `bun run build`

---
*Phase: 18-referral-contract-link-plumbing*
*Completed: 2026-03-29*
