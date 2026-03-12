---
phase: 14-refactor-dialogs-to-use-a-modal-library
plan: 01
subsystem: shared-dialog-foundation
tags: [dialog, modal, kobalte, accessibility]
requires:
  - phase: 13-replace-inline-action-feedback-with-toasts
    provides: current public-site shell and toast layer
affects: [phase-14-ui, analytics-modal, payment-fullscreen]
tech-stack:
  added: [@kobalte/core]
  patterns: [shared-dialog-wrapper, controlled-open-seam, focus-restore-helper]
key-files:
  created:
    - src/components/dialog/AppDialog.tsx
    - src/components/dialog/AppDialog.test.tsx
  modified:
    - package.json
    - bun.lock
    - src/styles/base.css
    - src/styles/responsive.css
key-decisions:
  - "Adopted `@kobalte/core` as the dialog library while keeping `solid-sonner` for toast delivery."
  - "Built a public-site-specific `AppDialog` wrapper instead of wiring raw Kobalte primitives independently inside each modal surface."
patterns-established:
  - "Dialog consumers now get controlled open/close, portal/overlay/content wiring, and explicit focus-restore behavior from one shared wrapper."
  - "Modal overlay and positioner styling now live in shared app-dialog hooks with consumer-specific classes layered on top."
requirements-completed: []
duration: not-tracked
completed: 2026-03-11
---

# Phase 14 Plan 01 Summary

**Added `@kobalte/core` and established the shared dialog shell for the public site**

## Performance

- **Completed:** 2026-03-11
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added `@kobalte/core@0.13.11` to the public site dependencies.
- Created `src/components/dialog/AppDialog.tsx` as the shared wrapper around Kobalte portal/overlay/content primitives.
- Added focused helper-level regression coverage for controlled close behavior and focus restoration in `src/components/dialog/AppDialog.test.tsx`.
- Refactored the shared modal shell styling into `app-dialog` overlay/positioner/content hooks while preserving the analytics and payment modal class layers.

## Task Commits

No atomic task commits were created during local phase execution.

## Files Created/Modified

- `package.json` - added the dialog-library dependency
- `bun.lock` - locked the new dependency graph
- `src/components/dialog/AppDialog.tsx` - shared library-backed dialog wrapper
- `src/components/dialog/AppDialog.test.tsx` - helper-level regression coverage for wrapper behavior
- `src/styles/base.css` - shared dialog-shell overlay/positioner/content hooks
- `src/styles/responsive.css` - responsive padding adjustments for the shared dialog shell

## Decisions Made

- Chose `@kobalte/core` over `@ark-ui/solid` because it provides the required Solid-native dialog primitives with a smaller dependency footprint and a less expansive surface area for this repo.
- Kept the wrapper API intentionally small and consumer-focused instead of building a broader design-system modal abstraction.

## Deviations from Plan

- The automated wrapper test focuses on the wrapper’s close/focus helpers rather than fully rendering Kobalte dialog primitives under Bun’s lightweight test environment. Full DOM behavior is covered later through built-preview browser verification.

## Issues Encountered

- Kobalte’s dialog primitives are not trivially renderable under the repo’s existing “tree shape” test harness, so the wrapper test stays at the helper contract layer while browser checks cover the actual DOM behavior.

## User Setup Required

None.

## Next Phase Readiness

- Both modal consumers can now migrate onto the shared wrapper instead of duplicating low-level dialog behavior.
- The payment fullscreen modal is the next lower-risk migration target.

## Verification

- `bun test src/components/dialog/AppDialog.test.tsx`
- `bun run typecheck`
- `bun run build`

---
*Phase: 14-refactor-dialogs-to-use-a-modal-library*
*Completed: 2026-03-11*
