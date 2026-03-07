# Phase 8: Social Profile Card UI Refresh - Research

**Researched:** 2026-03-07
**Domain:** Social-profile card UI, existing card component seams, responsive styling, fallback behavior
**Confidence:** HIGH

## User Constraints (from 08-CONTEXT.md)

### Locked Decisions
- Rich cards need a mobile-first profile-style header with a circular avatar on the left and a text stack on the right.
- The UI should feel close to how the underlying platforms present profile identity, especially on mobile.
- Rich cards must keep description or content before source branding and link context.
- Simple cards keep the current leading slot, but it becomes a circular avatar when profile metadata exists.
- Simple cards may use a two-line header when handle and audience stats are present.
- Mobile should prefer wrapping over dropping handle, stats, or source context.
- Metrics should stay platform-native when possible, use compact formatting, and follow platform-native order.
- Metrics should usually read as inline text rather than chips or badges.
- Partial profile metadata should still use the profile-style layout.
- Links without profile metadata should only inherit subtle profile-card cues rather than fully mimicking social profile cards.
- If both a profile image and preview image exist, the avatar should lead the header while the preview image can still appear below in its round-rect media slot.
- The overall card list should feel unified for now.

### Claude's Discretion
- Exact platform-specific header copy and text hierarchy.
- Exact spacing, typography, and wrapping behavior needed to make the profile treatment feel intentional.
- Exact fallback styling details for non-profile cards.

### Deferred Ideas (Out of Scope)
- Configurable grid or toggleable card layouts.
- Stronger visual differentiation between social-profile cards and non-profile cards.
- Deeper platform-specific templates beyond flexible text-stack variations.

## Summary

Phase 8 should treat Phase 07's `socialProfile` data as a presentation layer input, not a new data problem. The repo already has the necessary metadata in `RichCardViewModel.socialProfile`, but the current UI still renders the older preview-card structure:

1. `RichLinkCard.tsx` only uses `title`, `description`, `imageUrl`, `handleDisplay`, and source branding.
2. `SimpleLinkCard.tsx` still resolves the handle directly and does not consume `socialProfile` at all.
3. `socialProfile` currently exposes ordered metrics and separate avatar/preview URLs, but it does not yet provide display-ready compact metric text or platform-aware presentation helpers.
4. `validate-data.ts` still requires a renderable preview image for rich cards, so the new avatar-first header must layer on top of the existing rich preview-media contract rather than replacing it.

Recommended delivery split:
1. **Rich-card profile header:** expand the rich-card view model and markup so rich cards can show avatar, handle, and inline metrics while preserving preview media and source context.
2. **Simple-card profile treatment:** refresh simple cards to use the same social-profile language in a denser form without sacrificing scanability.
3. **Responsive/fallback polish:** unify mobile wrapping, partial/no-profile fallbacks, and accessibility semantics across both card variants.

## Standard Stack

### Core

| Tool/Surface | Purpose | Why It Fits |
|--------------|---------|-------------|
| `solid-js` component props + JSX | Card structure changes in `RichLinkCard.tsx` and `SimpleLinkCard.tsx` | Existing rendering model already branches rich/simple cards at the route level. |
| Existing UI helpers under `src/lib/ui/` | Shared presentation data for handle, avatar, preview image, and metrics | Phase 07 already established `socialProfile` as the runtime metadata seam. |
| Plain CSS in `src/styles/base.css` and `src/styles/responsive.css` | Avatar shape, inline metric styling, header/body spacing, breakpoint rules | Current card system is CSS-driven with token-based sizing and no CSS-in-JS layer. |

### Supporting

| Tool/Surface | Purpose | When to Use |
|--------------|---------|-------------|
| `Intl.NumberFormat` compact notation | Display-ready large-number formatting | Needed for follower/subscriber counts without changing stored raw values. |
| Focused `node:test` helper coverage | Guard compact metric formatting and shared presentation helpers | Useful when adding richer display logic to `social-profile-metadata.ts` or a sibling helper. |
| Existing `quality:check` and build flow | Broad regression smoke after card markup/CSS changes | Useful in the polish plan once the visible UI changes are in place. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shared presentation helper layered on `socialProfile` | Hard-code formatting separately in each card component | Faster initially, but rich/simple cards drift quickly and native metric ordering/labels become inconsistent. |
| Avatar header plus preserved preview media | Replace preview media entirely with avatar when present | Conflicts with locked fallback behavior and with current validation that expects renderable rich preview media. |
| Unified visual language with subtle fallback cues | Separate social-card and non-social-card templates immediately | More control, but outside the locked Phase 08 scope and likely too much branching for this pass. |

## Architecture Patterns

### Pattern 1: Shared Social-Profile Presentation Layer

Keep one shared helper for display-ready social profile fields:
- handle display
- profile avatar URL
- preview media URL
- ordered metrics
- compact formatted metric copy

This avoids duplicating platform-native metric ordering and formatting between rich and simple cards.

### Pattern 2: Avatar Identity Chrome over Existing Preview Media

Treat the circular avatar as identity chrome in the header and preserve the round-rect preview image as content media below. This matches the locked Phase 08 design and avoids fighting the current rich-card preview validation contract.

### Pattern 3: Mobile-First Wrapping, Not Data Dropping

