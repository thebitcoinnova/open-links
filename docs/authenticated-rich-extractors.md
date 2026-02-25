# Authenticated Rich Extractors

This guide documents the authenticated-extractor framework for rich cards when direct metadata fetch is blocked (authwall, anti-bot, challenge pages).

## Purpose

For links configured with `links[].enrichment.authenticatedExtractor`, OpenLinks does not perform direct HTTP metadata fetch during enrichment.
Instead, enrichment reads committed metadata/image assets from the authenticated cache manifest.

If cache data is missing or invalid, enrichment and validation fail early in all lanes unless bypass is active.
Build/dev remain non-interactive and do not auto-open browsers.

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

## First-Run Setup Workflow

Primary onboarding command:

```bash
npm run setup:rich-auth
```

`setup:rich-auth` runs authenticated capture in `--only-missing` mode:

1. Loads configured rich links using `authenticatedExtractor`.
2. Validates current cache entries.
3. Skips links with already-valid cache entries.
4. Captures only missing/invalid entries.
5. Writes timestamped diagnostics artifact to `output/playwright/auth-rich-sync/`.

If no configured authenticated links are missing cache data, it exits 0 as a no-op.

## Full Sync Workflow

Manual/full capture command:

```bash
npm run auth:rich:sync
```

Useful filters:

```bash
npm run auth:rich:sync -- --only-link linkedin
npm run auth:rich:sync -- --only-extractor linkedin-auth-browser
npm run auth:rich:sync -- --only-missing
npm run auth:rich:sync -- --force
```

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

When setup is missing, diagnostics should first point to:

```bash
npm run setup:rich-auth
```

Global bypass (local emergency use only):

```bash
OPENLINKS_RICH_ENRICHMENT_BYPASS=1 npm run build
```

## LinkedIn Auth Session Behavior

LinkedIn extractor session handling is autonomous after browser launch:

- opens headed browser when auth is required
- watches URL + cookies + DOM markers
- classifies state transitions (`login`, `mfa_challenge`, `authwall`, `authenticated`, `unknown`)
- proceeds automatically once authenticated
- times out with explicit diagnostics if login/MFA is not completed

No Enter key checkpoint is required.

## Local Auth Wait Controls

For LinkedIn one-off scripts and extractor auth waiting:

- `OPENLINKS_AUTH_SESSION_TIMEOUT_MS` (default `600000`)
- `OPENLINKS_AUTH_SESSION_POLL_MS` (default `2000`)

One-off overrides:

- `--auth-timeout-ms <ms>`
- `--poll-ms <ms>`

## Security Boundaries

- No cookies, credentials, or browser session state are committed.
- No raw HTML snapshots are committed as part of authenticated cache.
- Committed cache includes metadata + local asset references + diagnostics only.
- Authenticated login remains local/manual for credentials and MFA completion.

## Adding a New Extractor

Scaffold command:

```bash
npm run auth:extractor:new -- --id <extractor-id> --domains <domain1,domain2> --summary "<summary>"
```

The command creates:

- plugin template in `scripts/authenticated-extractors/plugins/`
- registry wiring in `scripts/authenticated-extractors/registry.ts`
- policy entry in `data/policy/rich-authenticated-extractors.json` (`status=experimental`)

Then complete implementation using:

- `docs/create-new-rich-content-extractor.md`
- `skills/create-new-rich-content-extractor/SKILL.md`
