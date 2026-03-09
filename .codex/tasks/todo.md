# Todo

## Current

- [x] Turn off preview-derived rich-card media globally through the existing `site.ui.richCards.imageTreatment` setting.
- [x] Add a focused regression proving `imageTreatment: "off"` still preserves Substack's avatar-led profile card while suppressing preview media.
- [x] Verify with `bun test src/components/cards/social-profile-card-rendering.test.tsx src/lib/ui/rich-card-description-sourcing.test.ts`, `bun run validate:data`, and `bun run build`.

### Completion Review

- Result: The live OpenLinks site config now sets `site.ui.richCards.imageTreatment` to `off`, so preview-derived Open Graph-style media is hidden across rich cards by default while social-profile avatars remain visible. No enrichment metadata, public/authenticated caches, generated image manifests, or SEO image fields were changed.
- Verification: `bun test src/components/cards/social-profile-card-rendering.test.tsx src/lib/ui/rich-card-description-sourcing.test.ts`, `bun run validate:data`, and `bun run build` passed on March 9, 2026. The new focused regression confirms Substack still renders with an avatar lead when preview media is globally disabled, and the existing non-profile regression still confirms preview-led cards fall back to icon-led rendering when `imageTreatment` is off.
- Residual risk: The page-level policy now hides preview media for all present and future rich cards until intentionally reversed, so any future non-profile rich link that should keep a preview image will require revisiting the global setting rather than only a per-site override.

- [x] Verify the current Substack public rich-cache entry still preserves distinct `image`, `ogImage`, `twitterImage`, `profileImage`, and subscriber metadata under the new storage model.
- [x] Refresh the generated rich metadata and baked image assets so the Substack preview/avatar files exist locally in `public/generated/images/`.
- [x] Verify with `bun install --frozen-lockfile`, `bun run enrich:rich:strict`, `bun run images:sync`, `bun run validate:data`, and `bun run build`.

### Completion Review

- Result: The Substack link (`substack`, source label `peter.ryszkiewicz.us`) is healthy under the new split storage model. Stable source metadata remains in `data/cache/rich-public-cache.json`, generated rich metadata was rebuilt in `data/generated/rich-metadata.json`, and baked local image assets now exist again under `public/generated/images/` with URL-to-file mappings in `data/generated/content-images.json`. The regenerated Substack metadata still carries distinct `image`/`ogImage`/`twitterImage` plus `profileImage`, and includes `subscribersCount=10`.
- Verification: `bun install --frozen-lockfile`, `bun run avatar:sync`, `bun run enrich:rich:strict`, `bun run images:sync`, `bun run validate:data`, and `bun run build` all passed on March 9, 2026. The baked Substack assets resolved to `public/generated/images/54e10190cf9525d7d7796386830386257cee28aa453aaf7c3533cc180b269c21.jpg` (preview/OG/Twitter image) and `public/generated/images/507a2bdb6baf0c2930e28c0f5a30f7c7b7f88ccbe6aef3975d7aa26a7ccb9e57.jpg` (profile avatar). `git status --short` was clean after verification.
- Residual risk: The committed public cache still stores the canonical remote Substack CDN URLs by design; runtime localization depends on `data/generated/content-images.json` and `public/generated/images/` being regenerated in environments that do not already have those generated artifacts present.

- [x] Add a hook-aware `validate:data` mode that skips generated rich-artifact checks unless staged paths touch rich metadata/image inputs.
- [x] Route Husky and hook-only CI parity through `validate:data:hook` with a staged-path file under `.cache/openlinks-precommit/`.
- [x] Add validator coverage plus hook smoke verification so unrelated stale rich artifacts no longer force `git commit --no-verify`.
- [x] Verify with `bun run typecheck`, `bun run biome:check`, targeted validator tests, `bun run hooks:precommit`, `bun run validate:data`, and `bun run ci:required:hook:build`.

### Completion Review

