# Todo

- [x] Bump the global profile avatar scale in `data/site.json` from `1.5` to `1.6`.
- [x] Add explicit rich-card variant markup so CSS can target `simple` and `rich` card surfaces consistently.
- [x] Rebalance card sizing globally in CSS: slightly larger rich media, smaller rich-card icons, and larger simple-card leading logos without changing the simple-card row layout.
- [x] Verify with `bun run typecheck`, `bun run biome:check`, `bun run validate:data`, and `bun run build`.

## Completion Review

- Result: The profile avatar, rich-card media, rich-card icons, and simple-card leading logos were rebalanced globally using the existing site config plus variant-specific card CSS.
- Verification: `bun run typecheck`, `bun run biome:check`, `bun run validate:data`, and `bun run build` all passed. Playwright verification against the built preview confirmed clean desktop/mobile rendering with no simple-card overflow or clipping.
- Residual risk: Rich-card media still stretches to the full card row height on desktop, so the larger simple-card logo chip is intentionally bigger than before but remains shorter than the full rich-media block when descriptions run long.
