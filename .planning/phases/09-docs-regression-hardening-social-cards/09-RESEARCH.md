# Phase 9: Docs + Regression Hardening for Social Cards - Research

**Researched:** 2026-03-10
**Domain:** maintainer-facing docs architecture, regression coverage consolidation, and verification guidance for the current social-card/runtime surface
**Confidence:** HIGH

## User Constraints

### Locked Decisions
- Phase 9 should update all relevant docs, not just one canonical file.
- Follower-history and card-share work should be documented as a clear subsection within the broader social-card story.
- The docs set should serve both:
  - maintainer-facing usage docs
  - system-behavior / deeper-reference docs
- Prefer canonical deep-dive docs with lighter cross-links elsewhere instead of repeating the same full explanations.
- Examples should cover all relevant milestone states:
  - profile cards with counts
  - `profileDescription` overrides
  - analytics/share action rows
  - no-history / fallback cards
- Raw public artifact examples are acceptable, including `history/followers/index.json` and a representative CSV.
- Current seeded links/platforms are acceptable examples.
- Docs should lead with minimal starter examples before richer examples.
- Manual verification docs should cover all major user-visible states, including:
  - desktop/mobile layout
  - profile-level share
  - card-level share
  - analytics page controls
  - card modal behavior
  - no-history cards
  - public artifact checks
- Manual docs should include both a short checklist and a narrative verification guide.
- Docs should explicitly mention when automated tests already cover a behavior.
- Treat documentation drift as a real regression class.
- Regression priorities are roughly equal across the major states; do not artificially over-prioritize one area.

### Claude's Discretion
- Exact doc ownership split across `docs/data-model.md`, `docs/customization-catalog.md`, `README.md`, and any new verification-specific doc.
- Exact placement of the analytics/share subsection within the broader social-card narrative.
- Whether the regression-hardening work lands in existing test files only or also introduces a new focused documentation/verification test helper.

### Deferred Ideas (Out of Scope)
- New runtime features beyond docs/regression hardening.
- Broader site navigation or layout redesigns.
- New platform-metadata capture work beyond documenting current behavior.

## Summary

Phase 9 should be implemented as a **documentation-and-proof consolidation pass**, not a broad UI rewrite. The current codebase already has the behavior; the gap is that the maintainer-facing documentation and regression story have not yet caught up to:

- Phase 08.1 `profileDescription`
- Phase 10 rich-card description-image-row policy
- Phase 11 follower-history analytics
- Phase 12 card-level share actions

Primary recommendation:

1. Make `docs/data-model.md` the canonical deep dive for data and runtime behavior.
2. Use `docs/customization-catalog.md` as the concise operational knob index with examples and cross-links.
3. Add one dedicated verification-focused doc (or strongly expanded verification section in an existing doc) that combines:
   - short checklist
   - narrative walkthrough
   - references to automated tests
   - public artifact checks
4. Expand the current rendering regression coverage around generic states, not just seeded-link-specific examples, while still using seeded links as readable examples in the docs.

## Standard Stack

### Core

| Tool/Surface | Purpose | Why It Fits |
|--------------|---------|-------------|
| Existing maintainer docs under `docs/` | Canonical documentation surface | The repo already has clear separation between deep-dive docs and operational catalogs. |
| Existing card/rendering tests under `src/components/cards/` and `src/lib/ui/` | Regression-hardening surface | Current behavior is already mostly locked by focused tests; Phase 9 should consolidate and broaden those, not invent a new harness. |
| Existing verification reports under `.planning/phases/*-VERIFICATION.md` | Source material for maintainers’ manual verification guidance | They already encode the milestone’s proven states and can be distilled into maintainer-facing checklists. |

### Supporting

| Tool/Surface | Purpose | When to Use |
|--------------|---------|-------------|
| `README.md` | Lightweight entrypoint and cross-links | Use for brief discoverability and routing to the deeper docs, not for duplicating the full deep dive. |
| `docs/customization-catalog.md` | Fast operational lookup table | Use for quick “where does this knob live?” guidance and copy-paste examples. |
| `public/history/followers/index.json` and CSVs | Raw artifact examples | Use for showing the maintainer-facing history surface directly. |
| Existing tests such as `social-profile-card-rendering.test.tsx`, `rich-card-description-sourcing.test.ts`, `non-payment-card-accessibility.test.tsx` | Behavioral evidence references in docs | Use when docs should explicitly say which automated test already covers a state. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Canonical deep dives + cross-links | Repeat full explanations across every doc | Easier browsing in one file, but higher drift risk and more maintenance overhead. |
| Expand current test files with generic-state coverage | Create a separate massive milestone regression file | Centralized milestone file may feel neat, but existing focused files already map well to behavior seams. |
| Dedicated verification doc | Fold everything into README or data-model doc | Fewer files, but harder to keep the verification story discoverable and maintainable. |

