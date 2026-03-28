# Phase 16 Research: Profile Header Quick Links UI + Responsive Polish

**Researched:** 2026-03-28  
**Scope:** Visible Quick Links strip UI, responsive behavior, and accessibility polish for the profile header

## Executive Summary

Phase 16 should build a small, dedicated Quick Links strip component above the existing profile action bar and feed it from the Phase 15 `ResolvedProfileQuickLinksState` seam already passed into `ProfileHeader`. The current codebase already has the right data flow, but the existing icon/chip primitives are card-oriented and oversized for this header use. The most likely successful approach is a new compact icon-link treatment that borrows brand-palette logic from the icon system without reusing the full `.card-icon` box size or the action-bar button shell.

The strip should stay visually lighter than the existing share/copy/QR action bar, disappear entirely when empty, and use real link semantics with explicit accessible names and titles. The biggest risks are accidentally making it feel like a second action bar, letting icon-only UI degrade accessibility, and overbuilding overflow/configurability before the default multi-line version is proven.

## What to Reuse

### Existing data seam

- `src/lib/ui/profile-quick-links.ts` already provides:
  - `ResolvedProfileQuickLinksState`
  - `ResolvedProfileQuickLink`
  - ordered, deduped winners from Phase 15
- `src/routes/index.tsx` already derives `profileQuickLinks` from `content.links` and passes it to `ProfileHeader`.
- `src/components/profile/ProfileHeader.tsx` already exposes `quickLinks?: ResolvedProfileQuickLinksState` and a `data-has-quick-links` seam.

### Existing icon system

- `src/components/icons/LinkSiteIcon.tsx` already resolves known-site icons and brand-aware palettes.
- `src/lib/icons/brand-icon-options.ts` and the `site.ui.brandIcons` settings already encode color mode, contrast mode, and size mode.
- This means Phase 16 does not need to invent platform glyph lookup or brand-palette computation from scratch.

### Existing motion and interaction language

- `.bottom-action-bar-action` in `src/styles/base.css` already demonstrates the current hover/press/focus motion language:
  - subtle `translateY`
  - border/background transitions
  - focus ring via `box-shadow`
- That interaction feel can be echoed in a lighter form for Quick Links so the strip feels native to the app.

## What Not to Reuse Directly

### `.card-icon`

`src/styles/base.css` defines `.card-icon` with a large box size intended for cards and QR/payment/header-card contexts:

- `--card-icon-base-size: 5.15rem`
- `--card-icon-base-glyph-size: 2.08rem`

That is too large and card-like for a compact header shortcut strip. The phase should probably create a dedicated Quick Links icon size/treatment rather than drop `.card-icon` in unchanged.

### `.bottom-action-bar-action`

The action bar shell is intentionally button-like, bordered, and label-capable. Reusing it would make Quick Links feel like a second action bar, which conflicts with the locked design direction. Phase 16 should create a lighter outbound-link strip rather than dressing social links as app actions.

## Likely Files to Touch

### Primary UI files

- `src/components/profile/ProfileHeader.tsx`
  - render the visible strip above the existing action bar
  - keep the strip hidden when `quickLinks?.hasAny` is false
- likely new component:
  - `src/components/profile/ProfileQuickLinks.tsx` or similar
  - keeps the strip markup and interaction logic out of `ProfileHeader.tsx`
- likely new tests:
  - `src/components/profile/ProfileQuickLinks.test.tsx`
  - extend `src/components/profile/ProfileHeader.test.tsx`

### Styling files

- `src/styles/base.css`
  - strip layout, spacing, hover/focus states, overflow hint treatment
- `src/styles/responsive.css`
  - mobile wrapping/scroll behavior and desktop fit differences

### Optional icon integration helpers

- `src/components/icons/LinkSiteIcon.tsx`
  - only if Phase 16 needs a smaller variant or parameterized presentation
- or a new small wrapper component for header-specific icon rendering

## Accessibility and Semantics

