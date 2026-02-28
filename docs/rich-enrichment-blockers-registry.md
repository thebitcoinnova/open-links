# Rich Enrichment Blockers Registry

Canonical machine-readable policy source:

- `data/policy/rich-enrichment-blockers.json`

Schema:

- `schema/rich-enrichment-blockers.schema.json`

This registry is required by enrichment and validation. If the file is missing or invalid, build-time commands fail with remediation guidance.

## Purpose

Track domains that are known to block direct-fetch rich metadata so misconfigurations are caught early and consistently.

This is the canonical policy source for build enforcement.  
`docs/rich-metadata-fetch-blockers.md` remains the narrative and attempt-history companion.

## Data Model

Root fields:

- `version`: currently `1`
- `updatedAt`: UTC timestamp for latest policy update
- `blockers`: array of blocker entries

Blocker entry fields:

- `id`: stable policy identifier
- `status`: `blocked`, `monitoring`, or `resolved`
- `scope`: currently `direct_fetch`
- `domains`: base domains covered by this blocker
- `matchSubdomains`: whether subdomains are included
- `reasonCategory`: `authwall`, `bot_protection`, `challenge`, `unknown`
- `lastVerifiedAt`: UTC timestamp of latest confirmation
- `summary`: short machine-facing rationale
- `remediation`: array of required/expected remediation actions
- `plannedSupportNote` (optional): short roadmap note (for example, authenticated fetch work coming soon)
- `docs`: references to companion documentation paths

## Enforcement Behavior

If a rich link is expected to fetch metadata (`type=rich`, URL present, enrichment enabled):

1. If URL host matches a `status=blocked` registry entry:
   - fail the run with reason `known_blocker`, unless override is enabled.
2. Override path:
   - set `links[].enrichment.allowKnownBlocker=true` to force-attempt enrichment.
3. Emergency bypass:
   - set `OPENLINKS_RICH_ENRICHMENT_BYPASS=1` to downgrade blocker failures for that run.

Domain matching:

- exact host match, or
- subdomain match when `matchSubdomains=true`.

## Maintenance Workflow

When confirming a new blocker or changing status:

1. Update `data/policy/rich-enrichment-blockers.json`.
2. Set `updatedAt` and `lastVerifiedAt` in UTC (`YYYY-MM-DDTHH:MM:SSZ`).
3. Update `docs/rich-metadata-fetch-blockers.md` with narrative findings/attempts.
4. Run:

```bash
bun run validate:data
bun run enrich:rich
```

5. Confirm diagnostics/remediation text is still accurate.

## Current Scope Limits

- Scope is currently `direct_fetch` only.
- Authenticated/session-based enrichment is tracked separately in extractor/cache registries and is used when links configure `links[].enrichment.authenticatedExtractor`.
