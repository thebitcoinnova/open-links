# Todo

## Current

### In Progress

- [x] Add explicit `mailto:` handling to the shared non-payment card pipeline so email links no longer fall through to the generic unknown-link presentation.
- [x] Improve default email-card UX with a dedicated mail icon, scheme-aware accessibility copy, and cleaner long-address text treatment while preserving existing override surfaces.
- [x] Verify the email-card change with focused card/unit tests, `bun run typecheck`, `bun run biome:check`, and `git diff --check`.

### Completion Review

- Result: Email links now resolve through a shared internal link-kind helper instead of falling through the generic unknown-link path. `mailto:` cards derive the visible address from the URL when no explicit description is present, suppress blank source/footer labels for non-host schemes, render a dedicated neutral mail icon, expose contact-aware shell data attributes, and announce themselves accessibly as `Send email to ...`. Long email addresses now wrap safely and clamp to two lines on narrow layouts while expanding normally on desktop. The implementation also leaves a contact-scheme architecture seam in place so `tel:` can reuse the same resolver later without another card-model refactor.
- Verification: `bun install` passed in this worktree so the component-rendering tests could resolve `solid-js`. `bun test src/lib/links/link-kind.test.ts src/lib/ui/rich-card-description-sourcing.test.ts src/components/cards/social-profile-card-rendering.test.tsx src/components/cards/non-payment-card-accessibility.test.tsx` passed. `bun run typecheck` passed. `bun run biome:check` passed. `bun run build` passed end to end, including `enrich:rich:strict`, `images:sync`, `social:preview:generate`, `validate:data`, and the final Vite production build. `git diff --check` passed.
- Residual risk: The only unrelated code adjustment in this batch was refreshing a stale dataset assertion in `src/lib/ui/rich-card-description-sourcing.test.ts` so the existing rich-link audit reflects the current `cluborange` dataset. Email-specific share/copy/QR actions remain intentionally unchanged, so a future contact-action pass may still want to make those controls email-aware.

- [x] Audit the current enrichment parsing/extraction paths and capture the migration matrix for direct, public-augmented, and authenticated strategies.
- [x] Introduce a shared internal strategy framework plus generic document-parsing primitives, while keeping the existing CLI commands and data contracts stable.
- [x] Migrate current public and authenticated providers onto the shared registry-backed framework, add adapter/parity tests, and rerun repo-required verification.

### Completion Review

- Result: The enrichment stack now resolves every current path through a single internal strategy framework with explicit branch/source-kind contracts, while generic HTML extraction moved into reusable document primitives. Public-direct HTML, public-augmented providers, and authenticated browser extractors still feed the existing CLI/data outputs, but the strategy registry now owns source selection and normalized parsing so provider-specific behavior no longer leaks into the generic parser layer. The authenticated extractor scaffolder and docs were also repointed at the new strategy registration path, and the audit matrix was captured in `docs/enrichment-strategy-audit.md`.
- Verification: `bun test scripts/enrichment/document-primitives.test.ts scripts/enrichment/strategy-registry.test.ts scripts/enrichment/public-augmentation.test.ts scripts/enrichment/parse-metadata.test.ts` passed. `bun run biome:check` passed. `bun run typecheck` passed. `bun run studio:lint` passed. `bun run studio:typecheck` passed. `bun run --filter @openlinks/studio-api test` passed. `bun run studio:test:integration` passed. `bun run validate:data` passed. `bun run enrich:rich:strict` passed. `bun run build` passed. `bun run quality:embedded-code` passed.
- Residual risk: The compatibility adapters still exist by design, so the architecture is cleaner without being fully simplified yet. A later cleanup pass can remove the legacy adapter surfaces once no callers depend on them, but this batch intentionally kept those seams to avoid command or data-contract drift.

- [x] Bundle deterministic generator fonts for the social preview so Resvg stops falling back to machine-dependent fonts.
- [x] Replace heuristic pill sizing and `dominant-baseline` centering with font-backed Resvg bbox measurement for the eyebrow and footer badges.
- [x] Verify the stabilized pill layout with focused generator tests, asset regeneration, `bun run typecheck`, `bun run biome:check`, and `git diff --check`.

