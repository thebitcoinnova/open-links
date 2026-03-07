---
phase: 08-social-profile-card-ui-refresh
plan: 01
subsystem: rich-card-ui
tags: [ui, rich-cards, social-profile, metrics]
requires:
  - phase: 07-social-profile-metadata-pipeline
    provides: normalized social profile metadata and avatar/count persistence
affects: [phase-08-simple-cards, phase-09-docs-regression]
tech-stack:
  added: []
  patterns: [avatar-first-rich-header, compact-metric-display, duplicate-preview-suppression]
key-files:
  created: []
  modified:
    - src/components/cards/RichLinkCard.tsx
    - src/lib/ui/rich-card-policy.ts
    - src/lib/ui/social-profile-metadata.ts
    - src/lib/ui/social-profile-metadata.test.ts
    - src/styles/base.css
    - src/styles/responsive.css
key-decisions:
  - "Rich cards only use the full profile-header treatment when profile metadata exists or the link resolves as a supported profile surface."
  - "When profile avatar and preview image resolve to the same asset, the preview media block is suppressed to avoid duplicate imagery."
patterns-established:
  - "Audience metrics are formatted once in the shared social-profile helper and consumed as display-ready text in card markup."
  - "Profile-style rich-card descriptions can fall back to curated link copy when fetched profile descriptions redundantly repeat counts."
requirements-completed: [UI-07, UI-09]
duration: 18min
completed: 2026-03-07
---

# Phase 8 Plan 01 Summary

**Delivered the rich-card half of the social profile refresh with avatar-first identity chrome and shared metric formatting**

## Performance

- **Duration:** 18 min
- **Completed:** 2026-03-07T13:37:19-0600
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Extended the shared social-profile presentation helper with platform detection, display-name cleanup, compact metric text, and distinct avatar-versus-preview awareness.
- Updated the rich-card view model so profile-aware cards can render a dedicated header, suppress duplicate preview media, and reuse shared source-label/description logic.
- Rebuilt `RichLinkCard.tsx` around a profile-style header with circular avatar, handle, inline metrics, description, and source branding in the new order.
- Reworked rich-card CSS for the new vertical hierarchy and mobile metric wrapping without reintroducing broken fallback placeholders.

## Task Commits

No atomic task commits were created during local phase execution.

## Files Created/Modified

- `src/lib/ui/social-profile-metadata.ts` - shared profile presentation fields and compact metric display text
- `src/lib/ui/social-profile-metadata.test.ts` - regression coverage for display names, compact counts, and raw-text fallbacks
- `src/lib/ui/rich-card-policy.ts` - profile-aware rich-card title/description/source/preview decisions
- `src/components/cards/RichLinkCard.tsx` - avatar-first rich-card markup and richer accessibility metadata
- `src/styles/base.css` - rich-card avatar/header/media styling
- `src/styles/responsive.css` - mobile sizing and inline/full-width preview handling for the new rich cards

## Decisions Made

- Kept non-profile rich cards out of the full avatar-header treatment so Phase 8 could stay focused on supported profile surfaces while still preserving a unified shell.
- Used shared description sanitization instead of component-specific string patching so simple cards can inherit the same profile-description behavior later in the phase.

## Deviations from Plan

None.

## Issues Encountered

- Instagram’s fetched description repeated follower counts already rendered in the header, so the view-model layer now falls back to curated link copy when profile descriptions obviously duplicate audience metrics.

## User Setup Required

None.

## Next Phase Readiness

- Simple cards can reuse the same `socialProfile` display surface and source-label logic without reformatting metrics in JSX.
- The final polish wave can focus on fallback cohesion, accessibility, and broader verification rather than revisiting rich-card structure.

---
*Phase: 08-social-profile-card-ui-refresh*
*Completed: 2026-03-07*
