# Data Model Deep Dive

OpenLinks is driven by three JSON files:

- `data/profile.json`
- `data/links.json`
- `data/site.json`

The app renders from these files after validation. This document explains what each file controls, what is required, and how to extend safely.

For a complete day-2 audit checklist of every data-driven customization area, use `docs/customization-catalog.md`.

## Recommended CRUD Path

Treat this document as the canonical contract/reference layer, not the default first editing surface.

Recommended order:

1. Prefer the repo's AI workflows/skills and automation docs for routine CRUD.
2. Prefer the Studio webapp when the browser-based self-serve editor covers your workflow.
3. Edit `data/*.json` directly only when you want lower-level control or need the manual fallback path.

Supporting docs:

- `docs/openclaw-update-crud.md`
- `docs/ai-guided-customization.md`
- `docs/studio-self-serve.md`

The three-file contract in this document and the upstream schemas under
`schema/` are also mirrored by
[`open-links-sites`](https://github.com/pRizz/open-links-sites), so breaking
changes here can propagate into that downstream project as well.

## Guiding Principles

- Keep core fields in schema-defined keys.
- Put extensions under `custom` to avoid collisions.
- Validate before build.
- Prefer explicit ordering when you care about exact link sequence.
- Use rich metadata only where it adds value.

## File Responsibilities

| File | Purpose | Required for build | Notes |
|------|---------|--------------------|-------|
| `data/profile.json` | Primary entity identity and bio metadata | Yes | Stable compatibility path for the primary hero/entity record |
| `data/links.json` | All rendered links + groups + order | Yes | Supports `simple`, `rich`, and `payment` cards |
| `data/site.json` | Theme, UI preferences, quality policy | Yes | Also controls quality and deploy-relevant behavior |

## `profile.json`

Schema: `schema/profile.schema.json`

`data/profile.json` remains the stable upstream contract path for backward
compatibility, but the record itself can represent the primary public entity for
the site, including a person or an organization.

### Required fields

- `name` (string)
- `headline` (string)
- `avatar` (URI string)
- `bio` (string, max 500)

### Entity typing

- `entityType` (optional string enum: `person` or `organization`)
- When omitted, runtime behavior defaults to `person` for backward
  compatibility.
- Keep using `data/profile.json` even for organizations; the path is stable
  across validation, Studio, and downstream consumers.

### Avatar materialization behavior

- `profile.avatar` remains the source-of-truth URL in `data/profile.json`.
- During `bun run dev` and `bun run build`, avatar sync fetches and stores a local copy at `public/cache/profile-avatar/profile-avatar.<ext>`.
- Avatar sync writes the committed stable manifest `data/cache/profile-avatar.json` plus the gitignored runtime overlay `data/cache/profile-avatar.runtime.json`.
- Runtime rendering uses the local resolved path from the committed avatar manifest, not the raw remote URL.
- The main profile/site QR also reuses the resolved avatar and automatically pairs it with the site brand mark when both assets are available; there is no separate profile-QR config surface.
- On fetch failure:
  - cached local avatar is reused when available, or
  - fallback file `public/profile-avatar-fallback.svg` is used.
- Force refresh is available via `bun run avatar:sync -- --force` or `OPENLINKS_AVATAR_FORCE=1`.
- All cache-backed remote fetches are governed by `data/policy/remote-cache-policy.json`; adding a new remote host without policy coverage is a validation error.

### Common optional fields

- `entityType`
- `location`
- `pronouns` (primarily relevant for `entityType: "person"`)
- `status`
- `profileLinks` (array of `{ label, url }`)
- `contact` (object, supports `email`, `website`, plus extensions)
- `custom` (extension namespace)

### Starter profile preset

If you are using the recommended AI or Studio paths, treat the JSON examples below as reference shapes the tools should produce, not as proof that hand-editing is the preferred workflow.

```json
{
  "name": "Your Name",
  "headline": "What you do",
  "avatar": "https://example.com/avatar.jpg",
  "bio": "One to two sentences about your work and interests.",
  "entityType": "person",
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

### Organization example

```json
{
  "name": "Bright Builds LLC",
  "headline": "Product engineering for ambitious teams",
  "avatar": "https://example.com/logo.png",
  "bio": "We design and ship software systems, automation, and product platforms.",
  "entityType": "organization",
  "contact": {
    "website": "https://example.com",
    "email": "hello@example.com"
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

### Minimal social profile starter

For supported profile links, start with the link shell and let build-time enrichment plus the committed public/authenticated caches fill in the richer metadata:

```json
{
  "id": "github",
  "label": "GitHub",
  "url": "https://github.com/pRizz",
  "type": "rich",
  "icon": "github",
  "description": "Code, experiments, and open-source projects",
  "enabled": true,
  "enrichment": {
    "enabled": true
  }
}
```

When enrichment succeeds, runtime can reuse the normalized metadata for avatar-first profile rendering, handle display, audience metrics, follower-history snapshots, and card analytics availability without requiring manual metadata in `data/links.json`.
The same identity metadata now also feeds QR center badges for non-payment links: when runtime resolves both a primary identity image (`metadata.profileImage` first, then a distinct `metadata.image`) and a known site identity from `links[].icon` or the URL, the QR code automatically renders a two-item side-by-side badge with both identities. No extra JSON configuration is required.

If you are using AI workflows or Studio for CRUD, this is the reference shape to target. Directly editing `data/links.json` is the manual fallback path.

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
- `effects.enabled`: opt the card into decorative special effects
- `effects.effects`: optional explicit effect list (`particles`, `lightning-particles`, `glitter-particles`)
- `effects.glitterPalette`: `gold`, `ice`
- `effects.bombasticity`: normalized effect intensity from `0` to `1`; `0` disables the decorative layer, the live curve reaches its busiest/fastest presentation by `0.1`, and `0.1..1` intentionally plateau at that maximum
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
- `foregroundColor`, `backgroundColor`: optional explicit overrides for the QR modules/background
- `logoMode`: `rail-default`, `custom`, `none`
- `logoUrl` (required when `logoMode` is `custom`)
- `logoSize`
- `badge.mode`: `auto`, `custom`, `none`
- `badge.size`: optional center-badge size override using the same normalized scale as `logoSize`
- `badge.items`: up to 2 entries using `{ "type": "rail" }`, `{ "type": "site", "value": "<known-site-id>" }`, or `{ "type": "asset", "value": "/payment-logos/example.svg" }`
- `payload` (optional explicit QR payload override)

Payment rails can include explicit app links via `payment.rails[].appLinks` for wallet/app-specific deep links.
When `payment.rails[].qr.badge.mode` is `auto`, runtime tries to infer a platform logo from `link.icon`, then `payment.rails[].icon`, then `payment.rails[].url` or `link.url`, and combines it with the rail symbol when both resolve and differ.
For branded payment cards, `links[].icon` (or a rail-level icon override) controls the card-shell icon and also seeds QR `auto` badge inference. If a new payment platform should render in card chrome like Club Orange does, add it to the shared known-site registry instead of relying on `badge.items.asset`.
`badge.items.asset` affects only the QR center badge. It does not change the card-shell icon, known-site resolution, or other surfaces that use shared icon rendering.
Without explicit `payment.rails[].qr.badge.mode` or `payment.rails[].qr.logoMode` overrides, runtime now applies that same local-first identity logic by default: it composes site/company + rail when both resolve, otherwise falls back to whichever single identity resolves.
When QR colors are omitted, runtime defaults follow the active theme using `--text-primary` for QR modules and `--surface-panel` for the background.
When `payment.effects.enabled` is true and no explicit effect list is provided, runtime defaults to subtle ambient particles for standard payment cards, and to both `lightning-particles` and gold `glitter-particles` for cards whose primary rail is Lightning. When `payment.effects.bombasticity` is omitted, runtime falls back to `site.ui.payments.effects.bombasticityDefault`, then to the built-in midpoint default of `0.5`, which now renders at the maximum live treatment.

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
  - committed baked files in `public/cache/content-images/<content-hash>.<ext>`
  - committed stable manifest `data/cache/content-images.json`
  - gitignored runtime overlay `data/cache/content-images.runtime.json`
- Runtime rich-card `metadata.image` values resolve to baked local paths when available.
- Runtime also localizes `metadata.ogImage`, `metadata.twitterImage`, and `metadata.profileImage` when baked local assets are available.
- If a link would render as a rich card without a materialized preview image, `bun run validate:data` (and therefore `bun run build`/`bun run dev`) now fails with remediation guidance.
- Header-only revalidation data is kept in the runtime overlay so routine `images:sync` runs do not rewrite tracked cache files unless the cached asset payload actually changes.
- Force refresh is available via `bun run images:sync -- --force` or `OPENLINKS_IMAGES_FORCE=1`.

#### Manual metadata (`links[].metadata`)

Supported keys include:

- `title`
- `description`
- `profileDescription`: profile-authored bio/summary for supported social profile links; when present, this wins over generic description-source rules
- `descriptionSource`: `fetched` (prefer fetched metadata description), `manual` (prefer top-level `links[].description`)
- `image`: canonical render image used by cards today
- `ogImage`: raw Open Graph image candidate when present
- `twitterImage`: raw Twitter card image candidate when present
- `profileImage`: canonical identity/avatar image
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
  - when this is a host-like custom domain for a known platform, footer rendering clarifies it as `Platform · domain` (for example `Substack · peter.ryszkiewicz.us`)
- `sourceLabelVisible`
- `enrichmentStatus`
- `enrichmentReason`
- `enrichedAt`
- `custom`

Image-role rules:

- `image` remains the backward-compatible preview/render image for card rendering.
- `ogImage` and `twitterImage` preserve source provenance separately instead of being folded into `image`.
- Generic metadata parsing defaults `image` to `ogImage ?? twitterImage`.
- Platform-specific augmentation may keep low-value placeholders in `ogImage`/`twitterImage` for completeness while choosing a different `image` for rendering.
- `profileImage` is independent from all preview/social image roles and may equal `image`.

Minimal manual override example:

```json
{
  "id": "x",
  "label": "X",
  "url": "https://x.com/pryszkie",
  "type": "rich",
  "icon": "x",
  "description": "Short updates and project notes",
  "metadata": {
    "handle": "pryszkie",
    "profileDescription": "We the people demand justice for the victims.",
    "sourceLabel": "x.com"
  },
  "enrichment": {
    "enabled": true
  }
}
```

Runtime notes:

- `profileDescription` only changes card copy for supported social profile links. Non-profile links continue to use `descriptionSource` plus the existing fetched/manual fallback order.
- `followersCount*`, `followingCount*`, and `subscribersCount*` drive the profile-header metric chips on supported social cards.
- Those audience fields also feed the follower-history pipeline when a nightly or local `bun run followers:history:sync` snapshot is taken.
- `links[].enrichment.profileSemantics="non_profile"` is the supported way to keep a rich link on generic rich-card behavior even when the URL belongs to a profile-capable site family.

#### URL-first handle extraction (v1)

- Runtime and enrichment use URL-only handle extraction (no HTML/meta-tag scraping).
- Resolution precedence is:
  1. manual `links[].metadata.handle`
  2. URL-derived handle when supported
- `links[].enrichment.profileSemantics` controls whether a rich link participates in profile handling:
  - `auto` (default): infer from URL family plus the handle rules above
  - `profile`: require profile semantics when a supported profile can be resolved; validation warns when it cannot
  - `non_profile`: opt out of profile semantics, handle warnings, profile-header metadata expectations, and avatar-first profile layout
- Supported extractor families in v1: GitHub, X/Twitter, LinkedIn, Facebook, Instagram, Medium, Substack patterns.
- If a URL is from a supported family but no handle can be resolved and `metadata.handle` is missing, validation emits a warning-level handle coverage issue unless `links[].enrichment.profileSemantics="non_profile"` is set.
- Handle coverage warnings are non-strict-blocking and do not fail `bun run validate:data:strict`.

Current profile-card-capable rich-link families include:

- GitHub: avatar + follower/following counts when public profile HTML exposes them
- Instagram: avatar + follower/following counts
- LinkedIn: authenticated-cache-backed avatar-first profile cards, including `profileDescription` when the cached metadata provides it
- Medium: avatar-first profile cards with public follower-count augmentation
- Primal: avatar-first profile cards with public follower/following metrics when available
- Substack: avatar-first profile cards with subscriber counts and custom-domain support via explicit/manual handle fallback
- X: avatar-first profile cards with best-effort public follower/following metrics and optional `profileDescription`
- YouTube: avatar + subscriber counts
- Facebook: authenticated-cache-backed avatar-first profile cards without audience-count guarantees in the current pass

Profile styling is still data-driven rather than a separate link type. A supported social profile URL plus the normalized metadata above is what flips a card onto the avatar-first profile path.

#### Enrichment policy (`links[].enrichment`)

Per-link controls:

- `enabled`
- `profileSemantics`: `auto` (default), `profile`, or `non_profile`
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
- `publicCachePath`: committed stable public metadata cache manifest path (default `data/cache/rich-public-cache.json`), refreshed only by explicit write-cache flows.
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
- local runtime overlay: `data/cache/rich-public-cache.runtime.json` (gitignored)
- local runtime overlay schema: `schema/rich-public-cache.runtime.schema.json`

Canonical authenticated extractor + cache registries:

- `data/policy/rich-authenticated-extractors.json`
- `schema/rich-authenticated-extractors.schema.json`
- `data/cache/rich-authenticated-cache.json`
- `schema/rich-authenticated-cache.schema.json`
- `public/cache/rich-authenticated/` (committed local assets)
- `output/playwright/auth-rich-sync/` (diagnostics, gitignored)

Canonical committed image cache registry:

- `data/cache/content-images.json`
- `public/cache/content-images/` (committed local assets)
- `data/cache/content-images.runtime.json` (gitignored runtime revalidation state)

When an enrichment-enabled rich link URL matches a `status=blocked` registry entry, enrichment fails early with reason `known_blocker` unless `links[].enrichment.allowKnownBlocker=true` is set for that link.

During routine `bun run enrich:rich` / `bun run enrich:rich:strict` runs, successful direct/public enrichment uses fetched metadata for the current generated output but only persists volatile revalidation state (`etag`, `lastModified`, `cacheControl`, `expiresAt`, `checkedAt`) into the local runtime overlay. The committed stable manifest at `data/cache/rich-public-cache.json` is refreshed only by explicit write flows such as `bun run enrich:rich:strict:write-cache` or other dedicated cache-sync commands like `bun run public:rich:sync`. If fetched metadata drifts while stable writes are disabled, OpenLinks clears runtime freshness for that cache key so stale committed metadata is never treated as fresh on later runs.

If a direct/public fetch fails but a committed public cache entry already exists, enrichment reuses that stale cached metadata as a warning-level fallback. In `bun run validate:data:strict`, that stale-cache reuse remains non-strict-blocking when the cached metadata is complete and does not require manual fallback; stale cache entries that are incomplete still fail strict validation. No raw public HTML snapshots are committed, and header-only refreshes no longer rewrite tracked cache timestamps.

Built-in public augmentation currently covers Medium (RSS/feed), Rumble (public about-page fetch with avatar/banner separation), Substack (canonical public profile fetch with original source-label preservation), X profiles (oEmbed + avatar), X communities (public OG community metadata), Instagram (public page metadata), and YouTube (public page metadata) without using `authenticatedExtractor`.

When `links[].enrichment.authenticatedExtractor` is configured, enrichment uses committed cache entries (`reason=authenticated_cache`) and fails early with `authenticated_cache_missing` if cache data/assets are missing or invalid.

`bun run dev` and `bun run build` run strict enrichment pre-steps and fail on configured blocking reasons plus known-blocker policy violations. Those routine pre-steps update only the local runtime overlay unless you intentionally run an explicit `*:write-cache` command.  
Temporary emergency local bypass is available with `OPENLINKS_RICH_ENRICHMENT_BYPASS=1`.

#### Public follower-history artifacts

OpenLinks can publish append-only follower/subscriber snapshots for the profile-oriented platforms that currently expose audience counts.

Canonical public outputs:

- `public/history/followers/index.json`
- `public/history/followers/<platform>.csv`

Update command:

```bash
bun run followers:history:sync
```

History rules:

- one row is appended per nightly/local snapshot run even if the count is unchanged
- observed drops are preserved exactly as captured
- rows stay append-only unless a maintainer manually edits the CSV later
- each row keeps audit columns: `observedAt`, `linkId`, `platform`, `handle`, `canonicalUrl`, `audienceKind`, `audienceCount`, `audienceCountRaw`, `source`

Current `index.json` shape:

```json
{
  "version": 1,
  "updatedAt": "2026-03-10T02:29:19.676Z",
  "entries": [
    {
      "linkId": "github",
      "label": "GitHub",
      "platform": "github",
      "handle": "prizz",
      "canonicalUrl": "https://github.com/pRizz",
      "audienceKind": "followers",
      "csvPath": "history/followers/github.csv",
      "latestAudienceCount": 90,
      "latestAudienceCountRaw": "90 followers",
      "latestObservedAt": "2026-03-10T02:29:19.676Z"
    }
  ]
}
```

Representative CSV:

```csv
observedAt,linkId,platform,handle,canonicalUrl,audienceKind,audienceCount,audienceCountRaw,source
2026-03-10T02:29:19.676Z,github,github,prizz,https://github.com/pRizz,followers,90,90 followers,public-cache
```

The follower-history sync reads the normalized audience metadata that runtime also uses for profile-card header metrics. That means both public-augmented and authenticated-cache-backed profiles can contribute history when they expose a primary audience field.

#### Analytics and share surfaces

The social-card system now exposes a few behavior-only surfaces that are driven by the data above rather than separate config keys:

- Profile header:
  - analytics button appears when follower-history index data is available
  - share button is always present and uses a clean-URL native-share/copy payload
- Card header row:
  - analytics button appears only for cards that have public follower-history data
  - share button appears on non-payment cards, including cards without history
- Analytics UI:
  - default range is `30D`
  - available presets are `30D`, `90D`, `180D`, and `All`
  - charts stay mostly separate by platform unless a future charting change can preserve legible multi-axis comparison

Use `docs/social-card-verification.md` for the current manual QA checklist and automated coverage map for these surfaces.

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
- `richCards.descriptionImageRow.default`: `auto` (default) or `off` for extra rich-profile preview media
- `richCards.descriptionImageRow.sites`: optional override map keyed by exact hostnames or known site ids such as `substack`
- `richCards.descriptionImageRow.placement.default`: `top-banner` (default) or `bottom-row`
- `richCards.descriptionImageRow.placement.sites`: optional placement override map keyed like `descriptionImageRow.sites`
- `richCards.descriptionImageRow.bannerMinAspectRatio`: numeric banner cutoff (default `2`)
- `richCards.descriptionImageRow.nonBannerFallback.default`: `off` (default) or `compact-end`
- `richCards.descriptionImageRow.nonBannerFallback.sites`: optional fallback override map keyed like `descriptionImageRow.sites`
- `richCards.mobile.imageLayout`: legacy `inline` / `full-width` setting retained for backward compatibility; unified non-payment card layout now ignores it
- `richCards.enrichment.publicCachePath`: path to committed public rich-cache manifest
- `richCards.enrichment.authenticatedCachePath`: path to authenticated rich-cache manifest
- `richCards.enrichment.authenticatedCacheWarnAgeDays`: stale warning threshold for authenticated cache entries
- `richCards.enrichment.failureMode`: `immediate` (default), `aggregate`
- `richCards.enrichment.failOn`: blocking reasons (`fetch_failed`, `metadata_missing`)
- `richCards.enrichment.allowManualMetadataFallback`: use manual metadata as warning-level fallback when remote metadata is missing
- `payments.qr.displayDefault`: `always`, `toggle`, `hidden`
- `payments.qr.styleDefault`: `square`, `rounded`, `dots`
- `payments.qr.foregroundColorDefault`, `payments.qr.backgroundColorDefault`: optional site-wide overrides; when omitted, runtime defaults follow the active theme using `--text-primary` and `--surface-panel`
- `payments.qr.logoModeDefault`: `rail-default`, `custom`, `none`
  `rail-default` preserves the single-rail fallback when no site/company identity resolves, while explicit per-rail `logoMode` still overrides the newer implicit composite default
- `payments.qr.logoSizeDefault`
- `payments.qr.fullscreenDefault`: `enabled`, `disabled`
- `payments.effects.enabledDefault`: opt payment cards into special effects by default
- `payments.effects.defaultEffects`: optional site-wide effect list (`particles`, `lightning-particles`, `glitter-particles`)
- `payments.effects.glitterPaletteDefault`: `gold`, `ice`
- `footer.description`: optional descriptive footer text
- `footer.ctaLabel`: optional CTA button label
- `footer.ctaUrl`: optional CTA target URL (defaults to the current GitHub repository URL)
- `footer.prompt.enabled`: toggle the bootstrap prompt card in the footer
- `footer.prompt.title`: optional prompt section title
- `footer.prompt.explanation`: optional short explanation above the prompt text
- `footer.prompt.text`: optional copyable bootstrap prompt text (defaults to the canonical generated bootstrap prompt with absolute GitHub doc URLs for this repository)
- `footer.showBuildInfo`: toggle the footer build-provenance row (`Built <UTC>` plus an optional commit link)
- `footer.showLastUpdated`: legacy alias for `footer.showBuildInfo`

Maintainers should keep the markdown OpenClaw prompt snippets synchronized with `bun run openclaw:prompts:sync` and verify drift with `bun run openclaw:prompts:check`.

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

#### `ui.richCards.descriptionImageRow`

Controls optional preview media for rich profile cards when `metadata.image` is distinct from `metadata.profileImage`.

- `default`
  - `auto` (default): enable profile preview media when the card is rich, profile-oriented, and has a distinct preview image
  - `off`: never render the extra preview media
- `sites`
  - optional override map keyed by exact hostnames (`peter.ryszkiewicz.us`) or known site ids (`substack`, `github`, `medium`)
- `placement.default`
  - `top-banner` (default): render banner-shaped preview images above the avatar/title block
  - `bottom-row`: preserve the legacy full-width media row after the description
- `placement.sites`
  - optional override map keyed like `sites`
- `bannerMinAspectRatio`
  - default `2`
  - preview images below the cutoff are treated as non-banner media
- `nonBannerFallback.default`
  - `off` (default): hide non-banner preview images when `placement.default` resolves to `top-banner`
  - `compact-end`: render non-banner preview images as a compact end-of-card tile in the content column
- `nonBannerFallback.sites`
  - optional override map keyed like `sites`

Resolution precedence:

1. Exact hostname key from the link URL or host-like source label
2. Known site id from the link icon/URL
3. `site.ui.richCards.descriptionImageRow.default`

Additional notes:

- The preview media is rich-card only; simple cards ignore it.
- `richCards.imageTreatment: "off"` also suppresses it.
- `top-banner` qualification is runtime-only and uses the image's natural width/height ratio.
- Cards without a distinct preview image continue to render only the avatar/header plus description/footer flow.

#### `ui.richCards.mobile.imageLayout`

Legacy mobile rich-card image placement setting retained for backward-compatible config/schema support.

- `inline`
- `full-width`

Current runtime behavior: unified non-payment cards always use the shared lead-left layout across breakpoints, so this setting and `links[].metadata.mobileImageLayout` no longer affect rendering.

#### `quality.seo` image materialization behavior

- SEO image candidates (`socialImageFallback`, defaults, profile overrides) are included in `images:sync`.
- Starter config uses a generated local site preview at `/generated/seo/social-preview.png`, produced by `bun run social:preview:generate`.
- Runtime SEO tags (`og:image`, `twitter:image`) use baked local assets when available.
- Runtime never falls back to remote SEO image URLs; unresolved remote candidates fall back to `/openlinks-social-fallback.png`.

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
- `ctaUrl`: CTA destination URL (when omitted, runtime uses the current GitHub repository URL).
- `prompt.enabled`: controls whether the footer renders the copyable bootstrap prompt card.
- `prompt.title`: heading shown above the bootstrap prompt.
- `prompt.explanation`: short helper copy explaining how to use the prompt.
- `prompt.text`: copyable prompt text shown in the footer compact field for single-line values, with a preformatted fallback for multiline values (when omitted, runtime uses repo-aware absolute GitHub doc URLs).
- `showBuildInfo`: controls rendering of the footer build-provenance row (`Built <UTC>` plus an optional `Commit <shortSha>` link).
- `showLastUpdated`: legacy alias for `showBuildInfo`. `showBuildInfo` wins when both are present.

Example:

```json
{
  "ui": {
    "footer": {
      "description": "OpenLinks is a personal, free, open source, version-controlled links site.\nFork it, customize it, and publish fast.",
      "ctaLabel": "Create Your OpenLinks",
      "prompt": {
        "enabled": true,
        "title": "Create your own OpenLinks site",
        "explanation": "Paste this bootstrap prompt into OpenClaw, Claude, or Codex to create a new OpenLinks site from this repository."
      },
      "showBuildInfo": true
    }
  }
}
```

The footer build-provenance row and `/build-info.json` expose the same runtime fields:
`builtAtIso`, `commitSha`, `commitShortSha`, and `commitUrl`.

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

For most maintainers, prefer the AI-assisted or Studio paths above and use the loop below only when you intentionally choose the manual fallback path.

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
- Social-card verification guide: `docs/social-card-verification.md`
- Authenticated extractor architecture/workflow: `docs/authenticated-rich-extractors.md`
- New extractor implementation workflow: `docs/create-new-rich-content-extractor.md`
