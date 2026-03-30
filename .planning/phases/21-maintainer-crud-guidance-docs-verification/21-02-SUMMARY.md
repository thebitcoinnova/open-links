---
phase: 21-maintainer-crud-guidance-docs-verification
plan: 02
subsystem: referral-discoverability-verification-downstream
tags: [referral, readme, verification, downstream, docs]
requires:
  - 21-01
provides:
  - top-level referral discoverability
  - referral-specific verification guidance
  - warning interpretation breadcrumbs
  - downstream additive-schema notes
affects: [phase-21-discovery, maintainer-verification, downstream-docs]
tech-stack:
  added: []
  patterns: [breadcrumb-doc-routing, script-backed-verification-guidance, additive-schema-downstream-notes]
key-files:
  created: []
  modified:
    - README.md
    - docs/quickstart.md
    - docs/social-card-verification.md
    - docs/downstream-open-links-sites.md
key-decisions:
  - "README and quickstart should route to deeper referral docs instead of duplicating the full contract."
  - "Referral verification stays script-backed and clearly frames extraction as assistive rather than authoritative."
  - "Downstream docs now distinguish UI-only referral changes from shared contract/schema changes."
patterns-established:
  - "Use top-level maintainer docs as breadcrumb surfaces that point into `docs/data-model.md` and `docs/social-card-verification.md` for the deeper referral story."
  - "Treat `links[].referral` as additive but review-worthy on upstream sync in downstream-facing docs."
requirements-completed:
  - MAINT-02
duration: not-tracked
completed: 2026-03-30
---

# Phase 21 Plan 02 Summary

**Referral support is now discoverable from the top-level maintainer docs and backed by explicit verification/downstream guidance**

## Performance

- **Duration:** not-tracked
- **Completed:** 2026-03-30
- **Tasks:** 3
- **Files modified:** 4
- **Files created:** 0

## Accomplishments

- Added top-level referral discoverability and path routing to `README.md`.
- Added a referral-aware note to `docs/quickstart.md` so maintainers hit the correct day-2 path early.
- Extended `docs/social-card-verification.md` with a script-backed referral checklist, warning interpretation guidance, and explicit “assistive, not authoritative” language.
- Updated `docs/downstream-open-links-sites.md` with a referral-specific additive-schema note and an explicit UI-only vs shared-contract distinction.

## Task Commits

1. **Task 1: Surface referral support in README and quickstart without turning them into schema docs** + **Task 2: Add referral-specific verification and warning interpretation guidance** + **Task 3: Add explicit downstream referral breadcrumbs and finish with a docs-drift pass** - `149c7c6` (`docs`)

## Files Created/Modified

- `README.md` - referral feature discoverability, maintainer-path routing, downstream breadcrumb
- `docs/quickstart.md` - referral-aware CRUD path note at the main day-2 entrypoint
- `docs/social-card-verification.md` - referral checklist, script-backed verification path, warning interpretation, automated coverage map updates
- `docs/downstream-open-links-sites.md` - additive `links[].referral` schema guidance plus UI-only vs shared-contract distinction

## Decisions Made

- Kept the README and quickstart referral notes short and routing-focused rather than duplicating the full `links[].referral` contract.
- Put the deeper warning interpretation in the shared social-card verification guide because referral cards now live inside the shared card system.
- Framed downstream referral impact as additive-but-review-worthy instead of either “no impact” or “always requires downstream changes.”

## Deviations from Plan

- **[Rule 3 - Blocking] Shared-doc drift pass bundled into the same commit**: the README, quickstart, verification guide, and downstream doc needed to move together to keep the referral breadcrumb story coherent, so the docs-drift pass shipped as part of the same docs commit rather than a separate cleanup commit.

## Issues Encountered

- None beyond normal docs synchronization. The existing top-level CRUD hierarchy already matched the approved direction, so the work stayed focused on referral discoverability and verification clarity rather than broader README restructuring.

## User Setup Required

None.

## Next Phase Readiness

- Maintainers can now discover, author, verify, and reason about referral links without reverse-engineering the repo.
- The phase is ready for goal-level verification and phase-closeout updates.

## Verification

- `bun run biome:check`
- `bun run studio:lint`
- `bun run typecheck`
- `bun run studio:typecheck`
- `bun run --filter @openlinks/studio-api test`
- `bun run studio:test:integration`

---
*Phase: 21-maintainer-crud-guidance-docs-verification*
*Completed: 2026-03-30*
