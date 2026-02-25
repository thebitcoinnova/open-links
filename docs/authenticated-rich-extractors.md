# Authenticated Rich Extractors

This guide documents the authenticated-extractor framework for rich cards when direct metadata fetch is blocked (authwall, anti-bot, challenge pages).

## Purpose

For links configured with `links[].enrichment.authenticatedExtractor`, OpenLinks does not perform direct HTTP metadata fetch during enrichment.  
Instead, enrichment reads committed metadata/image assets from the authenticated cache manifest.

If cache data is missing or invalid, enrichment and validation fail early in all lanes unless bypass is active.

## Canonical Files

- Extractor policy registry: `data/policy/rich-authenticated-extractors.json`
- Extractor policy schema: `schema/rich-authenticated-extractors.schema.json`
- Authenticated cache manifest: `data/cache/rich-authenticated-cache.json`
- Authenticated cache schema: `schema/rich-authenticated-cache.schema.json`
- Local committed assets directory: `public/cache/rich-authenticated/`

## Link and Site Configuration

### Per-link

Under `links[].enrichment`:

- `authenticatedExtractor`: extractor id (for example `linkedin-auth-browser`)
- `authenticatedCacheKey`: optional cache key override (defaults to `link.id`)

### Site-level

Under `site.ui.richCards.enrichment`:

- `authenticatedCachePath` (default `data/cache/rich-authenticated-cache.json`)
- `authenticatedCacheWarnAgeDays` (default `30`, warning-only)

## Sync Workflow

Primary command:

```bash
npm run auth:rich:sync
```

Useful filters:

```bash
npm run auth:rich:sync -- --only-link linkedin
npm run auth:rich:sync -- --only-extractor linkedin-auth-browser
npm run auth:rich:sync -- --force
```

Workflow behavior:

1. Loads configured rich links that use `authenticatedExtractor`.
2. Loads extractor policy and plugin registry.
3. Guides login/session establishment once per extractor group.
4. Extracts metadata and downloads image assets to `public/cache/rich-authenticated/`.
5. Updates `data/cache/rich-authenticated-cache.json`.
6. Prints summary and remediation for failures.

Commit both manifest and assets after successful sync.

## Build and Validation Enforcement

- `npm run enrich:rich` and `npm run enrich:rich:strict`:
  - use cache for authenticated links (`reason=authenticated_cache`)
  - fail on missing/invalid cache (`reason=authenticated_cache_missing`)
- `npm run validate:data` and `npm run validate:data:strict`:
  - verify extractor id exists and domain policy matches
  - verify cache entry exists and required fields are present
  - verify local asset file exists
  - emit stale cache warnings when age exceeds `authenticatedCacheWarnAgeDays`

Global bypass (local emergency use only):

```bash
OPENLINKS_RICH_ENRICHMENT_BYPASS=1 npm run build
```

## Security Boundaries

- No cookies, credentials, or browser session state are committed.
- No raw HTML snapshots are committed as part of authenticated cache.
- Committed cache includes metadata + local asset references + diagnostics only.
- Authenticated login is currently local/manual.

## Adding a New Extractor

To add future blocked domains:

1. Add policy entry to `data/policy/rich-authenticated-extractors.json`.
2. Implement plugin in `scripts/authenticated-extractors/plugins/`.
3. Register plugin in `scripts/authenticated-extractors/registry.ts`.
4. Configure `links[].enrichment.authenticatedExtractor` for relevant links.
5. Run `npm run auth:rich:sync` and commit cache/asset updates.