### Link semantics

Quick Links are outbound destinations, so they should render as `<a>` elements, not buttons.

Needed behaviors:

- explicit `aria-label` per platform/destination
- explicit `title`
- likely `target="_blank"` and `rel="noreferrer"` or repo-standard external-link behavior
- no selected/current state

### Icon-only constraints

Because the user chose icon-only UI:

- the accessible name must carry the meaning
- focus visibility must be strong enough that icon-only elements are still legible in keyboard navigation
- the strip should not rely on color alone to distinguish states

## Responsive Constraints

### Mobile

Current mobile header behavior already:

- collapses the profile header to one column
- hides desktop action bar labels
- keeps the mobile action row icon-first

That means the Quick Links strip can align well with the existing mobile posture, but Phase 16 still has to manage two risks:

1. stacking too many visual rows above the fold
2. introducing overflow behavior that fights with natural multi-line wrapping

### Desktop

Desktop can fit more links naturally, but the strip still needs to remain visually subordinate to:

- profile title/headline/bio
- the existing share/copy/QR action row

The centered alignment choice will matter here: a centered strip needs careful width and gap tuning so it looks intentional rather than like a floating orphan row.

## Planning Recommendations

### Recommended plan shape

1. Create a dedicated Quick Links strip component and render it in `ProfileHeader`.
2. Implement the base visual treatment and desktop/mobile default multi-line behavior.
3. Add the overflow hint treatment and tighten accessibility/focus/empty-state behavior with tests.

### Recommended visual treatment

- smaller-than-card icon targets
- icon-only links with subtle brand accents, mostly monochrome glyph treatment
- slight motion on hover/focus
- visually lighter than the share/copy/QR row
- no visible heading

## Phase-Specific Pitfalls

### 1. Second-action-bar drift

If the strip reuses too much of the existing action-bar chrome, it will feel like two competing action rows instead of “social shortcuts above app actions.”

### 2. Card-icon oversizing

If `.card-icon` is reused unchanged, the strip will likely become too tall and visually heavy for the header.

### 3. Accessibility regression from icon-only links

Without explicit labels/titles/focus treatment, the UI will look polished but behave poorly for keyboard and screen-reader users.

### 4. Overflow complexity too early

The user explicitly deferred configurability. Phase 16 should implement the default multi-line behavior and only enough overflow affordance to preserve polish, not a full config system.

### 5. Header rhythm collapse

Because the strip sits between profile copy and the action bar, spacing needs to be deliberate. Too little space makes it muddy; too much makes the header feel fragmented.

## Recommended Research Conclusion

The safest plan for Phase 16 is:

1. Keep the Phase 15 route-to-header seam unchanged.
2. Add a dedicated Quick Links strip component inside `ProfileHeader`.
3. Use icon-only outbound links with smaller custom sizing, not full `.card-icon` or `.bottom-action-bar-action` shells.
4. Default to centered, multi-line layout.
5. Add overflow affordance only when needed, with subtle edge fade treatment.
6. Lock accessibility and empty-state behavior with focused tests before moving on.

## Sources

- `src/components/profile/ProfileHeader.tsx`
- `src/components/profile/ProfileHeader.test.tsx`
- `src/lib/ui/profile-quick-links.ts`
- `src/routes/index.tsx`
- `src/components/icons/LinkSiteIcon.tsx`
- `src/lib/icons/brand-icon-options.ts`
- `src/styles/base.css`
- `src/styles/responsive.css`
- `.planning/phases/16-profile-header-quick-links-ui-responsive-polish/16-CONTEXT.md`
- `.planning/phases/15-quick-links-foundation/15-01-SUMMARY.md`
- `.planning/phases/15-quick-links-foundation/15-02-SUMMARY.md`
- `.planning/phases/15-quick-links-foundation/15-03-SUMMARY.md`

---
*Phase: 16-profile-header-quick-links-ui-responsive-polish*
*Research gathered: 2026-03-28*
