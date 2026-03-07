# Todo

## Current

- [x] Diagnose the dark/light brand icon lag and confirm the header/footer logo path is not the broken surface.
- [x] Update `src/components/icons/LinkSiteIcon.tsx` so palette sync runs after theme state changes instead of inside the stale synchronous memo path.
- [x] Verify with `bun run typecheck`, `bun run quality:check`, `bun run build`, and browser dark/light toggle repro.
- [x] Confirm the current share CTA markup and CSS before the icon-only alignment change.
- [x] Move the share control into the profile title row and keep the status message below it.
- [x] Convert the share CTA into a larger icon-only circular button with the existing accessible label and share behavior.
- [x] Verify desktop/mobile layout plus share fallback behavior, then record results.

## Completion Review

- Result: `LinkSiteIcon` now defers palette recomputation until after the active theme state lands on `document.documentElement`, so the card icon chips no longer render one toggle behind dark/light mode.
- Verification: `bun run typecheck`, `bun run quality:check`, and `bun run build` all passed. Playwright verification against the built preview confirmed the chips switch immediately on dark->light and light->dark toggles, while the utility/footer logos still invert correctly.
- Residual risk: The palette sync now depends on a queued microtask after the theme fingerprint changes; if theme application ever moves to a later async phase, this component should be revalidated.
- [x] Add a shared SEO metadata resolver that preserves the GitHub Pages `/open-links/` path for canonical URLs and social URLs.
- [x] Wire the shared resolver into runtime head updates and Vite `transformIndexHtml`, and replace `openlinks.example` in `data/site.json`.
- [x] Add a regression test for the project-path canonical behavior.
- [x] Verify with `bun run typecheck`, `bun run biome:check`, `bun run validate:data`, `bun run build`, `bun run quality:check`, `bun test src/lib/seo/resolve-seo-metadata.test.ts`, and `rg -n "openlinks\\.example" .`.

## SEO URL Completion Review

- Result: Canonical, `og:url`, and social image URLs now resolve from a shared SEO metadata path across runtime, Vite HTML generation, and quality checks, with `quality.seo.canonicalBaseUrl` updated to `https://prizz.github.io/open-links/`.
- Verification: `bun install`, `bun run typecheck`, `bun run biome:check`, `bun run validate:data`, `bun run build`, `bun run quality:check`, `bun test src/lib/seo/resolve-seo-metadata.test.ts`, and `rg -n "openlinks\\.example" .` passed or returned no matches; Playwright against the built preview confirmed hydrated `canonical` and `og:url` stayed `https://prizz.github.io/open-links/` and `twitter:image` resolved to `https://prizz.github.io/open-links/openlinks-social-fallback.svg`.
- Residual risk: SEO checks still warn that the site uses the deterministic fallback social image because no custom social preview image is configured.

### Share icon alignment

- Result: The profile header now uses an icon-only circular share control in the same row as the profile name, aligned flush to the right edge, with the status message kept below that row.
- Verification: `bun run typecheck`, `bun run biome:check`, and `bun run build` all passed. Playwright verification against the built preview confirmed one right-aligned `Share profile` button in the title row, a larger fixed-size icon button on desktop and mobile, and `Link copied` rendering below the row after forcing the clipboard fallback path.
- Residual risk: The shared `IconShare` component still contributes hidden SVG title text to `textContent`, so any future DOM assertions should continue checking visible layout and `aria-label` rather than assuming an empty raw text node.

## Previous Completed Work

- [x] Diagnose the dark/light brand icon lag and confirm the header/footer logo path is not the broken surface.
- [x] Update `src/components/icons/LinkSiteIcon.tsx` so palette sync runs after theme state changes instead of inside the stale synchronous memo path.
- [x] Verify with `bun run typecheck`, `bun run quality:check`, `bun run build`, and browser dark/light toggle repro.
- [x] Confirm why the `OpenLinks` simple-card logo in `Work` renders smaller than the adjacent rich-card profile image.
- [x] Update shared card CSS so simple-card leading logos use the same desktop/mobile leading-visual size tokens as rich-card media while keeping the row layout.
- [x] Verify with `bun run typecheck`, `bun run biome:check`, `bun run validate:data`, `bun run build`, and Playwright desktop/mobile measurements for the `Work` section.