### Completion Review

- Result: The social-preview renderer now pins Resvg to vendored `Space Grotesk` and `Manrope` font files, measures the eyebrow and footer labels from their actual rendered bounding boxes, and positions the pill text by offsetting against the measured glyph bounds instead of relying on heuristic widths or `dominant-baseline`. The regenerated PNG now shows even pill padding and stable label centering in both the generic fallback and the site-level preview.
- Verification: `bun test scripts/generate-openlinks-brand-assets.test.ts scripts/generate-site-social-preview.test.ts` passed. `bun run branding:assets` passed. `bun run social:preview:generate` passed. `bun run typecheck` passed. `bun run biome:check` passed. `git diff --check` passed. A visual check of `public/generated/seo/social-preview.png` confirmed that the eyebrow and footer pills are aligned in the rasterized output.
- Residual risk: The pill geometry is now deterministic for the current font files and Resvg version, so future font-file swaps or Resvg metric changes will require updating the corresponding exact-geometry test expectations.

- [x] Modernize the OpenLinks social preview into a premium PNG-first brand card with a generated site-level default preview.
- [x] Wire the new site social preview generator into build/deploy flows and update SEO defaults/docs/tests to match.
- [x] Verify the social preview refresh with targeted tests, repo-required checks, and a diff review.

### Completion Review

- Result: Replaced the old static fallback art with a premium charcoal/teal OpenLinks card, added a new `social:preview:generate` pipeline that writes `public/generated/seo/social-preview.svg` and `.png`, switched starter SEO config to use the generated PNG by default, and kept the hardcoded last-resort fallback on a generic `public/openlinks-social-fallback.png`. The build/deploy flows now generate the site preview automatically, hook-mode validation treats the new generator paths as rich-artifact inputs, and the docs/test coverage now describe and protect the PNG-first SEO contract.
- Verification: `bun install` passed. `bun test scripts/generate-openlinks-brand-assets.test.ts scripts/generate-site-social-preview.test.ts src/lib/seo/resolve-seo-metadata.test.ts scripts/validate-data.test.ts scripts/clean-public-build-artifacts.test.ts` passed. `bun run typecheck` passed. `bun run branding:assets` passed and regenerated `public/openlinks-social-fallback.svg` plus the new `public/openlinks-social-fallback.png`. `bun run social:preview:generate` passed. `bun run biome:check` passed. `bun run validate:data` passed. `bun run build` passed end to end, including `enrich:rich:strict`, `images:sync`, `social:preview:generate`, and `badge:site`. `git diff --check` passed.
- Residual risk: The generated site preview lives under ignored `public/generated/seo/`, so the asset is intentionally recreated by build/dev flows rather than committed. I did not perform the post-deploy LinkedIn Post Inspector cache refresh in this local change batch, so live cache invalidation still needs to happen after deployment.

- [x] Fix the stale utility-menu quality heuristics so the Kobalte popover path satisfies required CI checks.
- [x] Add shared utility-menu analyzer coverage for legacy manual behavior, Kobalte behavior, and incomplete implementations.
- [x] Verify the CI-fix batch with `bun test scripts/quality/utility-menu.test.ts`, `bun run ci:required:quality`, and `bun run ci:required`.

### Completion Review

- Result: Added a shared `scripts/quality/utility-menu.ts` analyzer so both the accessibility and manual-smoke quality gates accept either the legacy manual-close menu contract or the current Kobalte `Popover` contract. `UtilityControlsMenu` now keeps explicit `aria-expanded` and `aria-controls` on the trigger, and the quality scripts no longer require stale literal `onFocusOut`/`pointerdown`/`Escape` strings when Kobalte manages close behavior.
- Verification: `bun test scripts/quality/utility-menu.test.ts` passed. `bun run biome:check` passed. `bun run ci:required:quality` passed with existing non-blocking SEO/performance warnings only. `bun run ci:required` passed end to end, including `typecheck`, deploy tests, `build`, `quality`, and Studio integration. `git diff --check` passed.
- Residual risk: The new analyzer is intentionally string-based because the surrounding quality framework already works that way, so future larger structural rewrites of `UtilityControlsMenu` may still require updating the accepted-contract heuristics. The new regression test against the live source should catch that drift earlier.

