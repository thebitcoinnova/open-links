---
phase: 20-referral-card-presentation-transparency-ux
verified: 2026-03-30T01:40:51Z
status: passed
score: 19/19 must-haves verified
---

# Phase 20: Referral Card Presentation + Transparency UX Verification Report

**Phase Goal:** Present referral links as visibly disclosed, benefit-aware cards while reusing the existing rich-card media and icon systems.  
**Verified:** 2026-03-30T01:40:51Z  
**Status:** passed

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Referral links render with visible disclosure treatment that distinguishes them from ordinary cards. | ✓ VERIFIED | `src/lib/ui/referral-card-presentation.ts` formats disclosure labels, `src/lib/ui/rich-card-policy.ts` exposes additive referral presentation state, and `src/components/cards/NonPaymentLinkCardShell.tsx` now renders a top-of-card referral badge. |
| 2 | Visitors can read both sides of the offer when the maintainer provided the fields. | ✓ VERIFIED | `NonPaymentLinkCardShell.tsx` renders visitor/owner benefit rows in the text column, and `src/components/cards/referral-card-rendering.test.tsx` plus `src/components/cards/non-payment-card-accessibility.test.tsx` cover both full and one-sided disclosure cases. |
| 3 | Rich referral cards can show promo images and brand identity through the existing metadata/icon paths. | ✓ VERIFIED | `buildRichCardViewModel(...)` keeps preview/image-driven non-profile rich referral cards on the shared lead/media path, and the rich referral tests confirm footer/source/icon behavior remains on the existing shell. |
| 4 | Focused UI and accessibility tests prove referral presentation does not regress non-referral card behavior. | ✓ VERIFIED | `referral-card-rendering.test.tsx`, `non-payment-card-accessibility.test.tsx`, `social-profile-card-rendering.test.tsx`, `rich-card-description-sourcing.test.ts`, and `rich-card-footer-labels.test.ts` collectively cover referral disclosure plus non-referral/profile fallback behavior. |

**Score:** 4/4 roadmap truths verified

### Plan Must-Haves

| Plan | Must-Have Summary | Status | Evidence |
|------|-------------------|--------|----------|
| 20-01 | Referral presentation stays additive to the shared non-payment card view model. | ✓ VERIFIED | `NonPaymentCardViewModel` now carries optional `referral` presentation data via `resolveReferralCardPresentation(...)`; no new card family or link type was introduced. |
| 20-01 | Disclosure labels format from `referral.kind` with a sensible soft-marker fallback. | ✓ VERIFIED | `formatReferralDisclosureLabel(...)` maps the approved kinds to `Referral`, `Affiliate`, `Promo`, and `Invite`, and soft markers fall back to `Referral`. |
| 20-01 | Visitor-first benefit ordering is centralized and only populated rows render. | ✓ VERIFIED | `resolveReferralCardPresentation(...)` builds ordered benefit rows and omits missing sides; fixture tests cover both full and one-sided cases. |
| 20-01 | `offerSummary` precedence is limited to referral cards and does not regress ordinary description sourcing. | ✓ VERIFIED | `buildNonPaymentCardViewModel(...)` prefers `referral.offerSummary` only when referral presentation exists, while `resolveLinkCardDescription(...)` remains unchanged; `rich-card-description-sourcing.test.ts` covers both paths. |
| 20-01 | Supported social profile cards and non-referral cards keep their existing view-model behavior. | ✓ VERIFIED | `social-profile-card-rendering.test.tsx` still passes its existing profile/non-profile cases, and the new referral-rich case stays in non-profile mode without altering supported profile semantics. |
| 20-02 | Referral cards show an explicit visible disclosure badge near the title/top of the card. | ✓ VERIFIED | `NonPaymentLinkCardShell.tsx` renders `.non-payment-card-referral-badge` before the title row, and `base.css` styles it as a restrained disclosure pill. |
| 20-02 | Benefit rows render in the text area, visitor-first, and omit empty sides. | ✓ VERIFIED | Benefit rows are rendered inside `.non-payment-card-summary`, and the new rendering tests explicitly cover full, one-sided, and soft-marker cases. |
| 20-02 | Short `termsSummary` renders inline while longer terms use excerpt + quiet affordance. | ✓ VERIFIED | `resolveReferralCardPresentation(...)` truncates long inline terms and exposes link state, while `NonPaymentLinkCardShell.tsx` renders inline terms copy plus a quiet sibling `Terms` link when present. |
| 20-02 | `termsUrl` avoids nested interactive markup inside the primary card anchor. | ✓ VERIFIED | The shell renders `.non-payment-card-referral-terms-link` in a sibling row after the main anchor, and accessibility tests assert the frame children remain separate interactions. |
| 20-02 | Promo imagery, brand icons, and source labels remain on the existing shared card/media system. | ✓ VERIFIED | Rich referral cards still use the shared preview lead, footer icon, and footer/source-label rules; no referral-only media subsystem or separate icon path was added. |
| 20-03 | Referral disclosure, benefit rows, and terms context are covered by focused rendering tests. | ✓ VERIFIED | `src/components/cards/referral-card-rendering.test.tsx` now covers simple, rich, soft-marker, and one-sided referral rendering states. |
| 20-03 | Accessibility coverage proves the quiet terms affordance is not nested inside the primary card link. | ✓ VERIFIED | `non-payment-card-accessibility.test.tsx` asserts the main card anchor and sibling terms-link are separate direct children of the frame. |
| 20-03 | Soft markers and one-sided benefits render gracefully without empty placeholder rows. | ✓ VERIFIED | Dedicated tests prove soft markers show only the generic badge and that one-sided disclosures render exactly one benefit row. |
| 20-03 | Rich referral cards still use promo imagery and existing source/footer cues through the shared system. | ✓ VERIFIED | The rich referral shell and footer-label tests keep `app.cluborange.org` source treatment and preview-led rendering intact. |
| 20-03 | Non-referral and supported social profile cards keep their previous description/source/layout behavior. | ✓ VERIFIED | Existing social-profile, description-sourcing, and footer-label suites still pass alongside the new referral tests. |

