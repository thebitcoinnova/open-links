---
phase: 11-historical-follower-tracking-growth-charts
plan: 04
subsystem: analytics-card-gap-closure
tags: [gap-closure, ui, analytics, accessibility, reactivity]
requires:
  - phase: 11-historical-follower-tracking-growth-charts
    plan: 03
    provides: initial analytics surface, card-level analytics action, and lazy-loaded chart flow
  - phase: 11-historical-follower-tracking-growth-charts
    plan: 04
    source: 11-UAT.md
    provides: diagnosed first-load visibility and card-header placement gaps
affects: [phase-11-verification, uat-follow-up]
tech-stack:
  added: []
  patterns: [reactive-card-analytics-accessor, header-row-action-reservation, browser-confirmed-gap-closure]
key-files:
  created: []
  modified:
    - src/routes/index.tsx
    - src/components/cards/NonPaymentLinkCardShell.tsx
    - src/components/cards/RichLinkCard.tsx
    - src/components/cards/SimpleLinkCard.tsx
    - src/styles/base.css
    - src/components/cards/non-payment-card-accessibility.test.tsx
key-decisions:
  - "Per-card analytics availability is now resolved through a reactive accessor passed into card components instead of a one-time route render calculation."
  - "The card analytics action stays outside the anchor but visually reserves space in the title row rather than shifting the full card into a side-column layout."
patterns-established:
  - "Async card-action availability should flow through reactive accessors when the route render callback itself is not guaranteed to rerun."
  - "Header-row action spacing is reserved locally in the title row instead of globally padding the whole card shell."
requirements-completed: []
duration: not-tracked
completed: 2026-03-10
---

# Phase 11 Plan 04 Summary

**Closed the Phase 11 card analytics gaps by making first-load button visibility reactive and moving the action into the card header row**

## Performance

- **Completed:** 2026-03-10
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Reworked the route-to-card analytics path so cards receive a reactive analytics-button accessor instead of a one-time route render value. That allows history-aware cards to expose their analytics button as soon as the async follower-history index loads.
- Updated the shared non-payment card shell to consume the reactive analytics accessor and reserve action space in the card title row instead of padding the full card as though the button lived in a separate side column.
- Kept the analytics button outside the anchor element so the card remains semantically valid and retains its existing action-oriented accessible name.
- Extended the focused accessibility regression test to cover the new analytics-summary data attribute and header-row title structure.
- Verified the first-load fix in a real browser via Playwright snapshot against the local preview server before closing the gap plan.

## Task Commits

No atomic task commits were created during local gap-closure execution.

## Files Created/Modified

- `src/routes/index.tsx` - reactive analytics-button resolver per card instead of one-time route evaluation
- `src/components/cards/NonPaymentLinkCardShell.tsx` - reactive analytics button consumption and header-row title wrapper
- `src/components/cards/RichLinkCard.tsx` - updated prop plumbing for the analytics-button accessor
- `src/components/cards/SimpleLinkCard.tsx` - updated prop plumbing for the analytics-button accessor
- `src/styles/base.css` - title-row action spacing and revised card analytics button placement
- `src/components/cards/non-payment-card-accessibility.test.tsx` - coverage for the fixed card analytics path

## Decisions Made

- Kept the fix local to the route/card seam rather than introducing a new shared analytics store, because the bug was caused by a one-time render calculation rather than missing global state.
- Reserved analytics-button space in the summary title row only, which keeps the control visually aligned with the card header without shrinking the whole card content area.

## Deviations from Plan

- `src/styles/responsive.css` did not need changes after the header-row reservation fix proved stable across the existing responsive rules.

## Issues Encountered

- The original fix for the Phase 11 feature used a static `analyticsButton` value computed in the route render helper. That worked after a route remount but not on the initial async load, which is why the bug only reproduced before visiting the page-level analytics view.

## User Setup Required

None.

## Next Phase Readiness

- Phase 11 is ready for the user to rerun manual verification on the card-level analytics entry points.
- Phase 9 can document the analytics surface without needing to caveat a first-load card-action bug.

## Verification

- `bun test src/components/cards/non-payment-card-accessibility.test.tsx`
- `bun run typecheck`
- `bun run biome:check`
- `bun run build`
- Playwright CLI snapshot of `http://127.0.0.1:4173/` confirming first-load card analytics buttons are present before opening the page-level analytics view

---
*Phase: 11-historical-follower-tracking-growth-charts*
*Completed: 2026-03-10*
