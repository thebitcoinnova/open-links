---
phase: 20-referral-card-presentation-transparency-ux
plan: 01
subsystem: referral-card-view-model
tags: [referral, cards, view-model, disclosure, benefits]
requires: []
provides:
  - shared referral presentation helper
  - referral-aware non-payment card view model
  - offer-summary precedence for referral cards only
  - fixture-driven regression coverage for referral presentation inputs
affects: [phase-20-card-model, non-payment-cards, description-sourcing]
tech-stack:
  added: []
  patterns: [pure-presentation-helper, additive-card-varianting, referral-only-summary-precedence]
key-files:
  created:
    - src/lib/ui/referral-card-presentation.ts
    - src/lib/ui/referral-card-presentation.test.ts
  modified:
    - src/lib/ui/rich-card-policy.ts
    - src/lib/ui/rich-card-description-sourcing.test.ts
    - src/components/cards/social-profile-card-rendering.test.tsx
key-decisions:
  - "Referral presentation stays additive to the shared non-payment card model instead of becoming a fourth card family."
  - "Offer-summary precedence happens at the card view-model layer, not by mutating the base description resolver."
  - "Soft referral markers still resolve to a visible generic `Referral` disclosure label."
patterns-established:
  - "Use `resolveReferralCardPresentation(...)` as the single formatting seam for badge labels, benefit rows, and terms-link state."
  - "Let `buildNonPaymentCardViewModel(...)` substitute referral offer copy into the shared description slot while ordinary description sourcing remains unchanged."
requirements-completed:
  - CARD-01
  - CARD-02
duration: not-tracked
completed: 2026-03-30
---

# Phase 20 Plan 01 Summary

**The shared non-payment card model now understands referral disclosure, benefits, and offer-summary precedence**

## Performance

- **Duration:** not-tracked
- **Completed:** 2026-03-30
- **Tasks:** 3
- **Files modified:** 3
- **Files created:** 2

## Accomplishments

- Added `src/lib/ui/referral-card-presentation.ts` as a pure helper for disclosure labels, visitor-first benefit rows, and quiet terms-link state.
- Extended `NonPaymentCardViewModel` in `src/lib/ui/rich-card-policy.ts` with additive referral presentation data.
- Kept the existing base description resolver intact while letting referral `offerSummary` override the card description slot only at the shared view-model layer.
- Added fixture-driven view-model and description-sourcing tests for soft referral markers, one-sided benefits, and non-profile Club Orange referral presentation.

## Task Commits

1. **Task 1: Add a pure referral-presentation helper for the shared card model** + **Task 2: Extend the shared non-payment card view model without creating a new card type** + **Task 3: Lock view-model regressions for soft markers, one-sided benefits, and non-profile referral URLs** - `9fe8680` (`feat`)

## Files Created/Modified

- `src/lib/ui/referral-card-presentation.ts` - shared disclosure/benefit/terms formatting seam
- `src/lib/ui/referral-card-presentation.test.ts` - pure helper regression coverage
- `src/lib/ui/rich-card-policy.ts` - additive referral presentation state in the shared non-payment card view model
- `src/lib/ui/rich-card-description-sourcing.test.ts` - referral-only offer-summary precedence coverage
- `src/components/cards/social-profile-card-rendering.test.tsx` - non-profile referral-rich view-model coverage

## Decisions Made

- Chose `Supports` as the owner-side standardized label while preserving raw benefit text values.
- Kept short terms as inline copy plus optional quiet link state in the model so the shell can decide exact placement in Plan 20-02.
- Scoped referral summary precedence to `buildNonPaymentCardViewModel(...)` so non-referral description resolution remains stable for the rest of the app.

## Deviations from Plan

- **[Rule 3 - Blocking] Coupled model seam**: the pure helper, view-model integration, and targeted regression coverage had to land together to keep the shared card contract coherent, so all three tasks shipped in one feature commit.

## Issues Encountered

- The dataset audit in `rich-card-description-sourcing.test.ts` had drifted behind the current rich-link set and needed to be updated to reflect the current cached rich-link inventory.
- The first soft-marker helper test asserted the entire object shape instead of the meaningful surfaced fields, which was too brittle once the helper began returning stable optional keys.

## User Setup Required

None.

## Next Phase Readiness

- Phase 20 now has a stable referral-aware view model ready for JSX and CSS work in `NonPaymentLinkCardShell`.
- Plan 20-02 can focus on shell rendering and styling without reopening disclosure wording or summary precedence decisions.

## Verification

- `bun test src/lib/ui/referral-card-presentation.test.ts`
- `bun test src/lib/ui/rich-card-description-sourcing.test.ts src/components/cards/social-profile-card-rendering.test.tsx`
- `bun run typecheck`
- pre-commit required lanes also passed during `9fe8680`, including build and Studio integration checks

---
*Phase: 20-referral-card-presentation-transparency-ux*
*Completed: 2026-03-30*
