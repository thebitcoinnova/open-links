---
phase: 19-public-referral-enrichment-offer-capture
verified: 2026-03-30T00:35:00Z
status: passed
score: 17/17 must-haves verified
---

# Phase 19: Public Referral Enrichment + Offer Capture Verification Report

**Phase Goal:** Generalize public enrichment so common referral destinations can resolve canonical landing pages and capture promo metadata plus obvious offer terms without requiring a bespoke extractor by default.  
**Verified:** 2026-03-30T00:35:00Z  
**Status:** passed

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Common public referral URLs can resolve canonical metadata without a new program-specific extractor. | ✓ VERIFIED | `scripts/enrichment/referral-targets.ts` now normalizes query-param, path-based, shortener, and known-family referral targets; the direct strategy in `scripts/enrichment/strategy-registry.ts` reuses that helper. |
| 2 | When public terms are clearly discoverable, generated referral data captures them along with provenance and partial/inferred status. | ✓ VERIFIED | `data/generated/rich-metadata.json` now includes `cluborange-referral.referral` with `offerSummary`, `termsSummary`, `completeness`, `originalUrl`, `resolvedUrl`, and `strategyId`; `scripts/enrich-rich-links.ts` and `scripts/enrichment/public-augmentation.ts` populate those fields. |
| 3 | Existing one-off Club Orange referral behavior remains covered as a generalized regression case. | ✓ VERIFIED | Club Orange now uses the shared referral-target helper, and the Club Orange regression remains present in `scripts/enrichment/public-augmentation.test.ts` plus the real generated artifact output. |
| 4 | Enrichment reports and tests make the limits of extracted referral transparency explicit. | ✓ VERIFIED | `data/generated/rich-enrichment-report.json` now stores `referral` plus `referralCompleteness`, `scripts/enrichment/report.test.ts` covers `full`, `partial`, and `none`, and `public-augmentation.test.ts` covers omission-over-inference plus auth-gated skip behavior. |

**Score:** 4/4 roadmap truths verified

### Plan Must-Haves

| Plan | Must-Have Summary | Status | Evidence |
|------|-------------------|--------|----------|
| 19-01 | Original saved URL and resolved extraction target are both representable. | ✓ VERIFIED | `strategy-types.ts` now supports `source.originalUrl`, `fetch-metadata.ts` exposes `finalUrl`, and generated referral output stores `originalUrl` and `resolvedUrl`. |
| 19-01 | Known-family rewrites remain in strategy code, not user-authored JSON. | ✓ VERIFIED | Club Orange canonicalization lives in `scripts/enrichment/referral-targets.ts` and is consumed from `public-augmentation.ts`; no author-facing schema changes were added. |
| 19-01 | Offer-affecting referral params are preserved while pure analytics params are stripped. | ✓ VERIFIED | `scripts/enrichment/referral-targets.ts` tracks preserved vs stripped params, and `scripts/enrichment/referral-targets.test.ts` covers `ref`, `code`, `utm_*`, and `fbclid`. |
| 19-01 | Shorteners are supported only within a bounded public-only redirect policy. | ✓ VERIFIED | The referral target helper accepts `finalUrl` for shortener-backed resolution, and the fetch layer now surfaces final public URLs for later provenance without introducing authenticated behavior. |
| 19-01 | Existing Club Orange behavior stays covered by the new regression surface. | ✓ VERIFIED | Club Orange resolution and parsing remain covered in `public-augmentation.test.ts` and the real generated output. |
| 19-02 | `offerSummary` may use clearly public promo copy while `termsSummary` stays stricter. | ✓ VERIFIED | `resolvePublicReferralAugmentation(...)` in `public-augmentation.ts` uses promo-oriented title/sentence heuristics for `offerSummary` and separate condition-only sentence matching for `termsSummary`. |
| 19-02 | Ambiguous pages prefer omission over inference. | ✓ VERIFIED | `public-augmentation.test.ts` now asserts that ambiguous direct referral pages produce `completeness: "none"` instead of guessed terms. |
| 19-02 | Generated referral output preserves original/resolved URLs, strategy id, and terms source URL where applicable. | ✓ VERIFIED | `referral-fields.ts` defines those generated fields, `enrich-rich-links.ts` writes them, and the real Club Orange artifact shows them populated. |
| 19-02 | Referral completeness is explicit (`full`, `partial`, `none`). | ✓ VERIFIED | `referral-fields.ts` and `types.ts` now model completeness, `report.ts` persists it, and tests cover all three states. |
| 19-02 | No confidence score is introduced. | ✓ VERIFIED | No confidence field exists in the generated referral type or the report surface. |
| 19-03 | Club Orange remains supported as a generalized regression case. | ✓ VERIFIED | Club Orange canonicalization routes through the new referral target helper and still passes the seeded regression tests. |
| 19-03 | Broad shape-based referral target coverage is locked by tests. | ✓ VERIFIED | `referral-targets.test.ts`, `strategy-registry.test.ts`, and `public-augmentation.test.ts` cover direct, query-param, path-based, shortener, and known-family cases. |
| 19-03 | `full`, `partial`, and `none` referral outcomes are visible in the report/test surface. | ✓ VERIFIED | `scripts/enrichment/report.test.ts` explicitly covers `full`, `partial`, and `none`, and `data/generated/rich-enrichment-report.json` shows `referralCompleteness: "full"` for the seeded Club Orange case. |

