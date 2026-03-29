# Phase 18: Referral Contract + Link Plumbing - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a dedicated `links[].referral` contract plus the merge/load-validation plumbing needed to support it while keeping referral support additive to existing `simple` and `rich` links. This phase defines the authoring shape, merge rules, and validation defaults only; public extraction behavior and referral card presentation belong to later phases.

</domain>

<decisions>
## Implementation Decisions

### Disclosure vocabulary
- Use neutral schema field names rather than first-person copy.
- Keep a single `referral` umbrella object rather than splitting referral/affiliate/promo/invite into different link types.
- Add an optional `kind` field under `referral`; initial values should cover `referral`, `affiliate`, `promo`, and `invite`.
- Keep owner-side wording broad enough to cover cash, credits, access, exposure, or generic project support.
- Support one-sided benefit disclosures by allowing `visitorBenefit` and `ownerBenefit` to be independently absent.
- Keep two separate summary layers: `offerSummary` for the main deal and `termsSummary` for caveats/conditions.

### Minimum authoring contract
- `referral: {}` is a valid marker when a maintainer wants to flag a link as referral/promo before full details are known.
- Empty or near-empty referral objects should trigger validation warnings, not validation failures.
- Treat these as meaningful disclosure fields: `visitorBenefit`, `ownerBenefit`, `offerSummary`, `termsSummary`, `termsUrl`, and `code`.
- `kind` alone does not count as meaningful disclosure content.
- Add a dedicated optional `code` field rather than forcing promo/invite codes into prose.
- Allow soft referral entries where the maintainer only knows that the link is promotional but has not yet captured the exact benefit details.

### Manual vs extracted precedence
- Manual referral fields win field-by-field over generated referral data.
- Generated referral data may fill blank fields automatically but must not overwrite manual content.
- Track provenance per field where practical so maintainers can tell what was manual vs generated vs mixed.
- Warn when generated referral terms conflict with manual referral fields instead of silently trusting or silently replacing either side.

### Supported shapes and exceptions
- Include a dedicated `termsUrl` field for the canonical terms or landing-page source when available.
- One-sided referral benefits are valid without warning as long as the disclosed side is stated honestly.
- `ownerBenefit` should allow broad but truthful values such as “supports the project” when the exact benefit is indirect or unknown.
- Do not add a dedicated `disclosureLabel` field in Phase 18; later UI phases should derive labels from `kind` plus the populated referral fields unless planning later proves a stored label is necessary.

### Claude's Discretion
- Exact serialized field names beyond the approved concepts may be normalized during planning as long as they stay neutral and map cleanly to the decisions above.
- Exact warning copy, provenance encoding shape, and validation threshold details can be finalized during planning as long as they preserve the approved semantics.

</decisions>

<specifics>
## Specific Ideas

- The contract should maximize flexibility and extensibility while staying transparent by default.
- Auditability and debuggability matter, so provenance should be visible enough that maintainers can understand where referral data came from.
- The schema should work for arbitrary referral links through the normal CRUD path without requiring a bespoke extractor to be useful.

</specifics>

<deferred>
## Deferred Ideas

- First-class referral disclosure labels in the UI can be revisited in the referral card presentation phase if derived labels prove insufficient.
- Studio-specific guided referral controls remain a later concern; the current milestone can rely on the normal AI CRUD flow plus Advanced JSON/manual fallback.

</deferred>

---

*Phase: 18-referral-contract-link-plumbing*
*Context gathered: 2026-03-29*
