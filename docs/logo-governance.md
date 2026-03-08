# OpenLinks Logo Governance

This document defines the canonical OpenLinks logo asset paths and archive policy.

## Current Active Logo

- Winner label: `inset / centerline-2x / centered / c10-l10`
- Winner id: `inset--centerline-2x--centered--c10-l10`
- Winner source file:
  - `public/branding/openlinks-logo/v3/ol-mark--v3--inset--centerline-2x--centered--c10-l10.svg`

## Canonical and Alias Paths

The following files are treated as active logo aliases and should remain content-identical:

- `public/branding/openlinks-logo/openlinks-logo.svg` (global primary)
- `public/branding/openlinks-logo/openlinks-logo-v3.svg` (explicit v3 alias)
- `public/branding/openlinks-logo/v3/openlinks-logo.svg` (version-local canonical alias)

Historical explicit aliases remain version-pinned and are not content-identical to the active logo:

- `public/branding/openlinks-logo/openlinks-logo-v2.svg`
- `public/branding/openlinks-logo/v2/openlinks-logo.svg`

## Archive Policy

- V1 is already versioned and remains unchanged:
  - `public/branding/openlinks-logo/v1/`
- V2 remains available as the previous versioned winner/archive set:
  - `public/branding/openlinks-logo/v2/`
  - `docs/assets/openlinks-logo/v2/archive/openlinks-logo-variants.svg`
- For V3, only the winner stays in active V3 root.
- All non-winner V3 generated mark files are archived in:
  - `public/branding/openlinks-logo/v3/archive/`
- V3 archive metadata is stored in:
  - `public/branding/openlinks-logo/v3/archive/manifest.json`
- V3 comparison sheet is stored in:
  - `docs/assets/openlinks-logo/v3/openlinks-logo-variants.svg`
- V2 non-winner generated mark files remain archived in:
  - `public/branding/openlinks-logo/v2/archive/`
- V2 archive metadata and dedupe alias mappings remain stored in:
  - `public/branding/openlinks-logo/v2/archive/manifest.json`
- V2 archived comparison sheet remains stored in:
  - `docs/assets/openlinks-logo/v2/archive/openlinks-logo-variants.svg`

## Regeneration Workflow

Rebuild all logo outputs (V1 + V2 active/archive + V3 active/archive) using:

```bash
bun scripts/generate-openlinks-logo-variants.ts
```

The generator is the source of truth for canonical ids, aliases, and archive placement.

## Runtime Brand Assets

Runtime browser/app icons are generated from the active canonical alias:

- `public/branding/openlinks-logo/openlinks-logo.svg`

Generate runtime brand assets directly with:

```bash
bun run branding:assets
```

The logo-variant generator also triggers this command path after canonical/logo updates.

### Main app output root (`public/`)

- `favicon.svg`
- `favicon-16x16.png`
- `favicon-32x32.png`
- `favicon.ico`
- `apple-touch-icon.png`
- `android-chrome-192x192.png`
- `android-chrome-512x512.png`
- `site.webmanifest`
- `branding/openlinks-logo/openlinks-logo.svg`

### Studio output root (`packages/studio-web/public/`)

- `favicon.svg`
- `favicon-16x16.png`
- `favicon-32x32.png`
- `favicon.ico`
- `apple-touch-icon.png`
- `android-chrome-192x192.png`
- `android-chrome-512x512.png`
- `site.webmanifest`
- `branding/openlinks-logo/openlinks-logo.svg`

## Favicon Badge Policy

- Tiny browser icons (`favicon.svg`, PNG favicon sizes, ICO) use a high-contrast circular badge treatment for legibility at 16-32 px.
- The badge reuses the active canonical mark geometry and stroke weights; only presentation contrast is adjusted for favicon readability.
- Header/social surfaces use the same logo family without forcing tiny-icon badge styling.
