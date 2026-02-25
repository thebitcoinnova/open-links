---
name: create-new-rich-content-extractor
description: End-to-end workflow for adding a new authenticated rich extractor (policy, plugin, cache, docs, validation).
---

# Create New Rich Content Extractor Skill

Use this skill when a site blocks direct rich metadata fetch and needs authenticated extraction.

## Goals

1. Add an extractor with minimal core rewrites.
2. Keep build/dev fail-fast and non-interactive.
3. Produce committed cache + assets that pass validation/build.
4. Leave complete timestamped documentation.

## Inputs to collect

- Target domain(s)
- Extractor id (kebab-case)
- Link id(s)/URL(s)
- Summary of blocking behavior

## Execution Steps

1. Confirm blocker policy and findings are recorded.
   - Update `data/policy/rich-enrichment-blockers.json`.
   - Update `docs/rich-metadata-fetch-blockers.md` with UTC-stamped attempts.

2. Scaffold extractor.

```bash
npm run auth:extractor:new -- --id <extractor-id> --domains <domain1,domain2> --summary "<summary>"
```

3. Implement plugin in `scripts/authenticated-extractors/plugins/<extractor-id>.ts`.
   - Implement `ensureSession` with autonomous login/MFA wait.
   - Implement `extract` with metadata quality checks and local asset download.

4. Configure links.
   - Set `links[].enrichment.authenticatedExtractor`.
   - Optionally set `authenticatedCacheKey`.

5. Capture cache.

```bash
npm run setup:rich-auth
```

6. Validate.

```bash
npm run validate:data
npm run enrich:rich:strict
npm run build
```

7. Update docs.
   - `docs/authenticated-rich-extractors.md`
   - `docs/create-new-rich-content-extractor.md`
   - site-specific runbook/PoC docs

## Required Acceptance Gates

- No bypass env var required for green build.
- Cache manifest + assets committed.
- Enrichment reason for extractor links is `authenticated_cache`.
- No placeholder/authwall metadata in committed cache entries.

## Stop Conditions

Stop and escalate if any occur:

- Credentials/secrets are requested for commit/log output.
- Extraction can only proceed by weakening security boundaries.
- Domain behavior is inconsistent and cannot be reliably classified.
- Build requires changing fail-fast/non-interactive policy.

## References

- `docs/authenticated-rich-extractors.md`
- `docs/create-new-rich-content-extractor.md`
- `docs/rich-metadata-fetch-blockers.md`
