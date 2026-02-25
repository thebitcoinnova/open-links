# Create New Rich Content Extractor

This playbook defines the required process for adding authenticated rich extractors for blocked domains.

Use this when direct metadata fetch is blocked and you want build-safe committed cache output.

## Outcome Contract

A new extractor is complete only when all of these are true:

1. Policy entry exists in `data/policy/rich-authenticated-extractors.json`.
2. Plugin exists and is registered in `scripts/authenticated-extractors/registry.ts`.
3. Target links are configured with `links[].enrichment.authenticatedExtractor`.
4. `npm run setup:rich-auth` captures valid cache entries and assets.
5. `npm run build` passes without bypass.
6. Blocker and findings docs are updated with UTC timestamps.

## Required Security Boundaries

- Never commit cookies, credentials, or session state.
- Never commit raw HTML snapshots to repository-tracked paths.
- Commit only:
  - `data/cache/rich-authenticated-cache.json`
  - `public/cache/rich-authenticated/*`
  - metadata-only diagnostics in cache entries.

## Step 1: Confirm Domain Is a Direct-Fetch Blocker

1. Add/update domain status in `data/policy/rich-enrichment-blockers.json`.
2. Record narrative findings and attempts in `docs/rich-metadata-fetch-blockers.md` with UTC timestamps.
3. Define current remediation until extractor is live.

## Step 2: Scaffold the Extractor

Run:

```bash
npm run auth:extractor:new -- --id <extractor-id> --domains <domain1,domain2> --summary "<summary>"
```

This scaffolds plugin + registry + policy entry (`experimental`).

## Step 3: Implement Plugin Contract

File: `scripts/authenticated-extractors/plugins/<extractor-id>.ts`

Implement both functions:

- `ensureSession(context)`
- `extract(context)`

### `ensureSession` requirements

- must support headed local flow when auth/session missing
- must classify state transitions and wait through login/MFA/challenge
- must continue automatically when authenticated
- must timeout with actionable diagnostics
- must not require build-time interactive flow (`build` remains non-interactive)

### `extract` requirements

- load authenticated page
- extract usable `title`, `description`, `image`
- reject placeholder/authwall outputs
- download image to `public/cache/rich-authenticated/`
- return metadata with local asset path

## Step 4: Selector and Quality Strategy

- Prefer stable selectors with fallback layers.
- Treat these as hard failures:
  - missing `title|description|image`
  - placeholder text (`sign up`, `join`, challenge/authwall strings)
  - redirected non-target pages.
- Add extractor diagnostics notes for:
  - extractor version
  - selector profile
  - placeholder signals
  - captured URL.

## Step 5: Configure Links and Capture Cache

1. Set `links[].enrichment.authenticatedExtractor`.
2. Optionally set `authenticatedCacheKey`.
3. Run setup:

```bash
npm run setup:rich-auth
```

4. Commit changed manifest/assets.

## Step 6: Validate and Build

Run:

```bash
npm run validate:data
npm run enrich:rich:strict
npm run build
```

If failures occur, fix extractor/cache/config instead of using bypass.

## Step 7: Documentation Updates (Required)

Update all relevant docs:

- `docs/authenticated-rich-extractors.md`
- `docs/rich-metadata-fetch-blockers.md`
- site-specific PoC/runbook docs (if present)

Include:

- timestamped findings
- known limitations
- remediation and operator workflow
- any extractor-specific caveats.

## AI + Human Autonomous Workflow

For repeatable agent execution, use:

- `skills/create-new-rich-content-extractor/SKILL.md`

That skill enforces the end-to-end sequence with stop conditions for risky or ambiguous states.
