# OpenLinks Logo Governance

This document defines the canonical OpenLinks logo asset paths and archive policy.

## Current Active Logo

- Winner label: `inset / centerline-2x / centered`
- Winner id: `inset--centerline-2x--centered`
- Winner source file:
  - `public/branding/openlinks-logo/v2/ol-mark--v2--inset--centerline-2x--centered.svg`

## Canonical and Alias Paths

The following files are treated as active logo aliases and should remain content-identical:

- `public/branding/openlinks-logo/openlinks-logo.svg` (global primary)
- `public/branding/openlinks-logo/openlinks-logo-v2.svg` (explicit v2 alias)
- `public/branding/openlinks-logo/v2/openlinks-logo.svg` (version-local canonical alias)

## Archive Policy

- V1 is already versioned and remains unchanged:
  - `public/branding/openlinks-logo/v1/`
- For V2, only the winner stays in active V2 root.
- All non-winner V2 generated mark files are archived in:
  - `public/branding/openlinks-logo/v2/archive/`
- Archive metadata and dedupe alias mappings are stored in:
  - `public/branding/openlinks-logo/v2/archive/manifest.json`
- Archived comparison sheet is stored in:
  - `docs/assets/openlinks-logo/v2/archive/openlinks-logo-variants.svg`

## Regeneration Workflow

Rebuild all logo outputs (V1 + V2 active + V2 archive) using:

```bash
bun scripts/generate-openlinks-logo-variants.ts
```

The generator is the source of truth for canonical ids, aliases, and archive placement.
