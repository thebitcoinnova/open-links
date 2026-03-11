# Phase 13: Replace Inline Action Feedback with Toasts - Research

**Researched:** 2026-03-11
**Domain:** SolidJS-compatible toast delivery, current OpenLinks action-feedback seams, and the lightest path to replace inline share/copy status UI
**Confidence:** HIGH

## User Constraints

### Locked Decisions
- Replace the public site's short-lived share/copy feedback with toast notifications instead of inline status copy.
- Keep the current custom dialog/modal surfaces in place for now.
- Favor the smallest SolidJS-compatible library addition that solves toast delivery cleanly.
- Preserve the existing share semantics: native Web Share first, clipboard fallback second, and no noisy toast when the native sheet is dismissed.

### Claude's Discretion
- Exact toast host placement inside the public-site shell.
- Whether payment-rail copy feedback should join the same toast pattern in this phase.
- Whether clipboard behavior should stay embedded in `share-link.ts` or move into a reusable helper.
- Exact toast styling hooks and whether the library's default palette is overridden through local CSS classes or theme props.

### Deferred Ideas (Out of Scope)
- Replacing the analytics and payment fullscreen dialogs with a new dialog primitive library.
- Introducing a broader component system for the public site or Studio.
- Converting persistent informational live regions like the utility-bar pills into toast notifications.

## Summary

Phase 13 should be implemented as a **small feedback-infrastructure upgrade**, not as a UI-system rewrite:

1. Add a single SolidJS toast host to the public-site shell.
2. Route share and copy action results through a shared toast helper instead of per-component timers and inline `<output>` elements.
3. Normalize the remaining copy surface (`PaymentLinkCard`) onto the same clipboard and toast path so feedback stops drifting between share and copy interactions.

Primary recommendation:

- Use `solid-sonner` for this phase.
- Mount one global `Toaster` in the public route shell instead of introducing a broader primitive library.
- Keep `@kobalte/core` as the future choice only if a later phase decides to standardize dialogs and toasts together.

## Stack Recommendation

### Chosen for Phase 13

| Tool/Surface | Purpose | Why It Fits |
|--------------|---------|-------------|
| `solid-sonner` (`0.3.1` as checked 2026-03-11) | Public-site toast delivery | Solid-specific, current, lightweight relative to broader UI primitive suites, and exposes the small `Toaster` + `toast(...)` API surface this repo needs. |
| Existing `shareLink(...)` result contract | Keeps share behavior centralized | The helper already returns typed `shared` / `copied` / `dismissed` / `failed` results, which is a good seam for toast mapping. |
| One new shared toast helper under `src/lib/ui/` | Keeps presentation mapping consistent | Prevents `ProfileHeader`, `NonPaymentLinkCardShell`, and payment rails from each inventing their own status timers or copy. |
| One shared clipboard helper under `src/lib/share/` | Reuse between share fallback and payment-rail copy | Removes the current mismatch where share fallback has a textarea backup path but payment rails only try `navigator.clipboard.writeText(...)`. |

### Deferred but Relevant

| Tool/Surface | Purpose | Why Deferred |
|--------------|---------|--------------|
| `@kobalte/core` | Future toast + dialog standardization | Strong fit for both toast and dialog, but Phase 13 only needs toast delivery and the repo is already carrying `/` bundle-budget debt. |
| `@ark-ui/solid` | Larger cross-framework primitive set | Useful if the project later needs a broad primitive system, but heavier than necessary for this phase. |
| `solid-toast` | Alternate Solid-only toast library | Viable, but `solid-sonner` is more current and closer to the polished toast UX already common across modern app surfaces. |

## Architecture Patterns

### Pattern 1: One Toast Host at the Public-Site Shell

`src/routes/index.tsx` is the best mount point for a global toaster because:

- it is already the only public app shell,
- it owns the current light/dark mode signal,
- and it avoids changing Studio packages or introducing a second shell component just for toast delivery.

This phase should add one `Toaster` there, not scatter per-component toast providers.

### Pattern 2: Result-to-Toast Mapping, Not Per-Component Timers

Current share/card surfaces hold local timer state and inline `<output aria-live="polite">` elements. Phase 13 should replace that with a helper that:

- ignores `dismissed` results,
- maps `shared` / `copied` to success/info toasts,
- maps `failed` to an error toast,
- and keeps message wording consistent.

That keeps the share helper unchanged as the source of truth for share outcomes while moving ephemeral UI presentation into one place.

### Pattern 3: Shared Clipboard Primitive for Share Fallback and Payment Copy

`share-link.ts` already has the stronger clipboard fallback path:

- `navigator.clipboard.writeText(...)` when available,
- hidden textarea + `document.execCommand("copy")` fallback otherwise.

`PaymentLinkCard.tsx` currently has a weaker copy path that only tries `navigator.clipboard` and then silently ignores failure. Phase 13 should extract one clipboard helper and reuse it for both share fallback and payment-rail copy.

### Pattern 4: Remove Old Inline Status Surfaces Once Migration Is Complete

After migrating toasts:

- `ProfileHeader.tsx` should not render `.profile-share-status`.
- `NonPaymentLinkCardShell.tsx` should not render `.non-payment-card-action-status`.
- `PaymentLinkCard.tsx` should no longer swap the visible button label between `Copy` and `Copied`.

The utility-bar `utility-pill` live regions stay, because they communicate current page state rather than transient action feedback.

## Current Code Seams

### Inline Share/Card Feedback

