---
phase: 18-referral-contract-link-plumbing
verified: 2026-03-29T22:20:00Z
status: passed
score: 17/17 must-haves verified
---

# Phase 18: Referral Contract + Link Plumbing Verification Report

**Phase Goal:** Add a dedicated `links[].referral` data contract and merge/load-validation plumbing while keeping referral support additive to existing `simple` and `rich` links.  
**Verified:** 2026-03-29T22:20:00Z  
**Status:** passed

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `links[].referral` exists as a first-class validated contract with stable common fields plus `custom`. | ✓ VERIFIED | `schema/links.schema.json` now defines `linkReferralKind` and `linkReferralConfig`, and `src/lib/content/load-content.ts` exposes `OpenLink.referral`. |
| 2 | Runtime content loading can merge manual and generated referral data without disturbing existing non-referral links. | ✓ VERIFIED | `src/lib/content/load-content.ts` resolves optional generated `{ metadata, referral }` entries and merges `link.referral` through `mergeReferralWithManualOverrides(...)`. |
| 3 | Referral links on supported social-family domains can stay in generic/referral presentation mode instead of accidentally becoming profile cards. | ✓ VERIFIED | `scripts/validation/rules.ts` warns when supported profile-family referral links do not set `enrichment.profileSemantics="non_profile"`, and `data/examples/grouped/links.json` now demonstrates the approved Club Orange `non_profile` path. |
| 4 | Focused schema, load-content, and validation coverage protects the new contract and preserves current link behavior. | ✓ VERIFIED | `src/lib/content/referral-fields.test.ts`, `scripts/enrichment/generated-metadata.test.ts`, and `scripts/validation/rules.test.ts` all cover the new referral contract behavior; `bun run validate:data`, `bun run typecheck`, and `bun run build` passed. |

**Score:** 4/4 roadmap truths verified

### Plan Must-Haves

| Plan | Must-Have Summary | Status | Evidence |
|------|-------------------|--------|----------|
| 18-01 | `links[].referral` is optional, top-level, and does not introduce a new link type. | ✓ VERIFIED | `schema/links.schema.json` adds `referral` to `linkItem`, while `type` remains `simple`, `rich`, or `payment`. |
| 18-01 | Manual contract uses the approved neutral fields and omits `disclosureLabel`. | ✓ VERIFIED | `schema/links.schema.json` exposes `kind`, `visitorBenefit`, `ownerBenefit`, `offerSummary`, `termsSummary`, `termsUrl`, `code`, and `custom`; no `disclosureLabel` field exists. |
| 18-01 | `referral: {}` and one-sided benefits remain valid. | ✓ VERIFIED | `src/lib/content/referral-fields.test.ts` covers soft markers and one-sided disclosures; `bun run validate:data` passes without introducing new schema errors. |
| 18-01 | Runtime types and helper logic carry referral data for both `simple` and `rich` links. | ✓ VERIFIED | `OpenLink.referral` is part of the runtime model, and `src/lib/content/referral-fields.ts` centralizes normalization + merge helpers. |
| 18-02 | Existing generated metadata manifests remain valid when they only contain `metadata`. | ✓ VERIFIED | `scripts/enrichment/generated-metadata.test.ts` includes metadata-only compatibility checks, and `scripts/enrichment/generated-metadata.ts` keeps `referral` optional. |
| 18-02 | Per-link generated entries can optionally carry a `referral` sibling instead of a second generated manifest. | ✓ VERIFIED | `scripts/enrichment/types.ts` and `scripts/enrichment/generated-metadata.ts` now accept optional `referral` entries beside `metadata`. |
| 18-02 | Manual referral values win field-by-field while generated values fill blanks only. | ✓ VERIFIED | `src/lib/content/referral-fields.ts` implements manual-over-generated merge semantics with blank-fill-only behavior, and tests assert the merged output. |
| 18-02 | Runtime loaded links preserve referral provenance for later validation/UI work. | ✓ VERIFIED | `ResolvedLinkReferralConfig` and merged referral outputs now carry per-field provenance, with regression coverage in `src/lib/content/referral-fields.test.ts`. |
| 18-03 | Soft referral markers warn rather than fail. | ✓ VERIFIED | `scripts/validation/rules.ts` emits `Referral disclosure warning` when a referral object has no meaningful disclosure fields, and `scripts/validation/rules.test.ts` covers it. |
| 18-03 | `kind` alone is not treated as sufficient disclosure. | ✓ VERIFIED | The warning rule is driven by `hasMeaningfulReferralContent(...)`, and the tests explicitly cover `kind`-only referral markers. |
| 18-03 | Supported-profile referral links can use `enrichment.profileSemantics="non_profile"` and validation nudges maintainers toward it. | ✓ VERIFIED | `scripts/validation/rules.ts` emits a `Referral semantics warning` for supported profile-family referral links without `non_profile`, and tests cover both warned and non-warned cases. |
| 18-03 | Manual/generated referral mismatches surface as warnings. | ✓ VERIFIED | `scripts/validate-data.ts` now emits `Referral drift warning` when manual and generated referral fields disagree. |
| 18-03 | Example data demonstrates the additive contract without breaking builds. | ✓ VERIFIED | `data/examples/minimal/links.json` now contains a soft referral marker, and `data/examples/grouped/links.json` contains a richer supported-family referral example. |

