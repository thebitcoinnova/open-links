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

Diagnostics artifacts (gitignored):

- `output/playwright/auth-rich-sync/`
- `output/playwright/auth-flow/`

## Link and Site Configuration

### Per-link

Under `links[].enrichment`:

- `authenticatedExtractor`: extractor id (for example `linkedin-auth-browser`)
- `authenticatedCacheKey`: optional cache key override (defaults to `link.id`)

Current extractor ids in this repository:

- `linkedin-auth-browser` (LinkedIn profile extraction via authenticated browser session)
- `medium-auth-browser` (Medium profile extraction via RSS feed capture path)
- `x-auth-browser` (X profile extraction via oEmbed + avatar capture path)
- `facebook-auth-browser` (Facebook profile extraction via authenticated browser session + profile image capture)

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

`setup:rich-auth` is idempotent by design.

## Full Sync Workflow

Manual/full capture command:

```bash
npm run auth:rich:sync
```

Useful filters:

```bash
npm run auth:rich:sync -- --only-link linkedin
npm run auth:rich:sync -- --only-link medium
npm run auth:rich:sync -- --only-link x
npm run auth:rich:sync -- --only-link facebook
npm run auth:rich:sync -- --only-extractor linkedin-auth-browser
npm run auth:rich:sync -- --only-extractor medium-auth-browser
npm run auth:rich:sync -- --only-extractor x-auth-browser
npm run auth:rich:sync -- --only-extractor facebook-auth-browser
npm run auth:rich:sync -- --only-missing
npm run auth:rich:sync -- --force
npm run auth:rich:sync -- --only-link linkedin --only-missing --force
```

Behavior notes:

- Full sync (`auth:rich:sync`) re-captures selected links.
- `--only-missing` skips valid cache entries.
- `--only-missing --force` refreshes selected links even when cache is valid.

## Generic Auth Flow Assist

Reusable helper command for transition-driven auth debugging:

```bash
npm run auth:flow:assist -- --extractor <extractor-id> --url <target-url>
```

Optional wait overrides:

```bash
npm run auth:flow:assist -- --extractor <extractor-id> --url <target-url> --auth-timeout-ms 900000 --poll-ms 1500
```

The command delegates to extractor `ensureSession`, captures structured transition/action reports when available, and writes gitignored artifacts under `output/playwright/auth-flow/`.

## Clear Authenticated Cache

Use `auth:rich:clear` when cache entries or assets should be reset before recapture.

```bash
npm run auth:rich:clear -- --only-link linkedin --dry-run
npm run auth:rich:clear -- --only-link linkedin
npm run auth:rich:clear -- --only-extractor linkedin-auth-browser
npm run auth:rich:clear -- --cache-key linkedin
npm run auth:rich:clear -- --all
```

Safety rules:

- one selector is required (`--only-link`, `--only-extractor`, or `--cache-key`) unless `--all` is explicitly set
- dry-run mode reports changes without modifying files
- only unreferenced assets under `public/cache/rich-authenticated/` are removed
- run `npm run setup:rich-auth` after clear to repopulate cache

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

## Generic Auth Flow Runtime

New extractors should use shared auth-flow helpers:

- `scripts/authenticated-extractors/browser-session.ts`
- `scripts/authenticated-extractors/auth-flow-runtime.ts`
- `scripts/shared/embedded-code-loader.ts`

Required auth-state taxonomy:

- `login`
- `mfa_challenge`
- `post_auth_consent`
- `authenticated`
- `blocked`
- `unknown`

Runtime guarantees:

- transition logs on state-signature changes
- heartbeat logs while state is unchanged
- ask-first confirmation for action candidates (per action)
- unknown-state pause + operator choice (continue/abort)
- actionable failure in non-interactive mode when user confirmation is required

## Embedded Browser Code Files

Do not inline browser `eval` payloads in extractor/debug TypeScript files.

- Store browser snippets under `scripts/embedded-code/browser/<provider>/`.
- Load snippet text via `loadEmbeddedCode(...)` from `scripts/shared/embedded-code-loader.ts`.
- For scaffold templates, store source in `scripts/authenticated-extractors/plugins/*.template.ts` and render tokens via shared template replacement helpers.
- Scaffold token placeholders are intentionally named and must be replaced by the scaffold script:
  - `__EXTRACTOR_ID__`
  - `__EXTRACTOR_VERSION__`
  - `__DEFAULT_SESSION__`
  - `__EXPORT_NAME__`

Guardrail command:

```bash
npm run quality:embedded-code
```

This check is enforced in strict/CI flows.

## LinkedIn Auth Session Behavior

LinkedIn extractor session handling is autonomous after browser launch:

- opens headed browser when auth is required
- watches URL + cookies + DOM markers
- classifies state transitions (`login`, `mfa_challenge`, `authwall`, `authenticated`, `unknown`)
- proceeds automatically once authenticated (MFA is optional)
- times out with explicit diagnostics if login or challenge flow is not completed

No Enter key checkpoint is required.

## Medium Extractor Behavior

The Medium extractor (`medium-auth-browser`) uses a feed capture path:

- resolves feed URL from profile URL (`https://medium.com/feed/<target>`)
- parses feed channel metadata (`title`, `description`, image URL)
- rejects challenge/placeholder responses
- downloads image asset to `public/cache/rich-authenticated/`
- writes cache entry with diagnostics notes (`feedUrl`, `cacheKey`)

No interactive login is currently required for the Medium extractor path.

## X Extractor Behavior

The X extractor (`x-auth-browser`) uses an oEmbed + avatar path:

- resolves handle from `x.com/<handle>` (or `twitter.com/<handle>`)
- verifies profile availability via `https://publish.twitter.com/oembed`
- generates stable title/description when oEmbed title is blank
- captures image asset from `https://unavatar.io/x/<handle>` (fallback to X icon asset)
- writes cache diagnostics including `handle`, `oembedUrl`, and placeholder checks

No interactive login is currently required for the X extractor path.

## Facebook Extractor Behavior

The Facebook extractor (`facebook-auth-browser`) uses an authenticated browser-session path:

- opens the target profile and verifies authenticated session state
- requires local interactive login when session cookies are missing or expired
- classifies login, MFA/challenge, trust-device consent, blocked, and authenticated states
- proposes trust-device action candidate(s) and asks for explicit confirmation before click
- pauses and prompts on unknown states
- extracts title/description/profile-image candidates from authenticated DOM content
- rejects login-wall, challenge placeholders, and generic non-profile image assets
- downloads the detected profile image with current browser cookies and writes a local cached asset
- writes cache diagnostics including state signals and captured URL/session context

LinkedIn debug commands:

```bash
npm run linkedin:debug:bootstrap
npm run linkedin:debug:login
npm run linkedin:debug:validate
npm run linkedin:debug:validate:cookie-bridge
npm run auth:flow:assist -- --extractor facebook-auth-browser --url https://www.facebook.com/<profile>
```

## Local Auth Wait Controls

For interactive authenticated extractor waiting (LinkedIn/Facebook):

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

If this extractor workflow helped you, kindly consider opening a pull request against https://github.com/pRizz/open-links so everyone can benefit. Feedback and refinements are appreciated.