- Result: `validate:data` now supports a hook-aware mode that reads `.cache/openlinks-precommit/staged-files.txt` and skips generated rich-artifact checks unless staged paths touch rich metadata/image inputs. Husky and `ci:required:hook:build` now route through `validate:data:hook`, while normal `validate:data`, `build`, and CI keep full repo-wide strictness.
- Verification: `bun test scripts/validate-data.test.ts`, `bun run typecheck`, `bun run biome:check`, `bun run validate:data`, and a full `bun run hooks:precommit` pass all succeeded. Smoke verification also temporarily removed `data/generated/rich-metadata.json`, `data/generated/content-images.json`, and `data/generated/rich-enrichment-report.json`, then confirmed `bun run validate:data:hook` and `bun run ci:required:hook:build` passed for an unrelated staged path (`scripts/sync-profile-avatar.ts`) but failed for a rich-input staged path (`data/links.json`).
- Residual risk: The staged-path trigger list is now the source of truth for hook-mode rich-artifact checks. Future rich-generation inputs need to be added there, or hook mode could skip checks that should remain blocking.

- [x] Extend rich metadata, public cache, authenticated cache, and manual link schemas/types to preserve `ogImage` and `twitterImage` alongside `image` and `profileImage`.
- [x] Refactor generic parsing, public augmentation, authenticated extraction, and image-localization flows so all distinct image roles are preserved and cached locally.
- [x] Refresh committed public/auth cache data where possible, update maintainer docs and extractor skill guidance, and verify with parser/cache/image-sync/build checks.

### Completion Review

- Result: Rich metadata now preserves four distinct image roles: `image` (render image), `profileImage` (identity image), `ogImage`, and `twitterImage`. Generic parsing keeps OG/Twitter provenance separate, public augmentation carries those fields through, authenticated cache types/assets support per-role image entries, and runtime image localization now materializes all four fields when local assets exist.
- Verification: `bun test scripts/enrichment/parse-metadata.test.ts scripts/enrichment/public-augmentation.test.ts scripts/enrichment/public-cache.test.ts scripts/sync-content-images.test.ts scripts/authenticated-extractors/cache.test.ts`, `bun run typecheck`, `bun run biome:check`, `bun run studio:lint`, `bun run studio:typecheck`, `bun run --filter @openlinks/studio-api test`, `bun run studio:test:integration`, `bun run quality:embedded-code`, `bun run setup:rich-auth`, `bun run auth:rich:sync -- --only-link facebook --force`, `bun run enrich:rich:strict`, `bun run images:sync`, `bun run validate:data`, and `bun run build` passed. `bun run auth:rich:sync -- --only-link linkedin --force` failed because `AGENT_BROWSER_ENCRYPTION_KEY` is not configured locally.
- Residual risk: Facebook was re-captured from real extractor output, but LinkedIn could not be refreshed in this session due the missing `AGENT_BROWSER_ENCRYPTION_KEY`. The existing committed LinkedIn cache still validates, but it does not yet have newly captured per-role image metadata from a fresh extractor run.

- [x] Split `data/cache/rich-public-cache.json` into committed stable metadata plus ignored runtime revalidation state.
- [x] Refactor enrichment/public-sync cache writes so header-only refreshes update only the runtime overlay and stable metadata changes remain the only tracked writes.
- [x] Update schemas, docs, cache audit/tests, and verification so the public cache split is enforced and documented.
- [x] Verify with `bun test scripts/enrichment/public-cache.test.ts scripts/public-rich-sync.test.ts scripts/fetch-cache-audit.test.ts`, `bun run validate:data`, and `bun run typecheck`.

### Completion Review

- Result: `rich-public-cache.json` now stores only committed stable metadata, while volatile revalidation state moves into the ignored `data/cache/rich-public-cache.runtime.json` overlay. The shared cache helper transparently loads legacy single-file manifests, splits them on write, sorts keys deterministically, and keeps the caller-facing merged registry shape intact for enrichment and public sync.
- Verification: `bun test scripts/enrichment/public-cache.test.ts scripts/public-rich-sync.test.ts scripts/fetch-cache-audit.test.ts`, `bun run typecheck`, `bun run biome:check`, `bun run enrich:rich:strict` twice, and `bun run images:sync` passed. The second strict enrichment run left `data/cache/rich-public-cache.json` byte-identical while only the ignored runtime overlay changed, which confirms the merge-conflict reduction goal.
- Residual risk: `bun run validate:data` still fails in this worktree because the repo’s current rich-card image materialization state leaves several `links[].metadata.image` values unmapped in `data/generated/content-images.json`. That failure reproduces after regeneration and is outside this cache-split change.

