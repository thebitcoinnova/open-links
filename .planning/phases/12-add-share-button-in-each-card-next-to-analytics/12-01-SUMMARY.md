---
phase: 12-add-share-button-in-each-card-next-to-analytics
plan: 01
subsystem: shared-share-foundation
tags: [share, native-web-share, clipboard, card-actions]
requires:
  - phase: 11-historical-follower-tracking-growth-charts
    provides: sibling card-action pattern and history-aware card action seam
affects: [phase-12-ui, profile-header, card-actions]
tech-stack:
  added: []
  patterns: [shared-share-utility, profile-card-share-parity, sibling-card-action-contract]
key-files:
  created:
    - src/lib/share/share-link.ts
    - src/lib/share/share-link.test.ts
  modified:
    - src/components/profile/ProfileHeader.tsx
    - src/components/cards/NonPaymentLinkCardShell.tsx
    - src/components/cards/RichLinkCard.tsx
    - src/components/cards/SimpleLinkCard.tsx
key-decisions:
  - "Profile-level and card-level sharing now share one native-share/clipboard-fallback utility instead of duplicating browser logic."
  - "Card actions moved to an ordered action-row model so analytics and share can coexist without reopening the nested-interactive-content problem."
patterns-established:
  - "Web Share calls live in a reusable utility and return structured status for surface-specific feedback."
  - "Card actions are now represented as ordered sibling action specs rather than one hard-coded analytics button."
requirements-completed: []
duration: not-tracked
completed: 2026-03-10
---

# Phase 12 Plan 01 Summary

**Extracted a shared share utility and refactored the card action seam so cards can host both analytics and share**

## Performance

- **Completed:** 2026-03-10
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added `src/lib/share/share-link.ts` as the single shared implementation for native `navigator.share()` plus clipboard fallback and canonical current-page share URL resolution.
- Added focused tests covering native share success, user-aborted share dismissal, clipboard fallback, and canonical URL resolution.
- Refactored `ProfileHeader.tsx` to use the shared share helper while preserving the existing profile-level share button order and transient status behavior.
- Generalized the shared card shell from one analytics-only action to an ordered card-action array so cards can render multiple sibling actions without nesting them inside the anchor.
- Updated `RichLinkCard` and `SimpleLinkCard` to use the new ordered action seam.

## Task Commits

No atomic task commits were created during local phase execution.

## Files Created/Modified

- `src/lib/share/share-link.ts` - shared native-share and clipboard-fallback helper
- `src/lib/share/share-link.test.ts` - focused browser-API coverage for the share helper
- `src/components/profile/ProfileHeader.tsx` - profile share refactored onto the shared helper
- `src/components/cards/NonPaymentLinkCardShell.tsx` - generalized ordered sibling action seam
- `src/components/cards/RichLinkCard.tsx` - updated card action prop plumbing
- `src/components/cards/SimpleLinkCard.tsx` - updated card action prop plumbing

## Decisions Made

- Kept the share-status rendering local to the surface while centralizing the share attempt logic, so cards and the profile header can differ in presentation without drifting in browser behavior.
- Reused the current `IconShare` instead of introducing a second visual language for card-level share.

## Deviations from Plan

- The generalized card-action seam went slightly beyond a dedicated share prop because the ordered action-array model better fit the existing analytics action and future action-row expansion.

## Issues Encountered

- None after the share logic was centralized. The main work here was unifying behavior cleanly without regressing the existing profile share path.

## User Setup Required

None.

## Next Phase Readiness

- The visible card-level share button can now be added without duplicating Web Share logic.
- The ordered action seam is ready for analytics then share button rendering in the card header area.

## Verification

- `bun test src/lib/share/share-link.test.ts src/components/profile/ProfileHeader.test.tsx src/components/cards/non-payment-card-accessibility.test.tsx`
- `bun run typecheck`
- `bun run biome:check`

---
*Phase: 12-add-share-button-in-each-card-next-to-analytics*
*Completed: 2026-03-10*
