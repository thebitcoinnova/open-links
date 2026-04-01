# Phase 22 Research: Source-Authored Referral Flow Proof

**Researched:** 2026-03-30  
**Scope:** Close the milestone audit gap by proving the manual-first referral authoring path on real project data

## Executive Summary

Phase 22 should be a narrow gap-closure phase, not another referral feature phase. The milestone audit did not find a broken implementation across schema, enrichment, UI, or docs. It found one missing proof:

- the real repo does not currently contain a source-authored `links[].referral` object in `data/links.json`

That means the codebase already proves:

1. schema -> runtime merge
2. generated referral enrichment -> render
3. maintainer docs -> verification guidance

but it does **not** yet prove:

1. maintainer authors a referral object in source data
2. generated data fills blanks without drift
3. runtime renders the merged result from the real dataset
4. verification commands stay green

The safest fix is to use the existing `cluborange-referral` link in `data/links.json` as the real source-authored proof case instead of inventing a new referral link.

## Current Gap State

### The live source link is almost ready

Current real source data for `cluborange-referral`:

- exists in `data/links.json`
- is already a `rich` link
- already uses `enrichment.profileSemantics: "non_profile"`
- already participates in the public referral augmentation pipeline

Current problem:

- it has no `referral` object in source data at all
- all visible referral disclosure currently comes from generated artifacts under `data/generated/rich-metadata.json`

That is exactly why the milestone audit marked the manual-first flow as unproven.

### The generated path is already healthy

Current generated output for `cluborange-referral` already includes:

- `kind: "referral"`
- `offerSummary`
- `termsSummary`
- `completeness: "full"`
- `originalUrl`
- `resolvedUrl`
- `strategyId`
- `termsSourceUrl`

So Phase 22 does not need to reopen enrichment logic. It needs to add a source-authored referral object that coexists cleanly with this generated output.

## Recommended Proof Strategy

### Use `cluborange-referral` as the live source-authored example

This is the lowest-risk candidate because:

- it already exists in real data
- it already has working public referral enrichment
- it already uses the supported-family `non_profile` path
- the UI already exercises it

That means one small source-data change can close the audit gap without inventing a new product example.

### Keep the manual referral object minimal and stable

The best manual fields are the ones that:

- prove source authoring is real
- do not duplicate volatile public marketing copy
- do not create manual/generated drift warnings
- improve the live maintainer/user experience immediately

Recommended manual shape:

```json
"referral": {
  "kind": "referral",
  "ownerBenefit": "Supports the project",
  "termsUrl": "https://www.cluborange.org/signup?referral=pryszkie"
}
```

Why this shape is strong:

- `kind` + `ownerBenefit` proves source-authored referral disclosure
- `ownerBenefit` does not exist in generated output, so it proves blank-fill merge
- `termsUrl` is manual-only today, which lets the live UI show the sibling `Terms` link from real data instead of only from test fixtures
- generated `offerSummary` and `termsSummary` can still fill blanks without drift
- avoid freezing generated promo copy into source data unnecessarily

### Add one focused runtime/load-content proof

The current tests already cover:

- merge semantics in `src/lib/content/referral-fields.test.ts`
- generated referral output in report/enrichment tests
- referral card rendering with fixtures

What is missing is a direct proof that the **real dataset** now loads and merges the source-authored referral object correctly.

Best regression seam:

- add one new content-level test, likely `src/lib/content/load-content.referral.test.ts`

That test should prove:

- `loadContent()` returns `cluborange-referral.referral`
- manual fields (`kind`, `ownerBenefit`, `termsUrl`) survive
- generated fields (`offerSummary`, `termsSummary`, completeness/provenance metadata as applicable) fill blanks
- no drift warning path is triggered by the chosen source shape

An optional secondary assertion can check the built card model for the loaded link, but the content-loading seam is the highest-signal missing proof.

## Files Most Likely Needed

### Data + generated artifact proof

- `data/links.json`
- possibly `data/generated/rich-metadata.json` if enrich output changes
- possibly `data/generated/rich-enrichment-report.json` if report output changes

### Regression surface

- likely a new `src/lib/content/load-content.referral.test.ts`
- possibly a small extension to an existing card/model dataset test if that becomes clearer than a new file

### No broad docs sweep needed

Phase 21 already documented the referral contract and maintainer workflow. Phase 22 should not reopen docs unless the implementation exposes a small wording mismatch while closing the gap.

## Pitfalls Specific To This Phase

### 1. Copying generated promo text into source data

If Phase 22 writes generated `offerSummary` or `termsSummary` back into `data/links.json` just to “prove” the source flow, it may create avoidable drift churn and blur the manual-vs-generated boundary the milestone intentionally established.

### 2. Reopening enrichment design

The generated referral path already works. Phase 22 should not broaden into new extractor logic, new provenance formats, or simple-link augmentation support unless a concrete blocker appears.

### 3. Using only test fixtures again

The audit gap exists precisely because the real source data does not prove the flow. Adding more fixture-only tests without touching `data/links.json` would not close the milestone gap.

### 4. Adding a source-authored shape that triggers drift warnings

If manual fields intentionally duplicate generated fields but differ slightly, `validate:data` will warn. The fix should choose fields that are stable and complementary.

## Recommended Research Conclusion

The lowest-risk Phase 22 plan is:

1. add a minimal but meaningful `referral` object to the real `cluborange-referral` entry in `data/links.json`
2. rerun enrichment/validation/build so the live dataset proves the source-authored path
3. add one focused `loadContent()`-level regression that asserts the real source-authored referral object merges cleanly with generated referral output

That is enough to close the audit gap without turning this into another broad referral milestone.

## Sources

- `.planning/v1.3-MILESTONE-AUDIT.md`
- `.planning/ROADMAP.md`
- `data/links.json`
- `data/generated/rich-metadata.json`
- `data/generated/rich-enrichment-report.json`
- `src/lib/content/referral-fields.ts`
- `src/lib/content/load-content.ts`
- `scripts/enrich-rich-links.ts`
- `scripts/validate-data.ts`
- `scripts/validation/rules.ts`

---
*Phase: 22-source-authored-referral-flow-proof*
*Research gathered: 2026-03-30*