- [x] Increase the public-site default typography baseline so titles, body copy, captions, and card text render larger without requiring per-site overrides.
- [x] Increase the public-site default profile avatar, avatar-led card image, link-card site icon, and chrome logo sizing through shared layout/style defaults.
- [x] Add focused resolver tests for layout and typography defaults/overrides, then verify with `bun run biome:check`, `bun run typecheck`, and `bun run build`.

### Completion Review

- Result: The public OpenLinks page now renders larger by default through shared defaults only. Typography tokens were raised, the `compact` and `expressive` presets were recalibrated around the new baseline, the fallback `profileAvatarScale` default increased, shared avatar/icon/logo CSS variables were bumped, and new resolver tests now cover the layout and typography default/override paths.
- Verification: `bun test src/lib/ui/layout-preferences.test.ts src/lib/ui/typography-preferences.test.ts`, `bun run biome:check`, `bun run typecheck`, and `bun run build` passed after installing the repo-locked dependencies with `bun install --frozen-lockfile`. A lightweight Playwright spot-check against `bun run preview -- --host 127.0.0.1 --port 4173` loaded the page successfully at desktop (`1440x1400`) and mobile (`390x844`) viewports. The transient `data/cache/rich-public-cache.json` churn from `bun run build` was reverted so the final diff stays code-only.
- Residual risk: This is a global default-size bump, so the biggest remaining risk is theme-specific visual weight or long-title wrapping that only shows up on content variants beyond the current local dataset. Future tuning should stay in the shared token/CSS-variable layer rather than adding per-component overrides.

- [x] Add a repeatable fetch/cache audit that inventories build-time and enrichment network paths and marks any non-cached exceptions explicitly.
- [x] Expose the audit through a dedicated package script so it can run in the same verification flow as enrichment checks.
- [x] Verify with `bun test scripts/fetch-cache-audit.test.ts`, `bun run audit:fetch-cache`, `bun run enrich:rich:strict`, `bun run images:sync`, `bun run avatar:sync`, and `bun run validate:data`.

### Completion Review

- Result: The repo now has a repeatable fetch/cache audit in `scripts/fetch-cache-audit.test.ts` plus `bun run audit:fetch-cache`, which inventories every direct `fetch(...)` callsite, asserts the shared metadata fetch helper is only used by cache-writing enrichment entrypoints, and requires explicit classification for cache-backed, diagnostic-only, and runtime-only fetches.
- Verification: `bun test scripts/fetch-cache-audit.test.ts`, `bun run audit:fetch-cache`, `bun run typecheck`, `bun run enrich:rich:strict`, `bun run avatar:sync`, `bun run images:sync`, and `bun run validate:data` all passed. The transient `data/cache/rich-public-cache.json` revalidation churn from the live enrichment pass was reverted after verification so the change stays code-only.
- Residual risk: The automated audit currently governs direct `fetch(...)` callsites, not every browser-driven network navigation. Public browser sync and authenticated extractor browser flows were manually re-audited in this pass and still write through their cache/artifact pipelines, but a future fully-automated browser-network inventory would tighten that gap further.

- [x] Add hook-only `ci:required:hook:build` and `ci:required:hook:quality` scripts so pre-commit required parity can verify the repo without regenerating tracked outputs.
- [x] Switch `scripts/hooks/pre-commit.sh` heavy parity lanes from mutating `ci:required:build` / `ci:required:quality` to the new hook-only non-mutating commands while keeping the existing drift guard.
- [x] Update `docs/quickstart.md` and verify staged hook behavior so commit-time parity no longer creates incidental tracked cache churn.

