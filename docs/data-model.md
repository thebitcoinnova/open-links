# Data Model Deep Dive

OpenLinks is driven by three JSON files:

- `data/profile.json`
- `data/links.json`
- `data/site.json`

The app renders from these files after validation. This document explains what each file controls, what is required, and how to extend safely.

## Guiding Principles

- Keep core fields in schema-defined keys.
- Put extensions under `custom` to avoid collisions.
- Validate before build.
- Prefer explicit ordering when you care about exact link sequence.
- Use rich metadata only where it adds value.

## File Responsibilities

| File | Purpose | Required for build | Notes |
|------|---------|--------------------|-------|
| `data/profile.json` | Identity, bio, profile metadata | Yes | Primary hero/profile content |
| `data/links.json` | All rendered links + groups + order | Yes | Supports `simple` and `rich` cards |
| `data/site.json` | Theme, UI preferences, quality policy | Yes | Also controls quality and deploy-relevant behavior |

## `profile.json`

Schema: `schema/profile.schema.json`

### Required fields

- `name` (string)
- `headline` (string)
- `avatar` (URI string)
- `bio` (string, max 500)

### Avatar materialization behavior

- `profile.avatar` remains the source-of-truth URL in `data/profile.json`.
- During `npm run dev` and `npm run build`, avatar sync fetches and stores a local copy at `public/generated/profile-avatar.<ext>`.
- Avatar sync writes `data/generated/profile-avatar.json` with fetch/cache metadata.
- Runtime rendering uses the local resolved path from the generated manifest, not the raw remote URL.
- On fetch failure:
  - cached local avatar is reused when available, or
  - fallback file `public/profile-avatar-fallback.svg` is used.
- Force refresh is available via `npm run avatar:sync -- --force` or `OPENLINKS_AVATAR_FORCE=1`.

### Common optional fields

- `location`
- `pronouns`
- `status`
- `profileLinks` (array of `{ label, url }`)
- `contact` (object, supports `email`, `website`, plus extensions)
- `custom` (extension namespace)

### Starter profile preset

```json
{
  "name": "Your Name",
  "headline": "What you do",
  "avatar": "https://example.com/avatar.jpg",
  "bio": "One to two sentences about your work and interests.",
  "location": "City, Country",
  "profileLinks": [
    {
      "label": "GitHub",
      "url": "https://github.com/your-handle"
    }
  ],
  "contact": {
    "email": "hello@example.com"
  },
  "custom": {
    "profileVariant": "default"
  }
}
```

## `links.json`

Schema: `schema/links.schema.json`

`links.json` is where most customization happens.

### Root fields

- `links` (required array)
- `groups` (optional array)
- `order` (optional array of link IDs)
- `custom` (optional extension object)

### Link object required fields

Every item in `links` must include:

- `id`
- `label`
- `url`
- `type` (`simple` or `rich`)

### Link object optional fields

- `icon`
- `description`
- `group`
- `order`
- `enabled`
- `metadata` (rich card metadata)
- `enrichment` (build-time enrichment policy)
- `custom`

#### Icon resolution behavior

Link icons resolve using this precedence:

1. `links[].icon` alias match from `src/lib/icons/known-sites-data.ts`
2. URL domain match (exact or subdomain) from the same static registry
3. Generic fallback glyph

If `links[].icon` is unknown, validation emits a warning and runtime still attempts domain-based resolution.

Known-site logo rendering is contrast-aware by default: brand color is preferred, and fallback palette adjustments are applied when needed to keep icons visible.

### Simple card example

```json
{
  "id": "github",
  "label": "GitHub",
  "url": "https://github.com/your-handle",
  "type": "simple",
  "icon": "github",
  "description": "Code, experiments, and OSS",
  "enabled": true,
  "custom": {}
}
```

### Rich card example

```json
{
  "id": "project-home",
  "label": "Project",
  "url": "https://example.com/project",
  "type": "rich",
  "icon": "github",
  "description": "Project landing page",
  "enabled": true,
  "metadata": {
    "title": "Project title",
    "description": "One-line project summary",
    "image": "https://example.com/preview.png",
    "sourceLabel": "example.com"
  },
  "enrichment": {
    "enabled": true
  },
  "custom": {}
}
```

