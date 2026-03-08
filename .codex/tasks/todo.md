# Todo

## Current

- [x] Extend Substack public augmentation so custom-domain links fetch canonical `substack.com/@handle` profile data and persist subscriber counts without changing displayed source labels.
- [x] Keep Medium on the public-only path with no follower-count support, and document the March 8, 2026 evidence for that decision in the extractor/blocker workflow docs.
- [x] Verify the Substack subscriber-count change with focused enrichment/profile tests, then run repo enrichment/build checks and note any environment blockers.

- [x] Clarify footer source labels for known-platform custom domains using a shared formatter instead of raw host-only copy.
- [x] Add focused footer-label tests for canonical domains, custom domains, hidden labels, and simple-card reuse.
- [x] Verify the footer-label change with targeted tests plus typecheck, biome, and build checks.

- [x] Promote Medium and Substack into the supported social-profile platform set, including Substack custom-domain handling via explicit/generated handles.
- [x] Update public enrichment/cache plumbing so Medium persists handle/avatar data and Substack extracts avatar-first profile metadata instead of subscribe-card previews.
- [x] Extend focused profile-card and enrichment tests for Medium/Substack, then verify with targeted tests plus typecheck/enrichment/validation/build checks.

- [x] Increase the default site-logo/icon sizing again so lead logos and source/footer logos render larger without per-card overrides.
- [x] Verify the logo-size follow-up with `bun run biome:check` and `bun run build`, then review any generated-file churn before closing.

- [x] Increase the global profile-avatar sizing so the profile header avatar and card avatar leads render larger.
- [x] Increase the shared site-logo/icon sizing tokens so lead logos and footer/source logos render larger.
- [x] Verify the sizing pass with `bun run biome:check` and `bun run build`, then review the diff for unintended layout regressions.

- [x] Replace the split rich/simple non-payment card rendering paths with a shared lead-left card anatomy used by both `RichLinkCard` and `SimpleLinkCard`.
- [x] Refactor the shared non-payment card presentation model so lead visual, header meta, description, and footer/source rows are resolved generically without the old profile-vs-preview layout branches.
- [x] Converge base/responsive card CSS on the unified non-payment layout while keeping payment cards and theme selectors stable.
- [x] Extend focused non-payment card tests and docs to cover the unified layout and the deprecated no-op mobile image-layout setting.
- [x] Verify with `bun test src/components/cards/social-profile-card-rendering.test.tsx`, `bun run typecheck`, `bun run biome:check`, and `bun run build`, then review the final diff for unintended regressions.

- [x] Add site-level and per-link rich-card description-source policy so fetched descriptions are the default but manual copy remains configurable.
- [x] Replace the shared rich/simple description resolver heuristic with explicit fetched-vs-manual precedence.
- [x] Add focused precedence tests and a dataset audit covering the current rich-link set and shared card paths.
- [x] Update docs/schema coverage for description-source controls and verify with the rich-card/runtime build checks.

- [x] Add LinkedIn to the supported social-profile platform set so authenticated LinkedIn profile links normalize into avatar-first rich cards.
- [x] Update LinkedIn profile metadata handling and rendering so cached `image` backfills `profileImage`, the display name drops the `| LinkedIn` suffix, and the card avoids duplicate preview media.
- [x] Extend focused tests for LinkedIn supported-profile detection, metadata normalization, and rich-card rendering.
- [x] Update docs to describe LinkedIn as authenticated and profile-card-capable, then verify with targeted tests plus enrichment/validation diagnostics.

- [x] Audit the current authenticated extractor roster against the new public-first workflow and record the final branch decision for each platform.
- [x] Add a public augmentation execution path for Medium, X, Instagram, and YouTube, including blocker-aware routing and public-cache integration.
- [x] Remove Medium, X, Instagram, and YouTube from active authenticated extractor config/policy/cache usage while keeping LinkedIn and Facebook on the authenticated path.
- [x] Update extractor, blocker, and data-model docs so examples and remediation steps match the migrated implementation.
- [x] Verify the migration with targeted enrichment tests, repo-wide lint/type/test checks, and desktop/mobile browser inspection.