Current simple-card copy uses truncation and current rich-card mobile rules collapse to one column or float-inline media. Phase 08 should favor wrapping and stacked metadata on smaller screens instead of eliding handle or metric content.

### Pattern 4: Fallback by Visual Intensity, Not by Separate Template Family

Partial/no-profile cards should keep the same component family and only dial down identity chrome:
- no avatar -> omit avatar slot
- no metrics -> omit metric row
- no profile metadata -> keep subtle shared styling, not a completely separate social card system

## Current Code Seams

### Rendering Flow

- `src/routes/index.tsx` selects `RichLinkCard` vs `SimpleLinkCard` via `resolveRichCardVariant(...)`.
- Rich cards already receive a view model from `buildRichCardViewModel(...)`.
- Simple cards still receive the raw `OpenLink` and do their own handle resolution inline.

### Rich Card Constraints

- `src/components/cards/RichLinkCard.tsx` currently renders:
  - preview media first
  - title
  - description
  - source icon + handle/source text
- `src/lib/ui/rich-card-policy.ts` already resolves `socialProfile`, but only `handleDisplay` and `previewImageUrl` are visibly used today.

### Simple Card Constraints

- `src/components/cards/SimpleLinkCard.tsx` currently assumes the left slot is `LinkSiteIcon`, which is square brand-logo chrome rather than a circular profile avatar.
- Moving avatars into that left slot means source-brand context needs a new place in the compact text block or supporting metadata row.

### Styling Constraints

- `src/styles/base.css` defines card shells and the current square `card-icon` visual system.
- `src/styles/responsive.css` currently drives rich-card mobile layout mostly through preview-media behavior.
- There is no existing social-profile-specific CSS namespace yet.

### Validation/Runtime Constraints

- `scripts/validate-data.ts` still errors when a rich card lacks a renderable preview image, so profile avatars cannot replace preview media entirely.
- `src/lib/content/load-content.ts` already localizes `image` and `profileImage` separately, which Phase 08 can safely rely on.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Platform-native count copy in JSX | Repeated `count + label` string concatenation in each component | Shared formatting helper layered on `socialProfile.metrics` | Keeps ordering, compaction, and label style consistent. |
| Circular avatar behavior via brand icon hacks | Re-skinning `LinkSiteIcon` into an avatar component | Dedicated avatar rendering path using `profileImageUrl` | `LinkSiteIcon` is brand-logo oriented and square by design. |
| Mobile fallback by hiding fields | Conditional UI that drops handle/stats/source as widths shrink | Wrapping + stacked metadata rules in responsive CSS | Matches locked preference to keep information instead of dropping it. |

## Common Pitfalls

### Pitfall 1: Rich cards lose preview media when avatar exists
**What goes wrong:** The redesign treats avatar and preview as mutually exclusive, which breaks the desired header-plus-preview layout and may conflict with current validation assumptions.
**How to avoid:** Keep preview media as a separate body slot and let the header use `profileImageUrl` independently.

### Pitfall 2: Simple and rich cards format metrics differently
**What goes wrong:** Rich cards use one compact metric style while simple cards keep raw or inconsistent copy.
**How to avoid:** Put display-ready metric formatting in a shared helper before both card variants render it.

### Pitfall 3: Source branding disappears when the avatar takes the simple-card leading slot
**What goes wrong:** Simple cards become more profile-like but lose fast source identification.
**How to avoid:** Explicitly rehome source branding into a compact secondary line or inline metadata row.

### Pitfall 4: No-profile links look broken instead of intentionally quieter
**What goes wrong:** CSS assumes avatar/metrics are always present and leaves odd gaps when they are missing.
**How to avoid:** Design fallback spacing and conditional blocks as first-class states, not edge cases.

## Open Questions

1. **How much platform-specific text-stack variation is actually needed in Phase 08?**
   - Known: some flexibility is allowed.
   - Recommendation: implement one shared profile-header skeleton first, with small platform-aware copy tweaks only if needed.

2. **Where should simple-card source branding move once avatars occupy the leading slot?**
   - Known: source context must survive.
   - Recommendation: keep the source logo or label in the compact metadata line rather than inventing a new card region.

## Sources

### Primary (HIGH confidence)
- `.planning/phases/08-social-profile-card-ui-refresh/08-CONTEXT.md`
- `.planning/ROADMAP.md` (Phase 8 goal + success criteria)
- `src/components/cards/RichLinkCard.tsx`
- `src/components/cards/SimpleLinkCard.tsx`
- `src/lib/ui/rich-card-policy.ts`
- `src/lib/ui/social-profile-metadata.ts`
- `src/styles/base.css`
- `src/styles/responsive.css`
- `src/routes/index.tsx`
- `scripts/validate-data.ts`

### Secondary (MEDIUM confidence)
- `.planning/phases/07-social-profile-metadata-pipeline/*`
- `src/components/icons/LinkSiteIcon.tsx`

## Metadata

**Research scope:** card hierarchy, responsive behavior, avatar/media separation, and fallback constraints

**Confidence breakdown:**
- Current render/data seams: HIGH
- CSS and responsive integration path: HIGH
- Platform-parity guidance beyond current first-pass platforms: MEDIUM

**Research date:** 2026-03-07
**Valid until:** 2026-04-07

---

*Phase: 08-social-profile-card-ui-refresh*
*Research completed: 2026-03-07*
*Ready for planning: yes*
