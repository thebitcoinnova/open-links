---
phase: 10-configurable-rich-card-description-image-row
plan: 01
subsystem: rich-card-policy
tags: [ui, rich-cards, config, policy, overrides]
requires:
  - phase: 08-social-profile-card-ui-refresh
    provides: shared avatar-first rich-card shell and social-profile view model
provides:
  - site-level description-image-row config surface
  - per-site rich-card row override resolution
  - avatar-first profile-card policy for distinct preview media
affects: [phase-10-media-capture, phase-10-renderer, docs, validation]
tech-stack:
  added: []
  patterns: [global-plus-site-policy-resolution, avatar-first-profile-rich-cards, shared-view-model-row-state]
key-files:
  created: []
  modified:
    - schema/site.schema.json
    - src/lib/content/load-content.ts
    - src/lib/ui/rich-card-policy.ts
    - src/lib/ui/rich-card-description-sourcing.test.ts
    - src/components/cards/social-profile-card-rendering.test.tsx
key-decisions:
  - "Rich profile cards with distinct preview media stay avatar-led; the preview image is resolved as a second rendered slot instead of competing for the lead slot."
  - "Exact host overrides take precedence over generic site-id overrides so one custom domain can opt out without disabling an entire platform."
patterns-established:
  - "Description-image-row visibility is resolved once in the shared rich-card policy layer and consumed through view-model fields."
  - "The extra row is additive-only: no distinct preview image means no row, even when the policy default is auto."
requirements-completed: [UI-11]
duration: 20min
completed: 2026-03-09
---

# Phase 10 Plan 01 Summary

**Added the shared config and view-model policy that turns distinct rich-card preview media into an optional second row instead of a preview-led card layout**

## Performance

- **Duration:** 20 min
- **Completed:** 2026-03-09T03:16:58Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Added `site.ui.richCards.descriptionImageRow` to the site schema and runtime type surface with a global default plus per-site override map.
- Updated the rich-card policy layer so profile cards remain avatar-led even when `image` and `profileImage` are distinct, and exposed `showDescriptionImageRow` plus `descriptionImageUrl` in the shared view model.
- Added focused tests covering the default `auto` behavior, global `off`, host-level overrides, and site-level overrides without touching the JSX renderer yet.

## Task Commits

No atomic task commits were created during local phase execution.

## Files Created/Modified

- `schema/site.schema.json` - adds the `descriptionImageRow` config contract
- `src/lib/content/load-content.ts` - exposes the new config types to the runtime
- `src/lib/ui/rich-card-policy.ts` - resolves row visibility, override precedence, and avatar-first lead behavior
- `src/lib/ui/rich-card-description-sourcing.test.ts` - verifies global and per-site policy precedence
- `src/components/cards/social-profile-card-rendering.test.tsx` - verifies row eligibility at the rich-card view-model layer

## Decisions Made

- Kept the config surface under `site.ui.richCards` instead of reusing the deprecated mobile image-layout setting because the new behavior is richer than a breakpoint-only media toggle.
- Let exact host overrides beat generic known-site ids so one custom-domain profile can disable the row without affecting all links on that platform.

## Deviations from Plan

- Adjusted override precedence to favor exact hosts over generic site ids. This preserves the requested per-site flexibility for custom domains without weakening the global platform override path.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- The parser/validation wave can now align actual preview/profile media data to the new row state instead of changing component behavior ad hoc.
- The shared card shell has the policy fields it needs for the renderer wave.

---
*Phase: 10-configurable-rich-card-description-image-row*
*Completed: 2026-03-09*