### Completion Review

- Result: pre-commit required parity now stays in place but runs through hook-only non-mutating build/quality commands. The hook still performs the same heavy gate on CI-relevant staged paths, but it now validates against committed/generated artifacts instead of regenerating tracked cache files during commit.
- Verification: `bun run ci:required:hook:build`, `bun run ci:required:hook:quality`, `bun run hooks:precommit`, `bun run typecheck`, `bun run biome:check`, `bun run validate:data`, `bun run build`, and `bun run studio:test:integration` passed. Additional hook scenarios confirmed heavy parity is skipped for non-CI-relevant staged files and that the hook still refuses parity when unrelated unstaged CI-relevant tracked files are present.
- Residual risk: the hook’s post-parity tracked-drift guard remains important because future script changes could reintroduce tracked mutations; this change removes the known `build`/quality churn path but does not weaken that protection.

- [x] Stabilize public rich-cache entry timestamps so 304/header-only refreshes preserve `capturedAt` and `updatedAt` unless the cached metadata payload changes.
- [x] Stabilize `public:rich:sync` so unchanged audience captures avoid dirty writes and retain existing cache timestamps.
- [x] Stabilize generated image/avatar manifests so no-op runs preserve entry/root timestamps and persisted status, then verify with focused tests plus typecheck, validation, and build checks.

### Completion Review

- Result: Automatic public-cache writes now preserve `capturedAt` and `updatedAt` across `304` and metadata-equal refreshes, `public:rich:sync` now treats unchanged audience captures as no-ops instead of dirty writes, and the generated content-image/avatar manifests now preserve entry timestamps plus persisted `status` across `cache_fresh` and `not_modified` runs while only bumping root timestamps when the persisted manifest content actually changes.
- Verification: `bun test scripts/enrichment/public-cache.test.ts scripts/public-rich-sync.test.ts scripts/sync-content-images.test.ts scripts/sync-profile-avatar.test.ts`, `bun run typecheck`, `bun run biome:check`, `bun run validate:data`, and `bun run build` all passed.
- Residual risk: The real `bun run build` still surfaced legitimate public-cache churn for Instagram/GitHub freshness data because upstream payload and header values changed during the run; that generated diff was reverted after verification so this patch stays code-only, but the repo will still record those real upstream changes whenever operators intentionally refresh committed cache artifacts.

- [x] Make the non-Docker required CI lane canonical in `package.json`, including a dedicated local Docker parity script.
- [x] Extend `scripts/hooks/pre-commit.sh` with staged-path-sensitive required CI parity checks plus tracked-output restage protection.
- [x] Align `.github/workflows/ci.yml` messaging with the new local parity entrypoints, then verify normal and failure-path hook behavior before closing.

- [x] Fix non-payment card accessible-name semantics in the shared shell so action-oriented `aria-label` remains authoritative.
- [x] Realign the accessibility/manual-smoke quality checks with `NonPaymentLinkCardShell` instead of the stale wrapper files.
- [x] Add a rendered-markup regression test for simple and rich non-payment cards, then verify with `bun test src/components/cards/non-payment-card-accessibility.test.tsx`, `bun run typecheck`, `bun run build`, `bun run quality:check`, `bun run studio:test:integration`, and a final diff review.

- [x] Promote the v3 `10/10` mark to the canonical winner so the active global aliases and runtime brand assets use it everywhere.
- [x] Regenerate the logo manifests, SVG aliases, comparison sheet, and favicon/app-icon assets after the v3 winner switch.
- [x] Verify the winner switch with regeneration, `bun run typecheck`, `bun run biome:check`, `bun run build`, and a final diff review.

- [x] Extend the v3 OpenLinks thickness comparison set so it generates equal-weight variants from `6/6` through `15/15`.
- [x] Regenerate the v3 SVGs, manifests, and comparison sheet after expanding the weight range.
- [x] Verify the range expansion with regeneration, `bun run typecheck`, `bun run biome:check`, and a final diff review.