**Score:** 15/15 plan must-have groups verified

### Required Artifact Checks

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/ui/referral-card-presentation.ts` | Shared referral presentation seam | ✓ EXISTS + SUBSTANTIVE | Owns disclosure-label formatting, benefit-row ordering, and inline-terms/terms-link state. |
| `src/lib/ui/rich-card-policy.ts` | Additive referral-aware card view model | ✓ EXISTS + SUBSTANTIVE | Exposes optional referral presentation state and applies offer-summary precedence only at the card-model layer. |
| `src/components/cards/NonPaymentLinkCardShell.tsx` | Shared shell referral rendering | ✓ EXISTS + SUBSTANTIVE | Renders badge, benefit rows, inline terms, and sibling terms link without forking simple/rich markup. |
| `src/styles/base.css` | Referral sub-variant desktop styling | ✓ EXISTS + SUBSTANTIVE | Adds referral frame, badge, benefit-row, terms, and secondary-link styling on the existing non-payment card system. |
| `src/styles/responsive.css` | Referral mobile-safe layout | ✓ EXISTS + SUBSTANTIVE | Stacks benefit rows and expands the quiet terms link cleanly on mobile. |
| `src/components/cards/referral-card-rendering.test.tsx` | Focused referral shell coverage | ✓ EXISTS + SUBSTANTIVE | Covers simple, rich, soft-marker, and one-sided referral card rendering states. |
| `src/components/cards/non-payment-card-accessibility.test.tsx` | Referral accessibility coverage | ✓ EXISTS + SUBSTANTIVE | Proves shared anchor semantics plus sibling terms-link structure. |
| `src/lib/ui/rich-card-footer-labels.test.ts` | Referral source-label regression coverage | ✓ EXISTS + SUBSTANTIVE | Confirms referral cards preserve canonical footer/source-label behavior on known-site domains. |

**Artifacts:** 8/8 verified

## Requirements Coverage

| Requirement | Expected in Phase 20 | Status | Evidence |
|-------------|----------------------|--------|----------|
| CARD-01 | Visitors can tell a link is a referral/promo destination from visible card treatment. | ✓ COMPLETE | Referral cards now display a visible disclosure badge near the title in the shared shell. |
| CARD-02 | Visitors can read what they get and what the site owner gets directly on the rendered referral card. | ✓ COMPLETE | Shared-shell benefit rows render visitor and owner disclosures in the card text area when present. |
| CARD-03 | Rich referral cards reuse promo imagery and brand identity via the existing pipelines. | ✓ COMPLETE | Rich referral cards continue using the shared preview-image, known-site icon, and source-label systems. |
| CARD-04 | Referral presentation does not regress existing non-referral or supported social profile cards. | ✓ COMPLETE | Focused regression suites and existing shared-card suites remain green with the new referral UI. |

## Automated Verification Runs

- `bun test src/components/cards/referral-card-rendering.test.tsx`
- `bun test src/components/cards/referral-card-rendering.test.tsx src/components/cards/non-payment-card-accessibility.test.tsx src/components/cards/social-profile-card-rendering.test.tsx src/lib/ui/rich-card-description-sourcing.test.ts src/lib/ui/rich-card-footer-labels.test.ts`
- `bun run biome:check`
- `bun run studio:lint`
- `bun run typecheck`
- `bun run studio:typecheck`
- `bun run --filter @openlinks/studio-api test`
- `bun run studio:test:integration`
- `bun run build`

All passed. The build and quality flows still emit the pre-existing non-blocking warnings about the stale LinkedIn authenticated cache, Rumble partial metadata, the deterministic fallback social preview image, and the large analytics chart chunk warning.

## Anti-Patterns Found

None.

## Human Verification Required

None.

## Gaps Summary

**No gaps found.** Phase 20 delivered visible referral disclosure UI, additive offer/benefit/terms presentation, and focused regression coverage without regressing the shared non-payment card system.

## Verification Metadata

**Verification approach:** roadmap truths + plan must-haves + artifact inspection + focused automated command runs  
**Automated checks:** 9 passed, 0 failed  
**Human checks required:** 0  
**Total verification time:** 1 execution session

---
*Verified: 2026-03-30T01:40:51Z*
*Verifier: Codex (orchestrated execution)*
