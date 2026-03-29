# Phase 19: Public Referral Enrichment + Offer Capture - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Generalize public referral enrichment so common referral URLs can resolve canonical public landing pages and capture promo metadata plus obvious offer terms without requiring a bespoke extractor by default. This phase is about public extraction behavior, normalization rules, and generated referral output; it does not redesign card UI, add analytics, or introduce authenticated referral workflows.

</domain>

<decisions>
## Implementation Decisions

### Canonical landing resolution
- Follow redirects by default, but keep redirect handling bounded and public-only.
- Preserve the original saved referral URL while extracting against the resolved public target when a better canonical landing page is reachable.
- Keep known-family normalization rules in enrichment strategy logic, not in the author-facing data model.
- Preserve offer-affecting referral identifiers such as `ref`, `referral`, `invite`, `code`, and `coupon` when they materially affect the offer.
- Strip pure analytics parameters such as `utm_*`, `fbclid`, and `gclid` when they do not affect the offer.
- Support shorteners and multi-hop chains within a small bounded redirect policy, but stop when the chain becomes auth-gated, JS-only beyond the approved public browser path, or too ambiguous.

### Terms capture threshold
- `offerSummary` may use clearly public, headline-level promo copy when it is stable and obviously tied to the offer.
- `termsSummary` must stay stricter and only capture plainly stated public conditions.
- Do not synthesize `termsSummary` from weak or ambiguous clues.
- Prefer omission over inference when the page is unclear.
- Clearly stated condition language such as `new users only`, `limited time`, `subject to approval`, and `terms apply` counts as extractable terms when the page states it directly.

### Provenance and reporting
- Generated referral output should preserve strong structured provenance rather than loose freeform notes.
- Preserve both the original saved URL and the resolved extraction target URL for debugging.
- Record the extraction strategy id in generated referral provenance.
- Record a terms source URL when terms are extracted from a different page or canonical target than the resolved landing page.
- Add a referral-specific completeness status with the values `full`, `partial`, and `none`.
- Do not add confidence scores in Phase 19; provenance plus completeness is sufficient for this milestone.

### Initial target patterns
- Optimize for broad shape-based coverage rather than a brittle brand-by-brand allowlist.
- Initial shapes include:
  - direct public landing pages with clear offer copy
  - query-parameter referral URLs (`ref`, `referral`, `invite`, `code`, `coupon`)
  - path-based invite/referral URLs
  - known-family canonical rewrites when a better public landing shape is already known
- Publicly reachable JS-heavy pages are in scope when they remain public and can be handled through the existing public-browser augmentation posture.
- Auth-gated or partially gated flows are out of scope once authentication is required to see the offer.
- Prefer broad pattern coverage with conservative extraction rules, so `partial` outcomes are acceptable but weak inference is not.

### Claude's Discretion
- Exact redirect hop limits, URL-param allowlists/denylists, and public-browser escalation thresholds can be finalized during planning as long as they stay bounded and public-only.
- Exact generated referral provenance field names may be normalized during planning so long as they preserve the approved original/resolved/source-url and strategy-id concepts.

</decisions>

<specifics>
## Specific Ideas

- Phase 19 should stay flexible and extensible rather than hard-coding a brittle family list.
- Auditability/debuggability matters enough that normalized referral extraction should keep both the original saved URL and the resolved extraction target.
- Broad URL-shape support is acceptable as long as terms extraction remains conservative and omission wins over guesswork.

</specifics>

<deferred>
## Deferred Ideas

- Authenticated referral flows are out of scope for Phase 19 and can be revisited later only if public-first extraction proves insufficient.
- Confidence scoring for generated referral extraction is deferred; provenance plus completeness should carry the debugging load for now.
- Referral analytics and UI presentation remain later phases.

</deferred>

---

*Phase: 19-public-referral-enrichment-offer-capture*
*Context gathered: 2026-03-29*
