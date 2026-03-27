---
phase: 15-quick-links-foundation
plan: 02
subsystem: profile-header
tags: [quick-links, profile-header, route-state, empty-state, testing]
requires:
  - phase: 15-quick-links-foundation
    plan: 01
    provides: pure quick-link derivation, ordering, and canonical tie-break behavior
provides:
  - Route-level quick-link state passed into the profile header seam
  - Non-visual header readiness signal for empty vs populated quick-link state
  - Focused header-contract tests without Phase 16 layout leakage
affects: [phase-15-foundation, profile-header, phase-16-quick-links-ui]
tech-stack:
  added: []
  patterns: [route-to-header-quick-link-state, non-visual-header-readiness-seam]
key-files:
  created: []
  modified:
    - src/lib/ui/profile-quick-links.ts
    - src/routes/index.tsx
    - src/components/profile/ProfileHeader.tsx
    - src/components/profile/ProfileHeader.test.tsx
key-decisions:
  - "The route owns Quick Links derivation and passes a state object into `ProfileHeader` rather than letting the header recompute foundation rules."
  - "Phase 15 exposes `data-has-quick-links` as a non-visual readiness seam so Phase 16 can add UI without reworking the contract."
patterns-established:
  - "Use a small `ResolvedProfileQuickLinksState` object as the handoff boundary from content/routing into the profile header."
  - "Lock empty-state suppression with non-visual tests before any visible Quick Links strip exists."
requirements-completed:
  - MAINT-01
duration: not-tracked
completed: 2026-03-27
---

# Phase 15 Plan 02 Summary

**The Quick Links foundation now reaches the profile header through a stable route-owned state seam with empty-state readiness locked down by focused tests**

## Performance

- **Duration:** not-tracked
- **Completed:** 2026-03-27
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Extended the Quick Links helper to expose a small route-friendly state object instead of only the raw resolved items array.
- Wired `RouteIndex` to derive Quick Links once from `content.links` and pass that state into `ProfileHeader`.
- Added a non-visual `data-has-quick-links` seam on the profile header so future UI work can distinguish empty versus populated state without rendering the strip early.
- Added focused `ProfileHeader` tests proving empty Quick Links state leaves no placeholder chrome and populated state reaches the header seam.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add a header-facing quick-link model and route integration** - `9a03cac` (`feat`)
2. **Task 2: Extend the profile-header contract for quick-link state without visual overreach** - `4cf260d` (`feat`)
3. **Task 3: Add focused tests for empty-state suppression and contract stability** - `d821d73` (`test`)

## Files Created/Modified

- `src/lib/ui/profile-quick-links.ts` - route-facing Quick Links state helper
- `src/routes/index.tsx` - single derivation point that passes Quick Links state into `ProfileHeader`
- `src/components/profile/ProfileHeader.tsx` - non-visual quick-link readiness seam
- `src/components/profile/ProfileHeader.test.tsx` - focused contract tests for empty vs populated Quick Links state

## Decisions Made

- Kept Quick Links derivation at the route layer so the header remains a consumer of state rather than a second derivation site.
- Represented readiness with a non-visual data attribute instead of prematurely rendering Phase 16 strip markup.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `bun run build` completed successfully but repeated the known non-blocking warnings about the stale LinkedIn authenticated cache and the fallback social preview image.
- The repo's pre-commit parity guard required the work to stay split cleanly by file, so the non-visual header seam and the tests landed as separate commits.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 16 now has a concrete route-to-header Quick Links contract to render from.
- The profile header can distinguish empty versus populated Quick Links state without introducing placeholder chrome before the visible strip work begins.

---
*Phase: 15-quick-links-foundation*
*Completed: 2026-03-27*
