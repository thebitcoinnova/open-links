# Rich Metadata Fetch Blockers

This document tracks rich metadata fetch failures caused by anti-automation protections (authwalls, bot filters, challenge pages).

`bun run dev` and `bun run build` now run strict rich enrichment before app build, so unresolved blockers can fail local and CI builds.

Canonical machine-readable blocker policy:

- `data/policy/rich-enrichment-blockers.json`
- Schema: `schema/rich-enrichment-blockers.schema.json`
- Registry guide: `docs/rich-enrichment-blockers-registry.md`

LinkedIn authenticated debug runbook:

- `docs/linkedin-authenticated-metadata-debug-runbook.md`

Authenticated extractor framework guide:

- `docs/authenticated-rich-extractors.md`
- `docs/create-new-rich-content-extractor.md`

## Maintenance Rules (Required)

When you find a new rich metadata fetch failure:

1. Update `data/policy/rich-enrichment-blockers.json` first (canonical policy source).
2. Add/update a finding section here with UTC ISO-8601 timestamps (`YYYY-MM-DDTHH:MM:SSZ`).
3. Record the exact URL and link id.
4. Record every meaningful fetch attempt and outcome (status code + any body clues).
5. Record the chosen workaround/remediation.
6. Update `data/links.json` and/or manual metadata if needed.
7. If moving a blocked domain to authenticated extraction, update:
   - `data/policy/rich-authenticated-extractors.json`
   - `data/cache/rich-authenticated-cache.json`
   - committed assets under `public/cache/rich-authenticated/`
8. Keep historical attempts; append updates instead of replacing old entries.

If a previously blocked domain becomes fetchable, add a timestamped verification entry and update the status table below.

## Known Unsupported Direct-Fetch Domains

These domains are currently treated as unsupported for direct unauthenticated metadata fetch in the build enricher.

| Site | Example URL | First Recorded (UTC) | Last Verified (UTC) | Typical Response | Current Status | Current Workaround |
|---|---|---|---|---|---|---|
| LinkedIn | `https://www.linkedin.com/in/peter-ryszkiewicz/` | `2026-02-24T11:29:52Z` | `2026-02-24T11:45:37Z` | `HTTP 999`, authwall redirect script | Unsupported direct fetch | Prefer authenticated extractor cache (`authenticatedExtractor`) or keep direct enrichment disabled/manual metadata |
| Medium | `https://medium.com/@peterryszkiewicz` | `2026-02-24T11:30:11Z` | `2026-02-25T12:39:14Z` | `HTTP 403`, Cloudflare challenge page ("Just a moment...") | Unsupported direct fetch | Prefer authenticated extractor cache (`authenticatedExtractor=medium-auth-browser`), fallback to manual metadata |
| X | `https://x.com/pryszkie` | `2026-02-26T09:55:42Z` | `2026-02-26T09:55:47Z` | `HTTP 200` shell response with missing `title`, `description`, and `image` | Unsupported direct fetch | Prefer authenticated extractor cache (`authenticatedExtractor=x-auth-browser`), fallback to manual metadata |
| Facebook | `https://www.facebook.com/peter.ryszkiewicz` | `2026-02-26T10:06:38Z` | `2026-02-26T10:06:49Z` | `HTTP 200` response with generic title and missing image metadata | Unsupported direct fetch | Prefer authenticated extractor cache (`authenticatedExtractor=facebook-auth-browser`), fallback to manual metadata |

## Findings Log

### LinkedIn

- Link id: `linkedin`
- URL: `https://www.linkedin.com/in/peter-ryszkiewicz/`
- Latest decision: Use authenticated extractor cache (`links[].enrichment.authenticatedExtractor=linkedin-auth-browser`).
- Reason: Direct fetch remains blocked (`HTTP 999`/authwall). Authenticated browser-session extraction is now the supported path.

Operator setup command:

- `bun run setup:rich-auth`

#### Attempt History

