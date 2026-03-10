# Phase 11: Historical Follower Tracking + Growth Charts - Research

**Researched:** 2026-03-10
**Domain:** append-only public follower-history artifacts, nightly GitHub Actions publication, and SolidJS-friendly chart rendering
**Confidence:** HIGH

## User Constraints

### Locked Decisions
- Nightly history capture must append a row on every run, even when a count does not change.
- Observed decreases must remain visible in history exactly as captured.
- History stays append-only by default; maintainers may manually repair CSVs later if they choose.
- History rows should keep audit-friendly identifiers such as link id, platform, handle, and canonical URL when sensible.
- CSV history should be split by platform instead of stored in one shared wide table.
- CSV histories should be publicly accessible.
- Card-level analytics entry should exist for links with history data and should open a platform-specific graph, likely in a modal.
- A dedicated all-platform analytics page should be reachable from the profile header via a new button immediately left of `Share`.
- The analytics experience should serve both visitors and the site owner.
- Initial presentation should stay minimal, not dashboard-heavy.
- Cross-platform charts should stay mostly separate.
- A combined chart is acceptable only if the charting approach can support independent y-axes per platform.
- Single-platform views should support a raw-count versus growth-rate toggle.
- Default time window should be 30 days with sleek switchable range controls.
- Missing days should render as visually connected lines instead of gaps.

### Claude's Discretion
- Whether the all-platform page also offers a raw-count versus percentage-growth comparison mode.
- Exact interaction contract between modal analytics and the dedicated analytics page.
- Exact CSV file naming convention within the per-platform storage approach.

### Deferred Ideas (Out of Scope)
- Broader analytics beyond audience-history graphs.
- Live runtime fetching from platform APIs.
- A generalized multi-page router overhaul for the public app.

## Summary

Phase 11 should follow the existing static-site model instead of introducing a live analytics backend:

1. Write append-only audience-history CSV artifacts into `public/` so they deploy as public static files.
2. Add a dedicated nightly workflow that captures counts, appends rows, commits generated CSV artifacts, and handles deployment explicitly.
3. Render analytics with **Apache ECharts** through a thin local Solid adapter component, not a third-party wrapper.

That recommendation is driven by three constraints from the phase context:

- The public app currently has **no router** and only one route entrypoint, so the analytics surface should be a progressive enhancement of the existing page shell rather than a broad navigation rewrite.
- The repo already has a **GitHub Actions direct-push-to-main** pattern in `.github/workflows/readme-screenshot-sync.yml`, but GitHub documents that workflow runs triggered by `GITHUB_TOKEN` do **not** trigger further workflows except `workflow_dispatch` and `repository_dispatch`. That means a nightly CSV-commit workflow cannot rely on the existing `push -> CI -> workflow_run -> Deploy Pages` chain unless it uses a PAT/GitHub App token or performs deploy work itself.
- Your combined-chart rule requires **independent y-axes per platform** when platforms share one chart. ECharts supports multiple y-axes directly; Unovis is more attractive for Solid-native composition but is weaker for this specific requirement.

Primary recommendation:

- **Charts:** use `echarts` with a local Solid bridge component.
- **Artifacts:** store public CSV history under `public/history/followers/`.
- **Workflow:** either push with a token that is allowed to trigger downstream workflows, or keep build/deploy responsibility inside the nightly workflow itself.
- **UI state:** use URL query/hash state plus existing modal patterns instead of adding a public-app router by default.

## Standard Stack

### Core

| Tool/Surface | Purpose | Why It Fits |
|--------------|---------|-------------|
| `echarts` | Primary chart engine for time-series analytics | Official support for multiple y-axes, time axes, and selectable Canvas/SVG renderers matches the combined-chart constraint best. |
| Solid local wrapper component | Lifecycle bridge for chart mount/update/dispose | No official ECharts Solid integration surfaced in primary-source research; a small local bridge avoids depending on a thin community wrapper. |
| Static CSV artifacts under `public/history/followers/` | Publicly deployable append-only history | Matches the repo's existing static-asset model under `public/` and keeps CSVs directly accessible after Pages deploy. |
| Existing GitHub Actions workflows | Nightly capture + commit/deploy orchestration | The repo already uses action-driven direct pushes to `main`, so the new workflow can follow familiar conventions while correcting for deploy-chain caveats. |

