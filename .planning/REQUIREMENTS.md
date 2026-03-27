# Requirements: OpenLinks v1.2

**Defined:** 2026-03-27
**Milestone:** v1.2 Profile Quick Links + Header Usability Polish
**Core Value:** A developer can fork/template the repo, edit structured link data, and reliably publish a polished personal links site with minimal friction.

## v1.2 Requirements

### Quick Links Discovery

- [ ] **QLINK-01**: Visitor can see a Quick Links section above the top-level profile action bar when at least one eligible major-platform social link exists.
- [ ] **QLINK-02**: Visitor can open a Quick Link directly to the matching enabled social/profile destination already defined in `data/links.json`.
- [ ] **QLINK-03**: Quick Links only include eligible major-platform known-site destinations and exclude generic, contact, payment, or otherwise non-social shortcuts.
- [ ] **QLINK-04**: Quick Links appear in a predictable order that prioritizes common platforms such as X, YouTube, GitHub, LinkedIn, and Instagram while remaining stable across builds.
- [ ] **QLINK-05**: Visitor sees Quick Links as recognizable icon-first shortcuts for supported platforms rather than a second full-text action bar.

### Header Interaction & Accessibility

- [ ] **HEAD-01**: Visitor can use every Quick Link with keyboard and screen readers because each shortcut exposes a descriptive accessible name, title, and visible focus treatment.
- [ ] **HEAD-02**: Visitor can use the Quick Links strip on both mobile and desktop without crowding, clipping, or weakening the current share/copy/QR action bar.
- [ ] **HEAD-03**: If no eligible Quick Links exist, the profile header omits the section entirely without leaving placeholder chrome or awkward spacing.

### Maintainer Model & Verification

- [ ] **MAINT-01**: Maintainer does not manage a second quick-link list because the header shortcuts derive from existing enabled top-level links.
- [ ] **QUAL-07**: Maintainer can verify Quick Link eligibility, ordering, accessibility labeling, and empty-state behavior through focused automated coverage and documented manual checks when needed.
- [ ] **DOC-08**: Maintainer-facing documentation stays accurate if Quick Links change the profile-header behavior or authoring expectations in a material way.

## Future Requirements

### Quick Links Controls

- **QLINK-06**: Maintainer can manually include, exclude, and reorder individual Quick Links without changing the main card order.
- **QLINK-07**: Studio exposes first-class controls for Quick Links behavior and preview.

### Header Enhancements

- **HEAD-04**: Visitor can see optional badges or lightweight status context in Quick Links without reducing scan speed.
- **HEAD-05**: Visitor can access a second-level overflow treatment when the site has an unusually large set of eligible social platforms.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Dedicated `profile.json` quick-link registry | Would create a second source of truth alongside `links[]` before the derived model is validated |
| Generic website or contact links in Quick Links | The section should stay focused on recognizable social/profile destinations |
| Embedded analytics, follower counts, or share actions inside Quick Links | Keeps the strip compact and prevents it from absorbing unrelated behaviors |
| Broad Studio/editor scope beyond documentation-ready follow-up hooks | This milestone is intentionally narrow and centered on the public profile header |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| QLINK-01 | Phase 16 | Pending |
| QLINK-02 | Phase 15 | Pending |
| QLINK-03 | Phase 15 | Pending |
| QLINK-04 | Phase 15 | Pending |
| QLINK-05 | Phase 16 | Pending |
| HEAD-01 | Phase 16 | Pending |
| HEAD-02 | Phase 16 | Pending |
| HEAD-03 | Phase 16 | Pending |
| MAINT-01 | Phase 15 | Pending |
| QUAL-07 | Phase 17 | Pending |
| DOC-08 | Phase 17 | Pending |

**Coverage:**
- v1.2 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-03-27 after roadmap traceability mapping*
