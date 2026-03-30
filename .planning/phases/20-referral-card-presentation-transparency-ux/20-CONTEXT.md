# Phase 20: Referral Card Presentation + Transparency UX - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Present referral links as visibly disclosed, benefit-aware cards while reusing the existing rich-card media and icon systems. This phase is about card presentation, disclosure hierarchy, and interaction/reading flow for referral links; it does not add analytics, new extraction behavior, or maintainer docs surfaces.

</domain>

<decisions>
## Implementation Decisions

### Disclosure treatment
- Referral cards should use an explicit visible disclosure label rather than only implicit styling.
- The visible disclosure label should be derived from formatted `referral.kind`.
- Initial visible mappings should stay literal and human-readable: `Referral`, `Affiliate`, `Promo`, `Invite`.
- The disclosure badge should live near the title or top of the card, not buried in the footer.
- The treatment should be noticeable but restrained: clear enough to be unmissable without making the card feel spammy.

### Benefit layout
- Show referral benefits as separate labeled rows rather than sentence-style prose.
- The visitor-side benefit gets visual priority.
- Only render the benefit rows that actually exist; do not preserve empty slots for missing sides.
- Standardize the labels, not the underlying benefit text.
- Preferred labels:
  - visitor side: `You get`
  - owner/creator side: `Supports` (or equivalent neutral support label chosen during planning)

### Terms and truncation
- Show `termsSummary` inline by default when it is short enough to stay readable within the card.
- When `termsSummary` is longer, use a short inline excerpt plus a `Details` or `Terms` affordance.
- If only `offerSummary` exists, show the offer naturally and do not add a “terms unavailable” treatment.
- If `termsUrl` exists, show a quiet separate terms link whenever it is available.
- Keep terms presentation secondary to the main offer and benefit rows.

### Media and source cues
- When promo imagery exists, let the promo image lead visually while the brand icon acts as a supporting cue.
- Keep the existing source-label behavior mostly intact, but preserve it clearly on referral cards.
- Keep the disclosure badge and benefit rows in the text content area rather than overlaying them on the image.
- Referral cards should be a distinct sub-variant of the existing rich-card family, not a separate card system.
- The visual differences should be obvious at a glance but still coherent with the site’s existing card language.

### Claude's Discretion
- Exact chip/badge styling, spacing, typography, and icon placement can be finalized during planning as long as the disclosure stays explicit and the card remains a sub-variant of the existing rich-card family.
- Planning can choose the exact secondary label for the owner-side row (`Supports`, `They get`, etc.) as long as it stays neutral and readable.

</decisions>

<specifics>
## Specific Ideas

- The disclosure should be visible early in the reading order, before a visitor commits to the card.
- Referral cards should still feel like OpenLinks cards, just with stronger disclosure and benefit framing.
- Benefit rows should scan quickly, with the visitor-side value clearly prioritized.
- Promo imagery should help the offer feel concrete, but the explanatory copy should stay in the text area for clarity.

</specifics>

<deferred>
## Deferred Ideas

- Terms expansion behavior beyond a simple `Details`/`Terms` affordance can be revisited later if the first UX is not sufficient.
- More opinionated label rewriting or copy normalization for benefit text is deferred; this phase should preserve the raw benefit content.
- Analytics, conversion cues, and documentation updates remain later phases.

</deferred>

---

*Phase: 20-referral-card-presentation-transparency-ux*
*Context gathered: 2026-03-29*
