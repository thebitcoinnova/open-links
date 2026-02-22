# Phase 2: Core UI + Theme Foundation - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

## Phase Boundary

Render the core profile page UI from validated JSON data, including simple cards, responsive behavior, dark/light mode support, and baseline theme architecture. This phase defines the primary presentation and interaction defaults while keeping configurability paths explicit.

## Implementation Decisions

### Page Composition
- Default above-the-fold composition should be balanced: identity content and first link cards both visible.
- Composition mode must be configurable by developer with support for `identity-first`, `links-first`, and `links-only`.
- Grouping presentation defaults to subtle section headers.
- Grouping style should be configurable, including an option for no grouping.
- Card density defaults to medium, with configurable compact and spacious variants.
- Profile detail richness defaults to standard (name + headline + bio + optional avatar), with configurable minimal and rich variants.

### Theme Direction
- If implementation remains straightforward, include starter theme personalities spanning all discussed families:
  - clean neutral, bold editorial,
  - dark futuristic, warm humanist,
  - minimal monochrome, vibrant creator.
- Token scope should include colors, spacing, radii, shadows, typography scale, and density defaults (with sensible defaults).
- Mode policy must be developer-configurable:
  - static dark,
  - static light,
  - dark-default with user light toggle.
- Default configuration should be dark-default with user light toggle enabled.
- Theme intensity mix should include both mild variation themes and a smaller set of strongly differentiated themes.

### Interaction Behavior
- Theme toggle should appear in a top-right header utility position.
- Card interaction feedback should default to minimal/subtle visual response.
- Motion should use moderate transitions and must include reduced-motion support.
- Link opening behavior should be developer-configurable, with default behavior opening external links in new tabs.

### Responsive Rules
- Mobile layout should use single-column flow with compact spacing and a sticky top utility row.
- Desktop card layout should be developer-configurable for single or two-column behavior, defaulting to single-column.
- Typography scale defaults to fixed values, but should be configurable.
- Interaction target threshold should be developer-configurable with touch-friendly defaults (>=44px-equivalent baseline).

### Claude's Discretion
- Exact naming of configuration keys and structure as long as the chosen behaviors remain configurable as specified.
- Exact number of starter themes in Phase 2 if full set needs phased introduction, provided coverage of mild + strong theme variation is preserved.
- Specific transition timing values and easing curves as long as motion remains moderate and reduced-motion-compatible.

## Specific Ideas

- Configuration should consistently expose mode choices instead of hardcoding one UI path.
- Defaults should be practical and opinionated, but every major presentation axis (composition, grouping, density, layout mode behavior) should remain developer-overridable.
- Theme system should avoid painting into a corner: token breadth matters now to reduce rework later.

## Deferred Ideas

- None — discussion stayed within phase scope.

---

*Phase: 02-core-ui-theme-foundation*
*Context gathered: 2026-02-22*
