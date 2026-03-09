# Requirements: OpenLinks v1.1

**Defined:** 2026-03-07
**Core Value:** A developer can fork/template the repo, edit structured link data, and reliably publish a polished personal links site with minimal friction.

## v1.1 Requirements

### Data Model & Enrichment

- [x] **DATA-07**: Maintainer can store profile-centric link metadata, including handle, profile image, and audience counts, in `links[].metadata` or generated rich metadata.
- [x] **DATA-08**: Build-time enrichment and authenticated extractors save available follower/following/subscriber-style counts and profile avatar data for supported social profile links.
- [x] **DATA-09**: Validation and metadata merging preserve deterministic manual overrides when some profile fields are missing, partial, or unsupported.
- [x] **DATA-10**: Maintainer can store a profile-authored description separately from the fetched page/header description for supported social profile links.
- [x] **DATA-11**: Public and authenticated metadata capture paths can persist both `description` and `profileDescription` when a platform exposes both surfaces.

### UI & Experience

- [x] **UI-07**: Rich cards with profile metadata render a profile-style header with circular profile image, handle, and audience stats while keeping description and source branding.
- [x] **UI-08**: Simple cards surface handle and available audience stats in a compact profile-oriented layout without losing fast link scanning.
- [x] **UI-09**: Links without profile metadata continue to render clear fallback simple/rich layouts on mobile and desktop without broken spacing or inaccessible labels.
- [x] **UI-10**: Social-profile cards can intentionally display `profileDescription` when present while non-profile links keep the current description fallback behavior.

### Documentation & Extensibility

- [ ] **DOC-05**: Maintainer docs explain the new profile metadata fields, supported extractor coverage, and manual override/fallback paths.
- [ ] **DOC-06**: Docs and examples show how the refreshed card presentation uses profile metadata and how maintainers can customize or opt out of the profile-style treatment.
- [x] **DOC-07**: Studio/editor workflows expose the profile-authored description field and extractor guidance explains when to capture it separately from page descriptions.

### Quality & Verification

- [ ] **QUAL-06**: Maintainer can verify the refreshed cards and metadata fallbacks through targeted automated coverage and documented manual checks.

## Future Requirements

### Social Metadata Depth

- **DATA-12**: Maintainer can store and render additional platform-specific metrics such as post counts, verified status, or likes when they are available and worth the complexity.
- **UI-11**: Project can support platform-specific card templates (for example, channel-style vs profile-style vs post-style) without rewriting the base card system.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Live client-side platform API fetching | Conflicts with deterministic static builds and would add credentials/runtime fragility |
| Full native embeds for each platform | Higher complexity than the profile-card polish targeted in v1.1 |
| Broad expansion into unrelated milestone candidates (CLI CRUD, hosting adapters, in-site editor) | Dilutes the focused UI/data-model milestone and slows delivery |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-07 | Phase 7 | Complete |
| DATA-08 | Phase 7 | Complete |
| DATA-09 | Phase 7 | Complete |
| DATA-10 | Phase 08.1 | Complete |
| DATA-11 | Phase 08.1 | Complete |
| UI-07 | Phase 8 | Complete |
| UI-08 | Phase 8 | Complete |
| UI-09 | Phase 8 | Complete |
| UI-10 | Phase 08.1 | Complete |
| DOC-05 | Phase 9 | Pending |
| DOC-06 | Phase 9 | Pending |
| DOC-07 | Phase 08.1 | Complete |
| QUAL-06 | Phase 9 | Pending |

**Coverage:**
- v1.1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-08 after completing Phase 08.1*
