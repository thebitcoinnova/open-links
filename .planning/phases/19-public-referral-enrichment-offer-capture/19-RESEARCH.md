# Phase 19 Research: Public Referral Enrichment + Offer Capture

**Researched:** 2026-03-29  
**Scope:** Public-first referral normalization, offer-term extraction, provenance, and regression strategy for Phase 19

## Executive Summary

Phase 19 should extend the existing `public_augmented` enrichment architecture instead of adding a new referral-specific subsystem. The repo already has the right building blocks:

- `public_direct` and `public_augmented` strategy selection in `scripts/enrichment/strategy-registry.ts`
- target rewriting and parser specialization in `scripts/enrichment/public-augmentation.ts`
- cached-source tracking through `sourceUrl` in `scripts/enrichment/public-cache.ts`
- generated per-link augmentation output in `data/generated/rich-metadata.json`
- a fresh additive `referral` runtime/generated seam from Phase 18

The main planning risk is not technical feasibility. It is keeping Phase 19 broad enough to handle many referral URL shapes while staying conservative about terms extraction. The safest structure is:

1. build a reusable referral-target normalization layer for query-param, path-based, known-family, and shortener-backed public URLs
2. extend `public_augmented` outputs so they can return referral data plus structured provenance
3. wire that referral output into `enrich-rich-links` and the enrichment report with explicit `full/partial/none` completeness
4. preserve the existing Club Orange referral behavior as a generalized regression case rather than a one-off forever

## Existing Architecture To Reuse

### Public augmentation already rewrites source URLs

`scripts/enrichment/public-augmentation.ts` already normalizes weak source URLs into stronger public targets:

- Medium profile URLs -> RSS/feed URLs
- Substack custom domains -> canonical `substack.com/@handle`
- YouTube profile URLs -> `/about`
- Rumble profile/video URLs -> `/about`
- Club Orange referral wrapper URLs -> canonical signup page

This means Phase 19 does not need a brand-new extraction model. It needs a more generic referral-target resolver that existing public augmentation strategies can reuse.

### Public-first JS-heavy patterns already exist

The current repo already supports public-but-not-plain-fetch-friendly enrichments:

- X oEmbed
- X community metadata
- Instagram public page metadata
- YouTube public profile metadata
- optional public browser refresh patterns documented in `docs/create-new-rich-content-extractor.md`

So the Phase 19 decision to include JS-heavy but still public pages fits the current architecture. The planning constraint is to keep those flows public-only and never let Phase 19 silently fall into authenticated extraction.

### Current fetch/cache plumbing is almost enough

`scripts/enrichment/fetch-metadata.ts` returns request outcome metadata, but it does not currently expose a normalized final/public target suitable for referral provenance. `scripts/enrichment/public-cache.ts` already tracks `sourceUrl`, which is a good precedent for storing the extraction target URL. Phase 19 should extend the existing target/result model rather than inventing a second provenance file.

### Current generated output shape can absorb referral data

Phase 18 extended the generated manifest so each link entry can now carry:

- `metadata`
- optional `referral`

That is sufficient for Phase 19. The missing piece is richer generated referral content:

- `offerSummary`
- `termsSummary`
- `termsUrl` when extractable
- provenance fields like original URL, resolved target, strategy id, and terms source URL
- referral completeness (`full`, `partial`, `none`)

## Recommended Phase 19 Design

### 1. Add a reusable referral-target normalization helper

This should not live in the user data model. It belongs in enrichment strategy code.

It should understand:

- direct public landing pages with no rewrite
- query-param referral URLs (`ref`, `referral`, `invite`, `code`, `coupon`)
- path-based invite/referral URLs
- known-family canonical rewrites such as Club Orange
- shortener or bounded multi-hop redirects when the final destination is public

It should preserve:

- original saved URL
- resolved extraction target URL
- offer-affecting identifiers

It should strip:

- pure analytics params (`utm_*`, `fbclid`, `gclid`) when they do not change the offer

### 2. Separate promo copy from condition capture

The user approved a strict split:

- `offerSummary`: may use headline-level public promo copy
- `termsSummary`: only plainly stated conditions

This means the parser should be allowed to return:

- `offerSummary` only
- `offerSummary + termsSummary`
- no referral terms at all

It should not fabricate `termsSummary` from weak clues.

### 3. Keep provenance structured and audit-friendly

Phase 19 should avoid confidence scores and instead record:

- original saved URL
- resolved extraction target URL
- extraction strategy id
- terms source URL when different from the resolved landing page
- completeness status (`full`, `partial`, `none`)

The best place for this is the generated referral output itself and the enrichment report entries, not freeform notes.