## Architecture Patterns

### Pattern 1: Canonical Behavior Docs, Catalog Docs for Lookup

Recommended split:

- `docs/data-model.md`
  - canonical explanation of fields and behavior
  - deep-dive examples
  - runtime semantics
- `docs/customization-catalog.md`
  - quick knobs index
  - short examples
  - links back to deep dives
- `README.md`
  - route maintainers into the right deep-dive docs

This matches the user’s “canonical deep dives with cross-links” preference and minimizes drift.

### Pattern 2: Verification Doc Should Blend Manual and Automated Evidence

Phase 9 should not describe manual checks in isolation. The docs should say:

- what a maintainer should manually inspect
- which automated test already covers that state
- what public artifact to inspect when relevant

This is the cleanest way to satisfy `QUAL-06` without duplicating the entire verification burden onto human-only steps.

### Pattern 3: Generic-State Regression Coverage over Seeded-Link-Only Coverage

Docs can use seeded links because they are understandable and concrete. Tests, however, should increasingly verify generic state classes:

- supported profile with `profileDescription`
- supported profile without `profileDescription`
- rich profile with distinct description image row on/off
- history-aware card with analytics/share actions
- non-history card with share-only
- non-profile fallback card

That keeps the regression story future-safe as seeded examples evolve.

### Pattern 4: Documentation Drift Is a Regression Surface

Treat docs/examples as if they were behavior contracts:

- if config names changed, docs must change
- if card action order changed, screenshots/examples/checklists must change
- if history artifact paths changed, docs must change

This means docs need verification steps just like code does.

## Current Code and Doc Seams

### Existing Docs Likely in Scope

- `docs/data-model.md`
  - already covers link metadata, rich-card config, and maintainer examples
  - needs updates for `profileDescription`, description-image-row policy, follower-history artifacts, and card share behavior
- `docs/customization-catalog.md`
  - already inventories site/config knobs
  - should gain succinct Phase 10/11/12 knobs and cross-links to the deep dive
- `README.md`
  - likely needs a lighter docs-index refresh to point at any expanded analytics/share/history docs

### Existing Test Seams Likely in Scope

- `src/components/cards/social-profile-card-rendering.test.tsx`
  - best place for rendering-state coverage across profile/fallback cards
- `src/lib/ui/rich-card-description-sourcing.test.ts`
  - best place for description precedence and row policy behavior
- `src/components/cards/non-payment-card-accessibility.test.tsx`
  - best place for analytics/share action-row semantics
- `src/lib/share/share-link.test.ts`
  - best place for share-payload behavior and copy-safe expectations

### Existing Verification Artifacts to Distill

- `.planning/phases/08.1-custom-profile-descriptions/08.1-VERIFICATION.md`
- `.planning/phases/10-configurable-rich-card-description-image-row/10-VERIFICATION.md`
- `.planning/phases/11-historical-follower-tracking-growth-charts/11-VERIFICATION.md`
- `.planning/phases/12-add-share-button-in-each-card-next-to-analytics/12-VERIFICATION.md`

These already encode the proven truths and should be mined into Phase 9’s maintainer-facing docs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| New parallel verification framework | Another bespoke manual-check system | Existing docs + existing verification reports + focused tests | Keeps the repo’s verification story consistent. |
| Seeded-link-only regression net | Tests that only encode current personal examples | Generic state coverage layered onto current focused test files | More durable as the dataset evolves. |
| Full duplicate docs across files | Rewriting the same explanations in README, data model, and catalog | Canonical deep dives with cross-links | Minimizes doc drift. |
| Screenshot-heavy docs everywhere | Large static visual docs burden | Text-first examples plus targeted references to current behavior | Easier to maintain and less brittle. |

## Common Pitfalls

### Pitfall 1: Docs only mention earlier milestone features
**What goes wrong:** maintainers understand `profileDescription`, but not the later analytics/share/history additions.
**How to avoid:** treat Phase 10, 11, and 12 as part of the same social-card story and document them as named subsections.

### Pitfall 2: Verification docs become purely narrative
**What goes wrong:** useful prose exists, but maintainers still do not know exactly what to click or which automated test already covers a state.
**How to avoid:** pair narrative guidance with a concise checklist and explicit automated-test references.

