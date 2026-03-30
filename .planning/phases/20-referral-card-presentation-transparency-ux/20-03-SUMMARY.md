---
phase: 20-referral-card-presentation-transparency-ux
plan: 03
subsystem: referral-card-regressions-and-accessibility
tags: [referral, accessibility, regression, tests, cards]
requires:
  - 20-01
  - 20-02
provides:
  - focused referral rendering regressions
  - sibling terms-link accessibility coverage
  - soft-marker and one-sided-benefit rendering coverage
  - footer/source regression coverage for referral cards
affects: [phase-20-regressions, card-accessibility, card-tests]
tech-stack:
  added: []
  patterns: [fixture-driven-referral-ui-tests, sibling-interaction-assertions, source-cue-regression-guards]
key-files:
  created: []
  modified:
    - src/components/cards/referral-card-rendering.test.tsx
    - src/components/cards/non-payment-card-accessibility.test.tsx
    - src/lib/ui/rich-card-footer-labels.test.ts
key-decisions:
  - "Referral accessibility coverage should assert reading order and sibling interaction structure directly rather than relying only on visual shell tests."
  - "Soft markers and one-sided benefits deserve their own explicit regression cases so the UI does not silently drift toward empty placeholder chrome."
  - "Canonical footer/source behavior remains unchanged for referral cards on known-site domains."
patterns-established:
  - "Use dedicated referral card fixtures in rendering and accessibility tests rather than folding every assertion into generic rich-card cases."
  - "Assert sibling terms-link structure by inspecting direct frame children and explicit terms-link aria labels."
requirements-completed:
  - CARD-04
duration: not-tracked
completed: 2026-03-30
---

# Phase 20 Plan 03 Summary

**Referral card presentation now has focused accessibility and regression coverage**

## Performance

- **Duration:** not-tracked
- **Completed:** 2026-03-30
- **Tasks:** 3
- **Files modified:** 3
- **Files created:** 0

## Accomplishments

- Expanded `src/components/cards/referral-card-rendering.test.tsx` with soft-marker and one-sided-benefit regressions.
- Added a focused accessibility test proving referral cards keep the shared primary anchor semantics while exposing the terms link as a sibling interaction.
- Added footer/source-label regression coverage for a referral-rich Club Orange card in `src/lib/ui/rich-card-footer-labels.test.ts`.
- Re-ran the shared referral card hardening bundle across rendering, accessibility, source-label, and description-sourcing tests.

## Task Commits

1. **Task 1: Add focused referral rendering regressions for rich and simple cards** + **Task 2: Harden accessibility coverage around referral reading order and terms affordances** + **Task 3: Prove non-referral and supported social profile behavior did not regress** - `02439d2` (`test`)

## Files Created/Modified

- `src/components/cards/referral-card-rendering.test.tsx` - soft-marker and one-sided-benefit regression coverage
- `src/components/cards/non-payment-card-accessibility.test.tsx` - referral reading-order and sibling terms-link coverage
- `src/lib/ui/rich-card-footer-labels.test.ts` - referral source/footer-label stability coverage

## Decisions Made

- Kept the accessibility assertions anchored to the shared card title (`Get Coffee`) so they reflect the real shell semantics instead of a simplified fixture shorthand.
- Reused the current Club Orange referral shape for footer/source regression coverage rather than inventing a new brand-specific fixture.
- Left the broader non-referral and supported social profile suites in place and layered referral-specific assertions on top rather than rewriting the established shared-card tests.

## Deviations from Plan

- **[Rule 1 - Auto-fix bug] Shared title expectation drift**: the first new accessibility test expected a simplified title in the anchor and terms-link labels, but the real shared shell uses the full card title; the assertions were corrected immediately and documented here.

## Issues Encountered

- The first accessibility assertion for the new sibling terms link used the wrong expected title string, which briefly failed the focused hardening bundle until it was aligned with the real card title.
- `biome` requested a wrapped assertion in the new referral rendering test before the final test commit.

## User Setup Required

None.

## Next Phase Readiness

- Phase 20 now has explicit coverage for disclosure, benefits, terms-link structure, and source-cue stability.
- The phase is ready for goal-level verification and planning-doc updates without additional card UX work.

## Verification

- `bun test src/components/cards/referral-card-rendering.test.tsx src/components/cards/non-payment-card-accessibility.test.tsx src/components/cards/social-profile-card-rendering.test.tsx src/lib/ui/rich-card-description-sourcing.test.ts src/lib/ui/rich-card-footer-labels.test.ts`
- `bun run typecheck`
- `bun run build`
- pre-commit required lanes also passed during `02439d2`, including build, quality, and Studio integration checks

---
*Phase: 20-referral-card-presentation-transparency-ux*
*Completed: 2026-03-30*
