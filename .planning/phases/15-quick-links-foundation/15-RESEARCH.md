# Phase 15 Research: Quick Links Foundation

**Researched:** 2026-03-27  
**Scope:** Derivation rules and foundation behavior for profile-header Quick Links

## Executive Summary

Phase 15 should derive Quick Links from the existing top-level `links[]` data, not from `profileLinks` or a new parallel registry. The codebase already has the right primitives to classify links as known-site / contact / generic, and the supported social/profile platforms are already modeled in the social-profile helpers. The main planning risk is avoiding a second source of truth while still giving the later UI phase a stable, ordered, deduplicated quick-link list to render.

## What to Reuse

### Existing link classification

- `src/lib/links/link-kind.ts` already classifies a link as `known-site`, `contact`, or `generic`.
- `src/lib/icons/known-sites-data.ts` already resolves a known site from either `icon` or URL domain.
- `src/lib/content/social-profile-fields.ts` already defines the supported profile-style platforms:
  - `cluborange`
  - `facebook`
  - `github`
  - `instagram`
  - `linkedin`
  - `medium`
  - `primal`
  - `rumble`
  - `substack`
  - `x`
  - `youtube`

### Existing rendering and model seams

- `src/components/profile/ProfileHeader.tsx` is the current top-level header/home for action-row content, but Phase 15 should stay on the derivation side and not bake layout into that component.
- `src/lib/ui/composition.ts` shows a useful pattern: keep the “what gets shown” logic in a pure resolver, then let the component render the result.
- `src/lib/ui/social-profile-metadata.ts` already uses `resolveSupportedSocialProfile` and `resolveLinkProfileSemantics` to determine whether a link should be treated as profile-like or not.

### Existing data shapes

- `data/links.json` already has the fields needed for deterministic derivation:
  - `enabled`
  - `icon`
  - `url`
  - `order`
  - `type`
  - `metadata`
  - `enrichment`
  - `custom`
- `data/profile.json` contains `profileLinks`, but nothing in the rendering path currently consumes it, so it would create a separate authoring surface if Quick Links were derived from it.

## Integration Points

### Likely helper seam

The phase wants a new pure resolver that:

- filters eligible links from `links[]`
- deduplicates to one winner per platform
- orders the results by the locked priority list, then content order
- returns an empty set cleanly when nothing qualifies

That helper should live beside the other small UI/content resolvers rather than inside `ProfileHeader`.

### Likely UI seam

The header should consume a derived Quick Links model, but Phase 15 should not decide the final row density or wrapping. That belongs to Phase 16. The foundation phase only needs to supply the ordered list and an empty-state signal.

## Schema / Validation Implications

### Marker placement

The canonical quick-link marker should not become a new top-level contract field unless absolutely necessary. The current schema already allows extension data in several places:

- `links[].custom`
- `links[].metadata.custom`
- `links[].enrichment.custom`
- root `custom`

For a same-platform tie-breaker marker, the least disruptive option is a namespaced extension under `links[].custom` or `links[].metadata.custom`, not a new top-level field and not `profileLinks`.

### What to avoid

- Do not add a second quick-link registry under `profile.json`.
- Do not expand the known-site registry to mean “eligible for Quick Links.”
- Do not tie Quick Links to enrichment success; they should be derivable from the saved link data alone.

## Testing Seams

### Best unit-test target

The most valuable tests are pure resolver tests for:

- eligibility filtering
- platform deduplication
- deterministic ordering
- canonical tie-breaking
- empty result behavior

### Existing adjacent tests worth mirroring

- `src/lib/content/social-profile-fields.test.ts` already exercises the supported profile platform set and conservative non-profile behavior.
- `src/lib/ui/rich-card-policy.ts` and related tests show how the repo prefers helper-level tests for data classification before UI coverage.

### What the tests should prove

- X/YouTube/Instagram/LinkedIn/GitHub/Facebook/Medium/Substack/Primal/Club Orange are considered eligible when they are supported profile-style destinations.
- A platform can only contribute one winner.
- The chosen winner is stable when content order changes within the same priority bucket.
- A canonical marker breaks ties only within a platform.
- No eligible links means no Quick Links section data at all.

## Pitfalls Specific to This Phase

### 1. `profileLinks` drift

`profileLinks` already exists in `data/profile.json`, but it is not part of the rendering path. Using it for Quick Links would create a duplicate maintainer workflow and diverge from the main card list in `links.json`.

### 2. Over-broad eligibility

`src/lib/icons/known-sites-data.ts` contains many brands that are valid icons but not appropriate Quick Links for this phase. The phase boundary should stay limited to OpenLinks-supported social/profile-style destinations.

### 3. Platform ambiguity

Some platforms have multiple URL shapes or multiple links in the dataset. The phase needs a clear winner-per-platform rule so the later UI work gets one stable entry per platform.

### 4. Configuration creep

Per-link hide/show, full ordering override, and whole-bar disable are all useful, but they are broader than the Phase 15 foundation. Keep them deferred so the phase stays derivation-focused.

### 5. Render/layout leakage

The UI phase needs to decide how many icons fit. Phase 15 should avoid encoding visual limits into the resolver.

## Recommended Research Conclusion

The lowest-risk plan for Phase 15 is:

1. Derive Quick Links from `links[]`.
2. Limit eligibility to supported profile-style platforms only.
3. Order by the locked platform priority, then content order.
4. Use one winner per platform.
5. Put any canonical marker in a namespaced extension field.
6. Return a full ordered set and let Phase 16 handle the visual fit.

## Sources

- `src/lib/content/social-profile-fields.ts`
- `src/lib/content/social-profile-fields.test.ts`
- `src/lib/icons/known-sites-data.ts`
- `src/lib/links/link-kind.ts`
- `src/lib/ui/composition.ts`
- `src/lib/ui/social-profile-metadata.ts`
- `src/components/profile/ProfileHeader.tsx`
- `schema/links.schema.json`
- `scripts/validation/rules.ts`
- `data/profile.json`
- `data/links.json`

---
*Phase: 15-quick-links-foundation*
*Research gathered: 2026-03-27*