### 4. Preserve public-only boundaries

Auth-gated flows should stop cleanly in Phase 19.

Allowed:

- publicly reachable HTML
- public oEmbed/XML/JSON endpoints
- JS-heavy but public browser-readable pages
- shorteners that ultimately resolve to public landing pages

Not allowed:

- flows requiring login/challenge to see the offer
- authenticated-only terms pages
- implicit escalation from public referral extraction into authenticated extractors

## Best Code Seams For Each Phase 19 Plan

### 19-01 Foundation seam

Likely files:

- `scripts/enrichment/strategy-types.ts`
- `scripts/enrichment/fetch-metadata.ts`
- `scripts/enrichment/public-augmentation.ts`
- likely a new helper such as `scripts/enrichment/referral-targets.ts`
- targeted tests in `scripts/enrichment/public-augmentation.test.ts`, `scripts/enrichment/fetch-metadata.test.ts`, and possibly a new `scripts/enrichment/referral-targets.test.ts`

This plan should establish:

- reusable target normalization
- bounded redirect/shortener handling
- original/resolved target representation

### 19-02 Data/output seam

Likely files:

- `src/lib/content/referral-fields.ts`
- `scripts/enrichment/types.ts`
- `scripts/enrich-rich-links.ts`
- `scripts/enrichment/report.ts`
- `scripts/enrichment/public-augmentation.ts`
- tests around generated output and report shape

This plan should establish:

- referral completeness status
- generated provenance fields
- actual `offerSummary` / `termsSummary` population
- enrichment report visibility for referral extraction state

### 19-03 Regression/generalization seam

Likely files:

- `scripts/enrichment/public-augmentation.ts`
- `scripts/enrichment/public-augmentation.test.ts`
- `scripts/enrichment/strategy-registry.test.ts`
- potentially a new `scripts/enrichment/report.test.ts`

This plan should establish:

- Club Orange routed through the generalized path rather than remaining a forever-special isolated branch
- broader regression coverage for query-param, path-based, and shortener-backed referral targets
- explicit test coverage for `partial`/`none` outcomes and public-only guardrails

## Pitfalls Specific To This Phase

### 1. Overfitting to brand-specific heuristics

If Phase 19 bakes every referral program into a separate hand-coded branch, it will violate the “flexible and extensible” goal immediately. The first-class unit should be URL shape + public target behavior, not brand.

### 2. Blurring `offerSummary` and `termsSummary`

The phase needs to preserve the approved threshold:

- headline-like promo copy is fine for `offerSummary`
- conditions need stronger evidence for `termsSummary`

If these collapse into one fuzzy parser, the extraction output will look more certain than it is.

### 3. Losing the original URL during normalization

If the generated output only stores the final target, debugging referral normalization will be painful. The original saved URL must remain visible.

### 4. Quietly escalating into auth behavior

The repo already has authenticated extractor infrastructure, but Phase 19 should not depend on it. Public JS-heavy handling is okay; auth-gated handling is a different problem.

### 5. Reporting too little

If referral extraction only emits `referral` fields without completeness or provenance, later UI/validation layers will not be able to explain why a link is partial or where the extracted terms came from.

## Recommended Research Conclusion

The lowest-risk Phase 19 plan is:

1. Introduce reusable referral-target normalization + bounded redirect provenance in the public augmentation layer.
2. Extend generated referral data with structured provenance and `full/partial/none` completeness.
3. Populate `offerSummary` conservatively from public promo copy and populate `termsSummary` only from plainly stated conditions.
4. Surface referral completeness/provenance in the enrichment report.
5. Generalize the current Club Orange referral behavior into the new referral-target layer and protect it with regression tests.

## Sources

- `scripts/enrichment/public-augmentation.ts`
- `scripts/enrichment/public-augmentation.test.ts`
- `scripts/enrichment/strategy-types.ts`
- `scripts/enrichment/strategy-registry.ts`
- `scripts/enrichment/strategy-registry.test.ts`
- `scripts/enrichment/fetch-metadata.ts`
- `scripts/enrichment/public-cache.ts`
- `scripts/enrichment/report.ts`
- `scripts/enrich-rich-links.ts`
- `data/cache/rich-public-cache.json`
- `docs/create-new-rich-content-extractor.md`
- `.planning/phases/19-public-referral-enrichment-offer-capture/19-CONTEXT.md`
- `.planning/phases/18-referral-contract-link-plumbing/18-RESEARCH.md`
- `.planning/phases/18-referral-contract-link-plumbing/18-VERIFICATION.md`

---
*Phase: 19-public-referral-enrichment-offer-capture*
*Research gathered: 2026-03-29*
