# Phase 24 Research: Referral Catalog + Skill-Driven Management

**Researched:** 2026-03-31  
**Scope:** Shared referral catalog storage, overlay/merge rules, matcher/link-shape modeling, sibling skill design, and downstream-safe migration planning

## Executive Summary

Phase 24 should not replace `links[].referral`. It should move referral authorship one layer up by adding a shared catalog that can seed and normalize referral data before the existing runtime/render contract is resolved.

The current repo already has the important lower-level pieces:

- `links[].referral` exists as an additive manual/runtime contract in `schema/links.schema.json` and `src/lib/content/referral-fields.ts`
- generated referral augmentation already merges into links in `src/lib/content/load-content.ts`
- public referral enrichment already resolves Club Orange through a special-case target path in `scripts/enrichment/referral-targets.ts` and `scripts/enrichment/public-augmentation.ts`
- the enrichment report and generated metadata already carry referral provenance/completeness in `scripts/enrichment/report.ts` and `scripts/enrichment/generated-metadata.ts`

That means Phase 24 is primarily an orchestration and model-design phase:

1. add a first-class referral catalog with stable ids and declarative matchers
2. let links reference the catalog explicitly while still overriding fields locally
3. keep manual `links[].referral` authoritative, with catalog and generated/public data filling blanks
4. move the maintainer workflow into a sibling referral-management skill instead of extending extractor-authoring workflows

## Existing Surfaces Phase 24 Will Touch

### Data and schema

- `schema/links.schema.json`
- `data/links.json`
- `data/generated/rich-metadata.json`
- likely a new catalog file under `data/policy/` so downstream copy rules stay aligned with existing copied policy files
- `config/fork-owned-paths.json` if a fork-local overlay file is introduced

### Runtime and enrichment

- `src/lib/content/referral-fields.ts`
- `src/lib/content/load-content.ts`
- `scripts/enrichment/referral-targets.ts`
- `scripts/enrichment/public-augmentation.ts`
- `scripts/enrich-rich-links.ts`
- `scripts/enrichment/generated-metadata.ts`
- `scripts/enrichment/report.ts`
- `scripts/validate-data.ts`

### Docs and maintainer flows

- `docs/data-model.md`
- `docs/customization-catalog.md`
- `docs/openclaw-update-crud.md`
- `docs/ai-guided-customization.md`
- `docs/studio-self-serve.md`
- `docs/create-new-rich-content-extractor.md`
- `docs/authenticated-rich-extractors.md`
- `docs/downstream-open-links-sites.md`
- `README.md`

### Skill entrypoints

- existing `skills/create-new-rich-content-extractor/SKILL.md`
- new sibling `skills/referral-management/SKILL.md`
- README skill discovery list

## Recommended Catalog Architecture

### Storage

The safest canonical home is a tracked shared file under `data/policy/`, with a schema beside it. That keeps the catalog in the same downstream-copied family as other shared policy data and avoids inventing a new sync convention.

Recommended shape:

- `data/policy/referral-catalog.json`
- `schema/referral-catalog.schema.json`

If a fork-local overlay is needed, add a second optional overlay file, also schema-validated, and mark it fork-owned in `config/fork-owned-paths.json`.

Recommended overlay shape:

- `data/policy/referral-catalog.local.json`

That gives the repo:

- shared upstream catalog by default
- explicit fork-local extensions when a fork needs a private variant
- an obvious place to put tombstones or local overrides without mutating the upstream source

### Three-layer model

Model the catalog as three nested layers:

1. `program` or `family`
   - stable umbrella identity
   - canonical brand/site identifiers
   - default public terms or disclosure context
   - broad applicability notes
2. `offer` or `variant`
   - a specific referral deal within that family
   - benefit text, terms text, codes, locale/eligibility, effective dates
   - the unit most likely to be reused across multiple link shapes
3. `matcher` or `link-shape`
   - declarative URL and context predicates
   - maps a link shape to a specific offer variant
   - should remain data, not code

This gives the catalog enough expressive power to handle one program with multiple offers and multiple URL forms without turning into a pile of one-off scripts.

