# Data Model Deep Dive

OpenLinks is driven by three JSON files:

- `data/profile.json`
- `data/links.json`
- `data/site.json`

The app renders from these files after validation. This document explains what each file controls, what is required, and how to extend safely.

For a complete day-2 audit checklist of every data-driven customization area, use `docs/customization-catalog.md`.

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
| `data/links.json` | All rendered links + groups + order | Yes | Supports `simple`, `rich`, and `payment` cards |
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
- During `bun run dev` and `bun run build`, avatar sync fetches and stores a local copy at `public/generated/profile-avatar.<ext>`.
- Avatar sync writes `data/generated/profile-avatar.json` with fetch/cache metadata.
- Runtime rendering uses the local resolved path from the generated manifest, not the raw remote URL.
- On fetch failure:
  - cached local avatar is reused when available, or
  - fallback file `public/profile-avatar-fallback.svg` is used.
- Force refresh is available via `bun run avatar:sync -- --force` or `OPENLINKS_AVATAR_FORCE=1`.

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
- `type` (`simple`, `rich`, or `payment`)

`url` is required for `simple` and `rich` links. `payment` links may omit `url` if `payment.rails` is configured.

### Link object optional fields

- `icon`
- `description`
- `group`
- `order`
- `enabled`
- `metadata` (rich card metadata)
- `enrichment` (build-time enrichment policy)
- `payment` (tips/payment rails + QR settings)
- `custom`

#### Icon resolution behavior

Link icons resolve using this precedence:

1. `links[].icon` alias match from `src/lib/icons/known-sites-data.ts`
2. URL domain match (exact or subdomain) from the same static registry
3. Optional single-step remap through `site.ui.brandIcons.iconOverrides`
4. Generic fallback glyph

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
    "handle": "project-owner",
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

### Payment links and rails

Payment support is available in two ways:

1. Dedicated payment cards with `type: "payment"`.
2. Payment metadata on regular `simple`/`rich` links via `payment` (the link upgrades to payment-card rendering at runtime).

`payment` supports:

- `qrDisplay`: `always`, `toggle`, `hidden`
- `primaryRailId`
- `rails`: array of rail objects

Supported rail values:

- `patreon`
- `kofi`
- `paypal`
- `cashapp`
- `stripe`
- `coinbase`
- `bitcoin`
- `lightning`
- `ethereum`
- `solana`
- `custom-crypto`

Per-rail QR settings (`payment.rails[].qr`) support:

- `enabled`
- `fullscreen`: `enabled`, `disabled`
- `style`: `square`, `rounded`, `dots`
- `foregroundColor`, `backgroundColor`
- `logoMode`: `rail-default`, `custom`, `none`
- `logoUrl` (required when `logoMode` is `custom`)
- `logoSize`
- `payload` (optional explicit QR payload override)

Payment rails can include explicit app links via `payment.rails[].appLinks` for wallet/app-specific deep links.

#### Payment example

```json
{
  "id": "support",
  "label": "Support My Work",
  "type": "payment",
  "description": "Tips help me ship more features",
  "payment": {
    "qrDisplay": "always",
    "primaryRailId": "btc",
    "rails": [
      {
        "id": "btc",
        "rail": "bitcoin",
        "address": "bc1qexampleaddress",
        "amount": "0.0005",
        "message": "Thanks for the support",
        "qr": {
          "style": "dots",
          "logoMode": "rail-default",
          "fullscreen": "enabled"
        }
      },
      {
        "id": "patreon",
        "rail": "patreon",
        "url": "https://patreon.com/example"
      }
    ]
  },
  "custom": {}
}
```

### Rich image materialization behavior

- Remote rich-image URLs are source data, but runtime does not render raw remote URLs.
- During `bun run dev` and `bun run build`, `images:sync` fetches remote rich-link and SEO image candidates and writes:
  - baked files in `public/generated/images/<content-hash>.<ext>`
  - manifest `data/generated/content-images.json`
