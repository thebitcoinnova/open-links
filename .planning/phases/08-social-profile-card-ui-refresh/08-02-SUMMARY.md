---
phase: 08-social-profile-card-ui-refresh
plan: 02
subsystem: simple-card-ui
tags: [ui, simple-cards, social-profile, source-context]
requires:
  - phase: 08-social-profile-card-ui-refresh
    plan: 01
    provides: shared profile presentation data and rich-card description/source helpers
affects: [phase-08-polish, phase-09-docs-regression]
tech-stack:
  added: []
  patterns: [avatar-capable-leading-slot, two-line-simple-header, wrapped-source-context]
key-files:
  created:
    - src/components/cards/social-profile-card-rendering.test.tsx
  modified:
    - src/components/cards/SimpleLinkCard.tsx
    - src/lib/ui/rich-card-policy.ts
    - src/routes/index.tsx
    - src/styles/base.css
    - src/styles/responsive.css
key-decisions:
  - "Simple cards keep the existing leading slot, but supported profile links turn that slot into a circular avatar or empty avatar shell."
  - "Source branding moves into a compact trailing row for profile-aware simple cards instead of competing with the new leading avatar slot."
patterns-established:
  - "Simple and rich cards share source-label resolution and profile-description fallback logic."
  - "Profile-aware simple cards wrap handle, metrics, and source context instead of truncating them away."
requirements-completed: [UI-08, UI-09]
duration: 12min
completed: 2026-03-07
---

# Phase 8 Plan 02 Summary

**Delivered the simple-card profile treatment with avatar reuse, wrapped metrics, and inline source context**

## Performance

- **Duration:** 12 min
- **Completed:** 2026-03-07T13:37:19-0600
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Rebuilt `SimpleLinkCard.tsx` so the left-hand slot can show a circular profile avatar (or empty avatar shell) while still falling back to `LinkSiteIcon` for non-profile links.
- Added a two-line header flow for profile-aware simple cards, with wrapped handle plus audience metrics on the second line instead of the old single-handle-only footer.
- Moved source context into a compact trailing row with a smaller inline brand icon so profile cards keep recognizable platform branding after the leading slot changes.
- Passed the site object into simple cards so source-label visibility follows the same policy path as rich cards.
- Added focused regression coverage around the shared profile/source presentation state needed for both simple and rich card rendering.

## Task Commits

No atomic task commits were created during local phase execution.

## Files Created/Modified

- `src/components/cards/SimpleLinkCard.tsx` - profile-aware simple-card structure, accessibility copy, and source row
- `src/routes/index.tsx` - site prop plumbing for simple-card source policy resolution
- `src/lib/ui/rich-card-policy.ts` - shared source-label and description helpers reused by simple cards
- `src/styles/base.css` - avatar slot, wrapped simple-card header, metric, and source-row styling
- `src/styles/responsive.css` - compact breakpoint rules for profile-aware simple cards
- `src/components/cards/social-profile-card-rendering.test.tsx` - shared view-model/source regression coverage for simple-card profile rendering inputs

## Decisions Made

- Kept plain `simple` links quieter by only showing the extra source row for profile-aware cards or rich links rendered through the simple-card path.
- Reused the shared description sanitization from the rich-card layer so future render-mode toggles do not produce mismatched copy between card variants.

## Deviations from Plan

None.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- Both card variants now read from the same social-profile presentation rules.
- The final polish pass can verify that partial-profile and non-profile cards still feel intentional across breakpoints.

---
*Phase: 08-social-profile-card-ui-refresh*
*Completed: 2026-03-07*
