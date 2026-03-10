---
phase: 12-add-share-button-in-each-card-next-to-analytics
plan: 02
subsystem: card-share-ui
tags: [ui, cards, share, accessibility, layout]
requires:
  - phase: 12-add-share-button-in-each-card-next-to-analytics
    plan: 01
    provides: shared share utility and ordered card-action seam
affects: [phase-12-verification, card-actions, mobile-layout]
tech-stack:
  added: []
  patterns: [ordered-card-action-row, inline-share-feedback, built-preview-ui-check]
key-files:
  created: []
  modified:
    - src/routes/index.tsx
    - src/components/cards/NonPaymentLinkCardShell.tsx
    - src/styles/base.css
    - src/components/cards/non-payment-card-accessibility.test.tsx
key-decisions:
  - "History-aware cards expose analytics first and share second, using the same sibling action row."
  - "Card share feedback is a short-lived inline status in the card summary area rather than a separate toast system."
patterns-established:
  - "Two-button card action rows reserve title-row space instead of padding the whole card like a side column."
  - "Built-preview browser snapshots backstop the visible action order and placement for card-level UI additions."
requirements-completed: []
duration: not-tracked
completed: 2026-03-10
---

# Phase 12 Plan 02 Summary

**Rendered the card-level share button beside analytics, wired it to the shared share helper, and verified the two-button action row**

## Performance

- **Completed:** 2026-03-10
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Wired history-aware cards in `src/routes/index.tsx` to expose two actions in order: analytics first, share second.
- Implemented the visible share affordance in `NonPaymentLinkCardShell.tsx`, including inline action-status feedback so clipboard fallback and native share outcomes can be surfaced without a separate toast system.
- Updated the card action row styling so analytics and share sit together in the header action area, with reserved space in the title row rather than whole-card side padding.
- Added focused regression coverage proving history-aware cards render analytics then share in order and cards without history render no action row at all.
- Verified the built preview in Playwright, confirming the action pair appears on the history-aware cards in the expected order.

## Task Commits

No atomic task commits were created during local phase execution.

## Files Created/Modified

- `src/routes/index.tsx` - resolves the ordered analytics/share action pair for history-aware cards
- `src/components/cards/NonPaymentLinkCardShell.tsx` - renders the ordered action row and inline share feedback
- `src/styles/base.css` - two-button action-row styling and title-row reservation
- `src/components/cards/non-payment-card-accessibility.test.tsx` - ordered action-row regression coverage and no-action-row guard case

## Decisions Made

- Kept the card share payload simple and card-specific (`label`, optional `description`, `url`) rather than introducing platform-specific formatting in this phase.
- Chose inline card status feedback for share fallback/success because it is lightweight, accessible, and local to the action source.

## Deviations from Plan

- `src/styles/responsive.css` did not need changes after the built-preview check showed the existing responsive rules handled the new two-button row acceptably.
- `ProfileHeader.test.tsx` did not require further edits in this wave because the share extraction in Wave 1 preserved the profile-level button order and semantics.

## Issues Encountered

- None beyond the expected contract cleanup around the new ordered action-row model and the Web Share helper typings.

## User Setup Required

None.

## Next Phase Readiness

- Phase 12 now ships the requested card-level share affordance and is ready for broader docs/regression coverage in Phase 9.
- The shared share utility and ordered card-action seam can support future action refinements without reworking the card shell again.

## Verification

- `bun test src/lib/share/share-link.test.ts src/components/profile/ProfileHeader.test.tsx src/components/cards/non-payment-card-accessibility.test.tsx`
- `bun run typecheck`
- `bun run biome:check`
- `bun run build`
- Playwright built-preview snapshot of `http://127.0.0.1:4173/` confirming history-aware cards render analytics then share in the action row

---
*Phase: 12-add-share-button-in-each-card-next-to-analytics*
*Completed: 2026-03-10*
