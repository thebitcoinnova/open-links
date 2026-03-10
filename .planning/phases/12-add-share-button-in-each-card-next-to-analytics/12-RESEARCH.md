# Phase 12: Add Share Button in Each Card Next to Analytics - Research

**Researched:** 2026-03-10
**Domain:** card-level native share actions, shared Web Share fallback logic, and action-row layout inside the existing card shell
**Confidence:** HIGH

## User Constraints

### Locked Decisions
- Add a share button to each card that already exposes the Phase 11 analytics action.
- Place the share button immediately to the right of the analytics button.
- Invoke the native Web Share action when available.
- Keep card-level share behavior aligned with the existing profile-level share behavior rather than inventing a totally separate interaction model.
- Preserve current card semantics and do not regress the analytics controls or mobile layout.

### Claude's Discretion
- Exact payload shape for the shared data (`title`, `text`, `url`) as long as it remains coherent and card-specific.
- Whether the fallback feedback is inline status text, an aria-live-only message, or both.
- Whether the card action contract should stay action-specific or become a slightly more general reusable action-row shape.

### Deferred Ideas (Out of Scope)
- Per-platform custom share payload templates.
- Share counts, share tracking, or analytics around the share action itself.
- Social-network-specific share intents separate from the native share flow.

## Summary

Phase 12 should be implemented as a **small extension of the Phase 11 card action system**, not as a second sharing subsystem:

1. Extract the current profile-level share logic from `ProfileHeader.tsx` into a shared utility.
2. Reuse that utility for a card-level share button that targets the individual card URL.
3. Extend the current sibling action pattern beside cards so analytics and share become a paired action row.

Primary recommendation:

- Create a shared utility under `src/lib/share/` for:
  - resolving a shareable URL,
  - trying `navigator.share(...)`,
  - falling back to clipboard copy,
  - returning a small status enum/message.
- Keep card actions **outside the anchor** exactly as Phase 11 learned to do.
- Reuse the current `IconShare` and the existing card-header reservation strategy from the Phase 11 gap closure.
- Add focused regression coverage for first-load button visibility, button order, and preserved anchor semantics.

## Standard Stack

### Core

| Tool/Surface | Purpose | Why It Fits |
|--------------|---------|-------------|
| Native `navigator.share()` | Primary card-level share mechanism | Official Web Share path already matches the user's requested native share behavior. |
| `navigator.canShare()` | Guard for data capability checks when helpful | Official docs position it as the preflight check for shareable data. |
| Clipboard fallback via `navigator.clipboard.writeText()` plus textarea fallback | Non-native share fallback path | The profile header already uses this pattern successfully; Phase 12 should centralize and reuse it. |
| Existing sibling card-action pattern | Placement of analytics + share beside cards | Phase 11 already established the semantic boundary: actions outside the anchor. |

### Supporting

| Tool/Surface | Purpose | When to Use |
|--------------|---------|-------------|
| Shared share utility in `src/lib/share/` | Reuse between profile share and card share | Use immediately; otherwise share behavior will drift between the profile header and cards. |
| Existing `ProfileHeader.test.tsx` and `non-payment-card-accessibility.test.tsx` style | Regression coverage for action buttons and semantics | Best place to lock in button order and anchor/action separation. |
| Playwright CLI | Browser confirmation for native/fallback share affordances on the built preview | Useful for confirming desktop/mobile action-row layout after implementation. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shared utility for profile + card share | Duplicate the current `ProfileHeader` share helpers into card code | Faster to write, but guaranteed behavioral drift and duplicate fallback bugs later. |
| Sibling action buttons outside the anchor | Put the share button inside the card link markup | Invalid nested-interactive semantics and likely accessibility regressions. |
| Native Web Share with clipboard fallback | Platform-specific share-intent URLs per network | More bespoke behavior, worse parity with the existing profile share path, and not what the user asked for. |

## Architecture Patterns

### Pattern 1: One Share Utility, Multiple Entry Points

`ProfileHeader.tsx` already contains:
- URL resolution,
- native share attempt,
- clipboard fallback,
- status timing.

Phase 12 should extract the reusable parts so both profile-level and card-level share actions call the same share helper. Keep the status presentation local to the surface, but keep the share attempt logic centralized.

### Pattern 2: Card Actions Stay Outside the Anchor

Phase 11 already established the right semantic posture:
- the main card remains a link,
- auxiliary actions are sibling buttons.

Phase 12 should extend that same pattern rather than wrapping share inside the anchor or making the whole card action row interactive.

### Pattern 3: Header-Row Action Pairing, Not Whole-Card Padding

The Phase 11 gap fix showed that reserving space in the title row works better than padding the whole card as if an action lived in its own side column. Phase 12 should build on that:
- analytics button first,
- share button second,
- both aligned to the card title row.

### Pattern 4: Share Payload Should Be Card-Specific but Minimal

Recommended default payload:
- `title`: resolved card title or label
- `text`: resolved card description when it is concise enough to be useful
- `url`: the card destination URL

Avoid platform-specific formatting in this phase. The user asked for a native share action, not a custom share copy system.

## Current Code Seams

### Existing Share Logic

- `src/components/profile/ProfileHeader.tsx` currently owns:
  - canonical/profile URL resolution,
  - `navigator.share(...)`,
  - clipboard fallback,
  - transient inline status.
