---
name: create-new-rich-content-extractor
description: Public-first workflow for adding rich metadata support, using authenticated extraction only when public sources are insufficient.
---

# Create New Rich Content Extractor Skill

Use this skill when OpenLinks is missing rich metadata for a link and you need to decide whether the fix belongs in direct/public enrichment or authenticated extraction.

## Goals

1. Start with the simplest viable metadata source.
2. Prefer direct/public enrichment over authenticated extraction.
3. Keep build/dev fail-fast and non-interactive.
4. Leave a decision-complete outcome: `public_direct`, `public_augmented`, or `authenticated_required`.
5. When authenticated extraction is required, enforce explicit transition monitoring and ask-first action confirmation during auth flows.

## Inputs to collect

- Target domain(s)
- Link id(s)/URL(s)
- Fields needed from the current metadata model:
  - `title`
  - `description`
  - `image`
  - `profileImage`
  - `handle`
  - audience counts when applicable
- Summary of the current gap or failure
- Proposed extractor id (kebab-case) only if the authenticated branch becomes necessary

## Execution Steps

1. Run public-source triage first.
   - Determine which current metadata fields are missing or incorrect.
   - Check whether existing direct enrichment already returns those fields.
   - If not, inspect stable public sources such as:
     - page metadata,
     - public profile HTML,
     - canonical first-party profile pages for custom-domain accounts when they expose richer public metadata,
     - oEmbed,
     - RSS/feed data,
     - public avatar or image endpoints.
   - Record a short triage write-up containing:
     - fields needed,
     - fields currently present,
     - public sources checked,
     - chosen branch,
     - reason authenticated extraction is or is not required.

2. Classify the outcome into exactly one branch.
   - `public_direct`
     - existing direct enrichment already satisfies the needed fields,
     - stop and do not create blocker or extractor work.
   - `public_augmented`
     - a stable public source can satisfy the missing fields,
     - continue with the public implementation branch below.
   - `authenticated_required`
     - public sources are blocked or insufficient,
     - continue with the authenticated implementation branch below.

3. If the branch is `public_direct`, stop.
   - Do not update `data/policy/rich-authenticated-extractors.json`.
   - Do not scaffold an extractor.
   - Do not update authenticated cache or committed auth assets.
   - Validate the current direct path if any link/config change was made:

```bash
npm run validate:data
npm run enrich:rich:strict
npm run build
```

4. If the branch is `public_augmented`, implement public support end-to-end.
   - Extend existing public enrichment/parsing/normalization paths instead of authenticated cache infrastructure.
   - Gather only fields from the current OpenLinks metadata model that are actually needed.
   - Prefer keeping generic parsers generic and adding targeted augmentation/normalization after parsing when platform-specific logic is required.
   - Current in-repo `public_augmented` examples: Medium (RSS/feed), Substack (canonical public profile + custom-domain source preservation), X (oEmbed + avatar), Instagram (public page metadata), YouTube (public page metadata).
   - Canonical public profile fetches are allowed for custom-domain links when the canonical platform surface is still public and exposes better metadata. Preserve the original link URL identity in `sourceLabel` and UI copy even when the fetch target host differs.
   - A platform may remain `public_augmented` even when a requested count metric is still unsupported. Do not escalate count-only gaps to authenticated extraction unless public sources were conclusively checked and rejected.
   - Count-only gaps do not justify authenticated extraction when the platform already has a stable public path for the rest of the metadata.
   - Update handle resolver coverage when applicable:
     - `src/lib/identity/handle-resolver.ts`
     - `src/lib/identity/handle-resolver.test.ts`
   - Avoid touching:
     - `data/policy/rich-authenticated-extractors.json`
     - `data/cache/rich-authenticated-cache.json`
     - `public/cache/rich-authenticated/*`
   - Validate:

```bash
npm run validate:data
npm run enrich:rich:strict
npm run build
```

5. If the branch is `authenticated_required`, confirm blocker evidence before scaffolding.
   - Update `data/policy/rich-enrichment-blockers.json`.
   - Update `docs/rich-metadata-fetch-blockers.md` with UTC-stamped attempts.
   - Record why public sources were rejected.
   - Current in-repo `authenticated_required` examples: LinkedIn and Facebook.

6. Scaffold the authenticated extractor only for `authenticated_required`.

```bash
npm run auth:extractor:new -- --id <extractor-id> --domains <domain1,domain2> --summary "<summary>"
```

7. Implement the authenticated plugin in `scripts/authenticated-extractors/plugins/<extractor-id>.ts`.
   - Use shared auth runtime (`scripts/authenticated-extractors/auth-flow-runtime.ts`) and browser session helper (`scripts/authenticated-extractors/browser-session.ts`) when possible.
   - Load browser `eval` snippets from dedicated files via `scripts/shared/embedded-code-loader.ts`.
   - Implement `ensureSession` with transition monitoring + ask-first action confirmation.
   - Implement `extract` with metadata quality checks and local asset download.

