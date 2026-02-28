# Create New Rich Content Extractor

This playbook defines the required process for adding authenticated rich extractors for blocked domains.

Use this when direct metadata fetch is blocked and you want build-safe committed cache output.

## Outcome Contract

A new extractor is complete only when all of these are true:

1. Policy entry exists in `data/policy/rich-authenticated-extractors.json`.
2. Plugin exists and is registered in `scripts/authenticated-extractors/registry.ts`.
3. Target links are configured with `links[].enrichment.authenticatedExtractor`.
4. `bun run setup:rich-auth` captures valid cache entries and assets.
5. `bun run build` passes without bypass.
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
bun run auth:extractor:new -- --id <extractor-id> --domains <domain1,domain2> --summary "<summary>"
```

This scaffolds plugin + registry + policy entry (`experimental`).

Scaffold template source is a typed file at:

- `scripts/authenticated-extractors/plugins/authenticated-extractor-plugin.template.ts`

Required replacement tokens in that template:

- `__EXTRACTOR_ID__`
- `__EXTRACTOR_VERSION__`
- `__DEFAULT_SESSION__`
- `__EXPORT_NAME__`

## Step 3: Implement Plugin Contract

File: `scripts/authenticated-extractors/plugins/<extractor-id>.ts`

Implement both functions:

- `ensureSession(context)`
- `extract(context)`

Prefer shared helpers for new extractors:

- `scripts/authenticated-extractors/browser-session.ts`
- `scripts/authenticated-extractors/auth-flow-runtime.ts`
- `scripts/shared/embedded-code-loader.ts`

### `ensureSession` requirements

- must support headed local flow when auth/session missing
- must classify state transitions and wait through login/MFA/challenge
- must continue automatically when authenticated
- must timeout with actionable diagnostics
- must not require build-time interactive flow (`build` remains non-interactive)
- must load browser `eval` snippets from `scripts/embedded-code/browser/...` (no inline payload literals)

### Generic Auth-State Taxonomy (Required)

New extractors must classify each inspected screen into one of:

- `login`
- `mfa_challenge`
- `post_auth_consent`
- `authenticated`
- `blocked`
- `unknown`

These states power transition logs, operator prompts, and timeout diagnostics.

### Action Safety Model (Required)

For actionable consent screens (for example trust-device prompts):

1. Propose action candidates with:
   - `actionId`
   - `label`
   - `kind`
   - `risk`
   - `confidence`
2. Require explicit operator confirmation before any click.
3. Record proposed/executed/declined actions in diagnostics artifacts.
4. Never auto-click high-risk actions.
5. In non-interactive mode, fail with actionable error if action confirmation is required.

### Unknown-State Handling (Required)

When state is `unknown`:

1. Pause and prompt user to continue waiting or abort.
2. If non-interactive, fail immediately with clear remediation.
3. Include minimal metadata in diagnostics:
   - state
   - URL host/path
   - short title
   - signal labels
   - action labels (if any)

### `extract` requirements

- load authenticated page
- extract usable `title`, `description`, `image`
- reject placeholder/authwall outputs
- download image to `public/cache/rich-authenticated/`
- return metadata with local asset path
- keep browser DOM extraction snippets in dedicated files under `scripts/embedded-code/browser/...`

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
- Keep diagnostics metadata-only; do not persist raw HTML/body dumps to tracked files.

## Step 5: Configure Links and Capture Cache

1. Set `links[].enrichment.authenticatedExtractor`.
2. Optionally set `authenticatedCacheKey`.
3. Run setup:

```bash
bun run setup:rich-auth
```

4. Commit changed manifest/assets.

If debugging LinkedIn-specific auth/session behavior, use:

- `bun run linkedin:debug:bootstrap`
- `bun run linkedin:debug:login`
- `bun run linkedin:debug:validate`
- `bun run linkedin:debug:validate:cookie-bridge`

Generic auth-flow assistance for any extractor:

- `bun run auth:flow:assist -- --extractor <extractor-id> --url <target-url>`

## Step 6: Validate and Build

Run:

```bash
bun run validate:data
bun run enrich:rich:strict
bun run build
```

If failures occur, fix extractor/cache/config instead of using bypass.

Guardrail for embedded snippet enforcement:

```bash
bun run quality:embedded-code
```

## Step 7: Documentation Updates (Required)

Update all relevant docs:

- `docs/authenticated-rich-extractors.md`
- `docs/rich-metadata-fetch-blockers.md`
- site-specific debug/runbook docs (if present)

Include:

- timestamped findings
- known limitations
- remediation and operator workflow
- any extractor-specific caveats.
- auth transition checkpoints (for example MFA reached, trust-device prompt reached)
- action decisions (proposed/executed/declined)

## Step 8: Share Back (Recommended)

If this extractor workflow helped you, kindly consider opening a pull request against https://github.com/pRizz/open-links so everyone can benefit. Feedback and refinements are appreciated.

## AI + Human Autonomous Workflow

For repeatable agent execution, use:

- `skills/create-new-rich-content-extractor/SKILL.md`

That skill enforces the end-to-end sequence with stop conditions for risky or ambiguous states.