### Supporting

| Tool/Surface | Purpose | When to Use |
|--------------|---------|-------------|
| `@unovis/solid` | Secondary option if Phase 11 intentionally avoids combined multi-axis charts | Official Unovis docs position the library as framework-aware, including Solid, and it is attractive for separate per-platform charts with a lighter declarative feel. |
| `chart.js` | Fallback if the team strongly prefers canvas-only charts and a smaller conceptual API than ECharts | Official docs cover time scales, multi-axis charts, and `spanGaps`, but the integration surface is more manual for this phase's comparison needs. |
| Existing `dialog` pattern from `PaymentQrFullscreen.tsx` | Modal analytics viewer for card-level entry | Reuses an established focus-trap/backdrop approach already in the public app. |
| Existing `public:rich:sync` and cache-writing script style | Snapshot-writer script conventions | Phase 11 should mirror the repo's current script style for generated artifacts rather than inventing a second scripting posture. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `echarts` + local Solid wrapper | `@unovis/solid` | Cleaner Solid ergonomics, but weaker evidence for multi-y-axis combined charts. |
| `echarts` + local Solid wrapper | `chart.js` | Stable ecosystem and official time/multi-axis support, but more adapter/plugin wiring for time-series polish. |
| General-purpose chart library | `lightweight-charts` | Beautiful time-series rendering, but the official docs focus on left/right price scales, which is a worse fit for many-platform independent-axis comparison. |
| Public CSV artifacts | Hidden generated JSON only | Simpler runtime parsing, but fails the explicit product requirement that CSV histories stay publicly accessible. |

## Architecture Patterns

### Pattern 1: Public Artifact First, UI Fetch Second

Keep follower history as public static assets:

```text
public/
  history/
    followers/
      github.csv
      instagram.csv
      x.csv
```

The public app then `fetch`es those files on demand instead of bundling them into `data/*.json`. This preserves direct public access to the CSVs and avoids turning append-only history into a schema-validated content-editing concern.

### Pattern 2: One Nightly Workflow Owns Snapshot Consistency

The nightly workflow should:

1. run the existing metadata sync/capture path needed to obtain current counts,
2. append CSV rows,
3. commit generated history artifacts,
4. either deploy Pages itself or push with a token that can trigger the existing CI/deploy chain.

Do not assume that a `GITHUB_TOKEN` push back to `main` will cause downstream `push` workflows to run.

### Pattern 3: Query/Hash-Driven Analytics State over Router Expansion

The public app currently renders a single `RouteIndex` component from `src/main.tsx` and `src/routes/index.tsx`. For Phase 11, prefer:

- `?analytics=all` or `#analytics` for the full analytics view
- `?analytics=github` or modal state for card-level drill-down

This keeps analytics state shareable without forcing a router migration into a public app that does not currently need one.

### Pattern 4: Separate Charts by Default, Combined Chart as Conditional Enhancement

Render one platform chart per section by default. Treat the combined chart as optional and only render it when the selected library and layout can provide clearly readable independent y-axes. This matches the locked user decision and avoids misleading compression of smaller platforms.

### Pattern 5: Shared Data Loader for Modal and Full Page

Use one history-loading and transformation layer for both the card modal and the full analytics page:

- CSV fetch
- typed row normalization
- time-window filtering
- raw-count versus growth-rate transformation

Do not duplicate chart-prep logic across modal/page entry points.

## Current Code Seams

### Public-App Navigation Surface

- `src/main.tsx` mounts a single `RouteIndex` component.
- `src/routes/index.tsx` renders the whole public app with no router.
- `src/components/profile/ProfileHeader.tsx` already owns the `Share` button, which is the correct insertion point for the all-platform analytics button.

### Existing Modal Pattern

