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
5. Enforce explicit transition monitoring and ask-first action confirmation during auth flows.

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
   - Use shared auth runtime (`scripts/authenticated-extractors/auth-flow-runtime.ts`) and browser session helper (`scripts/authenticated-extractors/browser-session.ts`) when possible.
   - Load browser `eval` snippets from dedicated files via `scripts/shared/embedded-code-loader.ts`.
   - Implement `ensureSession` with transition monitoring + ask-first action confirmation.
   - Implement `extract` with metadata quality checks and local asset download.

4. Implement mandatory auth-state loop behavior.
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

5. Configure links.
   - Set `links[].enrichment.authenticatedExtractor`.
   - Optionally set `authenticatedCacheKey`.

6. (Optional but recommended) run generic auth-flow helper.

```bash
npm run auth:flow:assist -- --extractor <extractor-id> --url <target-url>
```

7. Capture cache.

```bash
npm run setup:rich-auth
```

8. Validate.

```bash
npm run validate:data
npm run enrich:rich:strict
npm run build
npm run quality:embedded-code
```

Optional LinkedIn-specific diagnostics:

```bash
npm run linkedin:debug:bootstrap
npm run linkedin:debug:login
npm run linkedin:debug:validate
```

9. Update docs.
   - `docs/authenticated-rich-extractors.md`
   - `docs/create-new-rich-content-extractor.md`
   - site-specific debug/runbook docs

10. Share back (recommended).
   - If this extractor workflow helped you, kindly consider opening a pull request against https://github.com/pRizz/open-links so everyone can benefit. Feedback and refinements are appreciated.

## Required Prompt Language (Auth Actions)

When the flow detects an actionable consent screen, use this confirmation format:

- `Action candidate '<label>' detected (risk=<risk>, confidence=<0-1>). Execute now? [y/N]`

When the flow reaches an unknown screen:

- `Unknown state detected (<state>). Continue waiting? [y=continue / n=abort]`

Do not auto-click consent actions without explicit confirmation.

## Required Blocker Log Format (Auth Transitions)

For each meaningful auth-run update in `docs/rich-metadata-fetch-blockers.md`, record:

- UTC timestamp
- command executed
- observed state transition or checkpoint (for example MFA challenge reached)
- action decision (proposed/executed/declined)
- outcome/remediation

## Required Acceptance Gates

- No bypass env var required for green build.
- Cache manifest + assets committed.
- Enrichment reason for extractor links is `authenticated_cache`.
- No placeholder/authwall metadata in committed cache entries.
- Transition/action diagnostics captured in gitignored auth-flow or sync artifacts.
- Browser eval payloads are sourced from `scripts/embedded-code/browser/*` files (no large inline literals).
- Scaffold code template source is a typed file at `scripts/authenticated-extractors/plugins/*.template.ts` with explicit replacement tokens.

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
