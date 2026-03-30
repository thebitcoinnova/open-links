# Requirements: OpenLinks v1.3

**Defined:** 2026-03-29
**Core Value:** A developer can fork/template the repo, edit structured link data, and reliably publish a polished personal links site with minimal friction.

## v1.3 Requirements

### Referral Contract

- [ ] **REF-01**: Maintainer can mark any URL-based link as a referral, affiliate, or promo destination through a dedicated `links[].referral` object instead of hiding referral semantics inside generic copy or `custom`.
- [ ] **REF-02**: Maintainer can store explicit transparency fields for what the visitor gets, what the site owner gets, and what the offer terms are, with stable schema fields plus a `custom` escape hatch.
- [ ] **REF-03**: Maintainer can keep referral links on supported social/profile domains in non-profile presentation mode so offer links do not accidentally render like profile cards.

### Referral Enrichment

- [ ] **ENR-01**: Maintainer can rely on the standard rich-enrichment flow to follow common public referral landing behavior and capture canonical title, description, and image without authoring a bespoke extractor for each new program.
- [ ] **ENR-02**: Maintainer can capture public referral terms or offer hints additively when they are clearly discoverable, while explicit manual `links[].referral` fields remain authoritative.
- [ ] **ENR-03**: Maintainer can see whether referral terms are manual, extracted, partial, or unavailable so the system does not imply legal or commercial certainty it did not verify.

### Referral Card Presentation

- [ ] **CARD-01**: Visitor can tell a link is a referral, affiliate, or promotional destination from visible card treatment rather than hidden metadata alone.
- [ ] **CARD-02**: Visitor can read what they get and what the site owner gets directly on the rendered referral card when those fields exist.
- [ ] **CARD-03**: Visitor can see rich referral cards use promo imagery and brand identity through the existing rich-metadata and known-site icon pipelines instead of a one-off referral media system.
- [ ] **CARD-04**: Visitor sees referral presentation without regressing existing non-referral cards or supported social profile cards.

### Maintainer Workflow & Docs

- [ ] **MAINT-01**: Maintainer can add or edit arbitrary referral links through the recommended AI CRUD and documented manual fallback workflow even when no extractor exists for that domain.
- [ ] **MAINT-02**: Maintainer-facing docs and README surfaces explain the referral schema, disclosure expectations, enrichment limits, and downstream compatibility impact accurately enough to keep day-2 maintenance predictable.

## Future Requirements

### Studio & Workflow Expansion

- **STUDIO-01**: Studio exposes first-class referral/disclosure controls and preview instead of relying on Advanced JSON for the new fields.
- **STUDIO-02**: Studio can validate or preview extracted referral-term provenance before publish.

### Analytics & Compliance

- **ANALYTICS-01**: Maintainer can view referral click or conversion analytics without leaving OpenLinks.
- **LEGAL-01**: Maintainer can opt into stronger jurisdiction-specific disclosure templates or policy checks.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Dedicated `referral` link type | Referral should stay additive to existing `simple` and `rich` links so the contract remains flexible and backward compatible. |
| Program-specific extractor work for every referral platform | v1.3 should work through manual authoring plus generic public enrichment first; bespoke extractors remain a later or exceptional path. |
| Automatic legal/compliance guarantees | Extracted landing-page copy cannot replace manual review or jurisdiction-specific disclosure judgment. |
| Runtime click tracking, payout analytics, or conversion attribution | The product remains a deterministic static build; deeper analytics belong to a later milestone. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REF-01 | Phase 18 | Complete |
| REF-02 | Phase 18 | Complete |
| REF-03 | Phase 18 | Complete |
| ENR-01 | Phase 19 | Complete |
| ENR-02 | Phase 19 | Complete |
| ENR-03 | Phase 19 | Complete |
| CARD-01 | Phase 20 | Pending |
| CARD-02 | Phase 20 | Pending |
| CARD-03 | Phase 20 | Pending |
| CARD-04 | Phase 20 | Pending |
| MAINT-01 | Phase 21 | Pending |
| MAINT-02 | Phase 21 | Pending |

**Coverage:**
- v1.3 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-29*
*Last updated: 2026-03-29 after initial v1.3 definition*
