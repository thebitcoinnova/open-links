# Roadmap: OpenLinks

## Active Milestone

### v1.1 - Social Profile Metadata + Card Refresh

**Status:** Phase 8 complete; inserted Phase 08.1 planned ahead of Phase 9 (updated 2026-03-09)
**Goal:** Make supported social links feel like real profile cards by persisting audience metadata and refreshing card presentation around profile identity.
**Phases:** 7-9 plus inserted Phase 08.1
**Requirements mapped:** 13/13 (6 complete)

### Phase 7: Social Profile Metadata Pipeline

**Directory:** `07-social-profile-metadata-pipeline`
**Status:** Complete 2026-03-07
**Goal:** Extend schemas, generated metadata, validation, and extractor outputs so supported links can persist profile avatar and audience stats.
**Depends on:** Phase 6
**Plans:** 3/3 complete
**Requirements:** DATA-07, DATA-08, DATA-09

**Success criteria:**
1. Manual and generated metadata support profile image plus follower/following/subscriber-style count fields.
2. Direct and authenticated extractor paths can persist supported profile stats and avatars into saved metadata.
3. Merge and validation behavior stay deterministic when profile fields are partial, missing, or unsupported.

**Completed plan areas:**
- [x] 07-01: Extend schema/types/validation for profile-centric metadata fields.
- [x] 07-02: Update enrichment and authenticated extractor outputs, fixtures, and reports for profile stats capture.
- [x] 07-03: Wire runtime content-loading and card view models to the new metadata surface.

### Phase 8: Social Profile Card UI Refresh

**Directory:** `08-social-profile-card-ui-refresh`
**Status:** Complete 2026-03-07
**Goal:** Rebuild simple and rich card presentation around profile identity cues while preserving existing content and source context.
**Depends on:** Phase 7
**Plans:** 3/3 complete
**Requirements:** UI-07, UI-08, UI-09

**Success criteria:**
1. Rich cards use circular profile imagery and a readable handle/stats header when profile metadata exists.
2. Simple cards present compact social-profile metadata without losing scanability or interaction clarity.
3. Links without profile metadata still render stable, accessible layouts on mobile and desktop.

**Completed plan areas:**
- [x] 08-01: Redesign rich-card structure for profile-style header and metadata grouping.
- [x] 08-02: Refresh simple-card layout and responsive rules for compact audience stats.
- [x] 08-03: Finish styling/accessibility polish across breakpoints and fallback states.

### Phase 08.1: Custom Profile Descriptions (INSERTED)

**Directory:** `08.1-custom-profile-descriptions`
**Status:** Planned 2026-03-09
**Goal:** Distinguish profile-authored bios from fetched page/header descriptions across metadata capture, runtime rendering, Studio editing, and extractor guidance.
**Depends on:** Phase 8
**Planned plans:** 3
**Requirements:** DATA-10, DATA-11, UI-10, DOC-07

**Success criteria:**
1. Metadata contracts can store `profileDescription` separately from the existing fetched/manual page description without breaking current fallback behavior.
2. Supported public and authenticated profile sources are audited and persist `profileDescription` where the platform exposes a distinct user-authored bio, with X validated first.
3. Social-profile cards and Studio can intentionally surface the profile-authored description while non-profile links keep the current description rules.

**Planned plan areas:**
- 08.1-01: Extend schemas, types, and merge rules for distinct profile description fields.
- 08.1-02: Audit supported platform capture/cache paths and extractor guidance to persist profile descriptions.
- 08.1-03: Update card rendering, Studio editing surface, and regression coverage for profile descriptions.

### Phase 9: Docs + Regression Hardening for Social Cards

**Directory:** `09-docs-regression-hardening-social-cards`
**Goal:** Document the expanded metadata model and lock down rendering and fallback behavior with targeted tests and verification guidance.
**Depends on:** Phase 08.1
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
- 🚧 **v1.1** — Defined 2026-03-07. 4 phases planned (including inserted Phase 08.1), 2 complete.

## Historical References

- Requirements archive: `.planning/milestones/v1.0-REQUIREMENTS.md`
- Audit report: `.planning/milestones/v1.0-MILESTONE-AUDIT.md`
- Milestone index: `.planning/MILESTONES.md`
