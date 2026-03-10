---
phase: 11-historical-follower-tracking-growth-charts
plan: 01
subsystem: history-contract
tags: [data, csv, validation, analytics]
requires:
  - phase: 10-configurable-rich-card-description-image-row
    provides: current social-profile metadata surface and rich-card validation baseline
affects: [phase-11-automation, phase-11-ui]
tech-stack:
  added: []
  patterns: [append-only-public-history, shared-csv-contract, validator-backed-history-artifacts]
key-files:
  created:
    - src/lib/analytics/follower-history.ts
    - src/lib/analytics/follower-history.test.ts
    - scripts/follower-history/append-history.ts
    - scripts/follower-history/append-history.test.ts
    - scripts/sync-follower-history.ts
  modified:
    - scripts/validate-data.ts
    - scripts/validate-data.test.ts
key-decisions:
  - "Follower history lives in public CSV files under `public/history/followers/` plus a public `index.json` manifest instead of hidden generated JSON."
  - "One shared row contract now backs both the nightly snapshot writer and the runtime analytics parser."
patterns-established:
  - "Append-only history rows preserve observed decreases and keep audit fields such as link id, platform, handle, canonical URL, and source."
  - "`validate:data` now enforces file/index parity and latest-row synchronization for follower-history artifacts."
requirements-completed: []
duration: not-tracked
completed: 2026-03-10
---

# Phase 11 Plan 01 Summary

**Established the append-only public follower-history contract, sync command, and validator support before workflow automation or UI work**

## Performance

- **Completed:** 2026-03-10
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added a shared follower-history contract covering per-platform CSV paths, a public index manifest, primary audience resolution, time-window filtering, and raw-versus-growth series transforms.
- Implemented append-only CSV helpers that preserve a stable header, quote raw audience text correctly, and write human-readable public artifacts under `public/history/followers/`.
- Added `scripts/sync-follower-history.ts` to resolve the current public/auth/manual audience counts from the repo’s existing metadata sources and append one row per eligible platform snapshot.
- Extended `validate:data` so it now catches malformed follower-history CSV files, stale index entries, and unindexed CSV artifacts before they can ship.
- Added focused regression coverage for compact-count parsing, CSV round-tripping, index validation, and append-only behavior.

## Task Commits

No atomic task commits were created during local phase execution.

## Files Created/Modified

- `src/lib/analytics/follower-history.ts` - shared public-history contract, parsing, filtering, and chart-point transforms
- `src/lib/analytics/follower-history.test.ts` - regression coverage for parsing and analytics transforms
- `scripts/follower-history/append-history.ts` - append-only CSV writer and public index manifest helper
- `scripts/follower-history/append-history.test.ts` - file-writing regression coverage
- `scripts/sync-follower-history.ts` - deterministic snapshot command for public history artifacts
- `scripts/validate-data.ts` - follower-history file/index validation
- `scripts/validate-data.test.ts` - validation coverage for matching artifacts and index drift

## Decisions Made

- Chose a public `index.json` manifest in addition to the CSV files so the app can discover history assets without relying on directory listing from static hosting.
- Limited the first history contract to one primary audience series per platform (`followers` or `subscribers`) instead of mixing following counts into the same feature.

## Deviations from Plan

- Parameterized the append-history helpers after execution revealed that test cleanup should never write into or delete the real `public/history/followers/` directory.

## Issues Encountered

- The first version of the append-history tests wrote into the real public history directory and cleaned it up afterward. The helper APIs were adjusted to support temp roots so verification cannot destroy the actual generated artifacts.

## User Setup Required

None.

## Next Phase Readiness

- The nightly workflow can now call one stable sync command instead of inventing its own history format.
- The analytics UI can consume public history through one shared parsing/transform layer instead of duplicating CSV logic in route components.

## Verification

- `bun test src/lib/analytics/follower-history.test.ts scripts/follower-history/append-history.test.ts scripts/validate-data.test.ts`
- `bun scripts/sync-follower-history.ts --dry-run`
- `bun run typecheck`

---
*Phase: 11-historical-follower-tracking-growth-charts*
*Completed: 2026-03-10*
