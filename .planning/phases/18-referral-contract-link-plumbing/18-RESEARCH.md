# Phase 18 Research: Referral Contract + Link Plumbing

**Researched:** 2026-03-29  
**Scope:** Referral data contract, merge/load plumbing, and validation defaults before any extraction or card-UI work

## Executive Summary

Phase 18 should establish referral support as a first-class, additive link contract without creating a new link type or a separate referral-only data file. The safest place for the manual authoring surface is a new optional `links[].referral` object on the top-level link model, not `metadata`, because referral disclosure applies to both `simple` and `rich` links and is not purely preview metadata.

The repo already has two strong patterns to reuse:

- field-by-field manual-over-generated precedence in `src/lib/content/social-profile-fields.ts`
- per-link generated augmentation merging in `src/lib/content/load-content.ts` via `data/generated/rich-metadata.json`

The lowest-risk Phase 18 direction is:

1. add `links[].referral` as the manual source-of-truth contract
2. add a small shared referral helper module for field lists, normalization, and merge logic
3. extend the existing per-link generated metadata manifest so each link entry can optionally carry `referral` augmentation data beside `metadata`
4. keep existing generated manifests backward compatible
5. enforce Phase 18 policy through warnings, not hard failures, for soft/partial referral entries

## What to Reuse

### Existing link-model seams

- `schema/links.schema.json` already models additive per-link configuration without introducing new link types for every behavior.
- `src/lib/content/load-content.ts` already defines the runtime `OpenLink` type and merges generated per-link metadata into loaded links.
- `src/lib/content/social-profile-fields.ts` already centralizes field lists plus field-by-field manual override semantics for social-profile metadata.

### Existing generated-augmentation seams

- `scripts/enrichment/types.ts` defines the generated per-link metadata typing used by enrichment and validation.
- `scripts/enrichment/generated-metadata.ts` already normalizes and stabilizes the generated manifest while preserving backward compatibility for unchanged links.
- `scripts/validate-data.ts` already resolves generated metadata by link before runtime-style validation checks.

### Existing validation posture

- `scripts/validation/rules.ts` is already warning-heavy for “informational but important” authoring issues.
- `scripts/validation/rules.ts` already has a profile-semantics warning model that can be reused for referral links on supported social/profile domains.
- `scripts/validation/rules.test.ts` already covers warning-level behavior and is the right place to lock the new referral warning rules.

### Existing Studio/manual fallback posture

- `packages/studio-web/src/pages/EditorPage.tsx` already has an Advanced JSON path for unsupported fields.
- `packages/studio-api/src/services/validation.ts` loads `schema/links.schema.json` directly, so additive schema changes automatically flow into Studio payload validation.

This means Phase 18 does not need first-class Studio forms to make the referral contract usable.

## Recommended Contract Shape

### Manual contract location

Put referral data on the top-level link object:

- `links[].referral`

Avoid these alternatives:

- `links[].metadata.referral`
  because referral disclosure is not only rich-card preview metadata and should work for `simple` links too
- a fourth `link.type`
  because the user explicitly wants referral support additive to existing `simple` and `rich` links
- a second generated referral manifest
  because the repo already has a stable per-link generated augmentation file

### Manual fields

Phase 18 should support these user-approved concepts:

- `kind` (optional; umbrella classifier, not a new link type)
- `visitorBenefit`
- `ownerBenefit`
- `offerSummary`
- `termsSummary`
- `termsUrl`
- `code`
- `custom`

Contract expectations:

- neutral field names
- one-sided benefits are valid
- `referral: {}` is valid as a soft marker
- `kind` alone is not meaningful disclosure
- no dedicated `disclosureLabel` yet

## Merge and Provenance Guidance

### Best merge model

Phase 18 should copy the repo’s existing profile-field override posture:

- manual referral fields win field-by-field
- generated referral fields fill only blanks
- conflict detection is warning-level, not blocking

### Provenance recommendation

The user asked for maximum auditability/debuggability, so object-level `source: "mixed"` is too coarse. The better Phase 18 shape is per-field provenance where practical, for example a provenance map keyed by referral field name.

