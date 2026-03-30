# Phase 21 Research: Maintainer CRUD Guidance + Docs + Verification

**Researched:** 2026-03-30  
**Scope:** Maintainer-facing referral authoring docs, CRUD path hierarchy, verification guidance, and downstream compatibility notes

## Executive Summary

Phase 21 should consolidate referral documentation around one canonical contract/reference surface and then fan that guidance outward into the maintainer entry points that people actually use. The repo already has strong generic CRUD/documentation scaffolding:

- `docs/data-model.md` is the canonical contract/reference layer
- `docs/openclaw-update-crud.md` and `docs/ai-guided-customization.md` already define the preferred repo-native AI maintenance path
- `docs/studio-self-serve.md` already frames Studio as the browser-based CRUD path
- `README.md` and `docs/quickstart.md` already route maintainers into those flows
- `docs/social-card-verification.md` already serves as the shared manual/automated card verification guide
- `docs/downstream-open-links-sites.md` already explains downstream compatibility surfaces

The gap is not missing documentation infrastructure. The gap is that referral support is now real in the codebase, but the maintainer docs still read as if referral authoring is just another hidden JSON detail. The safest Phase 21 structure is:

1. add the canonical referral contract and maintainer workflow guidance where advanced maintainers already look
2. update top-level discoverability, verification messaging, and downstream breadcrumbs so maintainers do not need to reverse-engineer the feature

That maps cleanly to the roadmap’s two plans.

## Current Docs State

### `docs/data-model.md` is the right canonical home, but referral is missing

This doc already:

- defines the three-file contract
- explains recommended CRUD path hierarchy
- documents `links[]`, `metadata`, `enrichment`, and `profileSemantics`
- calls out downstream compatibility generally

Current gap:

- there is no explicit `links[].referral` contract section
- there are no referral examples
- there is no manual-vs-generated precedence explanation in the maintainer reference layer
- completeness/provenance and referral-specific warning behavior are not surfaced for authors

This is the highest-priority gap in the phase.

### OpenClaw/customization docs already establish the path hierarchy, but not referral specifics

`docs/openclaw-update-crud.md`, `docs/ai-guided-customization.md`, and `docs/customization-catalog.md` already tell maintainers:

- AI CRUD is the preferred repo-native path
- manual JSON is a fallback
- customization inventory exists in a canonical place

Current gaps:

- no referral-specific guidance for `links[].referral`
- no curated referral examples
- no explicit note that referral support should not require bespoke extractor work by default
- no note that Studio currently relies on Advanced JSON for referral editing
- no referral-specific inventory section in the customization catalog

### Studio docs need an honesty pass, not a new product promise

`docs/studio-self-serve.md` currently frames Studio correctly as the browser-based CRUD path when it fits, but it does not mention referral support at all.

Current gap:

- maintainers could reasonably assume first-class Studio referral controls exist because the docs do not say otherwise

The Phase 21 decision is clear: Studio should be documented as a valid browser path, but referral authoring there currently depends on Advanced JSON.

### README and quickstart still lack referral discoverability

`README.md` and `docs/quickstart.md` already emphasize:

- AI CRUD first
- Studio second
- manual fallback last

Current gap:

- there is no top-level note that referral links are a supported authoring surface now
- maintainers cannot easily tell which deeper docs to open for referral work
- the current entry points do not answer “how do I add a referral link?” quickly

This phase should not dump the whole contract into README or quickstart. It should add high-signal routing.

### Verification docs are card-focused, but not referral-aware yet

`docs/social-card-verification.md` already covers:

- shared card surfaces
- rich/simple behavior
- quick links, share, analytics, and SEO preview verification
- script-backed verification commands

Current gap:

- no referral-specific checklist items
- no warning interpretation guidance for referral authoring
- no explicit “extraction is assistive, not authoritative” language

This is the best home for the deeper verification story because referral card behavior is now part of the shared card surface.

### Downstream guidance is generic, not referral-specific

`docs/downstream-open-links-sites.md` already describes compatibility-sensitive surfaces well, but it predates the referral milestone.

Current gap:

- it does not explicitly call out `links[].referral` as an additive schema change to review on sync
- it does not distinguish UI-only referral changes from contract/schema changes

This phase should add lightweight concrete guidance rather than a big downstream-process redesign.

## Recommended Phase 21 Design

