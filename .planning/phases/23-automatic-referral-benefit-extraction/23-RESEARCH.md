# Phase 23 Research: Automatic Referral Benefit Extraction

**Researched:** 2026-03-31  
**Scope:** Automatic public extraction of explicit `visitorBenefit` and `ownerBenefit` text for referral links

## Executive Summary

Phase 23 should extend the existing public referral augmentation pipeline rather than introducing a second referral system. The repo already has the right primitives:

- `scripts/enrichment/public-augmentation.ts` normalizes public referral targets and currently extracts `offerSummary` / `termsSummary`
- `scripts/enrich-rich-links.ts` wires generated referral data into the tracked manifest and report
- `src/lib/content/referral-fields.ts` already supports `visitorBenefit`, `ownerBenefit`, completeness, and provenance
- `scripts/enrichment/public-browser.ts` and `scripts/public-rich-sync.ts` already prove the repo can do public browser capture when plain fetch is insufficient

The core implementation challenge is not schema. It is how to add explicit-only benefit extraction without letting the repo drift into vague keyword guessing or per-program bespoke logic. The safest design is:

1. add a pure benefit-extraction helper that works from normalized public text/metadata
2. run it first on static fetched public content
3. only if that leaves benefit fields blank and the target is still public, invoke a generic public browser fallback for JS-heavy pages
4. preserve manual-over-generated merge behavior and keep auth-gated flows out of scope

## Current Architecture To Reuse

### Referral fields already support the target outputs

`src/lib/content/referral-fields.ts` already defines:

- `visitorBenefit`
- `ownerBenefit`
- `offerSummary`
- `termsSummary`
- completeness
- per-field provenance

This is important because Phase 23 does **not** need to change the runtime schema. Once generated referral output starts filling `visitorBenefit` or `ownerBenefit`, the existing merge/provenance behavior will already carry those fields through.

### Public referral augmentation is already the right seam

`scripts/enrichment/public-augmentation.ts` currently:

- resolves public referral targets
- keeps original/resolved URL provenance
- extracts `offerSummary` and `termsSummary`
- skips auth-gated resolved URLs

That means benefit extraction belongs here too. The public augmentation seam is already where the repo turns public referral metadata into generated referral output.

### The main enrichment pipeline already persists what Phase 23 needs

`scripts/enrich-rich-links.ts` already:

- resolves the public strategy
- fetches the public source
- normalizes the result
- calls `resolvePublicReferralAugmentation(...)`
- writes generated metadata/report output

So Phase 23 does not need a new persistence path. It only needs a richer generated referral payload.

### Public browser support already exists, but not in the referral pipeline

`scripts/enrichment/public-browser.ts` and `scripts/public-rich-sync.ts` prove the repo already has:

- a generic `runPublicBrowserJson(...)` wrapper around `agent-browser`
- output/artifact conventions for public browser capture
- patterns for tolerant public-only browser flows

Phase 23 should reuse that capability, but keep the referral browser fallback narrower than the social-audience sync flow:

- only for public referral candidates
- only after static extraction leaves benefit fields unresolved
- only for public HTML-like targets, not XML/oEmbed

## Recommended Phase 23 Design

### 1. Add a pure benefit-extraction helper

Create a pure helper that accepts normalized public copy and returns:

- `visitorBenefit`
- `ownerBenefit`
- or nothing

It should use high-signal extraction rules only:

- direct customer-facing phrases like discounts, credit, cash back, free trial, free shipping, bonus, sats, membership pricing
- direct owner/creator/project benefit phrases like commission, supports the project, store credit, referral reward
- allow omission instead of guesswork when the copy is broad or ambiguous

This helper should not know about domains. It should operate on text and metadata only.

### 2. Keep static extraction as the default path

The first pass should inspect:

- resolved page title
- public description/meta text
- parsed body text when available in the existing public augmentation path

If the helper can extract explicit `visitorBenefit` and/or `ownerBenefit` from that material, stop there and return the generated fields.

### 3. Add a generic public browser fallback for JS-heavy pages

If a referral candidate still has no explicit benefit fields after static extraction, and:

- the target is public
- the strategy is HTML-like
- the URL is not auth-gated

then run a generic public browser capture that extracts rendered visible text and key headline/summary strings. Feed that captured text back through the same pure benefit-extraction helper used by the static path.

This keeps one extraction brain and two acquisition paths instead of two different parsing systems.

### 4. Preserve manual-over-generated behavior

Because the merge layer already works field-by-field, generated benefit extraction should remain:

- additive
- blank-fill-only
- fully optional

The most important regression case is that a manual `ownerBenefit` like Club Orange’s `Supports the project` must remain authoritative even if generated extraction would produce something similar or different.

### 5. Report and artifact surfaces should stay explicit

The report already knows how to carry referral payloads and completeness. Phase 23 should make sure:

- benefit fields appear in generated referral entries when extracted
- completeness stays coherent
- auth-gated or ambiguous pages do not magically look “full”
- tests prove browser fallback and omission paths separately

## Recommended Plan Split

### 23-01: Static explicit-only benefit extraction

Focus:

- add pure benefit-extraction helper
- wire it into `resolvePublicReferralAugmentation(...)`
- extend static public referral output with generated `visitorBenefit` / `ownerBenefit`

This plan establishes the actual extraction rules and keeps the behavior conservative.

### 23-02: Public browser fallback for JS-heavy public pages

Focus:

- add a generic browser capture helper for public referral targets
- use it only after static extraction leaves benefit fields unresolved
- enforce public-only and auth-gated stop conditions

This plan reuses the repo’s existing browser tooling without turning referral enrichment into an authenticated extractor flow.

### 23-03: Report, artifacts, and regression hardening

Focus:

- report coverage for extracted benefit fields and completeness
- refreshed generated artifacts if current live referral entries gain new generated benefits
- regression coverage for manual precedence, auth-gated omission, and browser fallback behavior

This plan closes the phase by making the new behavior visible and durable.

## Key Risks

### 1. Vague copy being misclassified as a benefit

This is the highest-risk product bug. Generic marketing language should not produce owner/visitor benefits unless the text explicitly states what each side gets.

### 2. Browser fallback silently becoming the default

The public browser path should only run when static extraction fails to resolve benefits for a public referral candidate. Otherwise Phase 23 will become expensive, flaky, and harder to reason about.

### 3. Auth-gated or login-redirected pages looking partially successful

The existing auth-gated URL check is already a good guardrail. Phase 23 should preserve it and add tests for login/challenge URLs.

### 4. Phase 23 bleeding into Phase 24 catalog work

Phase 24 now exists for shared referral catalog and skill-driven management. Phase 23 should not invent catalog IDs, shared matcher registries, or skill CRUD flows early. It should stay focused on generated benefit extraction using the current runtime contract.

## Research Conclusion

Phase 23 should be planned as three waves:

1. static explicit-only benefit extraction
2. browser fallback for JS-heavy public pages
3. report/artifact/regression hardening

That structure fits the existing codebase, respects the public-first/manual-authoritative posture, and leaves the future referral catalog/skill work to Phase 24 where it belongs.
