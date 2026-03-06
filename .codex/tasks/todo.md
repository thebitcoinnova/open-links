# Todo

## Current

- [x] Diagnose the dark/light brand icon lag and confirm the header/footer logo path is not the broken surface.
- [x] Update `src/components/icons/LinkSiteIcon.tsx` so palette sync runs after theme state changes instead of inside the stale synchronous memo path.
- [x] Verify with `bun run typecheck`, `bun run quality:check`, `bun run build`, and browser dark/light toggle repro.

## Completion Review

- Result: `LinkSiteIcon` now defers palette recomputation until after the active theme state lands on `document.documentElement`, so the card icon chips no longer render one toggle behind dark/light mode.
- Verification: `bun run typecheck`, `bun run quality:check`, and `bun run build` all passed. Playwright verification against the built preview confirmed the chips switch immediately on dark->light and light->dark toggles, while the utility/footer logos still invert correctly.
- Residual risk: The palette sync now depends on a queued microtask after the theme fingerprint changes; if theme application ever moves to a later async phase, this component should be revalidated.

## Previous Completed Work

- [x] Bump the global profile avatar scale in `data/site.json` from `1.5` to `1.6`.
- [x] Add explicit rich-card variant markup so CSS can target `simple` and `rich` card surfaces consistently.
- [x] Rebalance card sizing globally in CSS: slightly larger rich media, smaller rich-card icons, and larger simple-card leading logos without changing the simple-card row layout.
- [x] Verify with `bun run typecheck`, `bun run biome:check`, `bun run validate:data`, and `bun run build`.

## Previous Completion Review

- Result: The profile avatar, rich-card media, rich-card icons, and simple-card leading logos were rebalanced globally using the existing site config plus variant-specific card CSS.
- Verification: `bun run typecheck`, `bun run biome:check`, `bun run validate:data`, and `bun run build` all passed. Playwright verification against the built preview confirmed clean desktop/mobile rendering with no simple-card overflow or clipping.
- Residual risk: Rich-card media still stretches to the full card row height on desktop, so the larger simple-card logo chip is intentionally bigger than before but remains shorter than the full rich-media block when descriptions run long.