- [x] Add a new v3 OpenLinks logo generation lane that explores thicker equal-weight strokes while keeping the v2 winner geometry family.
- [x] Generate versioned v3 winner/archive SVG assets, manifests, and a comparison sheet, then promote the v3 `8/8` winner to the active global logo aliases.
- [x] Update logo governance and brand-asset wording so the docs and runtime asset pipeline reflect v3 as the active mark.
- [x] Verify the logo refresh with regeneration, `bun run typecheck`, `bun run build`, and a final diff review for unintended alias churn.

- [x] Add a Medium-first `bun run public:rich:sync` command that bootstraps public cache entries from the feed and overlays browser-captured follower counts without touching authenticated-extractor infrastructure.
- [x] Extend public-cache writes so Medium feed refreshes preserve previously captured social metrics when the feed path does not provide them.
- [x] Add focused parser, cache-merge, UI, and sync-runner tests plus the Medium public-browser docs updates, then verify with the targeted and repo validation/build commands.

### Completion Review

- Result: `package.json` now exposes canonical local CI parity entrypoints (`bun run ci:required` plus `bun run ci:required:docker`), the pre-commit hook keeps the existing fast staged checks and then runs the required CI lane when staged files touch CI-relevant paths, and the hook now blocks both pre-existing unstaged CI-relevant tracked edits and new tracked output drift from heavy parity checks.
- Verification: `bun run hooks:precommit` passed with only `.codex/tasks/todo.md` staged and skipped the heavy parity phase; `bun run hooks:precommit` failed early with only `package.json` staged while `scripts/hooks/pre-commit.sh` remained unstaged; `bun run hooks:precommit` ran the full required lane plus all three Docker builds with all implementation files staged and then failed intentionally on tracked output drift in `data/cache/rich-public-cache.json`; `bun run ci:required`, `bun run biome:check`, `bun run studio:lint`, `bun run studio:typecheck`, and `bun run --filter @openlinks/studio-api test` passed.
- Residual risk: The full staged parity path is now intentionally strict enough to stop commits when `build` refreshes tracked cache files, which is the intended safety behavior but will add friction on commits that depend on time-sensitive public cache refreshes. The Docker parity lane is also materially slower than the rest of the hook when package or Docker guard paths are staged.

- Result: Shared non-payment cards now keep their action-oriented accessible name on `aria-label`, with `aria-labelledby` removed from the shared shell. The quality and manual-smoke checks now inspect `NonPaymentLinkCardShell`, and a new non-payment card accessibility test resolves simple and rich card trees to assert the expected label and description wiring.
- Verification: `bun test src/components/cards/non-payment-card-accessibility.test.tsx`, `bun run typecheck`, `bun run build`, `bun run quality:check`, `bun run studio:test:integration`, and `bunx @biomejs/biome check scripts/quality/a11y.ts scripts/quality/manual-smoke.ts src/components/cards/non-payment-card-accessibility.test.tsx --files-ignore-unknown=true` passed.
- Residual risk: Full `bun run biome:check` still reports formatting drift in generated JSON files under `data/generated/`, which is outside this CI accessibility fix. Diff review also confirmed the pre-existing unrelated change in `data/cache/rich-public-cache.json` remains untouched.

- Result: Medium now stays on the `public_augmented` path, with a separate `bun run public:rich:sync` command that uses a public browser profile to capture follower counts into `data/cache/rich-public-cache.json` while feed-based enrichment preserves those counts on later refreshes.
- Verification: `bun install`, `bun test scripts/enrichment/medium-public-browser.test.ts scripts/enrichment/public-cache.test.ts scripts/public-rich-sync.test.ts src/lib/ui/social-profile-metadata.test.ts src/components/cards/social-profile-card-rendering.test.tsx`, `bun run typecheck`, `bun run biome:check`, `bun run enrich:rich:strict`, and `bun run build` passed. `bun run public:rich:sync -- --only-link medium` succeeded once and wrote the Medium public cache/artifact, then a second immediate rerun failed cleanly on a Cloudflare placeholder without mutating the cache.
- Residual risk: Medium’s public browser capture is environment-sensitive and not fully deterministic; the committed cache now contains `3.3K followers` from the successful browser artifact, but repeated sync attempts can still hit Cloudflare and require another retry later.