- [x] Extend the shared profile presentation layer for Phase 08 with display-ready metric text, display-name cleanup, avatar/preview separation, and profile-aware description fallback logic.
- [x] Rebuild rich cards around an avatar-first social profile header while keeping description, preview-media fallback rules, and source branding coherent.
- [x] Refresh simple cards to support circular avatars, wrapped handle/metric lines, and inline source-brand context in the compact layout.
- [x] Verify Phase 08 with targeted profile-card tests, desktop/mobile Playwright inspection, and the repo quality/lint/type/test suite.

- [x] Research the Phase 08 card UI seams for rich/simple components, social-profile helpers, responsive styling, and fallback constraints.
- [x] Create `.planning/phases/08-social-profile-card-ui-refresh/08-RESEARCH.md` from the current card/rendering code and the locked design decisions.
- [x] Create the three Phase 08 execution plans for rich-card profile headers, simple-card profile compaction, and final responsive/accessibility polish.
- [x] Verify the Phase 08 plan set against the roadmap goal, UI requirements, and the current runtime/validation constraints before handing off to execution.

- [x] Implement the Phase 07 schema, type, merge, and validation contract for social profile avatars plus platform-native audience counts.
- [x] Extend Instagram and YouTube authenticated extraction, cache persistence, and enrichment reporting for profile metadata.
- [x] Wire profile avatars and audience metrics through image sync, runtime loading, and rich-card view models without redesigning the cards yet.
- [x] Verify Phase 07 with focused social-profile tests, enrichment/build checks, and the repo-wide lint/type/test suite.

- [x] Research the Phase 7 metadata pipeline seams for social profile avatars, audience stats, merge precedence, and image materialization.
- [x] Create `.planning/phases/07-social-profile-metadata-pipeline/07-RESEARCH.md` from the current codebase and locked context decisions.
- [x] Create the three Phase 7 execution plans for contract/validation, Instagram+YouTube extraction, and runtime metadata plumbing.
- [x] Verify the Phase 7 plan set against the roadmap goal and requirements before handing off to execution.

- [x] Review the archived v1.0 planning artifacts and current metadata/card seams to scope the next milestone around social profile metadata and card refresh.
- [x] Define v1.1 requirements and milestone goals in `.planning/PROJECT.md` and `.planning/REQUIREMENTS.md`.
- [x] Create the v1.1 roadmap in `.planning/ROADMAP.md` and reset `.planning/STATE.md` so Phase 7 is ready for discussion/planning.
- [x] Verify the planning-doc diffs for scope, requirement traceability, and next-step consistency.

- [x] Diagnose the dark/light brand icon lag and confirm the header/footer logo path is not the broken surface.
- [x] Update `src/components/icons/LinkSiteIcon.tsx` so palette sync runs after theme state changes instead of inside the stale synchronous memo path.
- [x] Verify with `bun run typecheck`, `bun run quality:check`, `bun run build`, and browser dark/light toggle repro.
- [x] Confirm the current share CTA markup and CSS before the icon-only alignment change.
- [x] Move the share control into the profile title row and keep the status message below it.
- [x] Convert the share CTA into a larger icon-only circular button with the existing accessible label and share behavior.
- [x] Verify desktop/mobile layout plus share fallback behavior, then record results.

## Completion Review