8. For both `public_augmented` and `authenticated_required`, update handle coverage when applicable.
   - If the domain family exposes user/profile handles, update `src/lib/identity/handle-resolver.ts`.
   - Add or adjust reserved path handling so non-profile URLs remain supported-but-unresolved where appropriate.
   - Extend `src/lib/identity/handle-resolver.test.ts` for:
     - resolvable profile URL behavior,
     - reserved/non-profile supported-domain behavior,
     - unsupported-domain behavior,
     - manual `metadata.handle` override precedence.

9. For `authenticated_required`, implement mandatory auth-state loop behavior.
   - Required state taxonomy:
     - `login`
     - `mfa_challenge`
     - `post_auth_consent`
     - `authenticated`
     - `blocked`
     - `unknown`
   - Emit transition logs when state signature changes.
   - Emit heartbeat logs while unchanged.
   - For actionable consent screens (for example "Trust this device"):
     - propose candidate action(s),
     - ask user for explicit confirmation before click,
     - log proposed/executed/declined actions.
   - For unknown states:
     - pause and prompt user to continue waiting or abort,
     - fail with actionable diagnostics when non-interactive.

10. For `authenticated_required`, configure links and capture cache.
    - Set `links[].enrichment.authenticatedExtractor`.
    - Optionally set `authenticatedCacheKey`.
    - Optional auth-flow helper:

```bash
npm run auth:flow:assist -- --extractor <extractor-id> --url <target-url>
```

    - Capture cache:

```bash
npm run setup:rich-auth
```

11. Validate the chosen branch.

```bash
npm run validate:data
npm run enrich:rich:strict
npm run build
```

For `authenticated_required`, also run:

```bash
npm run quality:embedded-code
```

Optional LinkedIn-specific diagnostics:

```bash
npm run linkedin:debug:bootstrap
npm run linkedin:debug:login
npm run linkedin:debug:validate
```

12. Update docs to match the chosen branch.
    - Always update:
      - `docs/create-new-rich-content-extractor.md`
    - Update `docs/authenticated-rich-extractors.md` only when authenticated workflow guidance changes.
    - Update `docs/rich-metadata-fetch-blockers.md` only for `authenticated_required` or when blocker evidence changes.
    - Update site-specific debug/runbook docs when applicable.

13. Share back (recommended).
    - If this workflow helped you, kindly consider opening a pull request against https://github.com/pRizz/open-links so everyone can benefit. Feedback and refinements are appreciated.

## Required Prompt Language (Auth Actions)

These prompts apply only to the `authenticated_required` branch.

When the flow detects an actionable consent screen, use this confirmation format:

- `Action candidate '<label>' detected (risk=<risk>, confidence=<0-1>). Execute now? [y/N]`

When the flow reaches an unknown screen:

- `Unknown state detected (<state>). Continue waiting? [y=continue / n=abort]`

Do not auto-click consent actions without explicit confirmation.

## Required Blocker Log Format (Auth Transitions)

This log format applies only when the chosen branch is `authenticated_required`.

For each meaningful auth-run update in `docs/rich-metadata-fetch-blockers.md`, record:

- UTC timestamp
- command executed
- observed state transition or checkpoint (for example MFA challenge reached)
- action decision (proposed/executed/declined)
- outcome/remediation

## Required Acceptance Gates

- `public_direct`
  - triage proves direct enrichment already satisfies required fields,
  - no blocker or authenticated extractor artifacts were added,
  - validation/build pass without bypass.
- `public_augmented`
  - missing fields are now satisfied by public enrichment,
  - no authenticated policy/cache/assets were touched,
  - validation/build pass without bypass.
- `authenticated_required`
  - no bypass env var required for green build,
  - cache manifest + assets committed,
  - enrichment reason for extractor links is `authenticated_cache`,
  - no placeholder/authwall metadata in committed cache entries,
  - transition/action diagnostics captured in gitignored auth-flow or sync artifacts,
  - browser eval payloads are sourced from `scripts/embedded-code/browser/*` files,
  - scaffold code template source is a typed file at `scripts/authenticated-extractors/plugins/*.template.ts` with explicit replacement tokens.
- For handle-capable domains, handle resolver and tests are updated and `metadata.handle` override precedence remains intact.

## Stop Conditions

Stop and escalate if any occur:

- A stable public path satisfies the required fields; do not continue into authenticated scaffolding.
- Credentials/secrets are requested for commit/log output.
- Extraction can only proceed by weakening security boundaries.
- Domain behavior is inconsistent and cannot be reliably classified.
- Build requires changing fail-fast/non-interactive policy.

## References

- `docs/authenticated-rich-extractors.md`
- `docs/create-new-rich-content-extractor.md`
- `docs/rich-metadata-fetch-blockers.md`
