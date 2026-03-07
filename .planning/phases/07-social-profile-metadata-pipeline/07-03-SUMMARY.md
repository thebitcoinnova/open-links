---
phase: 07-social-profile-metadata-pipeline
plan: 03
subsystem: runtime-social-profile-plumbing
tags: [runtime, images, card-view-model, social-profile, localization]
requires:
  - phase: 07-social-profile-metadata-pipeline
    plan: 01
    provides: stable profile metadata contract and merge semantics
  - phase: 07-social-profile-metadata-pipeline
    plan: 02
    provides: persisted Instagram and YouTube profile metadata in authenticated/generated outputs
affects: [phase-08-card-ui]
tech-stack:
  added: []
  patterns: [separate-avatar-localization, presentation-neutral-social-profile-helper, backward-compatible-view-model-expansion]
key-files:
  created:
    - src/lib/ui/social-profile-metadata.ts
    - src/lib/ui/social-profile-metadata.test.ts
  modified:
    - scripts/sync-content-images.ts
    - src/lib/content/load-content.ts
    - src/lib/ui/rich-card-policy.ts
key-decisions:
  - "Profile-avatar and preview-image handling stay separate through image sync and runtime localization."
  - "Phase 7 stops at view-model plumbing; the visible card redesign is deferred to Phase 8."
patterns-established:
  - "Card-facing consumers receive a normalized `socialProfile` object rather than platform-specific branching at render time."
  - "Unresolved remote profile-avatar paths are omitted safely instead of leaking unexpected raw URLs into the rendered site."
requirements-completed: [DATA-07, DATA-09]
duration: 7min
completed: 2026-03-07
---

# Phase 7 Plan 03 Summary

**Delivered runtime localization and card-facing metadata plumbing for social profile fields without changing the current card markup**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-07T08:46:00-06:00
- **Completed:** 2026-03-07T08:53:00-06:00
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Extended content-image sync so `profileImage` candidates are tracked and materialized independently from preview-image candidates.
- Updated runtime metadata localization to resolve both preview images and profile avatars while preserving manual override behavior.
- Added a presentation-neutral `socialProfile` helper that normalizes handle, avatar, preview image, and ordered audience metrics for future card consumers.
- Surfaced the normalized `socialProfile` object through the rich-card view model while keeping existing properties such as `handleDisplay` and `imageUrl` for backward compatibility.
- Added focused tests covering mixed manual/generated profile metadata normalization behavior.

## Task Commits

No atomic task commits were created during local phase execution.

## Files Created/Modified

- `scripts/sync-content-images.ts` - separate profile-avatar candidate collection and deterministic materialization
- `src/lib/content/load-content.ts` - runtime localization for `profileImage` plus shared asset-resolution helper
- `src/lib/ui/social-profile-metadata.ts` - normalized social profile metadata for card-facing consumers
- `src/lib/ui/social-profile-metadata.test.ts` - coverage for metric ordering, handle formatting, and image selection
- `src/lib/ui/rich-card-policy.ts` - backward-compatible view-model expansion with `socialProfile`

## Decisions Made

- Kept the helper presentation-neutral so simple and rich cards can share one normalized metadata layer in Phase 8.
- Avoided any markup redesign in this phase to keep Phase 7 strictly about data plumbing and regression-safe runtime behavior.

## Deviations from Plan

None.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- Phase 8 can consume `socialProfile.profileImageUrl`, `socialProfile.handleDisplay`, and `socialProfile.metrics` directly when redesigning simple and rich cards.
- Existing cards continue to render when profile metadata is absent, so the UI phase can focus on presentation rather than fallback plumbing.

---
*Phase: 07-social-profile-metadata-pipeline*
*Completed: 2026-03-07*