- Result: Substack rich links now fetch count-bearing public metadata from canonical `substack.com/@handle` profile pages when a handle is known, while preserving the original link host for `sourceLabel` and UI footer rendering. The committed public cache now persists Substack subscriber counts, and Medium remains on the public-only path without follower-count support.
- Verification: `bun install --frozen-lockfile`, `bun test scripts/enrichment/public-augmentation.test.ts`, `bun test src/lib/content/social-profile-fields.test.ts`, `bun test src/lib/ui/social-profile-metadata.test.ts`, `bun test scripts/enrichment/public-cache.test.ts`, `bun run enrich:rich:strict`, `bun run images:sync`, `bun run validate:data`, `bun run build`, `bun run biome:check`, `bun run studio:lint`, `bun run typecheck`, `bun run studio:typecheck`, `bun run --filter @openlinks/studio-api test`, and `bun run studio:test:integration` all passed.
- Residual risk: Substack exact subscriber counts currently depend on the canonical public `substack.com/@handle` preload shape; if Substack removes or renames `profile.subscriberCountString` / `profile.subscriberCountNumber`, the public path will fall back to core profile metadata without escalating to authenticated extraction.

- Result: Known-platform links on custom domains now clarify the footer/source row as `Platform · domain` while leaving canonical platform hosts and non-host manual labels unchanged. This is implemented only in the footer formatter, so header/source fallback text and other card copy remain as they were.
- Verification: `bun test src/lib/ui/rich-card-footer-labels.test.ts src/components/cards/social-profile-card-rendering.test.tsx src/lib/ui/rich-card-description-sourcing.test.ts`, `bun run typecheck`, `bun run biome:check`, and `bun run build` all passed.
- Residual risk: The already-dirty `data/cache/rich-public-cache.json` continued to pick up normal verification churn when `bun run build` reran enrichment; this task did not intentionally change cache logic or data content.

- Result: Medium and Substack now participate in the avatar-first supported social-profile path. Medium feed augmentation persists `handle` plus `profileImage`, Substack custom-domain enrichment extracts canonical handle and avatar/headshot metadata from safe public HTML, and the shared card/view-model layer now renders both platforms as profile cards with cleaned titles and handle rows.
- Verification: `bun install`, `bun test src/lib/content/social-profile-fields.test.ts src/lib/ui/social-profile-metadata.test.ts src/components/cards/social-profile-card-rendering.test.tsx scripts/enrichment/public-augmentation.test.ts scripts/enrichment/public-cache.test.ts`, `bun run typecheck`, `bun run enrich:rich:strict`, `bun run images:sync`, `bun run validate:data`, `bun run biome:check`, and `bun run build` all passed.
- Residual risk: `data/cache/rich-public-cache.json` picked up normal refresh churn for a few other public-cache entries when `enrich:rich:strict` reran; the functional changes are limited to Medium/Substack support plus the explicit Substack handle in `data/links.json`, but cache timestamps and some fetched URLs/ETags also moved as part of verification.

- Result: Default site logos/icons are now larger again. The global card-icon scale and base size were increased, the configured `normal` and `large` icon-size modes both step up, and the shared lead/footer logo tokens were increased so both main card logos and source/footer logos render larger without per-card overrides.
- Verification: `bun run biome:check` and `bun run build` passed. The build path also passed `avatar:sync`, `enrich:rich:strict`, `images:sync`, and `validate:data`; `validate:data` still reports the existing non-blocking Substack handle warning.
- Residual risk: This further increases logo weight globally, so if any card family now feels visually heavier than the avatars, the next adjustment should likely tune lead-logo tokens independently from the generic card-icon scale.

- Result: Global avatar and site-logo sizing is now larger across the profile header and card surfaces. The profile header avatar scale/base were bumped, shared avatar lead tokens were increased for non-payment cards, and shared icon tokens were increased for lead logos plus footer/source logos.
- Verification: `bun run biome:check` and `bun run build` passed. The build path also passed `avatar:sync`, `enrich:rich:strict`, `images:sync`, and `validate:data`; `validate:data` still reports the existing non-blocking Substack handle warning.
- Residual risk: Because this is a global token bump, the largest impact will be in dense one-column sections and on smaller mobile viewports; if any specific theme feels too heavy after live review, the next adjustment should tune the shared size tokens rather than add one-off component overrides.