- [x] Implement the Kobalte menu/sidebar refactor across the public utility controls menu and the Studio shell/editor.
- [x] Add focused regression tests for the new menu helpers, Studio nav model, and editor tab contract.
- [x] Verify the change with repo-required lint, typecheck, Studio tests, and a full build.

### Completion Review

- Result: Replaced the public utility controls popup with a Kobalte `Popover`, extracted its pure open/focus helpers for test coverage, added a Studio shell navigation component with shared desktop/mobile route definitions and a mobile Kobalte `Dialog` drawer, and moved the Studio editor rail/panel chrome into a Kobalte `Tabs`-backed `EditorWorkspace` wrapper. The Studio roadmap trackers were updated in both the doc checklist and the in-app checklist data, and `@kobalte/core` is now declared in `packages/studio-web/package.json`.
- Verification: `bun install` passed. `bun run biome:check` passed. `bun run studio:lint` passed. `bun run typecheck` passed. `bun run studio:typecheck` passed. `bun test src/components/layout/UtilityControlsMenu.test.tsx` passed. `bun run studio:web:test` passed. `bun run build` passed, including `enrich:rich:strict`, `images:sync`, and `validate:data`. `bun run studio:web:build` passed. `git diff --check` passed.
- Residual risk: The new root-app menu test stays at the helper-contract level because Bun’s default server-side test environment cannot directly execute the client-only Kobalte popover module. The behavior is still covered by typecheck/build integration plus the extracted focus/open helpers, but a future browser-capable UI test harness would allow end-to-end interaction coverage.

- [x] Fix the GitHub Actions deploy workflow gating so CI-triggered production deploys can run when `build_artifacts` is intentionally skipped.
- [x] Push the workflow fix, confirm the next `main` CI run triggers `Deploy Production`, and verify the AWS + Pages jobs execute instead of skipping.
- [x] Finish with live verification that the CI-driven deploy updated `openlinks.us` and the GitHub Pages mirror from the pushed artifact.

- [x] Run the full AWS + GitHub production deployment flow from this workspace, starting with local artifact generation and check-mode setup/bootstrap/publish verification.
- [x] Fix any deployment-script, infrastructure, or repository-setting failures surfaced by the live run and rerun the failing step until it succeeds.
- [x] Finish with end-to-end verification of `https://openlinks.us/` and the GitHub Pages mirror, then record the resulting state and residual risks.

### Completion Review

- Result: CI-driven production deployment is now enabled on `main`. The deploy workflow conditions in `.github/workflows/deploy-pages.yml` were tightened so the AWS and Pages jobs can run from CI handoff artifacts even when the workflow-local `build_artifacts` job is intentionally skipped on `workflow_run`, and the final verify job now runs after successful AWS + Pages publishes instead of being skipped by `needs` propagation.
- Verification: GitHub Actions run `23172647172` (`CI`) on commit `8856d0254d86821a8249cc27b911fb8ddb081353` completed successfully on the required lane and uploaded both deploy artifacts. Downstream run `23172683776` (`Deploy Production`) then completed with `success`: `Resolve Deploy Context` passed, `Deploy AWS Canonical Site` passed, `Deploy GitHub Pages Mirror` passed, and `Verify Production Deployment` passed. The deploy jobs explicitly downloaded the CI-generated AWS and Pages artifacts rather than rebuilding them inside the deploy workflow.
- Residual risk: The pipeline is live, but GitHub is now warning that several actions still run on deprecated Node 20 (`actions/upload-artifact@v4`, `dorny/paths-filter@v3`, and elsewhere in the workflow stack). That does not block current deploys, but those actions should be upgraded before the June 2, 2026 Node 24 cutoff.

