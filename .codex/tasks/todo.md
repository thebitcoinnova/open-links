# Todo

## Current

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