### Stable ids

Each layer should have stable ids so references stay readable and diffs stay small:

- `familyId`
- `offerId`
- `matcherId`

Those ids should be used for link references, tests, and provenance output.

## Recommended Merge and Lookup Behavior

### Lookup order

The runtime should resolve referral data in this order:

1. explicit manual fields on `links[].referral`
2. explicit catalog reference on the link, if present
3. catalog matcher resolution when the link does not point at a catalog entry directly
4. generated/public referral enrichment

The final runtime/referral object should still be the same contract that cards and validation already consume.

### Composition order

Field composition should be blank-fill-first, not replace-the-world:

- catalog defaults seed the referral record
- generated/public values fill blanks when they are stronger or more specific
- manual link fields win last, field by field

That preserves the current authoritative manual posture while still making the shared catalog useful.

### Provenance

`ReferralFieldProvenance` currently only knows about `manual` and `generated`. Phase 24 will probably need a third source such as `catalog`, or an equivalent source-path structure, so maintainers can tell whether a value came from the shared catalog, generated enrichment, or a manual override.

That provenance should stay in the resolved/generated surfaces, not in the raw authoring contract.

### Link-level reference

The cleanest explicit link reference is probably a nested referral reference object such as:

- `links[].referral.catalogRef`

That keeps the catalog pointer close to the runtime contract it influences and leaves the human-authored override fields in the same object.

The alternative is a separate top-level link field, but that makes the referral contract harder to reason about because the catalog reference and the disclosure text would be split apart.

## Matcher and Link-Shape Design

### Avoid brittle keyword scripts

The matcher layer should not become a hidden text-classifier. The user explicitly wants a higher-level alternative to ad hoc matcher scripts.

Use declarative predicates instead:

- host and subdomain
- exact path, path prefix, or path regex
- query param presence/value
- canonical source host
- known family id / offer id
- optional link-shape tags such as `signup`, `invite`, `shortener`, `path-code`, `query-code`

### Keep explainability first

Every matcher should be explainable in plain language. Store a short reason string or description so maintainers can see why a shape maps to a specific offer.

### Deterministic selection

Matcher selection should be deterministic:

- explicit catalog reference beats inferred matching
- exact offer matcher beats family fallback
- family fallback beats generic public referral logic
- if no matcher is strong enough, do not guess

### Shape coverage

The model should support multiple shapes for the same program and offer, including:

- direct canonical signup pages
- path-code invite links
- query-param referral links
- shortener-backed redirect links
- custom-domain referral wrappers that resolve to a canonical first-party page

That is what keeps the catalog from collapsing back into brand-specific special cases.

## Club Orange Migration Scope

Club Orange is the obvious migration canary because the repo already has:

- a special public referral target in `scripts/enrichment/referral-targets.ts`
- a public augmentation special case in `scripts/enrichment/public-augmentation.ts`
- active live test/data coverage in `data/links.json`, `data/generated/rich-metadata.json`, and referral-related tests

Phase 24 should convert that special-case into the first catalog-backed family, not leave it as a forever exception.

Recommended Club Orange shape:

- one program/family entry for Club Orange
- one signup offer variant for the current referral deal
- matcher(s) for the existing `signup.cluborange.org/co/<code>` and canonical `www.cluborange.org/signup?referral=<code>` shapes
- local `links[].referral` should still override catalog defaults when the link author wants different text

The migration should preserve current behavior while proving the catalog can represent a real multi-shape referral program.

## Sibling Skill Design

### Location

Add a sibling repo-local skill at:

- `skills/referral-management/SKILL.md`

If the skill needs examples, interview trees, or reusable templates, add small reference files under:

- `skills/referral-management/references/`

### Why a separate skill

The existing extractor skill is public-first enrichment and auth escalation work. The referral-catalog problem is different:

- it is maintainer interview + CRUD + catalog hygiene
- it is often data-driven, not extraction-driven
- it needs shared-catalog vs fork-overlay judgment
- it should prompt for upstream PRs when the change is generally useful

### What the skill should interview

