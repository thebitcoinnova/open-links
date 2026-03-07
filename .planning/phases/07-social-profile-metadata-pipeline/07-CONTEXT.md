# Phase 7: Social Profile Metadata Pipeline - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

## Phase Boundary

Extend schemas, generated metadata, validation, and extractor outputs so supported links can persist profile avatar and audience stats. This phase covers the metadata pipeline only; UI presentation changes happen in Phase 8, and broader platform rollout or extractor-skill updates are separate follow-on work.

## Implementation Decisions

### Audience Metrics Shape
- Use platform-native fields rather than a generic stats array.
- Save and render a single metric when that is all a platform exposes.
- Prefer raw numeric values when available.
- If only display text is available, parse to a numeric value when reliable and also preserve the original raw text.
- Manual metadata always overrides extractor-derived audience counts.

### First-Pass Platform Coverage
- First pass is limited to Instagram and YouTube.
- Capture audience stats only for URLs that clearly resolve to profile or account pages.
- Partial platform support is acceptable in this phase; broader platform rollout is not required before shipping.
- Unsupported platforms should omit the new fields entirely rather than storing explicit "not available" markers.

### Partial Data and Warning Rules
- Missing expected stats on a supported profile should produce a strong warning, not a build failure.
- Manual metadata may include only the fields the maintainer knows; complete metric sets are not required.
- When parsing is uncertain, preserve both the parsed numeric value and the original raw text with clearly named fields for debugging and auditability.
- Enrichment reporting should explicitly warn when a supported profile produces only partial expected stats.

### Profile Image Source Rules
- For Instagram and YouTube profile links, the canonical profile image should be the account or channel avatar, not a generic social preview image.
- If extractor logic cannot obtain a true profile avatar and only finds a generic preview image, leave the profile image empty and warn.
- Manual metadata can override the extracted profile image independently of other fields.
- Preserve avatar and preview image separately when both exist so later card rendering can use identity chrome and content imagery independently.

### Claude's Discretion
- Exact field names for parsed numeric values versus preserved raw text, as long as the naming clearly distinguishes parsed and original values.
- Exact warning copy and report phrasing, as long as missing expected stats are surfaced strongly and non-blockingly.
- Exact heuristics for deciding whether a profile URL is clear enough to attempt audience-stat extraction, provided they stay conservative.

## Specific Ideas

- Keep the pipeline slim and focused on known profile fields rather than introducing a fully generic stats model in v1.1.
- Preserve both parsed and original stat values when scraping text is ambiguous so later debugging and audits have source context.
- Treat avatar and preview image as separate assets because Phase 8 will use them differently in the card layout.

## Deferred Ideas

- Extend audience-stat support to X, LinkedIn, Facebook, Medium, and other supported domains after the Instagram and YouTube pass is proven out.
- Update the extractor-creation skill/workflow to account for audience-stat capture when authoring new extractors.

---

*Phase: 07-social-profile-metadata-pipeline*
*Context gathered: 2026-03-07*