- `src/components/profile/ProfileHeader.tsx` keeps a `shareStatus` signal, a reset timer, and an inline `<output class="profile-share-status">`.
- `src/components/cards/NonPaymentLinkCardShell.tsx` keeps `actionStatus`, a reset timer, and an inline `<output class="non-payment-card-action-status">`.

These are the primary Phase 13 migration targets.

### Payment Copy Feedback

- `src/components/cards/PaymentLinkCard.tsx` tracks `copiedRailId` and temporarily changes button text from `Copy` to `Copied`.
- There is no shared clipboard helper and no focused payment-copy regression file yet.

This is the right adjacent surface to normalize in Wave 2.

### Toast Host Placement

- `src/main.tsx` only bootstraps `RouteIndex`.
- `src/routes/index.tsx` already owns the public app shell and the current UI mode signal.

That makes `RouteIndex` the preferred host for `solid-sonner` so the toast theme and placement can stay aligned with the existing public-site shell.

### Existing Tests

- `src/lib/share/share-link.test.ts` already proves the share result contract and fallback semantics.
- `src/components/profile/ProfileHeader.test.tsx` already guards button ordering.
- `src/components/cards/non-payment-card-accessibility.test.tsx` already guards action-row semantics and share/analytics ordering.

Phase 13 should add focused helper tests rather than force all toast behavior to be proven through full DOM integration tests.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast lifecycle and stacking | Custom signal/timer queue in each component | `solid-sonner` `Toaster` + `toast(...)` | The repo only needs reliable transient notifications, not another local feedback framework. |
| Duplicate clipboard logic | Separate copy implementations in share and payment card code | Shared clipboard helper | Keeps fallback behavior and failure handling aligned. |
| Modal standardization in the same phase | Toast + dialog migration together | Toast-only phase now; dialog migration later if needed | Prevents scope creep and avoids adding a broader primitive library before it is justified. |
| Converting every live region into toast | Utility/status pills and persistent state banners | Keep non-action status where it already belongs | Toasts are for transient action feedback, not page configuration state. |

## Common Pitfalls

### Pitfall 1: Toast host mounted too low in the tree
**What goes wrong:** share/copy handlers fire before the active surface is mounted, or the toast theme drifts from the page shell.
**How to avoid:** mount one global `Toaster` in `RouteIndex`, not inside a card or action-row component.

### Pitfall 2: Native-share dismissals produce noisy feedback
**What goes wrong:** cancelling the native share sheet shows a failure toast even though the user intentionally dismissed it.
**How to avoid:** keep `dismissed` silent in the shared toast-mapping helper.

### Pitfall 3: Share fallback and payment copy still diverge
**What goes wrong:** one surface supports insecure-context fallback and the other silently fails.
**How to avoid:** extract one clipboard helper and make both flows call it.

### Pitfall 4: Toast styling ignores current site mode and overlaps existing chrome
**What goes wrong:** default toast styling clashes with the site theme or crowds the sticky top utility bar on mobile.
**How to avoid:** configure `Toaster` placement intentionally and add a small OpenLinks-specific toast class layer in the existing CSS files.

### Pitfall 5: Tests only prove the helper, not the migrated surfaces
**What goes wrong:** helper tests pass, but components still keep stale inline status markup or local timer state.
**How to avoid:** add focused structural regressions that prove the inline status nodes are removed and the action semantics stay intact.

## Open Questions

1. **Should payment-rail copy join the same toast pattern now?**
   - Recommendation: yes.
   - Reason: it is the remaining transient copy-feedback surface on the public site and currently has the weakest clipboard fallback implementation.

2. **Should the Toaster live in `main.tsx` or `RouteIndex`?**
   - Recommendation: `RouteIndex`.
   - Reason: it keeps the toast host aligned with the public shell and the existing mode signal.

3. **Should utility-bar `utility-pill` live regions be converted to toasts too?**
   - Recommendation: no.
   - Reason: those are persistent state indicators, not action-result feedback.

4. **Should this phase also migrate dialogs to a shared primitive library?**
   - Recommendation: no.
   - Reason: Phase 13 is a toast-focused cleanup; dialog standardization should wait for more modal surface area or a separate phase.

## Sources

### Primary (HIGH confidence)
- [solid-sonner GitHub](https://github.com/wobsoriano/solid-sonner)
- [solid-sonner npm](https://www.npmjs.com/package/solid-sonner)
- [Kobalte Toast docs](https://kobalte.dev/docs/core/components/toast/)
- `package.json`
- `src/routes/index.tsx`
- `src/lib/share/share-link.ts`
- `src/lib/share/share-link.test.ts`
- `src/components/profile/ProfileHeader.tsx`
- `src/components/cards/NonPaymentLinkCardShell.tsx`
- `src/components/cards/PaymentLinkCard.tsx`
- `src/styles/base.css`
- `src/styles/responsive.css`

### Secondary (MEDIUM confidence)
- `src/components/profile/ProfileHeader.test.tsx`
- `src/components/cards/non-payment-card-accessibility.test.tsx`
- `.planning/phases/12-add-share-button-in-each-card-next-to-analytics/12-RESEARCH.md`

## Metadata

**Research scope:** current action-feedback implementation, Solid-compatible toast-library fit, shared clipboard fallback reuse, and phase-sized rollout strategy

**Confidence breakdown:**
- Toast-library fit for this repo: HIGH
- Current feedback/copy seams: HIGH
- Recommended two-wave plan split: HIGH
- Exact toast styling details: MEDIUM

**Research date:** 2026-03-11
**Valid until:** 2026-04-11

---

*Phase: 13-replace-inline-action-feedback-with-toasts*
*Research completed: 2026-03-11*
*Ready for planning: yes*