That provenance should live in the generated/runtime augmentation surface, not in the author-authored manual schema.

### Generated-manifest recommendation

Do not create a second generated file. Extend the existing per-link generated manifest entry shape from:

- `{ metadata }`

to:

- `{ metadata, referral }`

This keeps existing infrastructure intact and lets Phase 19 plug referral extraction into an already-known merge path. Existing manifests that only include `metadata` must remain valid.

## Validation Guidance

### Warnings that belong in Phase 18

The contract wants flexibility, so these should be warnings rather than schema errors:

- empty `referral: {}` markers
- referral objects where `kind` is the only populated field
- referral links on supported social/profile domains that do not explicitly opt into `enrichment.profileSemantics="non_profile"`
- manual/generated referral field mismatches once generated referral augmentation exists

### Hard validation that still makes sense

Some shape checks should still be strict:

- `termsUrl` must parse as a URI when present
- `code` should be a non-empty string when present
- referral fields should stay string-based or object-based exactly where the schema defines them

## Downstream / Compatibility Notes

`open-links-sites` mirrors this repo’s schemas and three-file data contract, so Phase 18 should treat the referral schema as a compatibility-sensitive addition:

- keep the field additive and optional
- do not change existing link-type semantics
- do not require downstream repos to add referral data immediately
- avoid introducing a separate file or new entrypoint that downstream automation would need to learn mid-milestone

## Testing Seams

### Best unit-test targets

- a dedicated referral helper module for normalization + field-by-field merge behavior
- `scripts/enrichment/generated-metadata.test.ts` for backward compatibility of the generated manifest
- `scripts/validation/rules.test.ts` for new referral warnings

### Best higher-level verification targets

- `bun run validate:data`
- `bun run typecheck`
- `bun run build`

These will prove the additive schema/runtime changes do not break existing data or the current app build.

## Phase-Specific Pitfalls

### 1. Putting referral data under `metadata`

That would make referral disclosure feel like a rich-card-only feature and complicate simple-link support.

### 2. Creating a new link type

That would break the additive requirement and likely force broader UI/render changes before the contract is even stable.

### 3. Splitting generated referral data into a second file

The repo already has a per-link augmentation manifest. A second file would add drift, extra loading code, and more downstream compatibility surface.

### 4. Over-validating soft entries

The user explicitly wants partial/placeholder referral support. Blocking on incomplete fields would push maintainers back into `custom` or ad-hoc descriptions.

### 5. Letting extraction silently override manual disclosures

That would undercut trust and make the contract hard to debug. Manual values should remain authoritative.

## Recommended Research Conclusion

The lowest-risk Phase 18 plan is:

1. Add `links[].referral` to `schema/links.schema.json` and runtime types in `src/lib/content/load-content.ts`.
2. Introduce a dedicated referral helper module that defines the canonical field list, merge rules, and provenance helpers.
3. Extend the existing generated per-link augmentation shape to optionally carry `referral` data beside `metadata`.
4. Merge referral data field-by-field with manual precedence and blank-fill-only generated behavior.
5. Add validation warnings for disclosure-light entries, supported-profile referral defaults, and manual/generated conflicts.
6. Seed example data and tests so the contract is demonstrably additive before Phase 19 starts extraction work.

## Sources

- `schema/links.schema.json`
- `src/lib/content/load-content.ts`
- `src/lib/content/social-profile-fields.ts`
- `scripts/enrichment/types.ts`
- `scripts/enrichment/generated-metadata.ts`
- `scripts/enrichment/generated-metadata.test.ts`
- `scripts/validation/rules.ts`
- `scripts/validation/rules.test.ts`
- `scripts/validate-data.ts`
- `packages/studio-api/src/services/validation.ts`
- `packages/studio-web/src/pages/EditorPage.tsx`
- `docs/data-model.md`
- `docs/downstream-open-links-sites.md`
- `docs/create-new-rich-content-extractor.md`
- `.planning/phases/18-referral-contract-link-plumbing/18-CONTEXT.md`

---
*Phase: 18-referral-contract-link-plumbing*
*Research gathered: 2026-03-29*