- This is the obvious extraction point for a shared share utility.

### Existing Card Action Contract

- `src/components/cards/NonPaymentLinkCardShell.tsx` accepts `resolveAnalyticsButton`.
- `src/routes/index.tsx` resolves whether a card has analytics data and passes that through to card components.
- The shell now reserves space in `non-payment-card-title-row` and places the button as a sibling of the anchor.

This is the right seam for adding a parallel share action.

### Existing Icons and Tests

- `src/lib/icons/custom-icons.tsx` already exposes `IconShare`.
- `src/components/profile/ProfileHeader.test.tsx` already covers button ordering in the profile header.
- `src/components/cards/non-payment-card-accessibility.test.tsx` already covers the analytics sibling-button pattern and preserved anchor semantics.

### Routing/Data Constraints

- `src/routes/index.tsx` is still the single public route.
- Card-level share does not need any new route state or data source; it only needs each card’s existing URL and display metadata.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Share payload capability detection | Ad-hoc browser sniffing | `navigator.share` / `navigator.canShare` checks | Matches the platform capability surface directly. |
| Separate fallback logic per component | Repeated clipboard/share code in header and cards | Shared utility in `src/lib/share/` | Reduces behavioral drift and duplicated edge cases. |
| Nested card actions | Buttons inside the anchor tree | Sibling action buttons | Keeps semantics and accessibility clean. |
| Whole-card spacing hacks | Padding the full card as if actions live in another column | Title-row reservation and action-row alignment | Preserves scanability and header structure. |

## Common Pitfalls

### Pitfall 1: `navigator.share()` fails outside a trusted user gesture
**What goes wrong:** share calls silently reject or throw because the action is not triggered directly from a click/tap.
**How to avoid:** call the share helper directly from the button event handler with no async indirection before the API call.

### Pitfall 2: Card share behavior drifts from profile share behavior
**What goes wrong:** one surface copies to clipboard while the other shows different status semantics or payloads.
**How to avoid:** centralize the share attempt logic and keep only presentation-layer feedback local.

### Pitfall 3: Two card action buttons collapse awkwardly on mobile
**What goes wrong:** analytics + share start reading like a second column again or overlap the title/meta area.
**How to avoid:** reserve header-row space intentionally and test on mobile after both actions exist, not just after one.

### Pitfall 4: Share fallback gives no accessible feedback
**What goes wrong:** clipboard fallback works, but the user gets no visible or screen-reader confirmation.
**How to avoid:** return structured status from the shared utility and render short-lived status feedback on the consuming surface.

## Code Examples

### Recommended shared utility shape

```ts
export interface ShareLinkInput {
  title: string;
  text?: string;
  url: string;
}

export interface ShareLinkResult {
  status: "shared" | "copied" | "failed";
  message: string;
}
```

### Recommended card-action contract direction

```ts
interface CardActionButtonProps {
  ariaLabel: string;
  onClick: () => void;
  title?: string;
}
```

Then extend the shell with a second action resolver for share rather than inventing a separate layout component tree.

## Open Questions

1. **Should card share show inline status text?**
   - Recommendation: yes, but minimal. A short-lived status near the card header row is the safest fallback-feedback path.

2. **Should `text` be included in the share payload?**
   - Recommendation: include it only when the resolved description is short and non-redundant; otherwise share `title` + `url` only.

3. **Should all cards get a share button or only history-aware cards?**
   - The roadmap text says “each history-aware card”.
   - Recommendation: keep scope exactly there for this phase.

## Sources

### Primary (HIGH confidence)
- [MDN: Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API)
- [MDN: Navigator.share()](https://developer.mozilla.org/docs/Web/API/Navigator/share)
- [W3C Web Share API Recommendation](https://www.w3.org/TR/web-share/)
- [src/components/profile/ProfileHeader.tsx](/Users/peterryszkiewicz/.codex/worktrees/1eff/open-links/src/components/profile/ProfileHeader.tsx)
- [src/components/cards/NonPaymentLinkCardShell.tsx](/Users/peterryszkiewicz/.codex/worktrees/1eff/open-links/src/components/cards/NonPaymentLinkCardShell.tsx)
- [src/routes/index.tsx](/Users/peterryszkiewicz/.codex/worktrees/1eff/open-links/src/routes/index.tsx)
- [src/components/cards/non-payment-card-accessibility.test.tsx](/Users/peterryszkiewicz/.codex/worktrees/1eff/open-links/src/components/cards/non-payment-card-accessibility.test.tsx)
- [src/components/profile/ProfileHeader.test.tsx](/Users/peterryszkiewicz/.codex/worktrees/1eff/open-links/src/components/profile/ProfileHeader.test.tsx)

### Secondary (MEDIUM confidence)
- Phase 11 execution artifacts under `.planning/phases/11-historical-follower-tracking-growth-charts/`

## Metadata

**Research scope:** native share API behavior, existing share implementation seams, card action layout reuse, and regression strategy

**Confidence breakdown:**
- Native Web Share behavior and constraints: HIGH
- Existing code seams for reuse: HIGH
- Best-fit plan split: HIGH
- Exact UX copy/status wording: MEDIUM

**Research date:** 2026-03-10
**Valid until:** 2026-04-10

---

*Phase: 12-add-share-button-in-each-card-next-to-analytics*
*Research completed: 2026-03-10*
*Ready for planning: yes*
