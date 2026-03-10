---
phase: 11-historical-follower-tracking-growth-charts
plan: 03
subsystem: analytics-ui
tags: [ui, analytics, charts, modal, routing]
requires:
  - phase: 11-historical-follower-tracking-growth-charts
    plan: 01
    provides: runtime follower-history parsing and transformations
  - phase: 11-historical-follower-tracking-growth-charts
    plan: 02
    provides: public history index/csv artifacts and nightly publication flow
affects: [profile-header, card-shell, runtime-bundle]
tech-stack:
  added:
    - echarts@6.0.0
  patterns: [lazy-loaded-analytics-surface, query-driven-page-state, sibling-card-action-button]
key-files:
  created:
    - src/components/analytics/FollowerHistoryChart.tsx
    - src/components/analytics/FollowerHistoryModal.tsx
    - src/components/profile/ProfileHeader.test.tsx
  modified:
    - src/routes/index.tsx
    - src/components/profile/ProfileHeader.tsx
    - src/components/cards/NonPaymentLinkCardShell.tsx
    - src/components/cards/RichLinkCard.tsx
    - src/components/cards/SimpleLinkCard.tsx
    - src/components/cards/non-payment-card-accessibility.test.tsx
    - src/lib/icons/custom-icons.tsx
    - src/styles/base.css
    - src/styles/responsive.css
    - bun.lock
    - package.json
key-decisions:
  - "The all-platform analytics page uses query-string state and reuses the existing single-route public app instead of forcing a public-router migration."
  - "Cards render a sibling analytics button outside the anchor so the new action does not introduce interactive content inside the link."
patterns-established:
  - "ECharts is lazy-loaded so the default links page keeps the charting dependency off the main bundle path."
  - "Profile-header and card-level analytics actions both consume the same public follower-history index."
requirements-completed: []
duration: not-tracked
completed: 2026-03-10
---

# Phase 11 Plan 03 Summary

**Built the minimal follower-growth analytics surface with a dedicated profile-header entry point, card-level modal entry points, and a lazy-loaded ECharts integration**

## Performance

- **Completed:** 2026-03-10
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- Added a lazy-loaded ECharts wrapper component and a shared follower-history modal for platform-specific drill-down views.
- Added a new analytics button immediately left of `Share` in the profile header that toggles a dedicated all-platform follower-analytics page through query-string state.
- Updated the shared non-payment card shell to render a sibling analytics button for cards with published history data, avoiding nested interactive controls inside the anchor.
- Added a minimal analytics page with switchable time ranges, per-platform charts, and card-level modal entry points that reuse the same public history dataset.
- Added focused tests for the new analytics button behavior in both cards and the profile header.
- Split the analytics surface into lazy-loaded chunks so the default links page no longer pulls the full ECharts bundle into the main route chunk.

## Task Commits

No atomic task commits were created during local phase execution.

## Files Created/Modified

- `src/components/analytics/FollowerHistoryChart.tsx` - lazy-loadable ECharts wrapper for raw and growth views
- `src/components/analytics/FollowerHistoryModal.tsx` - focused modal drill-down for a single platform history
- `src/routes/index.tsx` - query-driven analytics page state, public history fetching, lazy component loading, and modal orchestration
- `src/components/profile/ProfileHeader.tsx` - analytics entry point beside the existing share button
- `src/components/cards/NonPaymentLinkCardShell.tsx` - sibling card analytics action button
- `src/components/cards/non-payment-card-accessibility.test.tsx` - regression coverage for the new card action
- `src/components/profile/ProfileHeader.test.tsx` - regression coverage for the header analytics toggle
- `src/styles/base.css` / `src/styles/responsive.css` - analytics page, modal, and action-button styling
- `src/lib/icons/custom-icons.tsx` - analytics icon
- `package.json` / `bun.lock` - ECharts dependency

## Decisions Made

- Shipped separate per-platform charts as the default comparison mode and left combined multi-axis charts as future optional enhancement, matching the locked Phase 11 product decision.
- Used SVG rendering for ECharts and lazy loading from the route to keep the default page lighter while still supporting a richer analytics surface on demand.

## Deviations from Plan

- Added lazy loading for the analytics components after the initial build showed the chart dependency pushing the main bundle past Vite’s warning threshold.

## Issues Encountered

- The first analytics build put ECharts on the main route chunk. Converting the analytics components to `lazy()` imports moved the chart bundle off the default path and brought the main route chunk back down.

## User Setup Required

None.

## Next Phase Readiness

- Phase 9 can now document and harden the analytics surface alongside the earlier social-profile card and metadata work.
- Future analytics refinements can add combined comparisons or richer controls without reopening the basic route/modal/button architecture.

## Verification

- `bun test src/lib/analytics/follower-history.test.ts scripts/follower-history/append-history.test.ts scripts/validate-data.test.ts src/components/cards/non-payment-card-accessibility.test.tsx src/components/profile/ProfileHeader.test.tsx`
- `bun run typecheck`
- `bun run biome:check`
- `bun run validate:data`
- `bun run build`

---
*Phase: 11-historical-follower-tracking-growth-charts*
*Completed: 2026-03-10*
