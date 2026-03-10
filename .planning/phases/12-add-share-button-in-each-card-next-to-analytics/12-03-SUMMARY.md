---
phase: 12-add-share-button-in-each-card-next-to-analytics
plan: 03
subsystem: share-gap-closure
tags: [gap-closure, share, cards, payloads, accessibility]
requires:
  - phase: 12-add-share-button-in-each-card-next-to-analytics
    plan: 02
    provides: initial card-level share action row and shared share helper rollout
  - phase: 12-add-share-button-in-each-card-next-to-analytics
    plan: 03
    source: 12-UAT.md
    provides: diagnosed share-copy and share-visibility gaps
affects: [phase-12-verification, uat-follow-up]
tech-stack:
  added: []
  patterns: [url-only-share-mode, share-without-analytics, widened-card-action-visibility]
key-files:
  created: []
  modified:
    - src/lib/share/share-link.ts
    - src/lib/share/share-link.test.ts
    - src/components/profile/ProfileHeader.tsx
    - src/routes/index.tsx
    - src/components/cards/non-payment-card-accessibility.test.tsx
key-decisions:
  - "The shared share helper now supports a copy-safe `url-only` mode so browser Copy actions can preserve clean pasteable URLs."
  - "Share availability is now broader than analytics availability: all shareable cards expose share, while analytics remains limited to history-aware cards."
patterns-established:
  - "Native share payload richness should be configurable when copy behavior matters."
  - "Card action rows can render share-only or analytics-plus-share depending on card capabilities."
requirements-completed: []
duration: not-tracked
completed: 2026-03-10
---

# Phase 12 Plan 03 Summary

**Closed the Phase 12 UAT gaps by making share copy URL-clean and decoupling card share from analytics availability**

## Performance

- **Completed:** 2026-03-10
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Added a `url-only` share mode to the shared share helper so profile and card share can preserve clean, pasteable URLs when the user relies on the share-sheet Copy action.
- Updated the profile header to use the copy-safe share mode, preventing extra headline text from contaminating copied profile URLs.
- Updated card share actions to use the same copy-safe mode, preventing label/description text from polluting copied card URLs.
- Decoupled share visibility from analytics visibility in the route action resolution: history-aware cards still show analytics then share, while cards without history now render share-only.
- Added regression coverage proving the helper can emit URL-only share payloads and that cards without history still render a share action row.

## Task Commits

No atomic task commits were created during local gap-closure execution.

## Files Created/Modified

- `src/lib/share/share-link.ts` - configurable `url-only` share payload mode
- `src/lib/share/share-link.test.ts` - regression coverage for copy-safe payload behavior
- `src/components/profile/ProfileHeader.tsx` - profile share switched to URL-only mode
- `src/routes/index.tsx` - share action now renders on all shareable cards, analytics stays history-aware
- `src/components/cards/non-payment-card-accessibility.test.tsx` - regression coverage for share-only cards and ordered action rows

## Decisions Made

- Treated clean copy behavior as more important than rich share payload metadata for both profile and card share surfaces.
- Kept the widened share visibility in the route layer rather than the card shell, since the distinction between analytics-capable and share-capable cards is a data-routing concern.

## Deviations from Plan

- `NonPaymentLinkCardShell.tsx` did not require further structural changes once the route began passing share-only card actions where analytics was absent.

## Issues Encountered

- The original Phase 12 implementation assumed that richer native share payloads were harmless, but the user’s platform Copy action serialized that richer payload into a non-pasteable URL+text string. The gap closure corrected that assumption.

## User Setup Required

None.

## Next Phase Readiness

- Phase 12 is ready for the user to rerun UAT with clean URL copy behavior and broader share visibility.
- Phase 9 can now document card sharing without caveating the earlier copy/visibility bugs.

## Verification

- `bun test src/lib/share/share-link.test.ts src/components/profile/ProfileHeader.test.tsx src/components/cards/non-payment-card-accessibility.test.tsx`
- `bun run typecheck`
- `bun run biome:check`
- `bun run build`

---
*Phase: 12-add-share-button-in-each-card-next-to-analytics*
*Completed: 2026-03-10*