- Runtime rich-card `metadata.image` values resolve to baked local paths when available.
- If a link would render as a rich card without a materialized preview image, `bun run validate:data` (and therefore `bun run build`/`bun run dev`) now fails with remediation guidance.
- Force refresh is available via `bun run images:sync -- --force` or `OPENLINKS_IMAGES_FORCE=1`.

#### Manual metadata (`links[].metadata`)

Supported keys include:

- `title`
- `description`
- `descriptionSource`: `fetched` (prefer fetched metadata description), `manual` (prefer top-level `links[].description`)
- `image`
- `profileImage`
- `handle` (canonical username/handle without leading `@`; runtime renders as `@handle`)
- `followersCount`
- `followersCountRaw`
- `followingCount`
- `followingCountRaw`
- `subscribersCount`
- `subscribersCountRaw`
- `imageFit`
- `mobileImageLayout`
- `sourceLabel`
- `sourceLabelVisible`
- `enrichmentStatus`
- `enrichmentReason`
- `enrichedAt`
- `custom`

#### URL-first handle extraction (v1)

- Runtime and enrichment use URL-only handle extraction (no HTML/meta-tag scraping).
- Resolution precedence is:
  1. manual `links[].metadata.handle`
  2. URL-derived handle when supported
- Supported extractor families in v1: GitHub, X/Twitter, LinkedIn, Facebook, Instagram, Medium, Substack patterns.
- If a URL is from a supported family but no handle can be resolved and `metadata.handle` is missing, validation emits a warning-level handle coverage issue.
- Handle coverage warnings are non-strict-blocking and do not fail `bun run validate:data:strict`.

Current profile-card-capable rich-link families include:

- GitHub: avatar + follower/following counts when public profile HTML exposes them
- Instagram: avatar + follower/following counts
- LinkedIn: authenticated-cache-backed avatar-first profile cards
- YouTube: avatar + subscriber counts
- Primal, X, and Facebook: avatar-first profile cards without count guarantees in the current pass

#### Enrichment policy (`links[].enrichment`)

Per-link controls:

- `enabled`
- `allowKnownBlocker`: explicit override to force-attempt enrichment for a known blocked domain
- `authenticatedExtractor`: use committed authenticated cache instead of public enrichment for true auth-required domains (currently LinkedIn and Facebook)
- `authenticatedCacheKey`: optional cache-key override (default uses `link.id`)
- `sourceLabel`
- `sourceLabelVisible`
- `custom`

Site-level default enrichment behavior is defined in `site.ui.richCards.enrichment`.

`site.ui.richCards.enrichment` supports:

- `enabledByDefault`: whether rich links attempt enrichment when link-level `enrichment.enabled` is omitted.
- `timeoutMs`: per-attempt request timeout.
- `retries`: retry count after the first attempt.
- `metadataPath`: generated metadata output path.
- `reportPath`: generated enrichment report path.
- `publicCachePath`: committed public metadata cache manifest path (default `data/cache/rich-public-cache.json`).
- `authenticatedCachePath`: authenticated cache manifest path (default `data/cache/rich-authenticated-cache.json`).
- `authenticatedCacheWarnAgeDays`: stale-cache warning threshold in days (default `30`, warning-only).
- `failureMode`: `immediate` (default) or `aggregate`.
  - `immediate`: stop strict enrichment on first blocking failure.
  - `aggregate`: process all eligible links, then fail after reporting all blockers.
- `failOn`: blocking reasons for strict enrichment. Default: `["fetch_failed", "metadata_missing"]`.
- `allowManualMetadataFallback`: default `true`. When `metadata_missing` occurs, any manual `links[].metadata.title|description|image` downgrades to warning.

Canonical known-blocker policy registry:

- `data/policy/rich-enrichment-blockers.json`
- Schema: `schema/rich-enrichment-blockers.schema.json`

Canonical public enrichment cache registry:

- `data/cache/rich-public-cache.json`
- `schema/rich-public-cache.schema.json`

Canonical authenticated extractor + cache registries:

