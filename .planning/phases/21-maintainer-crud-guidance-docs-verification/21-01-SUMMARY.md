---
phase: 21-maintainer-crud-guidance-docs-verification
plan: 01
subsystem: referral-authoring-docs
tags: [referral, docs, data-model, crud, studio]
requires: []
provides:
  - canonical referral contract docs
  - referral-aware AI CRUD guidance
  - referral field inventory notes
  - honest Studio Advanced JSON positioning for referral editing
affects: [phase-21-authoring-guidance, maintainer-docs, studio-docs]
tech-stack:
  added: []
  patterns: [canonical-contract-doc, ai-crud-first-guidance, advanced-json-fallback-positioning]
key-files:
  created: []
  modified:
    - docs/data-model.md
    - docs/openclaw-update-crud.md
    - docs/ai-guided-customization.md
    - docs/customization-catalog.md
    - docs/studio-self-serve.md
key-decisions:
  - "The full `links[].referral` contract now has one canonical home in `docs/data-model.md`."
  - "Repo-native AI CRUD remains the first recommendation; Studio is documented honestly as an Advanced JSON referral path for now."
  - "Manual JSON stays the fallback path rather than the default maintainer story."
patterns-established:
  - "Route maintainer workflow docs back to the canonical data-model referral section instead of duplicating the full contract everywhere."
  - "Explain referral precedence in two layers: short top-level rule plus deeper concise detail."
requirements-completed:
  - MAINT-01
duration: not-tracked
completed: 2026-03-30
---

# Phase 21 Plan 01 Summary

**Referral authoring is now documented in the canonical contract docs and across the preferred maintainer workflows**

## Performance

- **Duration:** not-tracked
- **Completed:** 2026-03-30
- **Tasks:** 3
- **Files modified:** 5
- **Files created:** 0

## Accomplishments

- Added a dedicated `links[].referral` section to `docs/data-model.md` with the approved field vocabulary, curated examples, precedence rules, and lightweight generated-field explanations.
- Updated `docs/openclaw-update-crud.md` so referral authoring is explicitly in scope and guided through the canonical referral contract rather than treated as an implicit JSON detail.
- Updated `docs/ai-guided-customization.md` so the links pass now gathers referral disclosures directly, including `non_profile` treatment for supported-family referral URLs.
- Added referral inventory notes to `docs/customization-catalog.md`.
- Updated `docs/studio-self-serve.md` to say plainly that Studio currently handles referral editing through Advanced JSON rather than first-class referral controls.

## Task Commits

1. **Task 1: Add the canonical referral contract section to the data-model docs** + **Task 2: Make the repo-native AI CRUD docs referral-aware** + **Task 3: Align the customization inventory and Studio docs with the current referral authoring reality** - `db0fb4e` (`feat`)

## Files Created/Modified

- `docs/data-model.md` - canonical referral contract, examples, precedence, generated-field overview
- `docs/openclaw-update-crud.md` - referral-aware day-2 CRUD guidance
- `docs/ai-guided-customization.md` - referral-aware links pass and maintainer-path guidance
- `docs/customization-catalog.md` - referral field inventory notes
- `docs/studio-self-serve.md` - explicit Advanced JSON referral editing note

## Decisions Made

- Kept the minimal referral example as `referral: {}` to reflect the approved soft-marker contract rather than inventing fake disclosure text too early.
- Let the one-sided supported-family example carry the `non_profile` pattern so maintainers see the correct supported-family referral treatment in the canonical contract docs.
- Chose to document generated referral fields lightly in `docs/data-model.md` while deferring deeper warning/verification interpretation to the later verification-focused docs pass.

## Deviations from Plan

- **[Rule 3 - Blocking] Canonical-first docs bundle**: the canonical contract section, CRUD guidance, customization inventory, and Studio positioning all needed to land together to keep the maintainer path hierarchy coherent, so the three tasks shipped in one docs-focused feature commit.

## Issues Encountered

- The initial AI-guided patch assumed a slightly different local reference block than the file currently had, so the update had to be reapplied in smaller hunks.
- `docs/data-model.md` had no existing referral anchor at all, so the full contract and examples needed to be introduced from scratch rather than amended.

## User Setup Required

None.

## Next Phase Readiness

- The canonical referral contract and maintainer path hierarchy are now documented.
- Plan 21-02 can focus on top-level discoverability, verification messaging, and downstream breadcrumbs without reopening the contract shape or workflow hierarchy.

## Verification

- `bun run biome:check`
- `bun run studio:lint`
- `bun run typecheck`
- `bun run studio:typecheck`
- `bun run --filter @openlinks/studio-api test`
- `bun run studio:test:integration`
- pre-commit studio checks also passed during `db0fb4e`

---
*Phase: 21-maintainer-crud-guidance-docs-verification*
*Completed: 2026-03-30*
