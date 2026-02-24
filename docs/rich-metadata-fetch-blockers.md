# Rich Metadata Fetch Blockers

This document tracks rich metadata fetch failures caused by anti-automation protections (authwalls, bot filters, challenge pages).

`npm run dev` and `npm run build` now run strict rich enrichment before app build, so unresolved blockers can fail local and CI builds.

## Maintenance Rules (Required)

When you find a new rich metadata fetch failure:

1. Add a new finding section with a UTC ISO-8601 timestamp (`YYYY-MM-DDTHH:MM:SSZ`).
2. Record the exact URL and link id.
3. Record every meaningful fetch attempt and outcome (status code + any body clues).
4. Record the chosen workaround/remediation.
5. Update `data/links.json` and/or manual metadata if needed.
6. Keep historical attempts; append updates instead of replacing old entries.

If a previously blocked domain becomes fetchable, add a timestamped verification entry and update the status table below.

## Known Unsupported Direct-Fetch Domains

These domains are currently treated as unsupported for direct unauthenticated metadata fetch in the build enricher.

| Site | Example URL | First Recorded (UTC) | Last Verified (UTC) | Typical Response | Current Status | Current Workaround |
|---|---|---|---|---|---|---|
| LinkedIn | `https://www.linkedin.com/in/peter-ryszkiewicz/` | `2026-02-24T11:29:52Z` | `2026-02-24T11:45:37Z` | `HTTP 999`, authwall redirect script | Unsupported direct fetch | `enrichment.enabled=false` for `linkedin`; use manual `links[].metadata` if rich fields are needed |
| Medium | `https://medium.com/@peterryszkiewicz` | `2026-02-24T11:30:11Z` | `2026-02-24T11:45:59Z` | `HTTP 403`, Cloudflare challenge page ("Just a moment...") | Unsupported direct fetch | Disable enrichment for affected links or provide manual `links[].metadata` |

## Findings Log

### LinkedIn

- Link id: `linkedin`
- URL: `https://www.linkedin.com/in/peter-ryszkiewicz/`
- Latest decision: Keep enrichment disabled (`data/links.json` has `enrichment.enabled=false`).
- Reason: Requests consistently return `HTTP 999` and redirect/authwall behavior; browser-style headers did not change outcome.

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
- Latest decision: Domain is currently treated as unsupported for direct unauthenticated fetch.
- Reason: Requests consistently return challenge-protected responses (`HTTP 403`).

#### Attempt History

| Timestamp (UTC) | Attempt | Outcome |
|---|---|---|
| `2026-02-24T11:45:53Z` | Baseline GET with `open-links-enricher/0.1` user-agent | `HTTP 403` |
| `2026-02-24T11:45:53Z` | Desktop Chrome user-agent only | `HTTP 403` |
| `2026-02-24T11:45:53Z` | Chrome UA + `Accept` + `Accept-Language` + `Upgrade-Insecure-Requests` | `HTTP 403` |
| `2026-02-24T11:45:53Z` | Full browser-like header set (`Sec-Fetch-*`, cache headers, etc.) | `HTTP 403` |
| `2026-02-24T11:45:53Z` | Mobile Safari user-agent | `HTTP 403` |
| `2026-02-24T11:45:59Z` | Body inspection | Cloudflare challenge page (`"Just a moment..."`, JS/cookie challenge) |

## Recommended Handling for Blocked Domains

1. Prefer disabling enrichment per link (`links[].enrichment.enabled=false`) for blocked domains.
2. If rich display is still desired, set manual `links[].metadata` fields (`title`, `description`, `image`).
3. Keep this file updated whenever blockers are confirmed, changed, or removed.