- Result: Non-payment cards now share one lead-left anatomy across both `RichLinkCard` and `SimpleLinkCard`. Preview-rich cards, avatar/profile cards, and icon-led simple cards all resolve through the same presentation model and shared shell, while payment cards remain unchanged.
- Verification: `bun test src/components/cards/social-profile-card-rendering.test.tsx`, `bun run typecheck`, `bun run biome:check`, and `bun run build` all passed. The build path also passed `avatar:sync`, `enrich:rich:strict`, `images:sync`, and `validate:data`; `validate:data` still reports the existing non-blocking Substack handle warning.
- Residual risk: The new rich fallback header currently reuses the source label when no handle/metrics are available, so some non-profile rich cards may show the domain in both the summary row and footer row until a later polish pass decides whether that duplication should be reduced.

- Result: Rich-link cards now resolve descriptions through an explicit policy instead of the old metric-duplication heuristic. Raw fetched `metadata.description` is the default across both rich cards and rich-link simple-card fallback mode, with `site.ui.richCards.descriptionSource` and `links[].metadata.descriptionSource` available when manual copy should win instead.
- Verification: `bun test src/lib/ui/rich-card-description-sourcing.test.ts src/components/cards/social-profile-card-rendering.test.tsx src/lib/ui/social-profile-metadata.test.ts src/lib/content/social-profile-fields.test.ts`, `bun run typecheck`, `bun run biome:check`, `bun run enrich:rich:strict`, `bun run images:sync`, `bun run validate:data`, and `bun run build` all passed.
- Residual risk: Because the new default is raw fetched descriptions, some platforms may now show boilerplate-heavy copy until a later sanitization pass adds platform-specific cleanup. `validate:data` still reports the existing non-blocking Substack handle warning.

- Result: LinkedIn now participates in the shared supported social-profile path, so authenticated-cache metadata reuses the cached `image` as `profileImage`, trims the `| LinkedIn` title suffix, and renders the existing LinkedIn link as an avatar-first rich card without duplicate preview media.
- Verification: `bun install`, `bun test src/lib/content/social-profile-fields.test.ts src/lib/ui/social-profile-metadata.test.ts src/components/cards/social-profile-card-rendering.test.tsx`, `bun run typecheck`, `bun run enrich:rich:strict`, `bun run images:sync`, `bun run validate:data`, `bun run build`, and `bun run biome:check` all passed.
- Residual risk: `bun run validate:data` still reports the existing non-blocking Substack handle warning, and the LinkedIn profile treatment still depends on the authenticated cache continuing to provide `title`, `description`, and `image`.

- Result: Medium, X, Instagram, and YouTube now enrich through a first-class public augmentation layer backed by the committed public cache, while LinkedIn and Facebook remain the only active authenticated extractors. Known direct-fetch blockers no longer force Medium/X into auth-only remediation, the committed authenticated cache was pruned to LinkedIn/Facebook, and the extractor docs/skill examples now match the real branch split.
- Verification: `bun test`, `bun run typecheck`, `bun run biome:check`, `bun run studio:lint`, `bun run studio:typecheck`, `bun run --filter @openlinks/studio-api test`, `bun run studio:test:integration`, `bun run enrich:rich:strict`, `bun run images:sync`, `bun run validate:data`, `bun run build`, and `bun run quality:check` all passed. Headed Playwright verification against `vite preview` confirmed desktop/mobile rendering still shows X on the profile-card path and Medium on the non-profile path after the migration.
- Residual risk: Medium now depends on the feed-style public augmentation path rather than the previous authenticated cache, so any upstream feed-format drift should be caught by rerunning `bun run enrich:rich:strict` and the focused public-augmentation tests when Medium metadata changes.

