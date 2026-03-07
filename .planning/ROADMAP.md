# Roadmap: OpenLinks

## Active Milestone

### v1.1 - Social Profile Metadata + Card Refresh

**Status:** Ready for phase planning (defined 2026-03-07)  
**Goal:** Make supported social links feel like real profile cards by persisting audience metadata and refreshing card presentation around profile identity.  
**Phases:** 7-9  
**Requirements mapped:** 9/9

### Phase 7: Social Profile Metadata Pipeline

**Directory:** `07-social-profile-metadata-pipeline`  
**Goal:** Extend schemas, generated metadata, validation, and extractor outputs so supported links can persist profile avatar and audience stats.  
**Depends on:** Phase 6  
**Planned plans:** 3  
**Requirements:** DATA-07, DATA-08, DATA-09

**Success criteria:**
1. Manual and generated metadata support profile image plus follower/following/subscriber-style count fields.
2. Direct and authenticated extractor paths can persist supported profile stats and avatars into saved metadata.
3. Merge and validation behavior stay deterministic when profile fields are partial, missing, or unsupported.

**Planned plan areas:**
- 07-01: Extend schema/types/validation for profile-centric metadata fields.
- 07-02: Update enrichment and authenticated extractor outputs, fixtures, and reports for profile stats capture.
- 07-03: Wire runtime content-loading and card view models to the new metadata surface.

### Phase 8: Social Profile Card UI Refresh

**Directory:** `08-social-profile-card-ui-refresh`  
**Goal:** Rebuild simple and rich card presentation around profile identity cues while preserving existing content and source context.  
**Depends on:** Phase 7  
**Planned plans:** 3  
**Requirements:** UI-07, UI-08, UI-09

**Success criteria:**
1. Rich cards use circular profile imagery and a readable handle/stats header when profile metadata exists.
2. Simple cards present compact social-profile metadata without losing scanability or interaction clarity.
3. Links without profile metadata still render stable, accessible layouts on mobile and desktop.

**Planned plan areas:**
- 08-01: Redesign rich-card structure for profile-style header and metadata grouping.
- 08-02: Refresh simple-card layout and responsive rules for compact audience stats.
- 08-03: Finish styling/accessibility polish across breakpoints and fallback states.

### Phase 9: Docs + Regression Hardening for Social Cards

**Directory:** `09-docs-regression-hardening-social-cards`  
**Goal:** Document the new metadata model and lock down rendering and fallback behavior with targeted tests and verification guidance.  
**Depends on:** Phase 8  
**Planned plans:** 2  
**Requirements:** DOC-05, DOC-06, QUAL-06

**Success criteria:**
1. Data model and extractor docs explain the new fields, supported platform behavior, and manual overrides.
2. Examples and customization docs show both profile-style and fallback card usage.
3. Automated and documented manual verification cover follower-count rendering and no-metadata fallback cases.

**Planned plan areas:**
- 09-01: Update data-model and extractor docs with profile metadata/count coverage.
- 09-02: Add rendering regression coverage and milestone-level verification notes for the new card states.

## Milestones

- ✅ **v1.0** — Shipped 2026-02-23. 6 phases, 16 plans. [Archive](./milestones/v1.0-ROADMAP.md)
- 🚧 **v1.1** — Defined 2026-03-07. 3 phases planned (7-9).

## Historical References

- Requirements archive: `.planning/milestones/v1.0-REQUIREMENTS.md`
- Audit report: `.planning/milestones/v1.0-MILESTONE-AUDIT.md`
- Milestone index: `.planning/MILESTONES.md`
