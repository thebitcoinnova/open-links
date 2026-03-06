# Todo

- [x] Add `primal.net` to the known-site registry and icon map.
- [x] Extend handle resolution coverage for `primal.net` profile URLs and tests.
- [x] Add the Primal profile link to `data/links.json` with the provided sample URL.
- [x] Verify with `bun test src/lib/identity/handle-resolver.test.ts`, `bun run validate:data`, `bun run typecheck`, `bun run biome:check`, and `bun run build`.

## Completion Review

- Result: `primal.net` now behaves like a first-class rich social link with direct-fetch enrichment, domain/icon recognition, and URL-handle support.
- Verification: all requested checks passed after regenerating rich metadata and synced content images.
- Residual risk: Primal profile URLs appear slug-based, so handle display now relies on URL-derived behavior unless a verified Primal-specific public handle source is added later.
