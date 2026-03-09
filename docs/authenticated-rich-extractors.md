# Authenticated Rich Extractors

This guide documents the authenticated-extractor framework for rich cards when stable public sources are insufficient and authenticated browser capture is actually required.

Authenticated extraction is a fallback workflow after public-source triage, not the default first move. Before adding or changing authenticated extractor support, first run the decision process in [`docs/create-new-rich-content-extractor.md`](docs/create-new-rich-content-extractor.md) and prefer `public_direct` or `public_augmented` whenever stable public sources can satisfy the required fields.

## Purpose

For links configured with `links[].enrichment.authenticatedExtractor`, OpenLinks does not perform direct HTTP metadata fetch during enrichment.
Instead, enrichment reads committed metadata/image-role assets from the authenticated cache manifest.

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

- `linkedin-auth-browser` (LinkedIn profile extraction via authenticated browser session; cached image is reused as the avatar-first profile-card image)
- `facebook-auth-browser` (Facebook profile extraction via authenticated browser session + profile image capture)

Current public-augmentation examples that are no longer configured as authenticated extractors:

- Medium (RSS/feed capture path, plus optional public browser follower refresh)
- X (oEmbed + avatar path)
- Instagram (public page metadata capture)
- YouTube (public page metadata capture)

See `docs/rich-extractor-public-first-audit.md` for the branch audit that locked this split.

### Site-level

Under `site.ui.richCards.enrichment`:

- `authenticatedCachePath` (default `data/cache/rich-authenticated-cache.json`)
- `authenticatedCacheWarnAgeDays` (default `30`, warning-only)

## First-Run Setup Workflow

Primary onboarding command:

```bash
bun run setup:rich-auth
```

`setup:rich-auth` runs authenticated capture in `--only-missing` mode:

1. Loads configured rich links using `authenticatedExtractor`.
2. Validates current cache entries.
3. Skips links with already-valid cache entries.
4. Captures only missing/invalid entries.
5. Writes timestamped diagnostics artifact to `output/playwright/auth-rich-sync/`.

If no configured authenticated links are missing cache data, it exits 0 as a no-op.

`setup:rich-auth` is idempotent by design.

Authenticated cache image-role rules:

- `metadata.image` stays the canonical render image.
- `metadata.profileImage` is the canonical identity/avatar image.
- `metadata.ogImage` and `metadata.twitterImage` preserve source provenance when an extractor can identify them.
- `assets.image`, `assets.profileImage`, `assets.ogImage`, and `assets.twitterImage` may point at the same committed local asset path when the underlying source URL is the same.

## Full Sync Workflow

Manual/full capture command:

```bash
bun run auth:rich:sync
```

Useful filters:

```bash
bun run auth:rich:sync -- --only-link linkedin
bun run auth:rich:sync -- --only-link facebook
bun run auth:rich:sync -- --only-extractor linkedin-auth-browser
bun run auth:rich:sync -- --only-extractor facebook-auth-browser
bun run auth:rich:sync -- --only-missing
bun run auth:rich:sync -- --force
bun run auth:rich:sync -- --only-link linkedin --only-missing --force
```

Behavior notes:

- Full sync (`auth:rich:sync`) re-captures selected links.
- `--only-missing` skips valid cache entries.
- `--only-missing --force` refreshes selected links even when cache is valid.

For Medium, X, Instagram, and YouTube, use `bun run enrich:rich:strict` instead. Those platforms now write material metadata through the committed public cache and keep volatile revalidation state in the local public-cache runtime overlay rather than the authenticated cache.

## Generic Auth Flow Assist

Reusable helper command for transition-driven auth debugging:

```bash
bun run auth:flow:assist -- --extractor <extractor-id> --url <target-url>
```

Optional wait overrides:

```bash
bun run auth:flow:assist -- --extractor <extractor-id> --url <target-url> --auth-timeout-ms 900000 --poll-ms 1500
```

The command delegates to extractor `ensureSession`, captures structured transition/action reports when available, and writes gitignored artifacts under `output/playwright/auth-flow/`.

## Clear Authenticated Cache

Use `auth:rich:clear` when cache entries or assets should be reset before recapture.

```bash
bun run auth:rich:clear -- --only-link linkedin --dry-run
bun run auth:rich:clear -- --only-link linkedin
bun run auth:rich:clear -- --only-extractor linkedin-auth-browser
bun run auth:rich:clear -- --cache-key linkedin
bun run auth:rich:clear -- --all
```

Safety rules:

- one selector is required (`--only-link`, `--only-extractor`, or `--cache-key`) unless `--all` is explicitly set
- dry-run mode reports changes without modifying files
- only unreferenced assets under `public/cache/rich-authenticated/` are removed
- run `bun run setup:rich-auth` after clear to repopulate cache

Commit both manifest and assets after successful sync.

## Build and Validation Enforcement

- `bun run enrich:rich` and `bun run enrich:rich:strict`:
  - use cache for authenticated links (`reason=authenticated_cache`)
  - fail on missing/invalid cache (`reason=authenticated_cache_missing`)
- `bun run validate:data` and `bun run validate:data:strict`:
  - verify extractor id exists and domain policy matches
  - verify cache entry exists and required fields are present
  - verify local asset file exists
  - emit stale cache warnings when age exceeds `authenticatedCacheWarnAgeDays`

When setup is missing, diagnostics should first point to:

```bash
bun run setup:rich-auth
```

Global bypass (local emergency use only):

```bash
OPENLINKS_RICH_ENRICHMENT_BYPASS=1 bun run build
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
bun run quality:embedded-code
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
- writes both `metadata.image` and `metadata.profileImage` so Facebook links render on the profile-card path
- preserves `metadata.ogImage` plus `assets.ogImage` when an authenticated page exposes a distinct Open Graph image
- writes cache diagnostics including state signals and captured URL/session context

LinkedIn debug commands:

```bash
bun run linkedin:debug:bootstrap
bun run linkedin:debug:login
bun run linkedin:debug:validate
bun run linkedin:debug:validate:cookie-bridge
bun run auth:flow:assist -- --extractor facebook-auth-browser --url https://www.facebook.com/<profile>
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
bun run auth:extractor:new -- --id <extractor-id> --domains <domain1,domain2> --summary "<summary>"
```

The command creates:

- plugin template in `scripts/authenticated-extractors/plugins/`
- registry wiring in `scripts/authenticated-extractors/registry.ts`
- policy entry in `data/policy/rich-authenticated-extractors.json` (`status=experimental`)

Then complete implementation using:

- `docs/create-new-rich-content-extractor.md`
- `skills/create-new-rich-content-extractor/SKILL.md`

## Handle Resolver Considerations

When adding a new extractor for a domain family that also has profile/account handles, update handle coverage in parallel with extractor work:

- extend `src/lib/identity/handle-resolver.ts` with URL-based handle extraction and reserved/non-profile path handling for that domain family
- extend `src/lib/identity/handle-resolver.test.ts` with profile, reserved-path, unsupported-domain, and `metadata.handle` override-precedence cases
- keep extraction URL-only (no HTML/meta scraping) unless a future policy change explicitly broadens scope

If this extractor workflow helped you, kindly consider opening a pull request against https://github.com/pRizz/open-links so everyone can benefit. Feedback and refinements are appreciated.