### 1. Keep one canonical referral contract doc

The user explicitly approved this. `docs/data-model.md` should become the canonical `links[].referral` reference and should include:

- the stable referral field set
- a small curated example set
- short precedence rule + deeper explanation
- brief generated-field explanation for maintainers
- cross-links to verification and downstream notes

This prevents the schema story from fragmenting across README, quickstart, and CRUD docs.

### 2. Use CRUD docs for path and workflow guidance, not full schema duplication

The OpenClaw/customization docs should:

- point maintainers to `docs/data-model.md` for canonical referral field meaning
- explain which workflow to use first
- be explicit about Studio’s current Advanced JSON status
- preserve manual JSON as the fallback path

These docs should teach “where and how to make the change,” not re-document every field in full.

### 3. Put verification guidance where maintainers already verify card behavior

Referral verification should live primarily in `docs/social-card-verification.md`, because it already owns shared card verification. The likely structure:

- quick checklist for “after adding a referral link”
- explicit scripts:
  - `bun run validate:data`
  - `bun run enrich:rich:strict`
  - `bun run build`
- explanation of likely warning classes
- reminder that extraction is assistive, not authoritative

README/quickstart can link to this deeper verification guide instead of duplicating it fully.

### 4. Use downstream breadcrumbs in multiple places

The user wants breadcrumbs. The best pattern is:

- `README.md`: brief referral discovery + downstream reminder link
- `docs/data-model.md`: explicit note when describing the referral contract
- `docs/downstream-open-links-sites.md`: referral-specific additive schema note + lightweight action guidance

This keeps downstream compatibility visible without making every doc downstream-centric.

## Best Code Seams For Each Phase 21 Plan

### 21-01 Canonical contract + CRUD guidance seam

Likely files:

- `docs/data-model.md`
- `docs/openclaw-update-crud.md`
- `docs/ai-guided-customization.md`
- `docs/customization-catalog.md`
- `docs/studio-self-serve.md`

This plan should establish:

- canonical referral contract documentation
- curated examples
- AI CRUD first / Studio Advanced JSON fallback / manual fallback hierarchy
- maintainer-facing referral workflow guidance

### 21-02 README + verification + downstream seam

Likely files:

- `README.md`
- `docs/quickstart.md`
- `docs/social-card-verification.md`
- `docs/downstream-open-links-sites.md`

This plan should establish:

- top-level discoverability
- script-backed verification checklist and limits messaging
- referral warning interpretation breadcrumbs
- explicit downstream compatibility guidance

## Phase-Specific Pitfalls

### 1. Duplicating the referral schema everywhere

If every doc explains the full field set differently, the maintainer story will drift quickly. One canonical contract doc is safer.

### 2. Overselling Studio

If Phase 21 implies first-class Studio referral controls exist, it will create friction immediately. The docs need to be honest about the current Advanced JSON path.

### 3. Burying verification behind generic prose

The user explicitly leaned toward script-backed checking. If the docs only say “make sure it works,” maintainers will not know what to run or how to interpret warnings.

### 4. Making downstream notes too vague

“This might affect downstream” is not enough. Maintainers need to know that `links[].referral` is additive but still review-worthy on sync.

### 5. Letting README turn into a schema document

README should route and summarize, not replace `docs/data-model.md`.

## Recommended Research Conclusion

The lowest-risk Phase 21 plan is:

1. update the canonical contract/reference and maintainer CRUD docs so referral authoring is explicit, small-example-driven, and path-hierarchical
2. update README/quickstart, the shared verification guide, and downstream notes so referral support is discoverable, verifiable, and clearly marked as an additive-but-review-worthy shared contract change

That closes the milestone’s maintainability loop without reopening Studio product work or referral extraction/runtime scope.

## Sources

- `README.md`
- `docs/data-model.md`
- `docs/openclaw-update-crud.md`
- `docs/ai-guided-customization.md`
- `docs/customization-catalog.md`
- `docs/studio-self-serve.md`
- `docs/social-card-verification.md`
- `docs/downstream-open-links-sites.md`
- `docs/quickstart.md`
- `.planning/phases/21-maintainer-crud-guidance-docs-verification/21-CONTEXT.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`

---
*Phase: 21-maintainer-crud-guidance-docs-verification*
*Research gathered: 2026-03-30*