- Result: Phase 08 now renders supported social links as profile-style cards, with circular avatar headers and compact follower/subscriber metrics in rich cards, while the simple-card path reuses the same shared profile/source presentation logic for render-mode fallback.
- Verification: `bun test src/lib/ui/social-profile-metadata.test.ts src/components/cards/social-profile-card-rendering.test.tsx`, `bun run biome:check`, `bun run typecheck`, `bun run studio:lint`, `bun run studio:typecheck`, `bun run --filter @openlinks/studio-api test`, `bun run studio:test:integration`, `bun run build`, and `bun run quality:check` all passed. Playwright inspection against the built preview at desktop (`1440x1400`) and mobile (`390x844`) confirmed Instagram/YouTube avatar headers, compact metric wrapping, and stable adjacent non-profile cards.
- Residual risk: The live site config still primarily exercises the new social treatment through rich cards, so broader platform-specific templates, grid/toggle layouts, and more extensive rendered simple-card examples remain future work for Phase 9+.

- Result: Phase 08 now has a research brief plus three executable plans that sequence the work as rich-card header redesign first, simple-card profile compaction second, and final responsive/fallback/accessibility polish third.
- Verification: Reviewed `.planning/phases/08-social-profile-card-ui-refresh/08-RESEARCH.md`, `.planning/phases/08-social-profile-card-ui-refresh/08-01-PLAN.md`, `.planning/phases/08-social-profile-card-ui-refresh/08-02-PLAN.md`, `.planning/phases/08-social-profile-card-ui-refresh/08-03-PLAN.md`, and checked that the plan files exist with waves `1`, `2`, and `3` plus dependency links `08-01 -> 08-02 -> 08-03`.
- Residual risk: Simple cards currently use a square brand-logo leading slot, so Phase 08 execution will need to rehome source-brand context carefully once circular avatars take over that visual position.

- Result: Phase 07 now persists platform-native social profile metadata end-to-end for Instagram and YouTube, including separate profile avatars, follower/following/subscriber counts, raw-text companions, manual override precedence, warning-only missing-field handling, runtime localization, and rich-card-facing `socialProfile` view-model plumbing.
- Verification: `bun test src/lib/content/social-profile-fields.test.ts src/lib/ui/social-profile-metadata.test.ts scripts/authenticated-extractors/plugins/instagram-auth-browser.test.ts scripts/authenticated-extractors/plugins/youtube-auth-browser.test.ts`, `bun run enrich:rich:strict`, `bun run images:sync`, `bun run validate:data`, `bun run build`, `bun run biome:check`, `bun run studio:lint`, `bun run typecheck`, `bun run studio:typecheck`, `bun run --filter @openlinks/studio-api test`, and `bun run studio:test:integration` all passed. `validate:data` still reports the existing non-blocking Substack handle warning.
- Residual risk: Audience parsing still depends on platform-specific text surfaces and only Instagram/YouTube are covered in this first pass, so broader social-platform support and the actual card redesign remain Phase 8+ work.

- Result: Phase 7 now has a research brief plus three executable plans that sequence the work as contract/precedence first, extractor persistence second, and runtime asset/view-model plumbing third.
- Verification: Reviewed `.planning/phases/07-social-profile-metadata-pipeline/07-RESEARCH.md`, `.planning/phases/07-social-profile-metadata-pipeline/07-01-PLAN.md`, `.planning/phases/07-social-profile-metadata-pipeline/07-02-PLAN.md`, `.planning/phases/07-social-profile-metadata-pipeline/07-03-PLAN.md`, and checked that all three plan files exist with waves `1`, `2`, and `3`.
- Residual risk: Exact field naming for parsed versus raw audience values is still intentionally discretionary inside execution, so Plan 07-01 should settle that quickly before downstream files start diverging.

- Result: The planning artifacts now define milestone v1.1 around social profile metadata persistence and a profile-style card refresh, with requirements mapped cleanly to phases 7-9.
- Verification: Reviewed `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, and `git diff -- .planning/PROJECT.md .planning/REQUIREMENTS.md .planning/ROADMAP.md .planning/STATE.md` for scope and traceability consistency.
- Residual risk: Phase 7 still needs a concrete normalization decision for asymmetric platform metrics (for example follower/following vs subscribers-only) before implementation starts.

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