- [x] Bump the global profile avatar scale in `data/site.json` from `1.5` to `1.6`.
- [x] Add explicit rich-card variant markup so CSS can target `simple` and `rich` card surfaces consistently.
- [x] Rebalance card sizing globally in CSS: slightly larger rich media, smaller rich-card icons, and larger simple-card leading logos without changing the simple-card row layout.
- [x] Verify with `bun run typecheck`, `bun run biome:check`, `bun run validate:data`, and `bun run build`.
- [x] Review the current `ProfileHeader` share actions, icon utilities, and CSS hooks.
- [x] Remove the secondary `Copy link` action and keep a single share flow in `src/components/profile/ProfileHeader.tsx`.
- [x] Add a reusable `IconShare` and render it inside the `Share profile` CTA.
- [x] Restyle the profile share button as the primary pill in `src/styles/base.css` and keep mobile behavior aligned in `src/styles/responsive.css`.
- [x] Verify the change with targeted checks, diff review, and note any environment blockers.
- [x] Restore local dependencies and rerun the LinkedIn-rich baseline diagnostics.
- [x] Fix the LinkedIn authenticated extractor so About text does not capture the section label.
- [x] Add a focused regression test for LinkedIn description sanitizing and headline fallback behavior.
- [x] Apply the immediate LinkedIn cache workaround and attempt a refresh from the fixed extractor.
- [x] Verify with `bun run enrich:rich:strict`, `bun run validate:data`, `bun test`, and `bun run build`.

## Previous Completion Review

- Result: `LinkSiteIcon` now defers palette recomputation until after the active theme state lands on `document.documentElement`, so the card icon chips no longer render one toggle behind dark/light mode.
- Verification: `bun run typecheck`, `bun run quality:check`, and `bun run build` all passed. Playwright verification against the built preview confirmed the chips switch immediately on dark->light and light->dark toggles, while the utility/footer logos still invert correctly.
- Residual risk: The palette sync now depends on a queued microtask after the theme fingerprint changes; if theme application ever moves to a later async phase, this component should be revalidated.

- Result: Simple-card leading logos now use the same desktop/mobile leading-visual tokens as rich-card media, and simple-card rows top-align so cards like `OpenLinks` visually match adjacent rich-card profile images in the `Work` section.
- Verification: `bun run typecheck`, `bun run biome:check`, `bun run validate:data`, and `bun run build` all passed. Playwright verification against the built preview measured `160x160` rich-media vs `160x160` simple-logo on desktop and `105.3x105.3` vs `105.3x105.3` on mobile, with screenshots confirming no overflow or clipping.
- Residual risk: This parity fix aligns simple-card logos with the current rich-card leading-visual tokens; if rich-card media sizing changes again or non-square rich previews become the design target, the shared token values should be revalidated.

- Result: The profile avatar, rich-card media, rich-card icons, and simple-card leading logos were rebalanced globally using the existing site config plus variant-specific card CSS.
- Verification: `bun run typecheck`, `bun run biome:check`, `bun run validate:data`, and `bun run build` all passed. Playwright verification against the built preview confirmed clean desktop/mobile rendering with no simple-card overflow or clipping.
- Residual risk: Rich-card media still stretches to the full card row height on desktop, so the larger simple-card logo chip is intentionally bigger than before but remains shorter than the full rich-media block when descriptions run long.

### Share CTA refresh

- Result: The profile header now exposes a single prominent `Share profile` CTA with a leading share icon, while keeping the native-share-first and clipboard-fallback behavior in one button.
- Verification: `bun run biome:check`, `bun run studio:lint`, `bun run typecheck`, `bun run studio:typecheck`, `bun run --filter @openlinks/studio-api test`, `bun run studio:test:integration`, and `bun run build` passed, and Playwright confirmed the page renders one share button with an icon and shows `Link copied` after forcing the clipboard fallback path.
- Residual risk: The share-sheet success path still depends on browser support for `navigator.share`, so native-share behavior remains browser-specific even though the fallback path is verified.

### LinkedIn extractor fix

- Result: LinkedIn authenticated extraction now filters out the glued `About` section label at both the DOM-candidate layer and the final Node-side description normalization layer, and the committed LinkedIn cache entry now serves the corrected description immediately.
- Verification: `bun install`, `bun run typecheck`, `bun run quality:embedded-code`, `bun test`, `bun run enrich:rich:strict`, `bun run images:sync`, `bun run validate:data`, and `bun run build` all passed. `bun run auth:rich:sync -- --only-link linkedin --force` was attempted and failed only because `AGENT_BROWSER_ENCRYPTION_KEY` is not set to a valid 64-character hex value in this environment.
- Residual risk: A live LinkedIn recapture from the fixed extractor is still pending until local authenticated-browser prerequisites are available, so the committed cache contains the manual hotfix text rather than a newly re-captured LinkedIn session artifact.
