# Architecture Research

**Domain:** JSON-driven static links site generator for developers
**Researched:** 2026-02-22
**Confidence:** HIGH

## Standard Architecture

### System Overview

```text
┌──────────────────────────────────────────────────────────────┐
│                 Authoring + Configuration Layer             │
├──────────────────────────────────────────────────────────────┤
│  data/profile.json   data/links.json   theme config         │
│  JSON Schema files   optional rich overrides                │
└───────────────┬───────────────────────────────┬──────────────┘
                │                               │
┌───────────────▼───────────────────────────────▼──────────────┐
│                      Build/Validation Layer                  │
├──────────────────────────────────────────────────────────────┤
│  Schema validation  →  optional metadata enrichment  →       │
│  static page generation (SolidStart prerender)              │
└───────────────┬───────────────────────────────┬──────────────┘
                │                               │
┌───────────────▼───────────────────────────────▼──────────────┐
│                     Delivery/Hosting Layer                   │
├──────────────────────────────────────────────────────────────┤
│  GitHub Actions CI   artifacts   GitHub Pages deployment     │
│  (future adapter hooks for AWS/Railway/etc.)                │
└──────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Data contract module | Defines schema and typed domain model | JSON Schema + generated TS types |
| Validation pipeline | Hard-fails invalid content before build | AJV validation script in CI/prebuild |
| Metadata enrichment module | Optional rich preview data collection | Build-time fetch with cache + fallback |
| Rendering system | Converts typed data to accessible UI cards | Solid components with card variants |
| Theme system | Encapsulates look-and-feel variability | CSS variables + tokenized theme files |
| Deploy workflow | Builds and publishes static site | GitHub Actions workflow templates |

## Recommended Project Structure

```text
.planning/
.github/
  workflows/
    ci.yml                 # validate + test + build
    deploy-pages.yml       # deploy static artifact to Pages

data/
  profile.json             # identity and page-level metadata
  links.json               # link cards and per-link config

schema/
  profile.schema.json
  links.schema.json

scripts/
  validate-data.ts         # schema checks + helpful errors
  enrich-rich-cards.ts     # optional metadata fetch/cache

src/
  components/
    cards/
      SimpleCard.tsx
      RichCard.tsx
  layouts/
    DefaultLayout.tsx
  themes/
    tokens/
      default-dark.css
      default-light.css
      ocean.css
  lib/
    content/
      loadContent.ts
    seo/
      buildMeta.ts
  routes/
    index.tsx

public/
  icons/                   # static icon fallbacks
```

### Structure Rationale

- **`data/` + `schema/` separation:** preserves explicit contract between content and UI.
- **`scripts/` build utilities:** keeps validation/enrichment deterministic and testable.
- **`src/themes/` isolation:** allows fork customization without touching rendering logic.
- **`.github/workflows/` modularization:** makes deployment target expansion additive.

## Architectural Patterns

### Pattern 1: Schema-First Content Contract

**What:** Data changes are validated against versioned schemas before rendering.
**When to use:** Always, because contributor edits (human or AI) can be structurally invalid.
**Trade-offs:** Adds setup overhead but dramatically improves reliability.

**Example:**
```typescript
const valid = ajv.validate(linksSchema, linksJson);
if (!valid) throw new Error(formatAjvErrors(ajv.errors));
```

### Pattern 2: Card Variant Rendering via Discriminated Union

**What:** Render simple vs rich cards through typed variant dispatch.
**When to use:** When cards share common fields but diverge in preview requirements.
**Trade-offs:** Slightly more boilerplate, much better maintainability.

**Example:**
```typescript
return card.type === "rich"
  ? <RichCard card={card} />
  : <SimpleCard card={card} />;
```

### Pattern 3: Build-Time Enrichment with Deterministic Cache

**What:** Resolve OG metadata at build time, store cache snapshots, and fallback safely.
**When to use:** When rich previews matter but runtime fetches are unacceptable.
**Trade-offs:** Adds pipeline complexity and external fetch variability.

## Data Flow

### Request Flow

```text
Developer edits JSON
    ↓
CI/local validate-data.ts
    ↓
(optional) enrich-rich-cards.ts
    ↓
SolidStart prerender build
    ↓
static output + deploy workflow
    ↓
public OpenLinks page
```

### State Management

```text
Build-time state (source of truth): data/*.json + schema/*.json
Runtime state (minimal): theme preference + UI interactions
```

### Key Data Flows

1. **Content flow:** JSON updates -> schema validation -> typed render props -> static HTML.
2. **Rich metadata flow:** external URL -> metadata fetch -> cached result -> rich card props.
3. **Theme flow:** selected theme token set -> CSS variables -> consistent card/layout styling.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Single user / few forks | Monorepo template + default workflows is sufficient |
| Dozens to hundreds of forks | Strengthen docs/tests/schema migration path |
| Ecosystem-level adoption | Add versioned schema migrations and deployment adapters |

### Scaling Priorities

1. **First bottleneck:** inconsistent fork customization; fix with robust templates and migration docs.
2. **Second bottleneck:** metadata fetch instability at scale; fix with cache controls and graceful degradation.

## Anti-Patterns

### Anti-Pattern 1: Theme and Data Coupling

**What people do:** Encode theme-specific assumptions directly in link data.
**Why it's wrong:** Data becomes non-portable across themes/layouts.
**Do this instead:** Keep data semantic, keep presentation in theme/layout layer.

### Anti-Pattern 2: Provider-Specific Deployment in App Code

**What people do:** Bake GitHub Pages path/deploy concerns into UI logic.
**Why it's wrong:** Blocks AWS/Railway expansion and complicates local preview.
**Do this instead:** Keep host-specific behavior in CI/workflow adapters.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| GitHub Actions/Pages | Workflow-based CI/CD | Required for template-first distribution model |
| Website metadata endpoints (OG tags) | Build-time HTTP fetch | Must include timeout/retry/fallback |
| Icon datasets (Iconify/simple-icons) | Build-time/local asset import | Avoid runtime icon dependency when possible |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `data/schema` ↔ `scripts/validate` | JSON + schema validation API | Hard gate before build |
| `scripts/enrich` ↔ `data/links` | normalized metadata payload | Must preserve manual overrides |
| `src/themes` ↔ `src/components` | design token interface | Keeps components theme-agnostic |

## Sources

- [SolidStart docs](https://docs.solidjs.com/solid-start)
- [Solid static site generation docs](https://docs.solidjs.com/solid-start/building-your-application/rendering/static-site-generation-ssg)
- [GitHub Pages workflow docs](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

---
*Architecture research for: JSON-driven static links generator*
*Researched: 2026-02-22*
