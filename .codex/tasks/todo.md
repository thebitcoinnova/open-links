# Todo

## Current

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
