# Theming and Layout Extensibility

This guide explains how to customize OpenLinks visuals and layout from low-risk token changes to deeper structural extensions.

Use this sequence:

1. Token changes (safest)
2. Scoped CSS overrides
3. New theme creation and registration
4. Layout behavior extensions

## Source of Truth Files

Primary files used by theme and layout behavior:

- `src/styles/tokens.css`
- `src/styles/base.css`
- `src/styles/responsive.css`
- `src/styles/themes/*.css`
- `src/lib/theme/theme-registry.ts`
- `src/lib/ui/composition.ts`
- `src/lib/ui/layout-preferences.ts`
- `data/site.json`

## Theme Strategy Overview

OpenLinks theme selection is data-driven:

- `data/site.json` controls `theme.active` and `theme.available`.
- Runtime selection resolves through `src/lib/theme/theme-registry.ts`.
- Theme mode behavior is controlled by `site.ui.modePolicy`.

## Level 1: Token-Only Customization (Low Risk)

Start with token edits before touching component CSS.

Primary file:

- `src/styles/tokens.css`

Typical token updates:

- surface/background colors
- text colors
- spacing scales
- border radii
- shadow levels

Recommended workflow:

1. Update token values in `tokens.css`.
2. Run `npm run dev`.
3. Verify dark/light readability and focus visibility.
4. Run `npm run quality:check` before commit.

Why this is preferred:

- Lowest maintenance cost.
- Usually no component rewrite needed.
- Better compatibility with future upstream updates.

## Level 2: Scoped CSS Overrides (Medium Risk)

Use scoped overrides when token changes are not enough.

Primary file:

- `src/styles/base.css`

Optional companion:

- `src/styles/responsive.css`

Guidelines:

- Scope by existing class names instead of global element selectors.
- Keep overrides near related section blocks.
- Preserve focus styles and keyboard accessibility selectors.
- Avoid `!important` unless unavoidable.

Example approach:

1. Identify target section/class in existing styles.
2. Add a scoped rule set with minimal selector depth.
3. Verify visual behavior in both dark and light modes.
4. Validate that hover/focus/tap states remain clear.

## Level 3: Add a New Theme (High Control)

When your fork needs a distinctive visual direction, add a new theme file and register it.

### Step A: Create theme stylesheet

Add a file under `src/styles/themes/`, for example:

- `src/styles/themes/signal.css`

Define only what differs from base tokens and theme variables.

### Step B: Register theme in stylesheet imports

Ensure the new theme stylesheet is imported where other theme files are loaded.

Current theme files include:

- `daybreak.css`
- `editorial.css`
- `futuristic.css`
- `humanist.css`
- `midnight.css`
- `neutral.css`

### Step C: Add metadata to theme registry

Update `src/lib/theme/theme-registry.ts`:

- add new `ThemeDefinition` entry (`id`, `label`, `intensity`)
- keep IDs lowercase and stable

### Step D: Enable theme in site config

Update `data/site.json`:

- add theme ID to `theme.available`
- optionally set as `theme.active`

### Step E: Validate

Run:

```bash
npm run validate:data
npm run dev
npm run quality:check
```

## Mode Policy Configuration

OpenLinks supports three mode policies in `site.ui.modePolicy`:

- `dark-toggle` (default)
- `static-dark`
- `static-light`

### Recommended default

Use `dark-toggle` for most forks:

- dark mode default
- user can switch to light mode
- mode preference persists in browser storage

### When to use static modes

Use static policies if your brand requires fixed contrast behavior:

- `static-dark`: brand requires dark-only visual identity
- `static-light`: brand requires light-only visual identity

## Theme Checklist

Before merging visual changes:

- [ ] Theme is listed in `theme.available` when intended.
- [ ] `theme.active` points to an available theme.
- [ ] Dark/light behavior matches `modePolicy` intent.
- [ ] Focus styles remain visible.
- [ ] Contrast remains acceptable for text and interactive elements.
- [ ] `npm run quality:check` completes successfully.

## Layout Extension Points

Layout behavior is composed from site config values and resolver utilities.

Primary layout files:

- `src/lib/ui/composition.ts`
- `src/lib/ui/layout-preferences.ts`
- `src/components/layout/LinkSection.tsx`
- `src/routes/index.tsx`

### Config fields that shape layout

In `data/site.json` under `ui`:

- `compositionMode`: profile-vs-links ordering strategy
- `groupingStyle`: grouped vs flat presentation
- `desktopColumns`: one/two column page layout
- `density`: compact/medium/spacious spacing
- `typographyScale`: fixed/compact/expressive typography tuning
- `targetSize`: comfortable/compact/large interaction footprint

### How layout resolution works

1. `load-content.ts` reads site config.
2. `resolveComposition()` maps composition mode and grouping style.
3. `resolveLayoutPreferences()` maps density/columns/type scale/target size.
4. `src/routes/index.tsx` applies these decisions through page class names and section rendering.

## Recipe: Add or Change a Layout Mode