- Result: Ran the deployment flow end to end from this workspace. `deploy:setup --apply`, `deploy:aws:bootstrap --apply`, `deploy:aws:publish --apply`, a downstream `deploy-pages.yml` run, and `deploy:verify` all succeeded earlier in the session, which brought `https://openlinks.us/` live on AWS and kept the GitHub Pages mirror valid. Follow-up fixes then addressed the remaining repo-side deployment issues: orphan `REVIEW_IN_PROGRESS` stack-shell recovery in the AWS scripts, deterministic deploy build timestamps, stabilization of `data/generated/rich-metadata.json` so repeated `deploy:build` runs stop churning on `generatedAt`/`enrichedAt`, and a public-build cleanup step that removes stray `.DS_Store` files plus legacy `public/generated/*` cache remnants before builds.
- Verification: `bun run test:deploy` passed. `bun test scripts/clean-public-build-artifacts.test.ts scripts/enrichment/generated-metadata.test.ts scripts/lib/build-timestamp.test.ts` passed. `bun run typecheck` passed. `bun run build` passed. `bun run deploy:build` passed. Two consecutive `bun run deploy:build:pages` runs produced the same artifact hash (`c82b64c5af22344df7d68bcc4719de69440c9a0994642e735d9f84d3df4dcff3`). `bun run deploy:setup` passed in check mode. `bun run deploy:aws:bootstrap` passed in check mode. `bun run deploy:aws:publish --artifact=.artifacts/deploy/aws` passed in check mode. `bun run deploy:pages:plan --artifact=.artifacts/deploy/github-pages` passed in check mode and now reports only real live-vs-local bundle drift, not local junk files. `bun run deploy:verify` passed. Targeted `bunx @biomejs/biome check ... --files-ignore-unknown=true` passed. `git diff --check` passed.
- Residual risk: The currently live AWS and GitHub Pages manifests still reflect the previously deployed artifact, so both check-mode publish plans show real updates waiting to be applied from the local fixed build. The GitHub Actions-side AWS job gating fix also exists only in the local workflow file until these changes are pushed. A final remote no-op/green run therefore still requires committing and pushing this batch, or explicitly applying the current local artifacts again.

- [x] Replace raw URL-keyed `data/cache/content-images.json` entries with stable slot keys covering link image fields and site SEO image fields.
- [x] Move volatile content-image fetch provenance into the runtime manifest only, and switch runtime/validation/SEO resolution onto slot-based lookups.
- [x] Add focused slot-resolution tests, regenerate the committed content-image manifest, and rerun validation/build verification.

- [x] Add an AWS canonical deployment target for `openlinks.us` while keeping GitHub Pages as a noindex mirror and fork-safe default.
- [x] Build the deploy script stack (`deploy:build`, setup/bootstrap/publish/verify) with check-mode idempotency, artifact manifests, and summary logs.
- [x] Rewire CI and production deploy workflows to hand off AWS/Pages artifacts, gate AWS behind explicit opt-in config, and document the new contract.

- [x] Make strict validation treat complete stale `public_cache` reuse as non-strict-blocking while keeping real enrichment failures strict-failing.
- [x] Fix strict CI follow-up handling so warning-summary/artifact steps run after `run_strict` fails and `quality:strict` is skipped when `build:strict` aborts.
- [x] Add focused validation/CI tests and rerun the targeted strict-lane verification commands.

### Completion Review

- Result: The tracked content-image cache now uses deterministic `bySlot` entries instead of volatile `byUrl` keys, with slot ids like `link:<id>:image` and `site:seo:defaults:ogImage`. Volatile fetch metadata now lives only in `data/cache/content-images.runtime.json`, the sync pipeline computes effective image slots from the same merge/normalization logic the app uses, runtime link image localization resolves by slot, SEO image resolution now receives slot context, and preview-image validation now checks slot materialization rather than raw remote URL presence.
- Verification: `bun test scripts/sync-content-images.test.ts scripts/validate-data.test.ts src/lib/content/load-content.test.ts src/lib/seo/resolve-seo-metadata.test.ts` passed. `bun run typecheck` passed. `bun run biome:check` passed. `bun run validate:data` passed. `bun run build` passed after rerunning the full prebuild path (`avatar:sync`, `enrich:rich:strict`, `images:sync`, `validate:data`). `git diff --check` passed.
- Residual risk: The first migration run rewrote `data/cache/content-images.json` from `byUrl` to `bySlot`, so the committed diff is intentionally large once. Future churn from rotating signed social CDN URLs should now stay in the untracked runtime manifest, but the slot collector still emits separate stable entries when multiple effective fields intentionally point at the same remote image.

