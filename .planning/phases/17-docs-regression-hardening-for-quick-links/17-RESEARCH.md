# Phase 17 Research: Docs + Regression Hardening for Quick Links

**Researched:** 2026-03-28  
**Scope:** Maintainer docs updates and light regression hardening for the shipped Quick Links feature

## Executive Summary

Phase 17 should do two things only: document the Quick Links behavior where maintainers already look for data and UI contract guidance, and lock in a small, high-signal regression surface around the newly shipped header strip. The docs already explain `profileLinks`, `links[]`, and generic card behavior, but they do not yet explain that Quick Links are derived automatically from existing top-level social/profile links, nor do they clarify that the feature does not introduce a second authoring surface.

The safest documentation targets are `docs/data-model.md`, `docs/customization-catalog.md`, and one lightweight discoverability note in `README.md` rather than a large Quickstart or Studio-doc expansion. On the regression side, the current tests already cover most of the intended contract, so Phase 17 should focus on tightening what is already there instead of adding broad snapshot or responsive-matrix coverage.

## Current Docs State

### `docs/data-model.md`

This is the best canonical place to explain Quick Links because:

- it already positions itself as the contract/reference layer
- it explains `data/profile.json`, `data/links.json`, and `data/site.json`
- it already warns maintainers that `profileLinks` exists as an optional profile field

Current gap:

- `profileLinks` is documented as a common optional field, but the document does not explain that Quick Links are actually derived from eligible top-level `links[]` entries
- this creates a risk that maintainers assume `profileLinks` drives the new header shortcuts

### `docs/customization-catalog.md`

This is the best “what knobs exist?” inventory surface. It already:

- enumerates `profileLinks[]`
- inventories `links[]`, `links[].metadata`, and `links[].enrichment`
- points to `docs/data-model.md` for behavior-level examples

Current gap:

- it does not say that Quick Links are behavior derived from existing `links[]` data
- it also does not call out that there is no dedicated Quick Links registry or per-link toggle surface yet

### `README.md`

This is the best lightweight discovery surface because:

- maintainers already use it for recommended CRUD posture and onboarding
- it is the first maintainer-facing document most users will read

Current gap:

- there is no mention of the Quick Links feature or the fact that it derives automatically from the top-level link set

### `docs/quickstart.md`

This is less attractive for the main Quick Links explanation because:

- it is already long
- it is focused on bootstrap and first-run workflow rather than feature semantics

Best use here would be only if a short discovery note in `README.md` turns out to feel too crowded. Otherwise `README.md` is the better lightweight note.

### Studio/self-serve docs

No Phase 16 work introduced a Studio control surface for Quick Links. Expanding Studio docs now would imply a browser-managed configuration path that does not exist yet, so the current context decision to skip Studio expansion is correct.

## Current Regression Surface

### Existing helper coverage

`src/lib/ui/profile-quick-links.test.ts` already covers:

- priority ordering
- remaining-platform content-order behavior
- canonical same-platform tie-breaking
- fallback ordering without canonical markers
- exclusion of non-profile/disabled/payment/unsupported links
- empty quick-link state

This already satisfies most of the “derivation” side of the desired regression scope.

### Existing visible-strip coverage

`src/components/profile/ProfileQuickLinks.test.tsx` already covers:

- icon-only rendering with no visible heading
- explicit outbound labels and titles
- hidden-empty behavior
- placement above the action bar
- action bar preservation when empty

### Existing header contract coverage

`src/components/profile/ProfileHeader.test.tsx` already covers:

- empty-state disappearance
- populated-state presence
- action-row preservation under populated Quick Links state

## What Still Needs Hardening

The current regression surface is already close to the requested “basic and light” target. The likely planning target is not “add lots more tests,” but rather:

1. verify the existing tests are called out clearly in docs/manual verification notes
2. add at most a small number of focused assertions if a clear hole is found during execution
3. avoid broadening into visual snapshots, CSS snapshots, or a full desktop/mobile matrix

## Best Places for the Downstream Note

The renderer-only/downstream note fits best in two places:

1. `docs/data-model.md`
   - because this is where maintainers are already being told about upstream/downstream contract surfaces
   - a Quick Links note can explicitly say “renderer behavior only; no `open-links-sites` data/schema change”

2. `README.md` or the short discovery note
   - because it can reinforce that this is automatic behavior derived from existing links rather than a new setup step

`docs/downstream-open-links-sites.md` already explains the compatibility surfaces well enough; Phase 17 likely only needs to reference that synopsis rather than expand it.

## Planning Recommendations

### Recommended doc split

**Plan 17-01 should likely touch:**

- `docs/data-model.md`
- `docs/customization-catalog.md`
- `README.md` (preferred) or `docs/quickstart.md` (fallback)

### Recommended regression/verification split

**Plan 17-02 should likely touch:**

- `docs/social-card-verification.md`
- possibly one or two existing test files only if a concrete gap is found

This keeps the phase aligned with “docs + regression hardening” instead of drifting into a new verification subsystem.

## Phase-Specific Pitfalls

### 1. Accidentally implying `profileLinks` powers Quick Links

Because `profileLinks` is already documented in `data-model.md` and `customization-catalog.md`, any Quick Links docs that are not explicit enough may reinforce the wrong mental model.

### 2. Accidentally implying configuration that does not exist

If the docs talk too generally about “customizing Quick Links,” maintainers may assume per-link toggles, separate ordering, or Studio controls already exist.

### 3. Over-expanding regression scope

The tests already cover the core contract. Phase 17 should avoid turning into a large matrix of visual snapshot or device-specific checks.

### 4. Missing downstream reassurance

Because this repo feeds `open-links-sites`, maintainers may reasonably wonder whether Quick Links changed a shared contract. The docs should answer that directly and briefly.

## Recommended Research Conclusion

The lowest-risk Phase 17 plan is:

1. Explain Quick Links in `docs/data-model.md` as automatic behavior derived from eligible top-level `links[]` entries.
2. Add a short note to `docs/customization-catalog.md` that there is no separate Quick Links registry or control surface yet.
3. Add a brief discoverability note in `README.md` rather than expanding Quickstart or Studio docs.
4. Update `docs/social-card-verification.md` to explicitly include the Quick Links strip in the manual/automated verification guide.
5. Keep regression changes light: only tighten an existing test if execution finds an obvious hole.

## Sources

- `docs/data-model.md`
- `docs/customization-catalog.md`
- `docs/social-card-verification.md`
- `docs/downstream-open-links-sites.md`
- `README.md`
- `docs/quickstart.md`
- `src/components/profile/ProfileQuickLinks.test.tsx`
- `src/components/profile/ProfileHeader.test.tsx`
- `src/lib/ui/profile-quick-links.test.ts`
- `.planning/phases/17-docs-regression-hardening-for-quick-links/17-CONTEXT.md`

---
*Phase: 17-docs-regression-hardening-for-quick-links*
*Research gathered: 2026-03-28*
