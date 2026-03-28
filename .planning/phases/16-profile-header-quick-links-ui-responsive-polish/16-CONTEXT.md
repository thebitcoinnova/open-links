# Phase 16: Profile Header Quick Links UI + Responsive Polish - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

## Phase Boundary

Render the visible Quick Links strip above the profile action bar using the Phase 15 foundation data, and decide the strip's layout, density behavior, icon treatment, accessibility-facing interaction cues, and empty-state behavior across mobile and desktop. This phase covers the visible strip UI and responsive polish only, not new user-configurable Quick Links settings.

## Implementation Decisions

### Strip anatomy

- Do not show a visible `Quick Links` heading; the strip should feel self-explanatory.
- Center the strip under the profile copy.
- Use bare icon-only links rather than bordered pills or chip containers.
- Keep the strip visually distinct as its own small block above the action bar, but with tight spacing so it still feels connected to that action area.

### Density and overflow

- Quick Links should wrap to multiple lines by default.
- Desktop should use the same general behavior as mobile, while naturally fitting more links before overflow becomes necessary.
- Let the layout decide naturally when it starts to feel crowded rather than locking a fixed visible count in this phase.
- When overflow happens, the strip should become horizontally scrollable and use a subtle edge fade or shadow/opacity gradient to imply additional hidden links.

### Icon treatment

- Default to a mostly monochrome treatment with subtle brand accents.
- Keep the strip icon-only; visible labels do not belong in the default Phase 16 treatment.
- Use the same visual treatment for all platforms rather than emphasizing some platforms more strongly.
- The overall mood should feel crisp and polished rather than glossy or playful.

### Interaction and states

- Hover and focus states should feel slightly animated rather than completely static or overly dramatic.
- The strip should feel like obvious outbound social shortcuts.
- Do not introduce an active/current selected state; these are outbound links only.
- When no eligible quick links exist, the strip should disappear completely with no reserved spacing.

### Claude's Discretion

- Exact motion timing, easing, and scale/opacity treatment for hover/focus/press states.
- Exact spacing, gap, and row rhythm between the Quick Links strip and the action bar, as long as the strip remains a small distinct block that feels connected.
- Exact implementation of the edge fade/scroll affordance when overflow occurs.

## Specific Ideas

- The strip should read as a polished icon row rather than a second action bar.
- The strip should use the Phase 15 route-to-header seam and avoid rethinking the derivation rules.
- Overflow should still hint that more items exist without adding a new menu-first interaction by default.

## Deferred Ideas

- Configurable single-line horizontal-scroll mode as a user-selectable alternative to the default multi-line layout.
- Configurable full-brand-color treatment as an alternative to the default monochrome-with-accents look.

---

*Phase: 16-profile-header-quick-links-ui-responsive-polish*
*Context gathered: 2026-03-28*