- Result: OpenLinks now has a first-class AWS deployment path for `openlinks.us` plus a GitHub Pages mirror path, both built from target-aware artifacts under `.artifacts/deploy/`. The repo now includes deploy config helpers, deploy manifests and integrity assertions, AWS bootstrap/publish/setup scripts, GitHub Pages deployment helpers, production workflow rewiring, nightly direct deploy parity for bot-authored pushes, and docs/OpenClaw contract updates that treat AWS as canonical and Pages as the mirror.
- Verification: `bun run test:deploy` passed. `bun run typecheck` passed. `bun run biome:check` passed after ignoring generated deploy artifacts/logs in Biome config. `bun run deploy:build` passed and wrote summaries under `.codex/logs/deploy/`. `bun run deploy:pages:plan --artifact=.artifacts/deploy/github-pages` passed and reported a changed mirror artifact. `bun run deploy:setup` passed in check mode. `git diff --check` passed.
- Residual risk: `bun run deploy:aws:bootstrap` and `bun run deploy:aws:publish --artifact=.artifacts/deploy/aws` now fail fast in check mode because the live CloudFormation stack is currently `REVIEW_IN_PROGRESS`; I tightened check-mode waits to 15 seconds so these commands emit explicit stack-readiness summaries instead of hanging for 30 minutes. I did not run remote GitHub Actions end-to-end from this workspace, so workflow behavior is verified by local script execution, artifact generation, and static workflow review rather than a fresh upstream run.

- Result: `validate:data:strict` now treats complete stale committed `public_cache` reuse as warning-only, exports the enrichment-classification helper for direct unit coverage, and leaves real enrichment failures strict-failing. The strict CI wrapper now skips `quality:strict` after `build:strict` fails, and the workflow follow-up steps use explicit failure guards so warning summaries, raw-log replay, and artifact upload can actually run on strict-lane failures.
- Verification: `bun test scripts/validate-data.test.ts scripts/github-actions/ci.test.ts` passed. `bun run validate:data:strict` passed. `bun run build:strict` passed. `bash scripts/github-actions/ci.sh run-strict` reached `quality:strict` only after a successful `build:strict`, then failed solely on the existing mobile performance strictness (`totalBytes` and `jsBytes`). `bun run typecheck` passed. `bunx @biomejs/biome check .codex/tasks/todo.md .github/workflows/ci.yml docs/data-model.md docs/deployment.md scripts/github-actions/ci.sh scripts/github-actions/ci.test.ts scripts/validate-data.test.ts scripts/validate-data.ts --files-ignore-unknown=true` passed for the checkable files. `git diff --check` passed.
- Residual risk: I did not rerun GitHub Actions itself from this workspace, so the fixed strict follow-up workflow conditions are verified by static review plus the local wrapper test rather than a fresh remote run. The strict lane still legitimately fails on the current mobile performance warning thresholds once build succeeds.

- [x] Add a committed `data/policy/remote-cache-policy.json` registry and `schema/remote-cache-policy.schema.json`, then centralize cache-check policy resolution for all cache-backed fetch pipelines.
- [x] Refactor content-image sync, profile-avatar sync, public rich-metadata fetches, and authenticated asset downloads onto one shared domain-scoped revalidation helper with a clean-break policy coverage requirement.
- [x] Migrate avatar cache persistence to committed `data/cache` / `public/cache` paths, extend validator persistence for clean-clone revalidation, and update validation/audits/docs/skills/tests to match the new model.

### Completion Review

