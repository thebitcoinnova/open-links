# Phase 3: Rich Cards + Content Enrichment - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

## Phase Boundary

Support per-link `simple`/`rich` configuration and deliver resilient rich-card rendering with optional build-time metadata enrichment. This phase clarifies rich-card behavior and fallback policy; it does not add new platform capabilities beyond card presentation and enrichment reliability.

## Implementation Decisions

### Rich Card Content Contract
- Default rich-card content should include title, description, image, and source/domain labeling.
- A link qualifies as rich with existing core fields only (`id`, `label`, `url`, `type=rich`); preview metadata remains optional.
- Platform/domain branding behavior should always show platform icon; domain/source label should be configurable.
- When image metadata is available, default treatment is a prominent thumbnail/cover area.

### Fallback Behavior Rules
- If metadata is missing entirely, render a rich-card shell using link label + URL-derived domain with a no-image fallback state.
- If metadata is partial, render available preview fields and omit missing fields without hard failure.
- If enrichment/fetch errors occur, fail build in strict mode and warn/fallback in non-strict mode.
- Diagnostics should be explicit: structured per-link warnings plus a generated fallback/enrichment report artifact.

### Enrichment Behavior & Control
- Phase 3 enrichment model is build-time only.
- Default policy: attempt enrichment for rich links unless a link explicitly opts out.
- Timeout/retry baseline should be moderate (timeout plus one retry).
- Caching is disabled in this phase; enrichment should fetch fresh data each build.

### Mixed Presentation Rules
- In mixed simple/rich sections, preserve configured order exactly; no auto-reordering by card type.
- Rich card visual prominence should be configurable via layout/density preferences rather than fixed sizing.
- Provide a global switch to render rich links as simple cards while preserving `type=rich` data.
- Rich cards should follow the same link target/open behavior policy used by simple cards.

### Claude's Discretion
- Exact configuration key names and schema shape for rich/fallback/enrichment controls.
- Exact timeout values and warning payload structure, as long as they honor moderate retry and strict-mode semantics.
- Exact visual implementation details of the rich card shell/placeholder within established Phase 2 design patterns.

## Specific Ideas

- Rich cards should remain useful even when metadata is sparse; fallback should preserve card utility rather than collapsing to broken states.
- Enrichment diagnostics should be actionable for developers and CI logs, not generic warnings.
- A global rich-as-simple rendering switch should support conservative deployments without mutating source data.

## Deferred Ideas

- Runtime or hybrid metadata enrichment modes are out of scope for this phase.
- Enrichment caching/persistence layers are deferred beyond Phase 3.

---

*Phase: 03-rich-cards-content-enrichment*
*Context gathered: 2026-02-22*