- `src/components/payments/PaymentQrFullscreen.tsx` already implements a focused modal flow with backdrop handling, ESC close, focus trapping, and mobile sizing.
- Phase 11 should reuse this pattern for the card-level analytics modal rather than introducing a new modal dependency.

### Static Asset + Data Loading Split

- `src/lib/content/load-content.ts` bundles `data/*.json` and `data/generated/*.json`.
- Existing public binary assets already live under `public/`, including cached authenticated images in `public/cache/rich-authenticated/`.
- Phase 11 history CSVs fit naturally under `public/` because they need to remain directly accessible after deploy.

### Current Audience Data Source

- Supported social-profile metrics already flow through `followersCount`, `followingCount`, and `subscribersCount` fields.
- Existing sync and enrichment scripts already write generated artifacts and caches in a deterministic file-based style.
- Phase 11 should piggyback on those current count sources rather than inventing a second count-acquisition mechanism.

### Workflow/Deploy Constraint

- `.github/workflows/readme-screenshot-sync.yml` demonstrates that this repo already accepts GitHub Actions direct commits to `main`.
- `.github/workflows/deploy-pages.yml` depends on a successful `CI` workflow on `main`.
- If the nightly history workflow commits with `GITHUB_TOKEN`, GitHub's documented event rules mean that commit will not automatically fan out into the existing CI/deploy workflow chain.

## Chart Library Comparison

### Recommended: Apache ECharts

**Why it fits this phase**

- Official docs cover **multiple x- and y-axes**, including examples with two y-axes and offset positioning.
- Official docs support both **Canvas and SVG** renderers, which is useful if the app needs sharper SVG output for small line charts or lower memory use for dense views.
- Official docs support **tree-shakable modular imports**, which is helpful in a bundle-sensitive static site.

**Why it beats the alternatives here**

- Best match for the optional combined chart with independent y-axes.
- Rich enough for the full-page all-platform surface without forcing a dashboard library.
- Works fine behind a small imperative Solid wrapper component.

**Tradeoff**

- More verbose config API than Solid-native declarative chart libraries.

### Secondary: Unovis

**Why it is attractive**

- Official docs present Unovis as a TypeScript-first library with framework integrations, including Solid.
- The docs emphasize CSS-variable theming, modular components, and clean XY-chart composition.

**Why it is not the primary recommendation**

- The official docs and examples strongly center on one `xAxis` and one `yAxis` configuration in `XYContainer`, and I did not find primary-source documentation for the independent multi-y-axis combined-chart use case you explicitly care about.
- That makes it a good fit only if Phase 11 leans into separate charts and treats combined comparison as optional or dropped.

### Viable Fallback: Chart.js

**Why it remains viable**

- Official docs include a time cartesian axis, multi-axis line-chart samples, and `spanGaps` support for visually connecting missing dates.

**Why it is not the first pick**

- More manual setup for time-series polish and comparison behavior.
- Less appealing than ECharts when optional combined multi-axis comparison is a first-class product constraint.

### Not Recommended for This Phase: Lightweight Charts

**Why**

- Official docs are excellent for time-series charts, but the visible-scale model is built around left and right price scales.
- That is a weaker match for an all-platform social-growth page where more than two platform scales may need to coexist clearly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Full chart primitives | Custom SVG/canvas axes, tooltips, legends, and hover logic | `echarts` (primary) or a documented chart library | This phase needs chart correctness and interaction polish, not bespoke chart infrastructure. |
| Cross-platform scaling heuristics | One homemade shared-axis normalization trick | Separate charts by default, multi-y-axis only through library support | Prevents misleading graphs for small-vs-large platforms. |
| Modal system for analytics | New modal dependency or inconsistent ad-hoc overlay | Existing `dialog` pattern from `PaymentQrFullscreen.tsx` | Keeps accessibility and interaction behavior consistent with current app patterns. |
| Workflow chaining assumptions | Assuming a bot commit to `main` will trigger existing workflows | Explicit deploy in the nightly workflow or a token strategy that can trigger downstream workflows | GitHub documents the `GITHUB_TOKEN` recursion limitation. |
| Directory discovery on Pages | Runtime directory listing of CSV files | Deterministic paths or a small generated index | Static hosting will not enumerate directories for the app. |

