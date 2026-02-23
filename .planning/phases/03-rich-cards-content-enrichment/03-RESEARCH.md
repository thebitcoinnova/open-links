# Phase 3: Rich Cards + Content Enrichment - Research

**Researched:** 2026-02-22
**Domain:** Rich-card rendering, fallback contracts, build-time metadata enrichment
**Confidence:** HIGH

## User Constraints (from 03-CONTEXT.md)

### Locked Decisions
- Rich cards default to title + description + image + source/domain labeling.
- `type=rich` requires only core link fields (`id`, `label`, `url`, `type`); preview metadata is optional.
- Platform icon should always render on rich cards; domain/source label must be configurable.
- If metadata image exists, default treatment is prominent cover/thumbnail.
- Missing metadata should still render a rich shell (no auto-hide, no auto-simple downgrade by default).
- Partial metadata should render available fields and omit missing ones without hard failure.
- Enrichment/fetch errors should fail strict mode and warn with fallback in non-strict mode.
- Diagnostics must include structured per-link warnings plus generated report artifact.
- Enrichment scope for Phase 3 is build-time only.
- Enrichment should run for rich links by default with per-link opt-out support.
- Timeout strategy should be moderate (timeout + one retry).
- No cache persistence in this phase (fresh enrichment per build).
- Mixed simple/rich ordering must preserve configured order.
- Rich prominence should be configurable via existing layout/density controls.
- Global switch must support rendering rich links as simple without mutating data.
- Rich cards should reuse global link-target behavior policy.

### Claude's Discretion
- Exact key names and object shape for rich/fallback/enrichment config.
- Exact timeout values and warning/report payload format.
- Exact CSS implementation details for rich card shell and placeholder state.

### Deferred Ideas (Out of Scope)
- Runtime/hybrid enrichment models.
- Persistent cache layers for enrichment.

## Summary

Phase 3 should extend the existing Phase 2 componentized route and validation pipeline instead of introducing parallel paths. Rich-card rendering should be treated as a display variant over the same canonical link model, with deterministic fallback behavior when metadata is missing or enrichment fails.

Recommended delivery split:
1. **Data + rendering contract:** Extend schema/types/config, add rich card component, route-level variant selection, fallback shell behavior, and global rich-as-simple switch.
2. **Enrichment pipeline:** Add build-time metadata fetch script with timeout + retry, per-link diagnostics report, and strict-mode integration so CI/developer workflows can choose fail-fast guarantees.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `solid-js` | `1.9.11` | Rich-card presentation variants | Existing UI layer already uses componentized card render paths. |
| `ajv` | `8.x` | Schema validation for extended metadata config | Existing validation contract already structured around AJV schemas. |
| Node `fetch` + `AbortController` | Runtime built-in | Build-time metadata retrieval with timeout | No new heavy dependency required for Phase 3 fetch behavior. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `linkedom` or `cheerio` | optional | HTML metadata extraction (`og:*`, `twitter:*`) | Use only if simple parser logic becomes brittle for metadata parsing. |
| `p-limit` | optional | Concurrency control for enrichment fetches | Use when many rich links cause rate/latency spikes. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Build-time fetch script | Runtime client-side metadata fetch | Runtime fetch increases UX variability and violates locked Phase 3 model. |
| Rich-only rendering hard requirement | Auto-downgrade to simple | Contradicts decision to keep rich shell fallback behavior. |

## Architecture Patterns

### Recommended Project Structure

```text
src/
  components/
    cards/
      SimpleLinkCard.tsx
      RichLinkCard.tsx
  lib/
    content/
      load-content.ts
    ui/
      rich-card-policy.ts
scripts/
  enrich-rich-links.ts
  enrichment/
    fetch-metadata.ts
    parse-metadata.ts
    report.ts
data/
  generated/
    rich-metadata.json (build artifact, regenerated each run)
```

### Pattern 1: Variant Renderer with Shared Link Contract