### Grouping and ordering behavior

OpenLinks supports grouped or flat list presentation.

#### Grouping

- Set `group` on each link.
- Define matching group objects in `groups`.
- Group labels are rendered depending on `site.ui.groupingStyle`.

Group example:

```json
"groups": [
  { "id": "social", "label": "Social", "order": 1 },
  { "id": "work", "label": "Work", "order": 2 }
]
```

#### Ordering precedence

Rendering order resolves using this precedence:

1. Explicit `order` array at root (`links.order`).
2. Per-link numeric `order` values.
3. Input order fallback.

This supports:

- fully curated order,
- partially curated order,
- or default natural order.

### Rich metadata and enrichment

Rich links can include manual metadata and/or generated metadata.

#### Manual metadata (`links[].metadata`)

Supported keys include:

- `title`
- `description`
- `image`
- `sourceLabel`
- `sourceLabelVisible`
- `enrichmentStatus`
- `enrichmentReason`
- `enrichedAt`
- `custom`

#### Enrichment policy (`links[].enrichment`)

Per-link controls:

- `enabled`
- `sourceLabel`
- `sourceLabelVisible`
- `custom`

Site-level default enrichment behavior is defined in `site.ui.richCards.enrichment`.

## `site.json`

Schema: `schema/site.schema.json`

`site.json` controls display defaults, theme, interaction policy, and quality policy.

### Required fields

- `title`
- `description`
- `theme` (`active`, `available`)

### High-signal sections

#### `theme`

- `active`: selected theme id
- `available`: allowed theme ids

Current theme IDs are resolved by `src/lib/theme/theme-registry.ts`.

#### `ui`

Main presentation controls include:

- `compositionMode`: `balanced`, `identity-first`, `links-first`, `links-only`
- `groupingStyle`: `subtle`, `none`, `bands`
- `profileRichness`: `minimal`, `standard`, `rich`
- `modePolicy`: `dark-toggle`, `static-dark`, `static-light`
- `linkTarget`: `new-tab-external`, `same-tab`, `new-tab-all`
- `desktopColumns`: `one`, `two`
- `density`: `compact`, `medium`, `spacious`
- `typographyScale`: `fixed`, `compact`, `expressive`
- `typography`: optional global/per-theme typography overrides
- `targetSize`: `comfortable`, `compact`, `large`
- `brandIcons.colorMode`: `brand`, `theme`
- `brandIcons.contrastMode`: `auto`, `always-theme`, `always-brand`
- `brandIcons.minContrastRatio`: number between `1` and `21` (default `3`)
- `brandIcons.sizeMode`: `normal`, `large`

Rich-card policy settings live under `ui.richCards`.

#### `ui.brandIcons`

`ui.brandIcons.colorMode` controls icon tinting strategy for known-site logos:

- `brand`: uses the registry brand color (default)
- `theme`: uses theme text/icon color

`ui.brandIcons.contrastMode` controls fallback behavior:

- `auto`: preserve brand where possible, then auto-adjust to satisfy contrast target
- `always-theme`: always use theme-driven glyph color
- `always-brand`: always force brand glyph color

`ui.brandIcons.minContrastRatio` sets the contrast target for icon glyphs against icon chip backgrounds.

`ui.brandIcons.sizeMode` controls default icon scale:

- `normal`: baseline icon size
- `large`: moderately larger icons (default)

#### `ui.typography`

`ui.typography` provides data-driven typography overrides without editing CSS files.

Precedence order:

1. Built-in token defaults
2. `ui.typographyScale` preset baseline (`fixed`, `compact`, `expressive`)
3. `ui.typography.global`
4. `ui.typography.themes[theme.active]`

Supported keys in each override object:

