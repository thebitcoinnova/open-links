# Phase 11: Historical Follower Tracking + Growth Charts - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

## Phase Boundary

Persist nightly follower snapshots as publicly accessible, append-only per-platform CSV histories, then expose an in-app analytics surface for viewing follower growth over time. This phase covers history presentation and graph UX for tracked platforms, not broader analytics capabilities beyond follower history.

## Implementation Decisions

### History Semantics

- Append a new history row on every nightly run, even when the follower count does not change.
- Public history should reflect observed decreases exactly as captured; do not smooth or suppress drops.
- Keep the history append-only by default, even when a captured value later appears incorrect.
- Maintainers may manually edit or repair CSV history if they want to correct past rows.
- Include multiple audit-friendly identity columns when sensible, including link id, platform, handle, and canonical URL.

### Growth Surface

- Add a clear stats or analytics icon on cards that have history data available.
- Card-level analytics entry should open that platform's graph, likely in a modal.
- Add a stats or analytics icon button to the left of the `Share` button in the profile header.
- The profile-header analytics button should open a dedicated page showing graphs for all tracked platforms.
- The experience should serve both site visitors and the site owner.
- Start with a minimal, sleek presentation rather than a dashboard-heavy UI.

### Chart Comparison Style

- Keep cross-platform charts mostly separate to avoid clutter.
- Only show a combined all-platform chart if the chosen charting approach can support independent y-axes per platform.
- If independent per-platform y-axes are not available, prefer separate charts rather than a misleading shared-scale combined chart.
- Single-platform views should support a toggle between raw counts and growth rate.

### Time Windows and Gaps

- Default the analytics view to the last 30 days of history.
- Provide simple, sleek controls for switching the displayed time range.
- Recently added platforms do not need special "new" or "limited history" treatment.
- Visually connect missing days in charts instead of rendering gaps between points.
- Time range should be user-switchable rather than fixed to one preset.

### Claude's Discretion

- Decide after chart-library research whether the all-platform page should also offer a raw-count versus percentage-growth comparison mode.
- Refine the exact interaction pattern for the card-level analytics modal and the dedicated analytics page, as long as the minimal visual direction and entry points stay intact.

## Specific Ideas

- A card-level analytics icon should act as a quick jump into that platform's follower history.
- The dedicated analytics page should be reachable from the main profile header through a button placed immediately left of `Share`.
- Combined comparison views should be treated as optional enhancement, not the default path, because platform scales will differ significantly.

## Deferred Ideas

None. Discussion stayed within the Phase 11 boundary.

---

*Phase: 11-historical-follower-tracking-growth-charts*
*Context gathered: 2026-03-10*