## Common Pitfalls

### Pitfall 1: Nightly CSV commits do not publish to Pages
**What goes wrong:** the action successfully commits CSV files to `main`, but the site never updates because downstream workflows do not trigger.
**Why it happens:** the workflow uses `GITHUB_TOKEN`, and GitHub suppresses most workflow fan-out from those events.
**How to avoid:** either run build/deploy inside the same nightly workflow or push with a token strategy intended to trigger the repo's normal automation.
**Warning signs:** repository history shows fresh CSV commits, but the deployed site and public CSV URLs remain stale.

### Pitfall 2: Public app cannot discover which CSVs exist
**What goes wrong:** the analytics page tries to list a directory at runtime or hardcodes incorrect files.
**Why it happens:** static hosting does not offer a runtime file-index API.
**How to avoid:** use deterministic file naming based on known tracked platforms or emit a tiny generated index manifest.
**Warning signs:** 404s on analytics-page load for deleted or newly added histories.

### Pitfall 3: Combined chart lies about smaller platforms
**What goes wrong:** one shared y-axis flattens low-count platforms into unreadable noise.
**Why it happens:** combined charts were enabled without true independent axes.
**How to avoid:** keep separate charts as the default and guard combined mode behind explicit multi-axis capability.
**Warning signs:** one large platform dominates the chart while other lines appear flat.

### Pitfall 4: Modal and full page drift apart
**What goes wrong:** card-level analytics and the full analytics page compute date ranges, labels, or growth-rate toggles differently.
**Why it happens:** each surface has its own fetch/transform logic.
**How to avoid:** centralize CSV loading and chart-series preparation in one utility layer.
**Warning signs:** the same platform shows different values or labels depending on entry point.

### Pitfall 5: Router work swallows the phase
**What goes wrong:** a simple analytics page turns into a broad navigation rewrite for the public app.
**Why it happens:** the implementation starts by adding generic routing infrastructure instead of solving the narrow analytics need.
**How to avoid:** start with query/hash state and only escalate to a router if planning proves the UX genuinely needs it.
**Warning signs:** planner tasks start centering on navigation infrastructure rather than history capture or chart rendering.

## Code Examples

### Suggested CSV row contract

```ts
interface AudienceHistoryRow {
  observedAt: string;
  linkId: string;
  platform: string;
  handle: string;
  canonicalUrl: string;
  audienceKind: "followers" | "subscribers";
  audienceCount: number;
  audienceCountRaw: string;
  source: "public-cache" | "authenticated-cache" | "manual";
}
```

This keeps one durable schema across per-platform files while preserving audit-trail identifiers.

### Solid wrapper around ECharts

```tsx
import { createEffect, onCleanup, onMount } from "solid-js";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

export function AudienceChart(props: { option: echarts.EChartsOption }) {
  let element!: HTMLDivElement;
  let chart: echarts.ECharts | undefined;

  onMount(() => {
    chart = echarts.init(element);
    chart.setOption(props.option);
  });

  createEffect(() => {
    chart?.setOption(props.option, true);
  });

  onCleanup(() => chart?.dispose());

  return <div ref={element} style={{ height: "320px" }} />;
}
```

### Query-param driven analytics state

```ts
const params = new URLSearchParams(window.location.search);
const analyticsView = params.get("analytics");

// analytics=all -> full analytics page
// analytics=github -> open or seed a platform-specific view
```

### Nightly workflow decision rule

```yaml
# If using GITHUB_TOKEN:
#   run snapshot + commit + build + deploy in this workflow
#
# If using a PAT/GitHub App token:
#   commit and push to main, then rely on the existing CI/deploy chain
```

## Open Questions

1. **Per-platform file naming**
   - What we know: history should be split by platform and stay easy to add/remove.
   - What is still open: whether the file path should be `platform.csv` or `platform/<link-id>.csv`.
   - Recommendation: if the site is expected to stay one-profile-per-platform, `platform.csv` is fine; if multiple same-platform profiles are likely, use `platform/<link-id>.csv` now.