- [x] Extend Substack public augmentation so custom-domain links fetch canonical `substack.com/@handle` profile data and persist subscriber counts without changing displayed source labels.
- [x] Keep Medium on the public-only path with no follower-count support, and document the March 8, 2026 evidence for that decision in the extractor/blocker workflow docs.
- [x] Verify the Substack subscriber-count change with focused enrichment/profile tests, then run repo enrichment/build checks and note any environment blockers.
- [x] Normalize icon-led non-payment card lead boxes so simple-card logos and rich icon fallbacks render near the avatar lead size instead of the oversized media size.
- [x] Verify the lead-size normalization with `bun run typecheck`, `bun run biome:check`, and a diff review for layout side effects.

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
- Result: Icon-led non-payment cards now size their lead boxes from avatar-derived tokens instead of the oversized media-scale tokens, so simple-card logos render within 4px of rich-card avatar leads on both desktop and mobile while preview-media cards stay unchanged.
- Verification: `bun install`, `bun run typecheck`, `bun run biome:check`, and `bun run --bun vite build` passed. Playwright against the built preview measured the `OpenLinks` simple icon lead at `100x100` vs avatar-rich leads at `96x96` on desktop and `82.4x82.4` vs `78.4x78.4` on mobile, with no title or description overflow in the checked cards. `git diff --stat` confirmed the change stayed limited to `.codex/tasks/todo.md` and `src/styles/base.css`.
- Residual risk: The current live dataset does not include a rich card that falls back to `data-lead-kind="icon"`, so browser verification covered the shared selector via the simple card plus avatar-rich cards rather than a live rich fallback example.

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

- Result: The active v3 winner is now `10/10`, so the global logo aliases, the versioned v3 alias, the studio/public runtime SVG copies, and the regenerated favicon/app-icon assets all point at the thicker `c10-l10` mark instead of `c8-l8`.
- Verification: `bun scripts/generate-openlinks-logo-variants.ts`, `bun run typecheck`, `bun run biome:check`, and `bun run build` all passed. Diff review confirmed the winner swap moved `c10-l10` into `public/branding/openlinks-logo/v3/` and archived `c8-l8` with the other non-winning v3 variants.
- Residual risk: The active favicon badge now renders the `10/10` stroke weight, which is substantially denser at 16-32 px than the previous `8/8` mark and may still warrant a small-icon-specific override after browser-level review.

- Result: The v3 thickness generator now produces the full equal-weight range from `6/6` through `15/15`, keeping `8/8` as the active winner while adding `11/11` through `15/15` to the archive and comparison sheet.
- Verification: `bun scripts/generate-openlinks-logo-variants.ts`, `bun run typecheck`, and `bun run biome:check` all passed. Diff review confirmed the new churn is the expanded v3 archive/comparison outputs plus the expected manifest stats update from 5 to 10 variants.
- Residual risk: The heaviest marks (`14/14` and `15/15`) are now available for review, but they compress the interior geometry substantially and may be too dense for tiny-size usage even if they remain mathematically valid.

- Result: The logo asset generator now produces a new v3 thickness study based on the existing inset centered family, archives the non-winning `6/6`, `7/7`, `9/9`, and `10/10` variants, and promotes the `8/8` mark to the active global logo aliases and runtime brand assets.
- Verification: `bun install`, `bun scripts/generate-openlinks-logo-variants.ts`, `bun run typecheck`, and `bun run build` all passed. Diff review confirmed the intentional churn is limited to the v3 logo lane, the active/global SVG aliases, the regenerated favicon/app-icon assets, and the expected v2 manifest alias cleanup.
- Residual risk: The favicon badge now follows the active logo stroke weights, so if the thicker `8/8` treatment feels too dense at 16px in real browser chrome, the badge policy may need a future small-icon-specific weight override.

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
