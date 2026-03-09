---
phase: 10-configurable-rich-card-description-image-row
plan: 02
subsystem: enrichment-validation
tags: [enrichment, validation, substack, cache, media]
requires:
  - phase: 10-configurable-rich-card-description-image-row
    plan: 01
    provides: row policy and avatar-first runtime semantics
provides:
  - distinct Substack preview-vs-avatar preservation
  - preview validation aligned to actual rich-card rendering
  - live public-cache example with separate image roles
affects: [phase-10-renderer, docs, build-validation]
tech-stack:
  added: []
  patterns: [meaningful-preview-preservation, render-surface-driven-validation]
key-files:
  created: []
  modified:
    - scripts/enrichment/public-augmentation.ts
    - scripts/enrichment/public-augmentation.test.ts
    - scripts/validate-data.ts
    - src/lib/ui/social-profile-metadata.test.ts
    - data/cache/rich-public-cache.json
    - .planning/phases/10-configurable-rich-card-description-image-row/10-02-PLAN.md
key-decisions:
  - "Substack preserves a second image only when the canonical profile exposes a real social image distinct from the avatar; generic subscribe-card art remains suppressed."
  - "Preview-image validation now keys off actual rendered preview surfaces (`leadKind=preview` or `showDescriptionImageRow`) instead of every rich link blindly."
patterns-established:
  - "Source-specific parsers decide whether a second image is meaningful before the UI consumes it."
  - "Validation follows runtime layout requirements rather than stale assumptions about every rich card needing preview media."
requirements-completed: [UI-11, QUAL-06]
duration: 22min
completed: 2026-03-09
---

# Phase 10 Plan 02 Summary

**Preserved real Substack social-image separation and taught validation to require preview media only when the rich-card runtime actually renders it**

## Performance

- **Duration:** 22 min
- **Completed:** 2026-03-09T03:16:58Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Updated the Substack public augmentation path so a distinct canonical `og:image` survives alongside the profile avatar, while the generic subscribe-card placeholder is still ignored.
- Changed `validate:data` to require preview media only for cards that render a preview lead or the new description-image row, instead of every rich link.
- Refreshed the committed Substack public-cache example to prove the new distinct-media path with a real canonical profile image pair.
- Verified the live enrichment path with `bun run enrich:rich:strict`, `bun run images:sync`, and `bun run validate:data`.

## Task Commits

No atomic task commits were created during local phase execution.

## Files Created/Modified

- `scripts/enrichment/public-augmentation.ts` - preserves distinct Substack preview media when it is real and useful
- `scripts/enrichment/public-augmentation.test.ts` - covers placeholder suppression and distinct social-image preservation
- `scripts/validate-data.ts` - validates preview images only for cards that actually render preview media
- `src/lib/ui/social-profile-metadata.test.ts` - proves the runtime sees distinct Substack preview/profile images
- `data/cache/rich-public-cache.json` - committed Substack public-cache example now uses a distinct social image
- `.planning/phases/10-configurable-rich-card-description-image-row/10-02-PLAN.md` - corrected the verification command path after execution revealed `public:rich:sync` does not target Substack

## Decisions Made

- Kept generic subscribe-card art out of the new row because it does not meaningfully represent the underlying profile content.
- Chose runtime-driven preview validation instead of weakening validation wholesale, so non-profile rich cards still keep their existing preview guarantees.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected the Substack verification command in the plan**
- **Found during:** Task 2 (live verification path check)
- **Issue:** `public:rich:sync` does not currently support Substack targets, so the original plan referenced a nonexistent verification path.
- **Fix:** Updated `10-02-PLAN.md` to verify Substack through `enrich:rich:strict` plus `validate:data`, while retaining `scripts/public-rich-sync.test.ts` coverage for the sync-path discipline.
- **Files modified:** `.planning/phases/10-configurable-rich-card-description-image-row/10-02-PLAN.md`
- **Verification:** `bun test scripts/public-rich-sync.test.ts`, `bun run enrich:rich:strict`, and `bun run validate:data` passed.

## Issues Encountered

- Live enrichment refreshed an unrelated Instagram cache URL during verification. That churn was intentionally reverted so the tracked cache diff stayed focused on the Substack media split.

## User Setup Required

None.

## Next Phase Readiness

- The renderer now has a real, committed Substack example with distinct preview and profile images to consume.
- Validation and build flows are aligned with the new row before the JSX/CSS changes land.

---
*Phase: 10-configurable-rich-card-description-image-row*
*Completed: 2026-03-09*
