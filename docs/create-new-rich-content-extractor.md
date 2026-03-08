# Create New Rich Content Extractor

This playbook defines the required public-first process for adding rich metadata support when OpenLinks does not yet capture the fields a link needs.

Use this when existing direct enrichment is missing data and you need to decide whether support belongs in:

- `public_direct`
- `public_augmented`
- `authenticated_required`

## Outcome Contract

A new support workflow is complete only when all of these are true:

1. A triage write-up exists with:
   - fields needed,
   - fields currently present,
   - public sources checked,
   - chosen branch,
   - reason authenticated extraction is or is not required.
2. Exactly one branch has been completed:
   - `public_direct`
   - `public_augmented`
   - `authenticated_required`
3. `bun run build` passes without bypass.
4. Relevant docs were updated to reflect the chosen branch.

## Required Security Boundaries

- Never commit cookies, credentials, or session state.
- Never commit raw HTML snapshots to repository-tracked paths.
- For `authenticated_required`, commit only:
  - `data/cache/rich-authenticated-cache.json`
  - `public/cache/rich-authenticated/*`
  - metadata-only diagnostics in cache entries.

## Step 1: Public-Source Triage

Start here for every case. Do not scaffold an authenticated extractor before completing this step.

1. Define the exact fields you need from the current OpenLinks metadata model:
   - `title`
   - `description`
   - `image`
   - `profileImage`
   - `handle`
   - audience counts when applicable
2. Determine what existing direct enrichment already returns.
3. Inspect stable public sources that could fill the gap:
   - page metadata,
   - public profile HTML,
   - oEmbed,
   - RSS/feed data,
   - public avatar/image endpoints.
4. Record a triage write-up containing:
   - fields needed,
   - fields currently present,
   - public sources checked,
   - chosen branch,
   - reason authenticated extraction is or is not required.

## Step 2: Choose the Branch

Classify the result into exactly one branch:

- `public_direct`
  - Existing direct enrichment already produces the required fields.
  - Stop. Do not create blocker or extractor work.
- `public_augmented`
  - Stable public sources can satisfy the missing fields.
  - Continue with the public implementation branch below.
- `authenticated_required`
  - Public sources are blocked or insufficient.
  - Continue with the authenticated implementation branch below.

## Step 3: `public_direct` Stop Rule

If the chosen branch is `public_direct`:

1. Do not update `data/policy/rich-enrichment-blockers.json`.
2. Do not scaffold an authenticated extractor.
3. Do not update authenticated cache manifests or committed auth assets.
4. Validate only if link/config changes were required:

```bash
bun run validate:data
bun run enrich:rich:strict
bun run build
```

## Step 4: `public_augmented` Implementation Branch

When the chosen branch is `public_augmented`:

1. Extend existing public enrichment/parsing/normalization paths instead of authenticated cache infrastructure.
2. Gather only the fields needed by the current metadata model.
3. Prefer keeping generic parsers generic and adding targeted augmentation/normalization after parsing when platform-specific logic is required.
4. Ensure the public path writes normalized fetch-derived metadata through the committed public cache:
   - `data/cache/rich-public-cache.json`
   - `schema/rich-public-cache.schema.json`
   - no raw HTML snapshots
   - current in-repo examples: Medium (RSS/feed), X (oEmbed + avatar), Instagram (public page metadata), YouTube (public page metadata)
5. Update handle coverage when applicable:
   - `src/lib/identity/handle-resolver.ts`
   - `src/lib/identity/handle-resolver.test.ts`
6. Do not touch:
   - `data/policy/rich-authenticated-extractors.json`
   - `data/cache/rich-authenticated-cache.json`
   - `public/cache/rich-authenticated/*`
7. Validate:

```bash
bun run validate:data
bun run enrich:rich:strict
bun run build
```

## Step 5: `authenticated_required` Blocker Confirmation

Only after public-source triage selects `authenticated_required`:

1. Add/update domain status in `data/policy/rich-enrichment-blockers.json`.
2. Record narrative findings and attempts in `docs/rich-metadata-fetch-blockers.md` with UTC timestamps.
3. Define current remediation until the authenticated path is live.
4. Record why public sources were rejected.
5. Current authenticated-only examples in this repository are LinkedIn and Facebook.

## Step 6: Scaffold the Extractor

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

## Step 7: Implement Plugin Contract

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

## Step 8: Selector and Quality Strategy

- Prefer stable selectors with fallback layers.
- Treat these as hard failures:
  - missing `title|description|image`
  - placeholder text (`sign up`, `join`, challenge/authwall strings)
  - redirected non-target pages.
- Add extractor diagnostics notes for:
  - extractor version
  - selector profile
  - placeholder signals
  - captured URL
- Keep diagnostics metadata-only; do not persist raw HTML/body dumps to tracked files.

## Step 9: Handle Resolver Considerations (Required When Applicable)

If the chosen branch is `public_augmented` or `authenticated_required` and the domain family exposes profile/account handles, update handle extraction coverage:

1. Update URL extractor/reserved-route logic in `src/lib/identity/handle-resolver.ts`.
2. Add or adjust tests in `src/lib/identity/handle-resolver.test.ts` for:
   - valid profile URL resolution for the supported domain
   - reserved/non-profile URL handling (`supported=true`, unresolved handle when applicable)
   - unsupported-domain behavior (`supported=false`)
   - manual `metadata.handle` precedence over URL-derived value
3. Ensure handle updates remain URL-only and do not alter enrichment blocking behavior.

## Step 10: Configure Links and Capture Cache

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

## Step 11: Validate and Build

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

## Step 12: Documentation Updates (Required)

Update all relevant docs:

- Always update:
  - `docs/create-new-rich-content-extractor.md`
- Update `docs/authenticated-rich-extractors.md` only when authenticated workflow guidance changes.
- Update `docs/rich-metadata-fetch-blockers.md` only for `authenticated_required` or when blocker evidence changes.
- Update site-specific debug/runbook docs when present.

Include:

- triage outcome and chosen branch
- public sources checked
- known limitations
- remediation and operator workflow
- any extractor-specific caveats
- auth transition checkpoints and action decisions for `authenticated_required`

## Step 13: Share Back (Recommended)

If this extractor workflow helped you, kindly consider opening a pull request against https://github.com/pRizz/open-links so everyone can benefit. Feedback and refinements are appreciated.

## AI + Human Autonomous Workflow

For repeatable agent execution, use:

- `skills/create-new-rich-content-extractor/SKILL.md`

That skill enforces the end-to-end sequence with stop conditions for risky or ambiguous states.
