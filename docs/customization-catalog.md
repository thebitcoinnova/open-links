# Customization Catalog (Data-Driven)

This document is the canonical inventory of all data-driven customization knobs used by OpenClaw day-2 Update/CRUD flows.

Use this catalog when `customization_path=customization-audit` in `docs/openclaw-update-crud.md`.

For behavior-level examples and fallback rules, use `docs/data-model.md`. For manual QA and automated regression references around the current social-card, analytics, and share surfaces, use `docs/social-card-verification.md`.

Recommended workflow posture:

- Prefer the repo's AI workflows/skills and automation docs for routine CRUD.
- Prefer the Studio webapp when the self-serve editor covers your workflow.
- Use this catalog as the knob inventory/reference layer.
- Drop to manual JSON edits only when you need the lower-level fallback path.

## Audit Category IDs (for `focus_areas`)

Use these IDs when `audit_scope=focused`:

1. `profile`
2. `links-root`
3. `links-items`
4. `links-metadata`
5. `links-enrichment`
6. `site-core-theme`
7. `site-ui-layout`
8. `site-ui-typography`
9. `site-ui-brand-icons`
10. `site-ui-rich-cards`
11. `site-quality`
12. `extensions-guardrails`

## 1) `data/profile.json` (`profile`)

Coverage:

- `name`
- `headline`
- `avatar`
- `bio`
- `location`
- `pronouns`
- `status`
- `profileLinks[]`
- `contact`
- `custom`

## 2) `data/links.json` root (`links-root`)

Coverage:

- `links[]`
- `groups[]`
- `order[]`
- `custom`

## 3) `data/links.json` link items (`links-items`)

Coverage for each `links[]` item:

- `id`
- `label`
- `url`
- `type`
- `icon`
- `description`
- `group`
- `order`
- `enabled`
- `payment`
- `metadata`
- `enrichment`
- `custom`

## 4) `links[].metadata` (`links-metadata`)

Coverage:

- `title`
- `description`
- `profileDescription`
- `descriptionSource`
- `image`
- `profileImage`
- `imageFit`
- `mobileImageLayout` (legacy no-op for unified non-payment card layout)
- `handle`
- `followersCount`
- `followersCountRaw`
- `followingCount`
- `followingCountRaw`
- `subscribersCount`
- `subscribersCountRaw`
- `sourceLabel`
- `sourceLabelVisible`
- `enrichmentStatus`
- `enrichmentReason`
- `enrichedAt`
- `custom`

Notes:
`profileDescription` is only used for supported social profile links and takes precedence over the generic fetched/manual description-source policy when present.

Audience-count fields (`followersCount*`, `followingCount*`, `subscribersCount*`) power two downstream surfaces:

- profile-card header metrics
- follower-history snapshots under `public/history/followers/`

`sourceLabel` still defines the displayed source/domain string, but known-platform custom domains are clarified automatically in card footers as `Platform · domain`.

## 5) `links[].enrichment` (`links-enrichment`)

Coverage:

- `enabled`
- `allowKnownBlocker`
- `authenticatedExtractor`
- `authenticatedCacheKey`
- `sourceLabel`
- `sourceLabelVisible`
- `custom`

## 6) `data/site.json` core and theme (`site-core-theme`)

Coverage:

- `title`
- `description`
- `baseUrl`
- `theme.active`
- `theme.available`

## 7) `site.ui` layout and interaction (`site-ui-layout`)

Coverage:

- `compositionMode`
- `groupingStyle`
- `profileRichness`
- `density`
- `modePolicy`
- `linkTarget`
- `desktopColumns`
- `typographyScale`
- `typography`
- `targetSize`
- `payments.qr.displayDefault`
- `payments.qr.styleDefault`
- `payments.qr.foregroundColorDefault`
- `payments.qr.backgroundColorDefault`
- `payments.qr.logoModeDefault`
- `payments.qr.logoSizeDefault`
- `payments.qr.fullscreenDefault`
- `payments.effects.enabledDefault`
- `payments.effects.defaultEffects`
- `payments.effects.glitterPaletteDefault`
- `payments.effects.bombasticityDefault`
- `profileAvatarScale`
- `footer.description`
- `footer.ctaLabel`
- `footer.ctaUrl`
- `footer.prompt.enabled`
- `footer.prompt.title`
- `footer.prompt.explanation`
- `footer.prompt.text`
- `footer.showBuildInfo`
- `footer.showLastUpdated` (legacy alias)

## 8) `site.ui.typography` (`site-ui-typography`)

Coverage:

- `global`
- `themes[themeId]`

Documented override keys:

- Font families:
  - `fontDisplay`
  - `fontBody`
- Type sizes:
  - `sizeTitle`
  - `sizeHeadline`
  - `sizeBody`
  - `sizeCaption`
  - `sizeCardTitle`
  - `sizeLinkTitle`
  - `sizeIcon`
- Line heights:
  - `lineHeightTitle`
  - `lineHeightBody`
  - `lineHeightCardTitle`
  - `lineHeightCardDescription`
- Font weights:
  - `weightCardTitle`
  - `weightLinkTitle`
  - `weightIcon`
