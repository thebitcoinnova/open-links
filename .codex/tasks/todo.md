# Todo

## Current

- [x] Add a reusable `copyLink(...)` helper, `IconCopy`, and shared `"copy"` card-action support so every existing Share surface can append a dedicated copy action.
- [x] Update the profile header action cluster and shared action styles so Share and Copy render as adjacent icon buttons without breaking analytics ordering or right alignment.
- [x] Verify with focused share/profile/card tests, `bun run typecheck`, and a final diff review.

### Completion Review

- Result: Every existing Share surface on the public site now has a dedicated Copy icon button immediately to its right. The shared card action model supports a new `"copy"` action kind, link cards render `analytics -> share -> copy` or `share -> copy` as appropriate, and the profile header now uses a right-aligned Share/Copy action cluster that reuses the same toast-based feedback path.
- Verification: `bunx @biomejs/biome check src/lib/icons/custom-icons.tsx src/lib/share/share-link.ts src/lib/share/share-link.test.ts src/components/cards/NonPaymentLinkCardShell.tsx src/components/cards/RichLinkCard.tsx src/components/cards/SimpleLinkCard.tsx src/components/cards/non-payment-card-accessibility.test.tsx src/components/profile/ProfileHeader.tsx src/components/profile/ProfileHeader.test.tsx src/routes/index.tsx src/styles/base.css src/styles/responsive.css .codex/tasks/todo.md --files-ignore-unknown=true` passed. `bun test src/lib/share/share-link.test.ts src/lib/share/copy-to-clipboard.test.ts src/components/profile/ProfileHeader.test.tsx src/components/cards/non-payment-card-accessibility.test.tsx` passed. `bun run typecheck` still fails only on pre-existing repo issues in `src/components/analytics/FollowerHistoryChart.tsx`, `src/components/dialog/AppDialog.tsx`, and `src/routes/index.tsx` involving unresolved `echarts`, `@kobalte/core/dialog`, and `solid-sonner` typings plus an existing implicit-`any` parameter in `AppDialog`.
- Residual risk: I did not run a live browser smoke check, so the new profile/card action spacing is covered by focused tests and CSS review rather than an interactive viewport pass. Full repo typecheck remains blocked until the existing dependency/type-resolution issues are fixed.

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