- Result: The repo now has a single committed domain-scoped cache revalidation registry in `data/policy/remote-cache-policy.json`, a shared `remote-cache-fetch` engine for policy-driven `HEAD`/conditional-`GET`/always-`GET` behavior, committed validator persistence for content images and public rich metadata, and a clean-break avatar cache flow rooted at `data/cache/profile-avatar.json` and `public/cache/profile-avatar/*`. Validation now fails when a cache-backed remote domain lacks explicit policy coverage, the authenticated asset download path routes through the same policy resolver, and the nightly workflow uploads cache-revalidation summaries from `output/cache-revalidation/*`.
- Verification: `bun test scripts/shared/remote-cache-policy.test.ts scripts/shared/remote-cache-fetch.test.ts scripts/enrichment/fetch-metadata.test.ts scripts/sync-content-images.test.ts scripts/sync-profile-avatar.test.ts scripts/enrichment/public-cache.test.ts scripts/fetch-cache-audit.test.ts scripts/validate-data.test.ts` passed. `bun run typecheck` passed. `bun run enrich:rich:strict:write-cache` passed. `bun run avatar:sync` passed. `bun run images:sync` passed. `bun run validate:data` passed. `bun run build` passed. `bun run quality:check` passed with the existing warning-level SEO/performance items. `bun run biome:check` passed.
- Residual risk: `authenticated_asset_images` now uses the shared policy model but still defaults to `always_get`, so the authenticated cache path has policy coverage and validator fields without yet taking a bandwidth win. Public-cache stable writes also remain explicit, so clean clones reuse committed validators but will not see unstaged metadata drift until a write-cache refresh persists it.

- [x] Remove the legacy `data/generated/content-images.json` compatibility path from runtime loading and validation so committed cache artifacts are the only supported content-image manifest.
- [x] Update diagnostics and test fixtures to use `cache/content-images` terminology instead of the old `generated/images` path.
- [x] Re-run focused cache checks plus build/quality verification to confirm the clean-break image-cache flow.

### Completion Review

- Result: The content-image pipeline now has a single supported storage model. Runtime loading reads only `data/cache/content-images.json`, validation no longer accepts `data/generated/content-images.json`, perf diagnostics now inspect `dist/cache/content-images`, and the repo test fixtures no longer present `generated/images` as a current path convention.
- Verification: `bun test scripts/sync-content-images.test.ts scripts/validate-data.test.ts src/lib/ui/social-profile-metadata.test.ts src/lib/ui/rich-card-footer-labels.test.ts src/lib/ui/rich-card-description-sourcing.test.ts src/components/cards/social-profile-card-rendering.test.tsx src/components/cards/non-payment-card-accessibility.test.tsx scripts/enrichment/supported-social-profile-metadata.test.ts` passed. `bun run typecheck` passed. `bun run images:sync` passed. `bun run validate:data` passed. `bun run build` passed. `bun run quality:check` passed with the existing warning-level SEO/performance items.
- Residual risk: The pipeline no longer tolerates stale legacy manifests, so anyone with old local-only `data/generated/content-images.json` state must refresh through `bun run images:sync`. That is the intended break, but it raises the cost of partially updated local worktrees until the new cache files are present.

- [x] Move rich-link image localization from the gitignored `data/generated` / `public/generated` cache into a committed stable cache with a gitignored runtime overlay.
- [x] Update validation/runtime loading plus maintainer workflows/docs so future link updates commit cached image assets by default.
- [x] Verify with focused image-cache tests, rich-link validation/build checks, and a diff review that the Bright Builds Facebook card now persists a local cached image in-repo.

### Completion Review

