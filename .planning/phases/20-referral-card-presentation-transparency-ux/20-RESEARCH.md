# Phase 20 Research: Referral Card Presentation + Transparency UX

**Researched:** 2026-03-30  
**Scope:** Shared non-payment card presentation, disclosure hierarchy, benefit rows, terms affordances, and regression seams for referral links

## Executive Summary

Phase 20 should extend the existing non-payment card view-model and shell instead of creating a separate referral card family. The repo already routes both `simple` and `rich` URL cards through the same architecture:

- `src/lib/ui/rich-card-policy.ts` builds the shared non-payment view model
- `src/components/cards/NonPaymentLinkCardShell.tsx` renders both simple and rich URL cards
- `src/styles/base.css` and `src/styles/responsive.css` own the shared non-payment card layout
- focused tests already cover view-model behavior, shared shell accessibility, and rich/profile regression surfaces

The main planning constraint is not visual styling. It is interaction structure. The current shell wraps the main card body in a single anchor. That means any quiet `termsUrl` affordance must be rendered outside that primary anchor, or the shell must otherwise avoid nested interactive content. Phase 20 should plan around that explicitly rather than discovering it mid-implementation.

The safest phase structure is:

1. add a small referral-presentation helper and extend the shared non-payment view model
2. render disclosure, benefits, offer/terms copy, and a quiet terms affordance inside the shared shell without breaking the existing media/icon/source behavior
3. harden accessibility and regression coverage so non-referral and supported social profile cards keep their current behavior

## Existing Architecture To Reuse

### Shared non-payment card architecture already exists

`src/lib/ui/rich-card-policy.ts` already centralizes the card decisions that matter for referral presentation:

- title selection
- description resolution
- lead kind (`preview`, `avatar`, `icon`)
- source-label behavior
- profile-preview behavior for rich cards
- footer icon and source-label decisions

Both `SimpleLinkCard` and `RichLinkCard` feed that view model into `NonPaymentLinkCardShell.tsx`. That means Phase 20 can add referral disclosure once and reuse it across both render modes.

### Referral data is already in runtime content

Phase 18 and Phase 19 already established the input seam Phase 20 needs:

- `OpenLink.referral` exists as an additive contract
- manual and generated referral fields already merge at load time
- generated referral data already exposes `offerSummary`, `termsSummary`, `termsUrl`, and provenance/completeness

So Phase 20 does not need to solve extraction or schema again. It only needs to decide how that already-merged referral data is presented.

### Existing rich-card media behavior should stay intact

The current card system already knows how to reuse:

- preview imagery for rich non-profile cards
- avatar/profile treatment for supported profile cards
- known-site icons in both lead and footer positions
- source labels in header/footer variants

That aligns well with the Phase 20 decisions:

- promo imagery should lead when available
- the brand icon should remain a supporting cue
- disclosure and benefit rows should stay in the text area
- referral cards should be a distinct sub-variant of the existing rich-card family, not a second system

### The current shell structure creates an important terms-link constraint

`NonPaymentLinkCardShell.tsx` currently renders:

- a `.non-payment-card-frame`
- one primary anchor for the card body
- a sibling `BottomActionBar`

Because the main content is already a single anchor, a `termsUrl` cannot safely become an inline nested anchor inside the description or footer markup. Phase 20 should therefore plan for one of these valid patterns:

- render the quiet terms link as a sibling interactive element outside the primary card anchor
- or render a non-anchor details affordance that does not create nested interactive content

The first option fits the approved “quiet terms link whenever `termsUrl` exists” decision best.

## Recommended Phase 20 Design

### 1. Add a pure referral-presentation helper

`src/lib/ui/rich-card-policy.ts` is already the shared decision layer, but Phase 20 should avoid stuffing all referral formatting logic directly into that file. A small helper such as `src/lib/ui/referral-card-presentation.ts` can own:

- formatted disclosure label resolution from `referral.kind`
- generic fallback label behavior for soft referral markers, likely `Referral`
- benefit-row construction and ordering
- terms presentation mode decisions
- primary summary preference, where `offerSummary` can override the default card description when present

This keeps the formatting logic pure and testable.

### 2. Keep referral presentation additive to the shared view model

The shared non-payment card view model should gain a referral presentation object rather than branching into a new card type. That object should be able to represent:

- whether the link should render in referral mode
- the visible disclosure label
- zero, one, or two benefit rows
- the primary offer copy to show in the card body
- the inline terms excerpt, if any
- whether a quiet external `Terms` or `Details` link should render

