# Phase 14: Refactor Dialogs to Use a Modal Library - Research

**Researched:** 2026-03-11
**Domain:** SolidJS dialog-library adoption for the existing analytics and payment fullscreen modals
**Confidence:** HIGH

## User Constraints

### Locked Decisions
- Replace the current custom modal/dialog implementation with a library-backed solution.
- Preserve the existing follower-history modal flow and the payment QR fullscreen flow.
- Keep the migration scoped to dialogs/modals; do not turn this into a broader public-site component-system rewrite.

### Claude's Discretion
- Exact dialog library choice for the public site.
- Whether to migrate both existing dialogs directly or introduce a shared wrapper layer first.
- How much existing CSS can be preserved versus restyled around the library's portal/overlay/content anatomy.
- What regression coverage should be added for focus restoration, close behavior, and overlay interactions.

### Deferred Ideas (Out of Scope)
- Replacing `solid-sonner` so dialogs and toasts live under one unified library.
- Refactoring the broader card/action layout or analytics page structure.
- Converting dialog launch state into router URLs or cross-page navigation.

## Summary

Phase 14 should be implemented as a **headless-dialog migration**, not a visual redesign:

1. Add one Solid-native dialog primitive library.
2. Introduce a shared wrapper/anatomy layer for the public site's modal surfaces.
3. Migrate the simpler payment QR fullscreen dialog first, then migrate the analytics/follower-history dialog, and finally add regression coverage plus built-preview verification.

Primary recommendation:

- Use `@kobalte/core`.
- Keep `solid-sonner` for toasts.
- Create a small shared dialog shell so the analytics and payment modals stop reimplementing focus trapping, scroll locking, escape handling, and outside-click dismissal.

## Library Recommendation

### Chosen for Phase 14