- `data/policy/rich-authenticated-extractors.json`
- `schema/rich-authenticated-extractors.schema.json`
- `data/cache/rich-authenticated-cache.json`
- `schema/rich-authenticated-cache.schema.json`
- `public/cache/rich-authenticated/` (committed local assets)
- `output/playwright/auth-rich-sync/` (diagnostics, gitignored)

When an enrichment-enabled rich link URL matches a `status=blocked` registry entry, enrichment fails early with reason `known_blocker` unless `links[].enrichment.allowKnownBlocker=true` is set for that link.

When direct/public enrichment succeeds, OpenLinks writes normalized fetch-derived metadata into the committed public cache manifest. Later enrich runs reuse fresh cache entries or revalidate stale entries with conditional requests (`reason=public_cache`) instead of live-fetching every page on every run.

If a direct/public fetch fails but a committed public cache entry already exists, enrichment reuses that stale cached metadata as a warning-level fallback. No raw public HTML snapshots are committed.

Built-in public augmentation currently covers Medium (RSS/feed), X (oEmbed + avatar), Instagram (public page metadata), and YouTube (public page metadata) without using `authenticatedExtractor`.

When `links[].enrichment.authenticatedExtractor` is configured, enrichment uses committed cache entries (`reason=authenticated_cache`) and fails early with `authenticated_cache_missing` if cache data/assets are missing or invalid.

`bun run dev` and `bun run build` run strict enrichment pre-steps and fail on configured blocking reasons plus known-blocker policy violations.  
Temporary emergency local bypass is available with `OPENLINKS_RICH_ENRICHMENT_BYPASS=1`.

First-run authenticated setup command:

- `bun run setup:rich-auth` (captures only missing/invalid authenticated cache entries)
- Optional one-link capture: `bun run auth:rich:sync -- --only-link <link-id>`
- Force one-link refresh even when cache is valid: `bun run auth:rich:sync -- --only-link <link-id> --force`
- Clear cache entries/assets before recapture: `bun run auth:rich:clear -- --only-link <link-id>` (or `--all`)

Extractor scaffolding command:

- `bun run auth:extractor:new -- --id <extractor-id> --domains <csv> --summary \"<summary>\"`

Local auth wait tuning for one-off LinkedIn flows:

- `OPENLINKS_AUTH_SESSION_TIMEOUT_MS` (default `600000`)
- `OPENLINKS_AUTH_SESSION_POLL_MS` (default `2000`)

LinkedIn debug commands:

- `bun run linkedin:debug:bootstrap`
- `bun run linkedin:debug:login`
- `bun run linkedin:debug:validate`
- `bun run linkedin:debug:validate:cookie-bridge`

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
- `profileAvatarScale`: number between `0` and `4`; default `1.5` (avatar size multiplier)
- `brandIcons.colorMode`: `brand`, `theme`
- `brandIcons.contrastMode`: `auto`, `always-theme`, `always-brand`
- `brandIcons.minContrastRatio`: number between `1` and `21` (default `3`)
- `brandIcons.sizeMode`: `normal`, `large`
- `brandIcons.iconOverrides`: optional known-site alias remap map (`{ "x": "twitter" }`)
- `richCards.imageFit`: `contain` (default preserve mode), `cover`
- `richCards.descriptionSource`: `fetched` (default), `manual`
- `richCards.mobile.imageLayout`: `inline` (default), `full-width`
- `richCards.enrichment.publicCachePath`: path to committed public rich-cache manifest
- `richCards.enrichment.authenticatedCachePath`: path to authenticated rich-cache manifest
- `richCards.enrichment.authenticatedCacheWarnAgeDays`: stale warning threshold for authenticated cache entries
- `richCards.enrichment.failureMode`: `immediate` (default), `aggregate`
- `richCards.enrichment.failOn`: blocking reasons (`fetch_failed`, `metadata_missing`)
- `richCards.enrichment.allowManualMetadataFallback`: use manual metadata as warning-level fallback when remote metadata is missing
- `payments.qr.displayDefault`: `always`, `toggle`, `hidden`
- `payments.qr.styleDefault`: `square`, `rounded`, `dots`
- `payments.qr.foregroundColorDefault`, `payments.qr.backgroundColorDefault`
- `payments.qr.logoModeDefault`: `rail-default`, `custom`, `none`
- `payments.qr.logoSizeDefault`
- `payments.qr.fullscreenDefault`: `enabled`, `disabled`
- `footer.description`: optional descriptive footer text
- `footer.ctaLabel`: optional CTA button label
- `footer.ctaUrl`: optional CTA target URL
- `footer.showLastUpdated`: toggle subtle build-time UTC timestamp display