Non-referral cards should simply keep this object undefined.

### 3. Reuse the existing description slot for offer-first referral copy

The context decisions imply that `offerSummary` should be visible naturally on-card, especially when no `termsSummary` exists. The lowest-friction way to do that is:

- keep the current description slot for non-referral cards
- prefer `referral.offerSummary` for referral cards when it exists
- continue falling back to the existing description logic when no offer summary exists

This keeps the layout stable while making the offer copy visible enough to satisfy CARD-01 and CARD-02.

### 4. Render disclosure and benefits inside the text area

Phase 20 should keep:

- the badge near the title/top of the card
- benefit rows in the text content area
- promo imagery and icons in their current lead/footer roles

This matches the approved reading order and avoids the complexity of overlaying text into variable promo art.

### 5. Keep terms secondary and validly interactive

The approved behavior suggests:

- short `termsSummary` can render inline under the offer/benefit content
- longer terms should render as an excerpt
- a quiet `Terms` or `Details` link should appear whenever `termsUrl` exists

Because of the shell anchor constraint, that quiet link should likely render as a sibling element in the frame, below the primary anchor and above the bottom action bar.

## Best Code Seams For Each Phase 20 Plan

### 20-01 Foundation seam

Likely files:

- `src/lib/ui/referral-card-presentation.ts`
- `src/lib/ui/referral-card-presentation.test.ts`
- `src/lib/ui/rich-card-policy.ts`
- `src/lib/ui/rich-card-description-sourcing.test.ts`
- `src/components/cards/social-profile-card-rendering.test.tsx`

This plan should establish:

- formatted disclosure label decisions
- benefit-row ordering and label selection
- offer-summary precedence in the shared description slot
- view-model compatibility for both simple and rich non-payment cards

### 20-02 Rendering seam

Likely files:

- `src/components/cards/NonPaymentLinkCardShell.tsx`
- `src/components/cards/referral-card-rendering.test.tsx`
- `src/styles/base.css`
- `src/styles/responsive.css`

This plan should establish:

- visible badge placement near the title
- separate benefit rows in the text area
- inline terms excerpt behavior
- quiet terms-link rendering outside the main anchor
- referral-specific visual polish without breaking current image/icon/source behavior

### 20-03 Regression seam

Likely files:

- `src/components/cards/referral-card-rendering.test.tsx`
- `src/components/cards/non-payment-card-accessibility.test.tsx`
- `src/components/cards/social-profile-card-rendering.test.tsx`
- `src/lib/ui/rich-card-description-sourcing.test.ts`
- `src/lib/ui/rich-card-footer-labels.test.ts`

This plan should establish:

- referral disclosure/benefit/terms accessibility
- no nested interactive-element regressions
- rich referral promo imagery staying aligned with the existing source/footer behavior
- explicit non-referral and supported-profile regression coverage

## Pitfalls Specific To This Phase

### 1. Creating a fourth visual card family by accident

If referral presentation forks the card markup too aggressively, the repo will drift away from the approved additive model. Phase 20 should keep referral treatment as an overlay on the shared non-payment card system.

### 2. Hiding the disclosure too low in the reading order

If the badge only appears in the footer or source-label region, CARD-01 will technically exist but still be weak in practice. The disclosure needs to show before the visitor commits to the card.

### 3. Breaking valid interaction structure with `termsUrl`

Nested anchors or nested buttons inside the main card link would create invalid or confusing interaction behavior. This is the highest-risk implementation detail in the phase and should be treated as a first-class planning requirement.

### 4. Regressing non-referral description behavior

If referral offer-copy precedence leaks into ordinary cards, Phase 20 will create noisy regressions. The new summary logic needs a clean referral-only boundary.

### 5. Over-normalizing benefit text

The user explicitly wanted transparency and flexibility. Phase 20 should standardize labels such as `You get` and `Supports`, but it should not rewrite the underlying benefit text.

## Recommended Research Conclusion

The lowest-risk Phase 20 plan is:

1. add a pure referral-presentation helper and extend the shared non-payment card view model
2. render visible disclosure, benefit rows, offer copy, and a quiet terms affordance in `NonPaymentLinkCardShell` while keeping promo imagery, source labels, and known-site icons on the current shared path
3. add focused rendering and accessibility regression coverage that proves referral cards changed while non-referral and supported social profile cards did not

That plan satisfies the user’s transparency goals without introducing a separate referral card subsystem or reopening referral extraction/schema decisions that Phases 18 and 19 already settled.