| Timestamp (UTC) | Attempt | Outcome |
|---|---|---|
| `2026-02-24T11:45:25Z` | Baseline GET with `open-links-enricher/0.1` user-agent | `HTTP 999` |
| `2026-02-24T11:45:26Z` | Desktop Chrome user-agent only | `HTTP 999` |
| `2026-02-24T11:45:27Z` | Chrome UA + `Accept` + `Accept-Language` + `Upgrade-Insecure-Requests` | `HTTP 999` |
| `2026-02-24T11:45:28Z` | Full browser-like header set (`Sec-Fetch-*`, cache headers, etc.) | `HTTP 999` |
| `2026-02-24T11:45:29Z` | Mobile Safari user-agent | `HTTP 999` |
| `2026-02-24T11:45:25Z` | Body inspection of profile URL response | Contains script redirecting to LinkedIn `authwall` |
| `2026-02-24T11:45:37Z` | Followed `authwall` URL and inspected OG/Twitter tags | Generic metadata only (`Sign Up | LinkedIn`, favicon image), not profile-rich metadata |

### Medium

- Link id: `medium`
- URL: `https://medium.com/@peterryszkiewicz`
- Latest decision: Use authenticated extractor cache (`links[].enrichment.authenticatedExtractor=medium-auth-browser`).
- Reason: Direct profile fetch remains challenge-protected (`HTTP 403`) and browser automation still lands on Cloudflare verification pages.

Operator setup command:

- `bun run setup:rich-auth`

#### Attempt History

| Timestamp (UTC) | Attempt | Outcome |
|---|---|---|
| `2026-02-24T11:45:53Z` | Baseline GET with `open-links-enricher/0.1` user-agent | `HTTP 403` |
| `2026-02-24T11:45:53Z` | Desktop Chrome user-agent only | `HTTP 403` |
| `2026-02-24T11:45:53Z` | Chrome UA + `Accept` + `Accept-Language` + `Upgrade-Insecure-Requests` | `HTTP 403` |
| `2026-02-24T11:45:53Z` | Full browser-like header set (`Sec-Fetch-*`, cache headers, etc.) | `HTTP 403` |
| `2026-02-24T11:45:53Z` | Mobile Safari user-agent | `HTTP 403` |
| `2026-02-24T11:45:59Z` | Body inspection | Cloudflare challenge page (`"Just a moment..."`, JS/cookie challenge) |
| `2026-02-25T12:36:25Z` | Auth extractor (`medium-auth-browser`) first implementation using browser DOM selectors | Session verification failed; `title` present but `description`/`image` missing |
| `2026-02-25T12:37:21Z` | `agent-browser` probe of profile URL (5s wait) | Challenge page persisted (`title=Just a moment...`, Cloudflare verification text) |
| `2026-02-25T12:37:35Z` | `agent-browser` probe of profile URL (20s wait) | Challenge page persisted after longer wait |
| `2026-02-25T12:37:45Z` | Fetch Medium feed endpoint `https://medium.com/feed/@peterryszkiewicz` | `HTTP 200` RSS XML with usable channel title/description/image |
| `2026-02-25T12:38:57Z` | `bun run setup:rich-auth` with feed-based `medium-auth-browser` extractor | Cache entry captured (`cacheKey=medium`) and local asset committed under `public/cache/rich-authenticated/` |

### X

- Link id: `x`
- URL: `https://x.com/pryszkie`
- Latest decision: Use authenticated extractor cache (`links[].enrichment.authenticatedExtractor=x-auth-browser`).
- Reason: Direct fetch reproducibly returns `metadata_missing` under strict enrichment (`HTTP 200` response but missing `title`, `description`, `image`).

Operator setup command:

- `bun run setup:rich-auth`

#### Attempt History

| Timestamp (UTC) | Attempt | Outcome |
|---|---|---|
| `2026-02-26T09:55:42Z` | `bun run enrich:rich:strict -- --links /tmp/openlinks-x-direct.json --out /tmp/rich-metadata-x-direct-1.json --report /tmp/rich-report-x-direct-1.json` | Blocking `metadata_missing`; `statusCode=200`; missing fields: `title`, `description`, `image` |
| `2026-02-26T09:55:47Z` | `bun run enrich:rich:strict -- --links /tmp/openlinks-x-direct.json --out /tmp/rich-metadata-x-direct-2.json --report /tmp/rich-report-x-direct-2.json` | Blocking `metadata_missing`; `statusCode=200`; missing fields: `title`, `description`, `image` |
| `2026-02-26T09:54:24Z` | `bun run setup:rich-auth` with `x-auth-browser` configured on link `x` | Cache entry captured (`cacheKey=x`) and local asset committed under `public/cache/rich-authenticated/` |