- Result: `images:sync` now writes stable committed cache artifacts to `data/cache/content-images.json` and `public/cache/content-images/*`, while volatile revalidation headers/status live in the new gitignored `data/cache/content-images.runtime.json` overlay. Runtime loading and validation now prefer the committed cache path, the Bright Builds Facebook page remains a manual rich card, and the repo-native CRUD/docs flow now tells maintainers and agents to refresh and commit cached image assets in the same change batch as link edits.
- Verification: `bunx @biomejs/biome check scripts/sync-content-images.ts scripts/validate-data.ts src/lib/content/load-content.ts scripts/fetch-cache-audit.test.ts scripts/validate-data.test.ts README.md docs/quickstart.md docs/data-model.md docs/openclaw-update-crud.md docs/ai-guided-customization.md skills/cache-rich-link-assets/SKILL.md .codex/tasks/todo.md .gitignore --write --files-ignore-unknown=true` passed. `bun test scripts/sync-content-images.test.ts scripts/validate-data.test.ts scripts/fetch-cache-audit.test.ts src/lib/identity/handle-resolver.test.ts src/lib/content/social-profile-fields.test.ts src/lib/ui/social-profile-metadata.test.ts scripts/authenticated-extractors/plugins/facebook-auth-browser.test.ts` passed. `bun run typecheck` passed. `bun run images:sync` created the committed stable cache. `bun run validate:data` passed. `bun run build` passed. `bun run quality:check` passed with the existing warning-level SEO/performance items.
- Residual risk: Manual rich links that point at expiring signed remote image URLs still depend on those URLs being refreshable by `images:sync` when bytes eventually drift. The committed cache now protects runtime rendering and git history, but the source URL itself can still expire and may need future recapture or authenticated extraction if the platform stops serving the image publicly.

- [x] Add an explicit `--write-public-cache` path plus runtime-only public-cache persistence helpers so routine `enrich:rich*` runs stop rewriting `data/cache/rich-public-cache.json`.
- [x] Refactor rich-enrichment persistence, nightly workflow wiring, and operator messaging/docs so stable public-cache writes happen only through explicit refresh commands.
- [x] Verify with focused public-cache/audit tests, `bun run typecheck`, `bun run validate:data`, and a temp-cache diff run covering read-only vs write-cache behavior.

### Completion Review

- Result: Routine `bun run enrich:rich` / `bun run enrich:rich:strict` runs now keep `data/cache/rich-public-cache.json` unchanged by default and only update the gitignored runtime overlay. Explicit stable refreshes now flow through `bun run enrich:rich:write-cache`, `bun run enrich:rich:strict:write-cache`, and the nightly follower-history workflow, while suppressed stable updates clear runtime freshness so stale committed metadata is never treated as fresh.
- Verification: `bunx @biomejs/biome check scripts/enrichment/public-cache.ts scripts/enrich-rich-links.ts scripts/enrichment/public-cache.test.ts scripts/fetch-cache-audit.test.ts --write --files-ignore-unknown=true` passed. `bun test scripts/enrichment/public-cache.test.ts scripts/fetch-cache-audit.test.ts` passed. `bun run typecheck` passed. `bun run validate:data` passed. A temp-cache verification seeded from `HEAD:data/cache/rich-public-cache.json` showed `bun scripts/enrich-rich-links.ts --strict` preserved the stable-cache hash exactly, while `bun scripts/enrich-rich-links.ts --strict --write-public-cache` updated the temp manifest for `github` follower drift (`90 -> 91`), proving the explicit write path still persists material changes.
- Residual risk: The temp-cache diff check covered only the `github` link rather than every public-enrichment target, and I did not execute the full nightly workflow end-to-end in GitHub Actions. The current repo still has an unrelated local modification in `data/cache/rich-public-cache.json`, which I left untouched.

## Recently Completed

- [x] Add Club Orange as a public-direct rich profile link with known-site/icon/handle support instead of a new authenticated extractor.
- [x] Add the required remote-cache policy coverage plus committed localized image-cache artifacts for the Club Orange profile avatar.
- [x] Verify the Club Orange path with focused tests, lint/typecheck, rich-enrichment validation, and a production build.

### Completion Review

