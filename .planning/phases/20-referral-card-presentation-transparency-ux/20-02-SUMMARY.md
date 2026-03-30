---
phase: 20-referral-card-presentation-transparency-ux
plan: 02
subsystem: referral-card-shell-and-styling
tags: [referral, cards, shell, css, transparency]
requires:
  - 20-01
provides:
  - shared-shell referral disclosure rendering
  - visitor/owner benefit rows in the text area
  - inline referral terms with sibling terms link support
  - referral-specific rich/simple card styling
affects: [phase-20-card-shell, non-payment-cards, card-styling]
tech-stack:
  added: []
  patterns: [shared-shell-subvariant, sibling-terms-link, benefit-rows-in-text-column]
key-files:
  created:
    - src/components/cards/referral-card-rendering.test.tsx
  modified:
    - src/components/cards/NonPaymentLinkCardShell.tsx
    - src/styles/base.css
    - src/styles/responsive.css
key-decisions:
  - "The quiet `Terms` affordance is rendered as a sibling link under the main card anchor instead of nesting inside the primary card interaction."
  - "Referral cards remain a styled sub-variant of the shared non-payment shell rather than a forked markup system."
  - "Disclosure badge, benefit rows, and inline terms stay in the text column while promo media and footer/source cues remain on the existing shared path."
patterns-established:
  - "Use `data-has-referral` on the shared frame and anchor to drive referral-specific styling without changing card family selection."
  - "Render referral secondary links in a sibling row after the primary anchor so external terms navigation stays valid and quiet."
requirements-completed:
  - CARD-01
  - CARD-02
  - CARD-03
duration: not-tracked
completed: 2026-03-30
---

# Phase 20 Plan 02 Summary

**Referral disclosure now renders directly in the shared card shell with a valid sibling terms link**

## Performance

- **Duration:** not-tracked
- **Completed:** 2026-03-30
- **Tasks:** 3
- **Files modified:** 3
- **Files created:** 1

## Accomplishments

- Extended `NonPaymentLinkCardShell.tsx` to render referral badges, benefit rows, inline terms copy, and a quiet sibling `Terms` link.
- Kept the card body as the primary anchor while moving terms navigation into a separate sibling interaction to avoid nested links.
- Added `src/components/cards/referral-card-rendering.test.tsx` to lock simple and rich referral rendering structure.
- Styled referral cards as a distinct but coherent shared sub-variant in `src/styles/base.css` and `src/styles/responsive.css`.

## Task Commits

1. **Task 1: Render visible referral disclosure and benefit rows in the shared shell** + **Task 2: Add inline terms behavior and a quiet terms affordance without nested links** + **Task 3: Style referral cards as a distinct shared sub-variant across desktop and mobile** - `b987272` (`feat`)

## Files Created/Modified

- `src/components/cards/NonPaymentLinkCardShell.tsx` - shared referral badge, benefit, inline terms, and sibling terms-link rendering
- `src/components/cards/referral-card-rendering.test.tsx` - focused rendering regression coverage for simple and rich referral cards
- `src/styles/base.css` - referral frame, badge, benefit-row, terms, and secondary-link styling
- `src/styles/responsive.css` - mobile-safe referral benefit stacking and secondary-link layout

## Decisions Made

- Kept the terms-link label as `Terms` for now to make the secondary affordance factual and unobtrusive.
- Let referral styling subtly tighten border/background emphasis instead of introducing louder ad-like color treatment.
- Preserved existing preview-image and footer/source behavior so rich referral cards still benefit from the current media/icon pipeline.

## Deviations from Plan

- **[Rule 3 - Blocking] Coupled shell/styling delivery**: the markup, sibling terms-link placement, focused rendering tests, and CSS all needed to land together to keep the first referral shell variant coherent, so the three tasks shipped in one feature commit.

## Issues Encountered

- The main card shell’s single-anchor structure made inline external terms navigation invalid, which required moving the quiet terms affordance into a sibling row instead of trying to place it inside the description/footer content.
- `biome` adjusted some staged JSX/CSS formatting during pre-commit, but no behavioral changes were needed after the auto-fix pass.

## User Setup Required

None.

## Next Phase Readiness

- Phase 20 now has the intended visible referral UI and can move into accessibility and regression hardening without reopening the shell structure.
- Plan 20-03 can focus on the reading order, sibling-interaction correctness, and non-referral fallback safety net.

## Verification

- `bun test src/components/cards/referral-card-rendering.test.tsx`
- `bun run typecheck`
- `bun run build`
- `bun test src/components/cards/non-payment-card-accessibility.test.tsx`
- pre-commit required lanes also passed during `b987272`, including build, quality, and Studio integration checks

---
*Phase: 20-referral-card-presentation-transparency-ux*
*Completed: 2026-03-30*