Use this for advanced forks that want behavior beyond existing `compositionMode` options.

### Step 1: Add mode value to type contract

Update union type in `src/lib/content/load-content.ts`:

- extend `CompositionMode` with new ID (example: `magazine`).

### Step 2: Extend resolver logic

Update `src/lib/ui/composition.ts`:

- include new mode in `getMode()`,
- define block ordering in `blocksForMode()`,
- define emphasis in `emphasisForMode()`.

### Step 3: Apply view behavior

Update `src/routes/index.tsx` and related layout components:

- ensure class naming and render flow handle the new mode,
- verify profile and links sections still render accessibly.

### Step 4: Add style support

Update style files:

- `src/styles/base.css` for new mode class behavior,
- optionally `src/styles/responsive.css` for breakpoint-specific adjustments.

### Step 5: Add data example

Update `data/site.json` (and optionally `data/examples/*/site.json`) with the new mode to keep examples aligned.

### Step 6: Validate and test

Run:

```bash
npm run validate:data
npm run build
npm run quality:check
```

Then manually verify:

- mobile/desktop responsiveness,
- keyboard tab order,
- focus visibility,
- card readability.

## Extension Point Matrix

Use this table to decide where a change belongs.

| Extension Point | File(s) | Purpose | Risk |
|-----------------|---------|---------|------|
| Theme token edits | `src/styles/tokens.css` | Global visual tuning without changing structure | Low |
| Theme-specific styling | `src/styles/themes/*.css` | Distinct visual identity per theme | Medium |
| Theme registration | `src/lib/theme/theme-registry.ts` | Expose new theme IDs and labels | Medium |
| Mode policy behavior | `src/lib/theme/mode-controller.ts` | Dark/light policy + persistence logic | Medium |
| Composition logic | `src/lib/ui/composition.ts` | Profile/link ordering and grouping behavior | Medium |
| Layout preferences mapping | `src/lib/ui/layout-preferences.ts` | Density, columns, target sizing behavior | Medium |
| Route-level rendering | `src/routes/index.tsx` | Final block render order and class wiring | Medium-High |
| Base/responsive style behavior | `src/styles/base.css`, `src/styles/responsive.css` | Shared component/layout rendering details | Medium-High |

## Decision Tree: If You Want X, Change Y

### If you want to change only colors/spacing

Change:

- `src/styles/tokens.css`

Do not start in:

- `src/routes/index.tsx`

### If you want a new branded look without changing layout logic

Change:

- new file in `src/styles/themes/`
- `src/lib/theme/theme-registry.ts`
- `data/site.json` theme settings

### If you want profile-first vs links-first page composition

Change:

- `data/site.json` -> `ui.compositionMode`

If existing modes are insufficient, extend:

- `src/lib/ui/composition.ts`

### If you want grouped vs flat link presentation

Change:

- `data/site.json` -> `ui.groupingStyle`
- `data/links.json` -> `group` + `groups` only when grouping is desired

### If you want denser or larger interaction rhythm

Change:

- `data/site.json` -> `ui.density`
- `data/site.json` -> `ui.targetSize`
- optionally refine CSS in `src/styles/base.css`

### If you want a two-column desktop layout

Change:

- `data/site.json` -> `ui.desktopColumns`

Then verify in real breakpoints:

- mobile,
- tablet,
- desktop.

## Anti-Patterns to Avoid

### 1) Deep selector overrides everywhere

Problem:

- brittle CSS that breaks on upstream merges.

Safer approach:

- use tokens first, then narrow scoped selectors.

### 2) `!important`-heavy theming

Problem:

- hard-to-debug cascade behavior and mode regressions.

Safer approach:

- adjust variable layers and selector specificity gradually.

### 3) Coupling data model to one visual branch

Problem:

- forks cannot switch composition/theme modes without editing app logic.

Safer approach:

- keep layout/theme decisions in `data/site.json` and resolver functions.

### 4) Ignoring accessibility while restyling

Problem:

- contrast/focus regressions that pass visual review but fail real navigation.

Safer approach:

- verify with `npm run quality:check` and keyboard testing before merge.

## Migration Notes for Fork Maintainers

When pulling upstream updates:

1. Rebase or merge upstream.
2. Resolve conflicts in this order:
   - `data/site.json`
   - `src/lib/theme/theme-registry.ts`
   - `src/lib/ui/composition.ts`
   - theme/style files
3. Re-run:

```bash
npm run validate:data
npm run build
npm run quality:check
```

4. Manually verify theme toggle and responsive layout behavior.

If your fork added custom layout modes:

- keep a short changelog section in your fork docs listing:
  - custom mode IDs,
  - files touched,
  - known compatibility assumptions.

## Maintainability Checklist

Before merging theme/layout changes:

- [ ] Change is mapped to the smallest viable extension point.
- [ ] Config-driven behavior remains preferred over hardcoded branching.
- [ ] Accessibility and quality checks were run.
- [ ] New theme IDs are registered and documented.
- [ ] Upstream merge impact was considered (especially on shared CSS files).