| Tool/Surface | Purpose | Why It Fits |
|--------------|---------|-------------|
| `@kobalte/core` (`0.13.11`, about `150.9k` weekly npm downloads as checked 2026-03-11) | Headless Solid-native dialog primitives | Solid-specific, unstyled, comparatively lighter dependency footprint than Ark UI, and its dialog docs explicitly cover focus trap, scroll lock, portal/overlay/content anatomy, escape handling, outside interaction hooks, and controlled open state. |
| Existing `solid-sonner` | Keep toast delivery unchanged | Already added in Phase 13. Replacing it just to converge libraries would expand scope with little Phase 14 value. |
| One shared dialog shell in `src/components/dialog/` or `src/lib/ui/` | Prevent modal duplication | Lets both modal surfaces share portal/overlay/content/focus behavior while preserving local content/layout differences. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@kobalte/core` | `@ark-ui/solid` (`5.34.1`, about `25.9k` weekly npm downloads checked 2026-03-11) | Ark UI is strong and modern, but it brings a broader, heavier state-machine-based dependency graph (about 65 package dependencies in current npm metadata) than this repo needs for two modal surfaces. |
| Headless dialog primitives | Keep the custom `<dialog>` + focus-trap code | Maintains duplicated event handling, focus management, and body-scroll locking in two places. |
| Scoped dialog migration | Full public-site primitive-system adoption | Too much scope for a follow-up phase that only needs to replace two custom dialogs. |

## Relevant Official Findings

### `@kobalte/core`

From the current Kobalte dialog docs and npm metadata checked on 2026-03-11:

- Dialogs follow the WAI-ARIA dialog pattern.
- Modal and non-modal modes are supported.
- Focus is trapped and scrolling is blocked while open.
- Escape closes the dialog.
- Controlled `open` / `onOpenChange` flows are supported.
- The anatomy directly maps to what this repo needs: `Trigger`, `Portal`, `Overlay`, `Content`, `CloseButton`, `Title`, and `Description`.

This is almost a one-to-one replacement for the current custom requirements.

### `@ark-ui/solid`

Ark UI also supports:

- controlled open state,
- `lazyMount`,
- initial/final focus hooks,
- outside-interaction control,
- and proper focus trap behavior.

It remains a valid fallback if Kobalte integration hits a blocker, but it is not the most conservative choice for this repo.

## Architecture Patterns

### Pattern 1: Shared Dialog Shell Before Surface Migration

The current modal components duplicate the same low-level behavior:

- `Escape` handling
- focus trapping via `Tab` cycling
- restoring previous focus on close
- `document.body.style.overflow = "hidden"`
- outside-click/backdrop dismissal

Phase 14 should extract a shared shell around the chosen library primitives before migrating both modal surfaces fully. Otherwise the first migrated modal will diverge from the second.

### Pattern 2: Migrate Payment QR First

`PaymentQrFullscreen.tsx` is the lower-risk dialog:

- fewer controls,
- no lazy chart,
- no time-range/mode toggles,
- and no analytics-specific layout behavior.

This makes it the best first migration target for proving the shared dialog shell, overlay styling, and focus-return behavior.

### Pattern 3: Keep Route/Card State Management Controlled

The current open state is already controlled correctly:

- analytics modal: `selectedHistoryLinkId` in `src/routes/index.tsx`
- payment fullscreen modal: `fullscreenRailId` in `src/components/cards/PaymentLinkCard.tsx`

Phase 14 should keep those controlled signals and map them onto library-backed `open` / `onOpenChange` APIs, not re-architect the state model.

### Pattern 4: Preserve Existing Visual Language Where Reasonable

The repo already has modal-specific classes and responsive rules:

- `.analytics-modal-*`
- `.payment-qr-fullscreen-*`

The migration should preserve those classes or adapt them narrowly so the UI looks stable while the behavior layer changes underneath.

## Current Code Seams

### Analytics Modal

`src/components/analytics/FollowerHistoryModal.tsx` currently owns:

- custom `HTMLDialogElement` refs,
- manual `keydown` handling for `Escape` and `Tab`,
- manual body scroll locking,
- explicit backdrop pointer-down dismissal,
- and close-button focus restoration.

This is the most behavior-heavy surface and the best place to validate the library-backed modal after the simpler payment case lands.

### Payment Fullscreen Modal

`src/components/payments/PaymentQrFullscreen.tsx` duplicates the same dialog plumbing with a simpler payload:

- one close button,
- one QR surface,
- one responsive size signal.

This should be the first migrated consumer of the shared shell.

### Styling

The current CSS already separates the two dialog surfaces:

- `src/styles/base.css` has dedicated analytics modal and payment fullscreen selectors.
- `src/styles/responsive.css` has mobile-specific modal sizing overrides.

That means the migration can keep visual selectors stable even if the rendered element changes from native `<dialog>` to library-managed `<div>` content.

### Tests

There is currently little to no dialog-specific regression coverage:

- payment card tests exist,
- card/action tests exist,
- but no focused tests assert modal anatomy, overlay presence, open/close semantics, or focus-return behavior.

Phase 14 should add that coverage instead of relying only on build success.

## Common Pitfalls

### Pitfall 1: Migrate one modal ad hoc and leave the other custom
**What goes wrong:** the repo ends up with two dialog systems and duplicated styling/integration work.
**How to avoid:** add a shared dialog shell first, then migrate both consumers through it.

### Pitfall 2: Lose focus-return semantics during migration
**What goes wrong:** closing the modal no longer returns focus to the analytics/share/fullscreen trigger that opened it.
**How to avoid:** explicitly test focus-return behavior or preserve trigger-driven controlled flows with the library's close auto-focus behavior.

### Pitfall 3: Portal content breaks existing z-index or mobile layout
**What goes wrong:** the modal renders under the top utility bar, over the toast layer incorrectly, or with broken width constraints on mobile.
**How to avoid:** verify desktop/mobile built previews and keep the current modal class hooks aligned with the portal content and overlay.

### Pitfall 4: Lazy chart/modal mounting regresses analytics performance
**What goes wrong:** the follower-history modal or chart starts mounting more aggressively and increases baseline route cost.
**How to avoid:** keep the existing lazy chart boundary intact and use the library's lazy-mount/controlled-open support where appropriate.

### Pitfall 5: Outside-click behavior changes unexpectedly
**What goes wrong:** clicking the overlay stops closing, or inner-content clicks start dismissing the dialog.
**How to avoid:** map the current backdrop dismissal semantics explicitly to the library's overlay/outside interaction hooks.

## Open Questions

1. **Should Phase 14 also replace the toast library for convergence?**
   - Recommendation: no.
   - Reason: the Phase 13 toast work is fresh, working, and unrelated to the dialog replacement goal.

2. **Should the library migration preserve the existing modal class names?**
   - Recommendation: yes where practical.
   - Reason: that keeps the visual diff small and reduces CSS churn.

3. **Should the analytics modal stay lazy-loaded?**
   - Recommendation: yes.
   - Reason: Phase 11 explicitly accepted a large chart chunk and kept it lazy to protect route cost.

4. **Should the payment and analytics modals share one wrapper?**
   - Recommendation: yes.
   - Reason: their duplicated focus/scroll/escape/outside-click logic is the clearest duplication this phase should remove.

## Sources

### Primary (HIGH confidence)
- [Kobalte Dialog docs](https://kobalte.dev/docs/core/components/dialog/)
- [Ark UI Dialog docs](https://ark-ui.com/docs/components/dialog)
- npm metadata for `@kobalte/core` and `@ark-ui/solid` checked on 2026-03-11
- `src/components/analytics/FollowerHistoryModal.tsx`
- `src/components/payments/PaymentQrFullscreen.tsx`
- `src/components/cards/PaymentLinkCard.tsx`
- `src/routes/index.tsx`
- `src/styles/base.css`
- `src/styles/responsive.css`
- `package.json`

### Secondary (MEDIUM confidence)
- `.planning/phases/13-replace-inline-action-feedback-with-toasts/13-RESEARCH.md`
- `.planning/phases/13-replace-inline-action-feedback-with-toasts/13-01-PLAN.md`
- `.planning/phases/13-replace-inline-action-feedback-with-toasts/13-02-PLAN.md`

## Metadata

**Research scope:** current custom modal duplication, Solid-native dialog library fit, migration order, and regression strategy

**Confidence breakdown:**
- Library choice for this repo: HIGH
- Current modal seam analysis: HIGH
- Three-wave migration order: HIGH
- Exact styling adaptation work: MEDIUM

**Research date:** 2026-03-11
**Valid until:** 2026-04-11

---

*Phase: 14-refactor-dialogs-to-use-a-modal-library*
*Research completed: 2026-03-11*
*Ready for planning: yes*
