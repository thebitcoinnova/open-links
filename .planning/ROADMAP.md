# Milestone v1.3: Referral Links + Offer Transparency

**Status:** ✅ COMPLETE
**Phases:** 18-21
**Total Plans:** 11

## Overview

v1.3 turns referral links into a first-class OpenLinks concept. The milestone adds a dedicated referral disclosure contract, keeps manual authoring flexible through the normal AI CRUD/manual paths, generalizes public enrichment so common referral landings can capture promo metadata and obvious terms without bespoke extractors, and presents referral transparency directly in cards without reopening the static-build architecture.

## Phases

### Phase 18: Referral Contract + Link Plumbing

**Goal:** Add a dedicated `links[].referral` data contract and merge/load-validation plumbing while keeping referral support additive to existing `simple` and `rich` links.
**Depends on:** Phase 17
**Plans:** 3 plans

Plans:
- [x] 18-01: Define the referral schema, TypeScript types, and load-content surfaces with manual-first semantics and a `custom` escape hatch.
- [x] 18-02: Add generated referral augmentation merge plumbing so build-time findings can enrich links without overwriting explicit manual disclosures.
- [x] 18-03: Add validation rules, example data, and regression coverage for disclosure fields, `profileSemantics: "non_profile"`, and downstream-safe defaults.

**Details:**
- Do not introduce a fourth link type; referral should remain additive to the current URL-based link model.
- Manual disclosure fields must be authoritative over extracted data because referral terms can be incomplete, stale, or jurisdiction-specific.
- `open-links-sites` mirrors the upstream three-file contract, so the schema addition must stay explicit, documented, and backward compatible.

**Success Criteria:**
- `links[].referral` exists as a first-class validated contract with stable common fields plus `custom`.
- Runtime content loading can merge manual and generated referral data without disturbing existing non-referral links.
- Referral links on supported social-family domains can stay in generic/referral presentation mode instead of accidentally becoming profile cards.
- Focused schema, load-content, and validation coverage protects the new contract and preserves current link behavior.

### Phase 19: Public Referral Enrichment + Offer Capture

**Goal:** Generalize public enrichment so common referral destinations can resolve canonical landing pages and capture promo metadata plus obvious offer terms without requiring a bespoke extractor by default.
**Depends on:** Phase 18
**Plans:** 3 plans

Plans:
- [x] 19-01: Generalize public augmentation so common referral URLs resolve to canonical landing pages and reuse the existing fetch/metadata pipeline.
- [x] 19-02: Extract obvious referral terms and disclosure hints into generated referral data with explicit provenance and partial-status reporting.
- [x] 19-03: Preserve and generalize the existing Club Orange referral flow as a regression case instead of keeping it as an isolated special-case path.

**Details:**
- Stay public-first: follow canonical landing pages and ordinary metadata before reaching for authenticated extractors.
- Extracted offer terms are assistive, not authoritative, and must never silently replace manual disclosures.
- Reporting should make it obvious whether referral disclosures came from manual fields, public extraction, mixed sources, or no reliable signal.

**Success Criteria:**
- Common public referral URLs can resolve canonical metadata without a new program-specific extractor.
- When public terms are clearly discoverable, generated referral data captures them along with provenance and partial/inferred status.
- Existing one-off Club Orange referral behavior remains covered as a generalized regression case.
- Enrichment reports and tests make the limits of extracted referral transparency explicit.

### Phase 20: Referral Card Presentation + Transparency UX

**Goal:** Present referral links as visibly disclosed, benefit-aware cards while reusing the existing rich-card media and icon systems.
**Depends on:** Phase 19
**Plans:** 3 plans

Plans:
- [x] 20-01: Add referral-aware card view models and visible disclosure treatment across simple and rich non-payment cards.
- [x] 20-02: Render visitor/owner benefits, terms summary or terms-link context, and source cues while reusing the existing rich image and known-site icon pipelines.
- [x] 20-03: Add focused accessibility and regression coverage for referral disclosure copy, rich imagery, and non-referral fallback behavior.

**Details:**
- Transparency should be visible in the UI, not only encoded in JSON or hidden in generic descriptions.
- Rich referral cards should continue to benefit from promo imagery, source labels, and known-site icons without a separate referral-media subsystem.
- Non-referral links and current supported social profile cards must keep their existing behavior.

**Success Criteria:**
- Referral links render with visible disclosure treatment that distinguishes them from ordinary cards.
- Visitors can read both sides of the offer when the maintainer provided the fields.
- Rich referral cards can show promo images and brand identity through the existing metadata/icon paths.
- Focused UI and accessibility tests prove referral presentation does not regress non-referral card behavior.

### Phase 21: Maintainer CRUD Guidance + Docs + Verification

**Goal:** Keep referral authoring easy through the recommended AI CRUD/manual paths and document the new contract, limits, and downstream impact accurately.
**Depends on:** Phase 20
**Plans:** 2 plans

Plans:
- [x] 21-01: Update the data-model, OpenClaw CRUD, and customization docs so maintainers can author referral links through the recommended repo-native workflows without needing a bespoke extractor.
- [x] 21-02: Update README, verification guidance, and downstream compatibility notes for the new referral contract, enrichment limits, and examples.

**Details:**
- AI CRUD remains the primary maintainer flow; Studio can rely on Advanced JSON fallback until first-class referral controls become necessary.
- README updates are mandatory because the feature changes the supported authoring contract and discovery story.
- Downstream `open-links-sites` impact must be called out explicitly because the shared schema surface is changing.

**Success Criteria:**
- Maintainers can discover and use the referral schema through the recommended CRUD/docs path without hand-reverse-engineering JSON.
- README, data-model docs, and CRUD guidance all explain manual-vs-extracted precedence and extractor limits consistently.
- Verification docs include referral-focused checks plus any relevant example or regression references.
- The roadmap closes with explicit downstream compatibility notes instead of assuming the schema change is renderer-only.

## Milestone Summary

**Key Accomplishments Planned:**

- Introduce a first-class referral disclosure contract without creating a new link type.
- Generalize public referral enrichment so common offer links can capture canonical landing metadata and obvious terms without bespoke extractors by default.
- Render referral transparency directly in cards while reusing the current rich-metadata and icon systems.
- Update maintainer docs and README guidance so referral support is discoverable through the repo's preferred AI CRUD and manual fallback paths.

**Key Decisions:**

- Referral support stays additive to `simple` and `rich` links rather than becoming a fourth card type.
- Manual disclosures remain authoritative; extracted terms are assistive hints with explicit provenance.
- The milestone should generalize the existing Club Orange referral handling rather than layering more one-off referral patches.
- Studio-specific guided controls are deferred unless the AI CRUD plus Advanced JSON path proves insufficient during implementation.

**Issues To Watch:**

- `links[].referral` is a compatibility-sensitive schema change for `open-links-sites`.
- Existing repo debt around `/` performance budgets, fallback social images, and analytics chunk size remains in flight during this milestone.
- Referral landing pages may expose incomplete or jurisdiction-specific copy, so extraction must surface uncertainty instead of overstating accuracy.

**Deferred / Not in v1.3:**

- First-class Studio referral forms and previews.
- Referral analytics, payout tracking, or runtime attribution.
- Automatic jurisdiction-specific disclosure compliance.
- Bespoke extractors for every referral ecosystem.

---

_For shipped milestone history, see .planning/MILESTONES.md_