- Letter spacing:
  - `trackingUtilityTitle`
  - `trackingSectionHeading`
  - `trackingCardSource`
  - `trackingIcon`
- Text transforms:
  - `transformUtilityTitle`
  - `transformSectionHeading`
  - `transformContactLabel`

## 9) `site.ui.brandIcons` (`site-ui-brand-icons`)

Coverage:

- `colorMode`
- `contrastMode`
- `minContrastRatio`
- `sizeMode`
- `iconOverrides`

## 10) `site.ui.richCards` (`site-ui-rich-cards`)

Coverage:

- `renderMode`
- `sourceLabelDefault`
- `descriptionSource`
- `imageTreatment`
- `imageFit`
- `descriptionImageRow.default`
- `descriptionImageRow.sites`
- `mobile.imageLayout` (legacy no-op for unified non-payment card layout)
- `enrichment.enabledByDefault`
- `enrichment.timeoutMs`
- `enrichment.retries`
- `enrichment.metadataPath`
- `enrichment.reportPath`
- `enrichment.publicCachePath`
- `enrichment.authenticatedCachePath`
- `enrichment.authenticatedCacheWarnAgeDays`
- `enrichment.failureMode`
- `enrichment.failOn`
- `enrichment.allowManualMetadataFallback`

Related policy source:

- `data/policy/rich-enrichment-blockers.json`
- `data/cache/rich-public-cache.json`
- `data/policy/rich-authenticated-extractors.json`
- `data/cache/rich-authenticated-cache.json`

Related public artifact surface:

- `public/history/followers/index.json`
- `public/history/followers/*.csv`

Operational commands tied to this category:

- `bun run public:rich:sync -- --only-link <link-id>` (refresh public audience/profile cache entries where supported)
- `bun run followers:history:sync` (append public follower/subscriber snapshots into the public history artifacts)
- `bun run setup:rich-auth` (first-run capture for missing/invalid authenticated cache entries)
- `bun run auth:rich:sync -- --only-link <link-id>` (single-link capture)
- `bun run auth:rich:sync -- --only-link <link-id> --force` (force refresh even when cache is valid)
- `bun run auth:rich:clear -- --only-link <link-id>` (clear cache entry + unreferenced asset before recapture)
- `bun run auth:extractor:new -- --id <id> --domains <csv> --summary \"<summary>\"` (new extractor scaffold)

High-signal examples:

- Minimal supported profile link that lets enrichment populate avatar/metrics:
  - `{"id":"github","label":"GitHub","url":"https://github.com/pRizz","type":"rich","icon":"github","description":"Code, experiments, and open-source projects","enrichment":{"enabled":true}}`
- Manual profile-description override for a supported profile card:
  - `{"metadata":{"handle":"pryszkie","profileDescription":"We the people demand justice for the victims.","sourceLabel":"x.com"}}`
- Explicit handle for a custom-domain Substack profile:
  - `{"metadata":{"handle":"peterryszkiewicz"}}`
- Disable the extra rich-card description-image row globally:
  - `"descriptionImageRow": { "default": "off" }`
- Disable it for one site while leaving the global default on:
  - `"descriptionImageRow": { "default": "auto", "sites": { "substack": "off" } }`
- Target one exact custom-domain host:
  - `"descriptionImageRow": { "default": "auto", "sites": { "peter.ryszkiewicz.us": "off" } }`

Derived behavior without dedicated config keys:

- Card analytics actions appear only when the follower-history index has a matching entry for that link.
- Card share actions are available on non-payment cards even when analytics/history is unavailable.
- Profile-header share uses a clean-URL payload so copy fallback remains browser-paste-safe.

## 11) `site.quality` (`site-quality`)

Coverage:

- `reportPath`
- `summaryPath`
- `blockingDomains`
- `seo.*`
- `accessibility.*`
- `performance.*`

High-signal examples within `site.quality`:

- `seo.canonicalBaseUrl`
- `seo.socialImageFallback`
- `seo.defaults`
- `seo.overrides.profile`
- `accessibility.focusContrastStrict`
- `accessibility.manualSmokeChecks`
- `performance.routes`
- `performance.profiles.mobile`
- `performance.profiles.desktop`

Notes:

- The starter config points `seo.socialImageFallback` at `/generated/seo/social-preview.png`, which is created by `bun run social:preview:generate`.
- Forks that want a fully custom social card can still point `seo.socialImageFallback`, `seo.defaults.ogImage`, or `seo.defaults.twitterImage` at their own local asset paths.

## 12) Extension guardrails (`extensions-guardrails`)

Preferred extension namespace:

- `profile.custom`
- `links.custom`
- `site.custom`
- `links[].custom`
- `links[].metadata.custom`
- `links[].enrichment.custom`

Guardrails:

- Keep core fields in schema-defined keys.
- Use `custom` for extension data.
- Avoid reserved-key collisions inside `custom` (for example, reusing `title`, `theme`, `type` at the same object level).
- Unknown top-level keys are allowed but produce warnings and should be intentional.

## Out of scope for Day-2 CRUD

Runtime/code-level customizations are out of scope for this day-2 data CRUD path.

For code-level extensions (new theme files, resolver changes, component/layout code updates), use:

- `docs/theming-and-layouts.md`
