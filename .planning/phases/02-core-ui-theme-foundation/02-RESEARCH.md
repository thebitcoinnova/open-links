# Phase 2: Core UI + Theme Foundation - Research

**Researched:** 2026-02-22
**Domain:** SolidJS UI composition, theming tokens, responsive behavior
**Confidence:** HIGH

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Default above-the-fold composition should be balanced (identity + first links visible).
- Developer-configurable composition modes must include identity-first, links-first, and links-only.
- Grouping presentation defaults to subtle section headers; grouping style must be configurable, including no grouping.
- Card density default is medium with configurable compact/spacious variants.
- Profile richness default is standard with configurable minimal/rich variants.
- Theme personalities should cover the A/B/C families if implementation remains straightforward.
- Theme token scope must include colors, spacing, radii, shadows, typography scale, and density defaults.
- Mode policy must be developer-configurable (`static-dark`, `static-light`, `dark-default-with-toggle`).
- Default mode policy should be dark-default with toggle.
- Theme set should include both mild-variation and strongly-differentiated options.
- Theme toggle should be top-right in header.
- Card feedback should remain minimal.
- Motion should be moderate with reduced-motion support.
- Link opening behavior should be developer-configurable; default external links open in new tab.
- Mobile layout: single-column, compact spacing, sticky top utility row.
- Desktop layout: developer-configurable single/two-column, default single.
- Typography scale defaults fixed but configurable.
- Interaction target threshold configurable with touch-friendly default.

### Claude's Discretion
- Exact config key naming and file partitioning.
- Exact initial count of starter themes if all families need phased introduction.
- Exact timing/easing values for moderate motion.

### Deferred Ideas (OUT OF SCOPE)
- None.

## Summary

Phase 2 should establish a durable presentation architecture, not one-off styling tweaks. The recommended implementation is a tokenized theme system layered over a composition/config model that controls profile richness, grouping style, density, and layout behavior. UI assembly should be componentized around profile header, section renderer, and simple link card primitives.

For mode behavior, use a single mode policy contract in data configuration (`static-dark`, `static-light`, `dark-toggle`) and a mode controller that applies root attributes/classes. Persist user choice only when toggle mode is enabled. Prefer minimal card interaction states and moderate transitions with `prefers-reduced-motion` handling from day one.

Primary recommendation: implement Phase 2 in three slices: composition primitives first, then mode/theme engine, then responsive and polish pass constrained by configuration.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `solid-js` | `1.9.11` | Component/state primitives for UI composition | Already in repo and suitable for configurable rendering paths. |
| CSS custom properties | Browser-native | Theme tokens for colors/spacing/radii/shadows | Enables low-overhead theming with high flexibility. |
| localStorage + media query | Browser APIs | Theme mode persistence and reduced-motion behavior | Lightweight and robust for static apps. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `clsx` | optional | Class composition helpers | Use if class logic becomes verbose with multiple config axes. |
| `@solid-primitives/media` | optional | Reactive media-query behavior | Use only if responsive logic exceeds simple CSS breakpoints. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS token themes | CSS-in-JS theming libs | More dynamic APIs, higher complexity and bundle overhead for static site needs. |
| Route-level composition forks | One generic mega component | Fewer files short-term, worse maintainability for configurable modes. |

**Installation:**

```bash
# Optional helpers only if needed
npm install clsx
```

## Architecture Patterns

### Recommended Project Structure

```text
src/
  components/
    profile/
      ProfileHeader.tsx
    cards/
      SimpleLinkCard.tsx
    layout/
      LinkSection.tsx
      TopUtilityBar.tsx
    theme/
      ThemeToggle.tsx
  lib/
    content/
      load-content.ts
    ui/
      composition.ts
      link-target.ts
    theme/
      mode-controller.ts
      theme-registry.ts
  styles/
    base.css
    tokens.css
    themes/
      midnight.css
      daybreak.css
      neutral.css
      editorial.css
      futuristic.css
      humanist.css
```

### Pattern 1: Config-Driven Composition Resolver

**What:** Resolve render behavior from site config (composition mode, density, grouping style, profile richness).
**When to use:** For developer-overridable UI behavior without rewriting components.
**Example:**

```typescript
const view = resolveComposition(site.ui?.composition ?? "balanced");
```

### Pattern 2: Mode Policy + Theme Token Layer