**Score:** 13/13 plan must-have groups verified

### Required Artifact Checks

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/enrichment/referral-targets.ts` | Reusable referral target normalization | ✓ EXISTS + SUBSTANTIVE | Handles param filtering, known-family rewrites, path-based patterns, and shortener-backed final targets. |
| `scripts/enrichment/referral-targets.test.ts` | Broad shape-based target tests | ✓ EXISTS + SUBSTANTIVE | Covers direct, query-param, path-based, shortener, and Club Orange cases. |
| `scripts/enrichment/fetch-metadata.ts` | Final public URL support | ✓ EXISTS + SUBSTANTIVE | Exposes `finalUrl` on fetch results. |
| `scripts/enrichment/public-augmentation.ts` | Conservative referral extraction helper | ✓ EXISTS + SUBSTANTIVE | Exports `resolvePublicReferralAugmentation(...)` with omission-over-inference and auth-gated skip behavior. |
| `scripts/enrichment/public-augmentation.test.ts` | Club Orange + `partial` + auth-gated regression coverage | ✓ EXISTS + SUBSTANTIVE | Covers seeded full extraction, partial headline-only extraction, and auth-gated omission. |
| `scripts/enrich-rich-links.ts` | Generated referral output wiring | ✓ EXISTS + SUBSTANTIVE | Writes `{ metadata, referral }` entries and `referralCompleteness` into enrichment results. |
| `scripts/enrichment/report.ts` | Referral report persistence | ✓ EXISTS + SUBSTANTIVE | Reads/writes referral completeness and provenance on report entries. |
| `scripts/enrichment/report.test.ts` | Report completeness/provenance tests | ✓ EXISTS + SUBSTANTIVE | Covers `full`, `partial`, and `none` referral outcomes. |

**Artifacts:** 8/8 verified

## Requirements Coverage

| Requirement | Expected in Phase 19 | Status | Evidence |
|-------------|----------------------|--------|----------|
| ENR-01 | Common public referral URLs can resolve canonical metadata without bespoke extractor work. | ✓ COMPLETE | The new target helper and direct strategy canonicalization handle broad referral shapes and known-family rewrites. |
| ENR-02 | Public referral terms or offer hints are captured additively while manual values remain authoritative. | ✓ COMPLETE | Generated referral output is now emitted in `data/generated/rich-metadata.json`, and Phase 18’s manual-over-generated runtime merge still applies on load. |
| ENR-03 | Maintainers can see whether referral terms are full, partial, or unavailable and where they came from. | ✓ COMPLETE | Completeness + provenance are present in the generated artifact and in `data/generated/rich-enrichment-report.json`. |

## Automated Verification Runs

- `bun test scripts/enrichment/referral-targets.test.ts scripts/enrichment/fetch-metadata.test.ts scripts/enrichment/public-augmentation.test.ts scripts/enrichment/strategy-registry.test.ts`
- `bun test src/lib/content/referral-fields.test.ts scripts/enrichment/public-augmentation.test.ts scripts/enrichment/generated-metadata.test.ts scripts/enrichment/report.test.ts`
- `bun test scripts/enrichment/public-augmentation.test.ts scripts/enrichment/report.test.ts scripts/enrichment/referral-targets.test.ts scripts/enrichment/strategy-registry.test.ts src/lib/content/referral-fields.test.ts`
- `bun run typecheck`
- `bun run build`
- `bun run enrich:rich:strict`

All passed. The build/validation flows still emit the pre-existing non-blocking warnings about stale LinkedIn authenticated cache, Rumble partial metadata, and fallback social preview imagery.

## Anti-Patterns Found

None.

## Human Verification Required

None.

## Gaps Summary

**No gaps found.** Phase 19 delivered generalized target resolution, generated referral output, and explicit report/test semantics for public referral extraction. The remaining warnings are pre-existing repo conditions and not regressions introduced by this phase.

## Verification Metadata

**Verification approach:** roadmap truths + plan must-haves + artifact inspection + focused automated command runs  
**Automated checks:** 6 passed, 0 failed  
**Human checks required:** 0  
**Total verification time:** 1 execution session

---
*Verified: 2026-03-30T00:35:00Z*
*Verifier: Codex (orchestrated execution)*