2. **All-platform comparison mode**
   - What we know: combined mode is acceptable only with independent y-axes.
   - What is still open: whether to expose a page-level raw-vs-percentage comparison toggle in addition to the single-platform raw-vs-growth-rate toggle.
   - Recommendation: keep raw-count charts as the default, then add a percentage-growth comparison toggle only if the final library/UX feels clear in testing.

3. **CSV discovery**
   - What we know: the public app needs deterministic history fetches.
   - What is still open: whether to infer candidate CSVs from known platforms/links or ship a generated history index manifest.
   - Recommendation: use deterministic paths first; add an index manifest only if 404 management or future flexibility becomes awkward during planning.

## Sources

### Primary (HIGH confidence)
- `.planning/phases/11-historical-follower-tracking-growth-charts/11-CONTEXT.md`
- `.planning/ROADMAP.md`
- [package.json](/Users/peterryszkiewicz/.codex/worktrees/1eff/open-links/package.json)
- [src/main.tsx](/Users/peterryszkiewicz/.codex/worktrees/1eff/open-links/src/main.tsx)
- [src/routes/index.tsx](/Users/peterryszkiewicz/.codex/worktrees/1eff/open-links/src/routes/index.tsx)
- [src/components/profile/ProfileHeader.tsx](/Users/peterryszkiewicz/.codex/worktrees/1eff/open-links/src/components/profile/ProfileHeader.tsx)
- [src/components/payments/PaymentQrFullscreen.tsx](/Users/peterryszkiewicz/.codex/worktrees/1eff/open-links/src/components/payments/PaymentQrFullscreen.tsx)
- [src/lib/content/load-content.ts](/Users/peterryszkiewicz/.codex/worktrees/1eff/open-links/src/lib/content/load-content.ts)
- [.github/workflows/deploy-pages.yml](/Users/peterryszkiewicz/.codex/worktrees/1eff/open-links/.github/workflows/deploy-pages.yml)
- [.github/workflows/readme-screenshot-sync.yml](/Users/peterryszkiewicz/.codex/worktrees/1eff/open-links/.github/workflows/readme-screenshot-sync.yml)
- [Apache ECharts handbook: Axis](https://echarts.apache.org/handbook/en/concepts/axis/)
- [Apache ECharts handbook: Best Practices, Canvas vs. SVG](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/)
- [Apache ECharts handbook: Import ECharts](https://echarts.apache.org/handbook/en/basics/import/)
- [Unovis docs: Introduction](https://unovis.dev/docs/introduction)
- [Unovis docs: Line](https://unovis.dev/docs/auxiliary/Line)
- [Chart.js docs: Time Cartesian Axis](https://www.chartjs.org/docs/latest/axes/cartesian/time.html)
- [Chart.js sample: Multi Axis Line Chart](https://www.chartjs.org/docs/latest/samples/line/multi-axis.html)
- [Chart.js sample: Line segment styling / `spanGaps`](https://www.chartjs.org/docs/latest/samples/line/segments.html)
- [Lightweight Charts docs: Price Scale](https://tradingview.github.io/lightweight-charts/docs/price-scale)
- [GitHub Actions docs: Events that trigger workflows](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows)
- [GitHub Actions docs: Schedule event](https://docs.github.com/en/actions/reference/events-that-trigger-workflows#schedule)

### Secondary (MEDIUM confidence)
- Existing public audience-cache and enrichment scripts under `scripts/`
- Existing public asset patterns under `public/cache/`

## Metadata

**Research scope:** public artifact strategy, nightly workflow behavior, Solid-compatible charting choices, app-surface integration constraints

**Confidence breakdown:**
- Workflow/deploy caveat: HIGH
- Local integration seams: HIGH
- ECharts recommendation: HIGH
- Unovis as secondary path: MEDIUM
- File naming and discovery strategy: MEDIUM

**Research date:** 2026-03-10
**Valid until:** 2026-04-10

---

*Phase: 11-historical-follower-tracking-growth-charts*
*Research completed: 2026-03-10*
*Ready for planning: yes*
