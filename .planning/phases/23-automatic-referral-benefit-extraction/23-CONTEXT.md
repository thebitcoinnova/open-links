# Phase 23: Automatic Referral Benefit Extraction - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend public referral enrichment so the repo can automatically fill `visitorBenefit` and `ownerBenefit` when those benefits are stated clearly on a public landing page. This phase is about conservative automatic benefit extraction strategy and verification; it does not add new referral schema fields, reopen manual-over-generated precedence, or default to bespoke/authenticated extractors for each referral program.

</domain>

<decisions>
## Implementation Decisions

### Extraction posture
- Stay public-first.
- Stay explicit-only.
- Use static fetch/parsing first.
- Allow a public browser-rendered fallback for JS-heavy public pages.
- Do not default to special/domain-specific extractors.
- Keep manual referral fields authoritative.

### Data behavior
- Reuse the existing referral fields:
  - `visitorBenefit`
  - `ownerBenefit`
  - `offerSummary`
  - `termsSummary`
  - completeness/provenance fields already present in generated referral output
- Do not change the schema for this phase.
- Generated benefit extraction should remain additive and blank-fill-only, matching the current referral merge rules.

### Extraction order
- Static resolved public page parsing should be the default path.
- Generic public browser fallback can be used for JS-heavy public pages when static parsing is insufficient.
- Manual fields still win field-by-field even when generated benefit text is available.
- Bespoke or authenticated extractors should be escalation paths only when generic public analysis cannot verify the benefit text.

### Guardrails
- Do not infer owner benefit from generic affiliate assumptions.
- Do not populate visitor/owner benefits from vague marketing copy.
- Do not treat auth-gated content as eligible for automatic benefit extraction.
- If the public evidence is weak or ambiguous, omit the field instead of guessing.

### Canonical proof case
- `cluborange-referral` remains the canonical live regression case for this next phase.
- The phase should still support broader future referral URLs without hard-coding a brand-by-brand extractor strategy first.

### Claude's Discretion
- Planning can choose the exact split between lower-level parsing helpers, browser fallback helpers, and report/test surfaces as long as the public-first and explicit-only rules remain intact.
- Planning can choose the exact regression layout for JS-heavy public pages as long as it proves browser fallback is a fallback, not the default path.

</decisions>

<specifics>
## Specific Ideas

- Owner/visitor benefit extraction should look like a natural extension of Phase 19's public referral augmentation, not a second competing enrichment system.
- The same provenance/completeness surfaces used for referral offer/terms data should continue to explain where generated benefit text came from.
- The phase should prefer broad reusable patterns over program-specific rules so future referral links do not require a new extractor by default.

</specifics>

<deferred>
## Deferred Ideas

- Authenticated referral flows remain out of scope unless a later phase chooses to escalate there deliberately.
- New referral schema fields are deferred.
- Per-program bespoke extractors are deferred unless generic public analysis proves insufficient.

</deferred>

---

*Phase: 23-automatic-referral-benefit-extraction*
*Context gathered: 2026-03-30*