**Score:** 13/13 plan must-have groups verified

### Required Artifact Checks

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `schema/links.schema.json` | Top-level referral contract | ✓ EXISTS + SUBSTANTIVE | Adds referral kind/config defs and exposes `referral` on each link item. |
| `src/lib/content/referral-fields.ts` | Shared referral helper seam | ✓ EXISTS + SUBSTANTIVE | Owns normalization, meaningful-field detection, merge semantics, and provenance helpers. |
| `src/lib/content/referral-fields.test.ts` | Focused contract/merge/provenance coverage | ✓ EXISTS + SUBSTANTIVE | Covers soft markers, one-sided benefits, merge precedence, and provenance normalization. |
| `scripts/enrichment/generated-metadata.ts` | Optional generated referral sibling handling | ✓ EXISTS + SUBSTANTIVE | Normalizes optional `referral` entries while preserving metadata-only behavior. |
| `scripts/enrichment/generated-metadata.test.ts` | Backward-compatible manifest coverage | ✓ EXISTS + SUBSTANTIVE | Verifies stabilization/equality behavior with and without referral entries. |
| `scripts/validation/rules.ts` | Referral warning policy | ✓ EXISTS + SUBSTANTIVE | Adds disclosure-light and supported-family `non_profile` guidance. |
| `scripts/validate-data.ts` | Manual/generated referral drift warnings | ✓ EXISTS + SUBSTANTIVE | Compares manual referral fields against generated referral augmentation data. |
| `data/examples/minimal/links.json` | Soft referral marker example | ✓ EXISTS + SUBSTANTIVE | Shows a simple `kind`-only promo marker. |
| `data/examples/grouped/links.json` | Fuller referral example including `non_profile` | ✓ EXISTS + SUBSTANTIVE | Shows a richer supported-family Club Orange referral configuration. |

**Artifacts:** 9/9 verified

## Requirements Coverage

| Requirement | Expected in Phase 18 | Status | Evidence |
|-------------|----------------------|--------|----------|
| REF-01 | Maintainer can mark a URL-based link as referral/affiliate/promo through a dedicated `links[].referral` object. | ✓ COMPLETE | The schema and runtime link model now expose `link.referral` as a first-class additive surface. |
| REF-02 | Maintainer can store explicit transparency fields and keep manual-vs-generated precedence predictable. | ✓ COMPLETE | Neutral fields, blank-fill-only generated merge, and per-field provenance are implemented and tested. |
| REF-03 | Maintainer can keep supported-family referral links in non-profile presentation mode. | ✓ COMPLETE | Validation nudges and example data now codify `enrichment.profileSemantics="non_profile"` for referral/promo use on supported profile-family URLs. |

## Automated Verification Runs

- `bun test src/lib/content/referral-fields.test.ts`
- `bun test scripts/enrichment/generated-metadata.test.ts`
- `bun test scripts/validation/rules.test.ts scripts/enrichment/generated-metadata.test.ts src/lib/content/referral-fields.test.ts`
- `bun run validate:data`
- `bun run typecheck`
- `bun run build`

All passed. The build/validation outputs still include the pre-existing non-blocking warnings about stale LinkedIn authenticated cache, Rumble partial metadata, and fallback social preview imagery.

## Anti-Patterns Found

None.

## Human Verification Required

None.

## Gaps Summary

**No gaps found.** Phase 18 delivered the contract, generated augmentation plumbing, warnings, and examples required by the roadmap. The remaining warnings are pre-existing repo conditions and not regressions introduced by this phase.

## Verification Metadata

**Verification approach:** roadmap truths + plan must-haves + artifact inspection + focused automated command runs  
**Automated checks:** 6 passed, 0 failed  
**Human checks required:** 0  
**Total verification time:** 1 execution session

---
*Verified: 2026-03-29T22:20:00Z*
*Verifier: Codex (orchestrated execution)*