**What:** Separate mode policy (static/toggle) from theme token selection.
**When to use:** Always, to avoid coupling light/dark logic to every component.
**Example:**

```typescript
applyModePolicy(site.modePolicy, storedPreference);
applyThemeTokens(site.theme.active);
```

### Pattern 3: Responsive Configuration Fallbacks

**What:** Keep responsive defaults in CSS, allow selected overrides from config.
**When to use:** When supporting configurable desktop columns/density without dynamic layout chaos.

### Anti-Patterns to Avoid
- Putting composition branches directly inside card components.
- Hardcoding mode behavior inside route markup.
- Over-animating cards (conflicts with minimal feedback requirement).
- Using runtime layout calculations where CSS breakpoints suffice.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Theme persistence orchestration | Custom event bus | Small mode controller + localStorage | Simpler, deterministic, easy to test. |
| Multi-mode layout branching | Scattered `if` checks in JSX | Central composition resolver | Keeps behavior consistent and maintainable. |
| Motion accessibility toggles | Manual per-component flags | Root reduced-motion class + CSS media queries | Prevents drift and missed components. |

**Key insight:** Phase 2 quality depends on shared UI contracts, not clever component-local logic.

## Common Pitfalls

### Pitfall 1: Theme system only skins colors
**What goes wrong:** spacing/radius/shadow/typography become hardcoded and theme variants feel fake.
**Why it happens:** token scope is too narrow initially.
**How to avoid:** define full token surface now (colors + shape + rhythm + type + density).
**Warning signs:** adding a new theme requires editing component styles directly.

### Pitfall 2: Toggle mode conflicts with static mode
**What goes wrong:** static-dark/static-light still respond to persisted toggle data.
**Why it happens:** one state path handles all mode policies.
**How to avoid:** mode controller must branch policy first, persistence second.
**Warning signs:** static mode site appears in wrong mode after prior toggle session.

### Pitfall 3: Responsive pass introduces layout regressions
**What goes wrong:** desktop and mobile spacing/targets diverge unpredictably.
**Why it happens:** responsive rules and density knobs overlap without precedence rules.
**How to avoid:** define precedence: explicit config > breakpoint defaults > token defaults.
**Warning signs:** cards become too small on mobile or overly sparse on desktop.

## Code Examples

### Composition mode dispatch

```typescript
switch (site.ui.compositionMode) {
  case "identity-first":
  case "links-first":
  case "links-only":
  default:
}
```

### Mode policy application

```typescript
const policy = site.ui.modePolicy ?? "dark-toggle";
const applied = policy === "static-dark" ? "dark" : policy === "static-light" ? "light" : storedOrDefault;
```

### Reduced-motion guard

```css
@media (prefers-reduced-motion: reduce) {
  * {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

## State of the Art (2024-2025)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-component ad-hoc theme classes | Design-token driven themes | Established best practice | Easier scaling to multiple theme identities. |
| Binary dark/light toggle only | Policy-driven mode behavior | Current productization trend | Supports static branding and user preference modes cleanly. |

## Open Questions

1. **How many starter themes to ship in Phase 2 if time pressure appears?**
   - What we know: desired coverage spans multiple families.
   - What's unclear: minimum acceptable count for phase completion.
   - Recommendation: implement token architecture for full families; ship at least 2-4 concrete themes in Phase 2 if execution budget tight.

2. **Two-column desktop threshold default**
   - What we know: desktop single/two-column must be configurable, default single.
   - What's unclear: exact breakpoint for optional two-column mode.
   - Recommendation: default threshold at wider breakpoint (e.g., >=1024px) with config override.

## Sources

### Primary (HIGH confidence)
- `.planning/phases/02-core-ui-theme-foundation/02-CONTEXT.md`
- `.planning/ROADMAP.md` Phase 2 goal and success criteria
- Existing repository UI/data structure under `src/`, `data/`, `schema/`

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` and `.planning/research/ARCHITECTURE.md`

## Metadata

**Research scope:** component structure, theming model, responsive behavior, interaction defaults

**Confidence breakdown:**
- Standard stack: HIGH
- Architecture: HIGH
- Pitfalls: HIGH
- Code examples: MEDIUM

**Research date:** 2026-02-22
**Valid until:** 2026-03-24

---

*Phase: 02-core-ui-theme-foundation*
*Research completed: 2026-02-22*
*Ready for planning: yes*
