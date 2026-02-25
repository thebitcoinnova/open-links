# Customization Catalog (Data-Driven)

This document is the canonical inventory of all data-driven customization knobs used by OpenClaw day-2 Update/CRUD flows.

Use this catalog when `customization_path=customization-audit` in `docs/openclaw-update-crud.md`.

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
- `metadata`
- `enrichment`
- `custom`

## 4) `links[].metadata` (`links-metadata`)

Coverage:

- `title`
- `description`
- `image`
- `mobileImageLayout`
- `sourceLabel`
- `sourceLabelVisible`
- `enrichmentStatus`
- `enrichmentReason`
- `enrichedAt`
- `custom`

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
- `profileAvatarScale`
- `footer.description`
- `footer.ctaLabel`
- `footer.ctaUrl`
- `footer.showLastUpdated`

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
- `imageTreatment`
- `mobile.imageLayout`
- `enrichment.enabledByDefault`
- `enrichment.timeoutMs`
- `enrichment.retries`
- `enrichment.metadataPath`
- `enrichment.reportPath`
- `enrichment.authenticatedCachePath`
- `enrichment.authenticatedCacheWarnAgeDays`
- `enrichment.failureMode`
- `enrichment.failOn`
- `enrichment.allowManualMetadataFallback`

Related policy source:

- `data/policy/rich-enrichment-blockers.json`
- `data/policy/rich-authenticated-extractors.json`
- `data/cache/rich-authenticated-cache.json`

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