Rich-card policy settings live under `ui.richCards`.

Description selection precedence for rich links:

1. `links[].metadata.descriptionSource`
2. `site.ui.richCards.descriptionSource`
3. default `fetched`

`fetched` resolves descriptions as `metadata.description -> links[].description -> URL/domain fallback`.
`manual` resolves descriptions as `links[].description -> metadata.description -> URL/domain fallback`.

#### `ui.richCards.imageFit`

Controls how rich-card preview images fill media tiles.

- `contain` (default): preserves full image content and avoids clipping.
- `cover`: fills the media tile and may crop edges.

Resolution precedence:

1. `links[].metadata.imageFit`
2. `site.ui.richCards.imageFit`
3. fallback default: `contain`

Migration note: previous behavior was effectively crop-first (`cover`). If you want that look globally, set `site.ui.richCards.imageFit` to `cover`.

#### `ui.richCards.mobile.imageLayout`

Controls mobile rich-card image placement when rich-card images are present.

- `inline` (default): compact square image (~quarter viewport width) with wrapped text/content flow.
- `full-width`: stacked full-width square image (legacy mobile behavior).

Resolution precedence:

1. `links[].metadata.mobileImageLayout`
2. `site.ui.richCards.mobile.imageLayout`
3. fallback default: `inline`

To keep the previous mobile style globally, set `site.ui.richCards.mobile.imageLayout` to `full-width`.

#### `quality.seo` image materialization behavior

- SEO image candidates (`socialImageFallback`, defaults, profile overrides) are included in `images:sync`.
- Runtime SEO tags (`og:image`, `twitter:image`) use baked local assets when available.
- Runtime never falls back to remote SEO image URLs; unresolved remote candidates fall back to `/openlinks-social-fallback.svg`.

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

`ui.brandIcons.iconOverrides` lets you remap known-site icon identities globally. Remapping applies after base icon resolution and is single-step only.

Example:

```json
{
  "ui": {
    "brandIcons": {
      "iconOverrides": {
        "x": "twitter"
      }
    }
  }
}
```

#### `ui.footer`

Footer content and CTA are configurable from `data/site.json`.

- `description`: descriptive body copy shown in the footer.
- `ctaLabel`: button text for the footer CTA.
- `ctaUrl`: CTA destination URL (when omitted, runtime uses repo default).
- `showLastUpdated`: controls rendering of a subtle build-time UTC "Last updated" line.

Example:

```json
{
  "ui": {
    "footer": {
      "description": "OpenLinks is a personal, free, open source, version-controlled links site.\nFork it, customize JSON, and publish fast.",
      "ctaLabel": "Create Your OpenLinks",
      "ctaUrl": "https://github.com/pRizz/open-links",
      "showLastUpdated": true
    }
  }
}
```

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
bun run validate:data
```

Behavior:

- fails on errors
- allows warnings

### Strict mode

```bash
bun run validate:data:strict
```

Behavior:

- fails on errors
- fails on warnings

### JSON mode

```bash
bun run validate:data:json
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
2. Run `bun run validate:data`.
3. Run `bun run build`.
4. Preview with `bun run preview`.
5. Commit and push.

## Related Docs

- Root overview: `README.md`
- Fast setup and deployment path: `docs/quickstart.md`
- AI-assisted change flow: `docs/ai-guided-customization.md`
- Exhaustive customization checklist: `docs/customization-catalog.md`
- Authenticated extractor architecture/workflow: `docs/authenticated-rich-extractors.md`
- New extractor implementation workflow: `docs/create-new-rich-content-extractor.md`
