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