### Facebook

- Link id: `facebook`
- URL: `https://www.facebook.com/peter.ryszkiewicz`
- Latest decision: Use authenticated extractor cache (`links[].enrichment.authenticatedExtractor=facebook-auth-browser`).
- Reason: Direct fetch reproducibly returns `metadata_partial` and misses required rich-card image metadata; deterministic fallback capture produced a generic Facebook icon instead of profile image, so extractor now requires authenticated DOM capture.

Operator setup command:

- `bun run setup:rich-auth`

#### Attempt History

| Timestamp (UTC) | Attempt | Outcome |
|---|---|---|
| `2026-02-26T10:06:38Z` | `bun run enrich:rich:strict` | `facebook` returned `metadata_partial` (`HTTP 200`) with only generic title and missing image |
| `2026-02-26T10:06:49Z` | `bun run enrich:rich:strict` (repro run) | `facebook` returned `metadata_partial` (`HTTP 200`) again; reproducible second signal |
| `2026-02-26T10:06:07Z` | `bun run validate:data` | Blocking validation error: `$.links[4].metadata.image` missing for rich-card rendering |
| `2026-02-26T10:10:04Z` | `bun run auth:rich:sync -- --only-link facebook --force` | Cache entry captured (`cacheKey=facebook`) and local asset committed under `public/cache/rich-authenticated/` |
| `2026-02-26T10:19:02Z` | `bun run auth:rich:sync -- --only-link facebook --force` with first auth-browser implementation | Session init failed due LinkedIn debug helper dependency requiring `AGENT_BROWSER_ENCRYPTION_KEY`; not acceptable for Facebook flow |
| `2026-02-26T10:20:09Z` | `bun run auth:rich:sync -- --only-link facebook --force` after config patch | Session init now correctly prompts local interactive login (`Interactive terminal is required for Facebook login`) |
| `2026-02-26T10:22:13Z` | `OPENLINKS_AUTH_SESSION_TIMEOUT_MS=5000 bun run auth:rich:sync -- --only-link facebook --force` in interactive mode | Session reached auth polling and timed out as expected when not logged in; signals included `content_unavailable`, `login_wall`, `login_required`, `profile_image_missing` |
| `2026-02-26T10:34:33Z` | `bun run auth:rich:sync -- --only-link facebook --force` interactive run | Reached MFA challenge state in headed login flow; waiting for verification completion before authenticated profile capture |
| `2026-02-26T10:37:36Z` | `bun run auth:rich:sync -- --only-link facebook --force` after MFA + trust-device approval | Capture succeeded with authenticated profile image (`sourceUrl` on `scontent-ord5-2.xx.fbcdn.net`), cache key `facebook` refreshed with extractor `facebook-profile-auth-v2` |

## Recommended Handling for Blocked Domains

1. Prefer disabling enrichment per link (`links[].enrichment.enabled=false`) for blocked domains.
2. If rich display is still desired, set manual `links[].metadata` fields (`title`, `description`, `image`).
3. Keep this file updated whenever blockers are confirmed, changed, or removed.

## Authenticated Debug Log Template

When running LinkedIn authenticated debug commands, append entries using this template:

| Timestamp (UTC) | Site | Session Mode | Result | Extracted Quality | Cookie-Bridge Result | Notes / Next Action |
|---|---|---|---|---|---|---|
| `YYYY-MM-DDTHH:MM:SSZ` | LinkedIn | `manual` / `hybrid` / `automated` | `pass` / `fail` | `full` / `partial` / `none` + placeholder signals | `status=<code>, placeholder=<yes/no>` or `not-run` | Short remediation or follow-up |