### Pitfall 3: Examples are too rich too early
**What goes wrong:** maintainers have to understand the whole advanced model before using the feature.
**How to avoid:** start with minimal examples, then progressively layer richer examples.

### Pitfall 4: Regression coverage remains tied to the personal seed dataset
**What goes wrong:** tests pass for current examples but fail to generalize as links/config evolve.
**How to avoid:** strengthen generic state coverage even while docs use the seeded dataset as examples.

## Code Examples

### Recommended doc split

```text
README.md
  -> quick pointers only

docs/data-model.md
  -> canonical behavior and examples

docs/customization-catalog.md
  -> quick config lookup and copy-paste snippets

docs/verification-guide.md (or an expanded equivalent)
  -> checklist + narrative + automated-test references + public artifact checks
```

### Recommended verification table pattern

```md
| State | Manual Check | Automated Coverage |
|-------|--------------|-------------------|
| Profile description override | Inspect X/LinkedIn seeded cards | `rich-card-description-sourcing.test.ts` |
| Analytics/share action row | Verify analytics then share order on card | `non-payment-card-accessibility.test.tsx` |
| Public history artifacts | Open `history/followers/index.json` and one CSV | `validate-data.ts` + `follower-history.test.ts` |
```

## Open Questions

1. **Should Phase 9 introduce a new verification doc file or expand an existing doc?**
   - Recommendation: use a dedicated doc if the checklist/narrative would overwhelm `docs/data-model.md`; otherwise keep one strong verification section and cross-link heavily.

2. **How much README should change?**
   - Recommendation: keep it light. Add routing to the updated deep dives and verification docs, but do not duplicate the full details there.

3. **How far should regression coverage expand in this phase?**
   - Recommendation: enough to encode the generic state classes listed above, without turning Phase 9 into a full feature-addition phase.

## Sources

### Primary (HIGH confidence)
- [docs/data-model.md](/Users/peterryszkiewicz/.codex/worktrees/1eff/open-links/docs/data-model.md)
- [docs/customization-catalog.md](/Users/peterryszkiewicz/.codex/worktrees/1eff/open-links/docs/customization-catalog.md)
- [src/components/cards/social-profile-card-rendering.test.tsx](/Users/peterryszkiewicz/.codex/worktrees/1eff/open-links/src/components/cards/social-profile-card-rendering.test.tsx)
- [src/components/cards/non-payment-card-accessibility.test.tsx](/Users/peterryszkiewicz/.codex/worktrees/1eff/open-links/src/components/cards/non-payment-card-accessibility.test.tsx)
- [src/lib/share/share-link.test.ts](/Users/peterryszkiewicz/.codex/worktrees/1eff/open-links/src/lib/share/share-link.test.ts)
- [.planning/phases/08.1-custom-profile-descriptions/08.1-VERIFICATION.md](/Users/peterryszkiewicz/.codex/worktrees/1eff/open-links/.planning/phases/08.1-custom-profile-descriptions/08.1-VERIFICATION.md)
- [.planning/phases/10-configurable-rich-card-description-image-row/10-VERIFICATION.md](/Users/peterryszkiewicz/.codex/worktrees/1eff/open-links/.planning/phases/10-configurable-rich-card-description-image-row/10-VERIFICATION.md)
- [.planning/phases/11-historical-follower-tracking-growth-charts/11-VERIFICATION.md](/Users/peterryszkiewicz/.codex/worktrees/1eff/open-links/.planning/phases/11-historical-follower-tracking-growth-charts/11-VERIFICATION.md)
- [.planning/phases/12-add-share-button-in-each-card-next-to-analytics/12-VERIFICATION.md](/Users/peterryszkiewicz/.codex/worktrees/1eff/open-links/.planning/phases/12-add-share-button-in-each-card-next-to-analytics/12-VERIFICATION.md)
- [docs/writing guide: Diátaxis framework](https://diataxis.fr/)

### Secondary (MEDIUM confidence)
- Current repo planning/context artifacts for Phases 08.1, 10, 11, and 12

## Metadata

**Research scope:** doc ownership, example strategy, verification documentation, and generic-state regression coverage

**Confidence breakdown:**
- Existing repo seams and docs layout: HIGH
- Verification integration path: HIGH
- Exact final doc file split: MEDIUM

**Research date:** 2026-03-10
**Valid until:** 2026-04-10

---

*Phase: 09-docs-regression-hardening-social-cards*
*Research completed: 2026-03-10*
*Ready for planning: yes*
