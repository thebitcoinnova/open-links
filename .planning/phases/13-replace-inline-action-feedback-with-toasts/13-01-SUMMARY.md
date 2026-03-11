---
phase: 13-replace-inline-action-feedback-with-toasts
plan: 01
subsystem: toast-foundation
tags: [toast, share, solid-sonner, accessibility]
requires:
  - phase: 12-add-share-button-in-each-card-next-to-analytics
    provides: shared share result contract and ordered card action row
affects: [phase-13-ui, profile-header, card-actions]
tech-stack:
  added: [solid-sonner]
  patterns: [shell-level-toaster, shared-action-toast-helper, silent-share-dismissal]
key-files:
  created:
    - src/lib/ui/action-toast.ts
    - src/lib/ui/action-toast.test.ts
  modified:
    - package.json
    - bun.lock
    - src/routes/index.tsx
    - src/components/profile/ProfileHeader.tsx
    - src/components/cards/NonPaymentLinkCardShell.tsx
    - src/components/profile/ProfileHeader.test.tsx
    - src/components/cards/non-payment-card-accessibility.test.tsx
key-decisions:
  - "Mounted one `solid-sonner` Toaster in `RouteIndex` and registered the runtime toast client there so the existing Bun component tests can stay server-safe."
  - "Mapped share outcomes to toasts with dismissed native-share results kept silent instead of surfacing false-error feedback."
patterns-established:
  - "Transient share feedback now flows through a shared toast helper instead of component-local timer state."
  - "The public site uses one shell-level, theme-aware toaster instead of per-surface toast providers."
requirements-completed: []
duration: not-tracked
completed: 2026-03-11
---

# Phase 13 Plan 01 Summary

**Added the public-site toast foundation and migrated profile/card share feedback off inline status markup**

## Performance

- **Completed:** 2026-03-11
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added `solid-sonner@0.3.1` to the public site and mounted one `Toaster` in `src/routes/index.tsx`.
- Created `src/lib/ui/action-toast.ts` plus focused tests so share/copy result contracts can map to success/info/error toasts with silent dismissal behavior.
- Refactored `ProfileHeader.tsx` to stop managing local share-status signals and inline `<output>` markup.
- Refactored `NonPaymentLinkCardShell.tsx` to stop managing local action-status signals and inline `<output>` markup while preserving the ordered sibling action row.
- Added structural regressions proving the profile header and shared card shell no longer render the old inline status nodes.

## Task Commits

No atomic task commits were created during local phase execution.

## Files Created/Modified

- `package.json` - added the `solid-sonner` dependency
- `bun.lock` - locked the new dependency
- `src/routes/index.tsx` - mounted the shell-level toaster and registered the runtime toast client
- `src/lib/ui/action-toast.ts` - shared share/copy toast mapping helper
- `src/lib/ui/action-toast.test.ts` - focused toast-mapping coverage
- `src/components/profile/ProfileHeader.tsx` - profile share migrated off inline status state
- `src/components/cards/NonPaymentLinkCardShell.tsx` - card share feedback migrated off inline status state
- `src/components/profile/ProfileHeader.test.tsx` - regression proving inline status markup is gone
- `src/components/cards/non-payment-card-accessibility.test.tsx` - regression proving shared cards no longer render inline action status markup

## Decisions Made

- Registered the runtime toast client from `RouteIndex` instead of importing `solid-sonner` directly into the helper so Bun's server-style component tests stay compatible.
- Kept toast placement bottom-center to avoid competing with the top utility bar while still staying close to the interaction context.

## Deviations from Plan

- The toast helper became a pure module with runtime client registration instead of directly importing `solid-sonner`; this was necessary after the initial Bun test pass exposed a server-export incompatibility.

## Issues Encountered

- Initial helper tests failed because importing `solid-sonner` directly inside a shared helper caused the Bun component test environment to load an incompatible `solid-js/web` server export path. The fix was to register the runtime client from `RouteIndex` and keep the helper pure.

## User Setup Required

None.

## Next Phase Readiness

- Payment-rail copy can now adopt the same toast behavior without introducing another feedback system.
- The public-site shell already hosts the global toaster, so the remaining work can focus on clipboard reuse and styling cleanup.

## Verification

- `bun test src/lib/ui/action-toast.test.ts src/components/profile/ProfileHeader.test.tsx src/components/cards/non-payment-card-accessibility.test.tsx`
- `bun run typecheck`
- `bun run build`

---
*Phase: 13-replace-inline-action-feedback-with-toasts*
*Completed: 2026-03-11*