The skill should ask, in order:

1. Is this a new program/family, a new offer variant, or a new matcher/link-shape?
2. What is the canonical public program identity?
3. What benefit text is safe to share, and which fields are manual-only?
4. What URL shapes should match this offer?
5. Are there multiple variants by region, code, time window, or campaign?
6. Does the link need a local override on top of shared catalog data?
7. Should this stay fork-local, or does it belong in an upstream PR?

### Skill output

The skill should be able to produce:

- catalog CRUD edits
- `data/links.json` reference/override edits
- focused tests
- docs updates
- a prompt to open a clean upstream PR when the item is generic and valuable to other forks

### Skill docs it should lean on

The skill should reference:

- `docs/data-model.md`
- `docs/customization-catalog.md`
- `docs/openclaw-update-crud.md`
- `docs/ai-guided-customization.md`
- `docs/downstream-open-links-sites.md`

It should also explicitly say that referral catalog management is not extractor-authoring work.

## Risks and Migration Concerns

### 1. Provenance widening

Adding catalog as a source means the current manual/generated provenance model is too narrow unless it is widened intentionally. That affects `src/lib/content/referral-fields.ts`, the generated manifest, and the report output.

### 2. Downstream sync surface

If the canonical catalog lives outside paths downstream already copies, `open-links-sites` will need a sync/update tweak so it sees the new file. Keeping the catalog under `data/policy/` minimizes that risk.

### 3. Overlay bookkeeping

If a fork-local overlay file is added, it must be treated as fork-owned and excluded from upstream PR diffs. That likely means updating `config/fork-owned-paths.json` and keeping the skill fork-aware about PR hygiene.

### 4. Club Orange regression risk

Club Orange is already wired through the public referral path, so the migration must preserve current outputs and tests while the special-case code is removed or reduced.

### 5. Special-case creep

The matcher layer should not become a new place to hide brand-specific parsing logic. If the catalog cannot express a shape, the answer should be to improve the matcher model, not to add another ad hoc branch.

## Verification Strategy

Phase 24 should validate both the catalog model and the runtime lookup path:

- targeted unit tests for catalog resolution, overlay merging, and manual/catalog/generated precedence
- targeted tests around Club Orange migration and any fallback behavior
- `bun run validate:data`
- `bun run enrich:rich:strict`
- `bun run build`

If the catalog file or shared contract changes, the docs should also mention the downstream impact explicitly so `open-links-sites` maintainers know what to review on the next pin bump.

## Research Conclusion

The lowest-risk Phase 24 plan is:

1. add a shared referral catalog under a downstream-friendly policy path with a schema and optional fork-local overlay
2. resolve referral data through declarative program/family, offer, and matcher layers while preserving manual link overrides and explicit catalog references
3. ship a sibling referral-management skill that interviews maintainers, edits catalog/link refs, and prompts for clean upstream PRs when the catalog addition is generally useful
4. migrate Club Orange onto the catalog path as the proving case, then remove the remaining special-case logic once parity is covered by tests

## Sources

- `schema/links.schema.json`
- `data/links.json`
- `data/generated/rich-metadata.json`
- `src/lib/content/referral-fields.ts`
- `src/lib/content/load-content.ts`
- `scripts/enrichment/referral-targets.ts`
- `scripts/enrichment/public-augmentation.ts`
- `scripts/enrich-rich-links.ts`
- `scripts/enrichment/generated-metadata.ts`
- `scripts/enrichment/report.ts`
- `scripts/validate-data.ts`
- `docs/data-model.md`
- `docs/customization-catalog.md`
- `docs/openclaw-update-crud.md`
- `docs/ai-guided-customization.md`
- `docs/studio-self-serve.md`
- `docs/create-new-rich-content-extractor.md`
- `docs/authenticated-rich-extractors.md`
- `docs/downstream-open-links-sites.md`
- `README.md`
- `config/fork-owned-paths.json`
- `skills/create-new-rich-content-extractor/SKILL.md`

---
*Phase: 24-referral-catalog-skill-management*
*Research gathered: 2026-03-31*