- Result: Club Orange now uses the repo’s `public_direct` path rather than an authenticated extractor. The change batch added a new `cluborange` rich link for `https://app.cluborange.org/pryszkie`, wired Club Orange into known-site branding/icon resolution, taught handle/social-profile detection to recognize `app.cluborange.org/<handle>` URLs, added remote-cache policy coverage for both the profile host and the S3 avatar host, updated the extractor workflow docs to classify Club Orange as `public_direct`, and committed the localized Club Orange avatar image slot in the stable content-image cache.
- Verification: `bun test src/lib/identity/handle-resolver.test.ts src/lib/content/social-profile-fields.test.ts src/lib/ui/social-profile-metadata.test.ts src/lib/ui/rich-card-footer-labels.test.ts` passed. `bun run biome:check` passed after `bun install`. `bun run typecheck` passed after `bun install`. `bun run enrich:rich:strict` passed and reported `cluborange: fetched (metadata_complete) [HTTP 200]`. `bun run validate:data` passed. `bun run build` passed and localized the Club Orange avatar into `public/cache/content-images/cc3b5c595c6218df99ba85990fd8ff94edbd13d58ecadbe073716a06febaf9d7.jpg`.
- Residual risk: Club Orange’s public profile page currently exposes title, bio, and avatar fields but not stable public audience metrics, so this support is intentionally avatar/title/bio-first unless the platform later adds a public follower-count source.

- [x] Add `@kobalte/core` and build one shared dialog wrapper for the public-site modal surfaces.
- [x] Migrate the payment QR fullscreen and follower-history analytics modals onto the shared wrapper without changing their controlled open-state seams.
- [x] Verify Phase 14 with focused dialog/payment/share regressions, `bun run biome:check`, `bun run typecheck`, `bun run build`, and a built-preview analytics modal browser check.

### Completion Review

- Result: Phase 14 is fully implemented. The public site now uses a shared `AppDialog` wrapper backed by `@kobalte/core`, the payment QR fullscreen modal and the follower-history modal no longer maintain their own duplicated `<dialog>` plumbing, and the existing route/card controlled-state seams remain intact. Shared dialog shell styles now sit under `app-dialog` overlay/positioner/content hooks, with the existing analytics/payment classes layered on top.
- Verification: `bun test src/components/dialog/AppDialog.test.tsx src/components/analytics/FollowerHistoryModal.test.tsx src/components/cards/PaymentLinkCard.test.tsx src/lib/share/share-link.test.ts src/lib/ui/action-toast.test.ts src/components/profile/ProfileHeader.test.tsx src/components/cards/non-payment-card-accessibility.test.tsx`, `bun run biome:check`, `bun run typecheck`, and `bun run build` all passed. A Playwright built-preview check of `http://127.0.0.1:4173/` then opened the GitHub analytics modal, confirmed one overlay/positioner/content stack, and verified the modal still fit within a `390x844` viewport after resizing. The current dataset exposes zero payment cards, so direct browser verification for payment fullscreen was not possible in this run and stayed covered by the focused automated tests.
- Residual risk: Adding `@kobalte/core` increases the main route bundle, and the live dataset still lacks a payment-card browser verification target. If future work adds payment cards back to the public dataset or introduces more dialog surfaces, it should recheck the dialog bundle impact and add a live browser verification path for payment fullscreen.

- [x] Research Phase 14's dialog-library fit, current modal seams, and the safest migration order for the public-site dialogs.
- [x] Create Phase 14 research plus the execution plans for shared dialog-shell setup, payment fullscreen migration, and analytics modal migration.
- [x] Update planning state so Phase 14 is marked planned and ready for `$gsd-execute-phase 14`.

### Completion Review

- Result: Added `.planning/phases/14-refactor-dialogs-to-use-a-modal-library/14-RESEARCH.md` plus three execution plans. Wave 1 adopts `@kobalte/core` and builds a shared dialog shell, Wave 2 migrates the simpler payment QR fullscreen flow, and Wave 3 migrates the follower-history modal while preserving the lazy chart route flow. `.planning/ROADMAP.md` and `.planning/STATE.md` now mark Phase 14 as planned and ready for execution.
- Verification: Reviewed the current modal components, route/card open-state seams, dialog styling hooks, the Kobalte and Ark UI official dialog docs, current npm metadata for both libraries, and the resulting planning-state diff to confirm the phase stays scoped to replacing duplicated dialog mechanics rather than reopening the entire UI system.
- Residual risk: Phase 14 adds another runtime dependency to a route that already carries known `/` bundle-budget debt, and it currently assumes `@kobalte/core` is the lowest-risk dialog choice. If execution reveals integration blockers or larger-than-expected bundle impact, the next pass may need to reassess the library choice or split the analytics modal migration further.