**What:** Keep a single canonical `OpenLink` model and branch rendering on resolved card variant at route/component boundary.
**When to use:** Always for simple/rich coexistence and global rich-as-simple override.

### Pattern 2: Fallback-First Rich Card ViewModel

**What:** Compute a rich view model with safe defaults (`title`, `description`, `image`, `domain`, `icon`) before rendering.
**When to use:** To enforce resilient rendering when metadata is absent/partial.

### Pattern 3: Enrichment as Deterministic Build Step

**What:** Run enrichment script prebuild (or dedicated command), emit structured diagnostics and generated metadata artifact.
**When to use:** For reproducible CI behavior with strict/non-strict policy control.

### Anti-Patterns to Avoid
- Making runtime rendering depend on network availability.
- Coupling enrichment failures to route crashes.
- Reordering cards by type automatically (violates locked order decision).
- Mixing diagnostic text formatting logic into rendering components.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML metadata parsing | Fragile regex-only parser for complex pages | Small parser utility with prioritized OG/Twitter/meta fallbacks | Reduces malformed extraction edge cases. |
| Timeout/retry orchestration | Repeated ad-hoc `setTimeout` wrappers | Shared fetch helper with abort + retry policy | Keeps behavior consistent and testable. |
| Diagnostics payload format | Unstructured console logs | Structured report object + renderer | Enables CI parsing and actionable remediation. |

## Common Pitfalls

### Pitfall 1: Schema allows rich config but renderer ignores global switch
**What goes wrong:** `type=rich` cards still render rich even when global override says render-as-simple.
**How to avoid:** centralize variant resolution in a policy helper used by the route.

### Pitfall 2: Enrichment failures are not strict-mode aware
**What goes wrong:** CI cannot enforce reliable metadata and silently ships degraded cards.
**How to avoid:** treat enrichment failures as warnings in normal mode and errors in strict mode through one policy gate.

### Pitfall 3: Fallback output is inconsistent across links
**What goes wrong:** some rich cards collapse, others show broken placeholders.
**How to avoid:** build one view-model builder that always fills fallback fields before render.

## Code Examples

### Rich variant resolution policy

```typescript
const variant = resolveCardVariant(link, site.richCards?.renderMode);
```

### Metadata fetch with timeout + one retry

```typescript
const metadata = await fetchWithRetry(url, { timeoutMs: 4000, retries: 1 });
```

### Strict-mode failure escalation

```typescript
const shouldFail = strict && enrichmentErrors.length > 0;
```

## Open Questions

1. **Domain/source label default visibility shape**
   - Known: configurable and icon-always policy is locked.
   - Unclear: whether default should be explicit boolean per-link or global default with per-link override.
   - Recommendation: global default + per-link override for consistency with existing site-level UI policy model.

2. **Generated report artifact location**
   - Known: report artifact is required.
   - Unclear: whether it should live under `.planning/` or `data/generated/`.
   - Recommendation: output machine-readable report to `data/generated/` and keep human diagnostics in console for CI logs.

## Sources

### Primary (HIGH confidence)
- `.planning/phases/03-rich-cards-content-enrichment/03-CONTEXT.md`
- `.planning/ROADMAP.md` (Phase 3 goal + criteria)
- Existing code under `src/`, `schema/`, and `scripts/validation/`

### Secondary (MEDIUM confidence)
- `.planning/phases/02-core-ui-theme-foundation/*` summaries and verification for extension patterns

## Metadata

**Research scope:** rendering contract, fallback policy, enrichment behavior, diagnostics model

**Confidence breakdown:**
- Contract/architecture mapping: HIGH
- Enrichment behavior recommendations: HIGH
- Optional helper library guidance: MEDIUM

**Research date:** 2026-02-22
**Valid until:** 2026-03-24

---

*Phase: 03-rich-cards-content-enrichment*
*Research completed: 2026-02-22*
*Ready for planning: yes*