- Font families: `fontDisplay`, `fontBody`
- Type sizes: `sizeTitle`, `sizeHeadline`, `sizeBody`, `sizeCaption`, `sizeCardTitle`, `sizeLinkTitle`, `sizeIcon`
- Line heights: `lineHeightTitle`, `lineHeightBody`, `lineHeightCardTitle`, `lineHeightCardDescription`
- Font weights: `weightCardTitle`, `weightLinkTitle`, `weightIcon`
- Letter spacing: `trackingUtilityTitle`, `trackingSectionHeading`, `trackingCardSource`, `trackingIcon`
- Text transforms: `transformUtilityTitle`, `transformSectionHeading`, `transformContactLabel`

Valid transform values:

- `none`
- `uppercase`
- `lowercase`
- `capitalize`

Example:

```json
{
  "ui": {
    "typographyScale": "compact",
    "typography": {
      "global": {
        "fontBody": "\"IBM Plex Sans\", \"Segoe UI\", sans-serif",
        "sizeBody": "1.02rem",
        "lineHeightBody": 1.6
      },
      "themes": {
        "editorial": {
          "fontDisplay": "\"Fraunces\", \"Iowan Old Style\", serif"
        }
      }
    }
  }
}
```

#### `quality`

Quality controls include:

- report output paths
- blocking domains
- SEO defaults/overrides
- accessibility smoke-check labels
- performance profile budgets

These values are consumed by:

- `scripts/quality/run-quality-checks.ts`
- `scripts/quality/seo.ts`
- `scripts/quality/a11y.ts`
- `scripts/quality/perf.ts`

## Validation Workflow

### Standard mode

```bash
npm run validate:data
```

Behavior:

- fails on errors
- allows warnings

### Strict mode

```bash
npm run validate:data:strict
```

Behavior:

- fails on errors
- fails on warnings

### JSON mode

```bash
npm run validate:data:json
```

Behavior:

- machine-readable output for scripts/agents

## Interpreting Validation Output

Validator output includes source file, JSON path, issue type, and remediation.

### Error example

```text
[data/links.json] $.links[1].url: URL scheme 'ftp:' is not allowed.
Fix: Use one of: http, https, mailto, tel.
```

Action:

1. Open `data/links.json`.
2. Navigate to `links[1].url`.
3. Replace with supported scheme.
4. Re-run validation.

### Warning example

```text
[data/site.json] $.experimentalFlag: Unknown top-level key 'experimentalFlag' is allowed but not part of the core contract.
Fix: Move 'experimentalFlag' into a dedicated custom block if it is extension data, or document why it belongs at top level.
```

Action:

1. Move extension to `site.custom.experimentalFlag`.
2. Re-run standard or strict validation.

## `custom` Extension Namespace

OpenLinks supports extensions through `custom`, but there are guardrails.

### Allowed extension locations

- `profile.custom`
- `links.custom`
- `site.custom`
- `links[].custom`
- `links[].metadata.custom`
- `links[].enrichment.custom`

### Do

- Use descriptive prefixes for project-specific fields.
- Keep extension values serializable JSON.
- Document custom keys in your fork README or docs.

### Do not

- Reuse reserved core keys (`title`, `theme`, `type`, etc.) inside `custom` at the same object level.
- Put required core behavior behind undocumented custom flags.
- Depend on unknown top-level keys long-term.

### Collision example (invalid)

```json
{
  "custom": {
    "title": "Collides with reserved core key"
  }
}
```

### Safer alternative

```json
{
  "custom": {
    "projectTitleOverride": "Custom semantic key"
  }
}
```

## Copy-Paste Starter Presets

You can use these ready presets directly:

- `data/examples/minimal/` for quick launch.
- `data/examples/grouped/` for grouped + ordered links.
- `data/examples/invalid/` for testing validation and CI checks.

## Recommended Edit Loop

1. Update JSON in `data/`.
2. Run `npm run validate:data`.
3. Run `npm run build`.
4. Preview with `npm run preview`.
5. Commit and push.

## Related Docs

- Root overview: `README.md`
- Fast setup and deployment path: `docs/quickstart.md`
- AI-assisted change flow: `docs/ai-guided-customization.md`
