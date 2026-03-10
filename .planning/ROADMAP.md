# Roadmap: OpenLinks

## Active Milestone

### v1.1 - Social Profile Metadata + Card Refresh

**Status:** All v1.1 phases complete; milestone ready for audit (updated 2026-03-10)
**Goal:** Make supported social links feel like real profile cards by persisting audience metadata and refreshing card presentation around profile identity.
**Phases:** 7-12 plus inserted Phase 08.1
**Requirements mapped:** 13/13 original v1.1 requirements mapped (13 complete); Phase 11 and Phase 12 follow-up scope were delivered outside the original requirement catalog

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
**Status:** Complete 2026-03-08
**Goal:** Distinguish profile-authored bios from fetched page/header descriptions across metadata capture, runtime rendering, Studio editing, and extractor guidance.
**Depends on:** Phase 8
**Plans:** 3/3 complete
**Requirements:** DATA-10, DATA-11, UI-10, DOC-07

**Success criteria:**
1. Metadata contracts can store `profileDescription` separately from the existing fetched/manual page description without breaking current fallback behavior.
2. Supported public and authenticated profile sources are audited and persist `profileDescription` where the platform exposes a distinct user-authored bio, with X validated first.
3. Social-profile cards and Studio can intentionally surface the profile-authored description while non-profile links keep the current description rules.

**Completed plan areas:**
- [x] 08.1-01: Extend schemas, types, and merge rules for distinct profile description fields.
- [x] 08.1-02: Audit supported platform capture/cache paths and extractor guidance to persist profile descriptions.
- [x] 08.1-03: Update card rendering, Studio editing surface, and regression coverage for profile descriptions.

### Phase 9: Docs + Regression Hardening for Social Cards

**Directory:** `09-docs-regression-hardening-social-cards`
**Status:** Complete 2026-03-10
**Goal:** Document the expanded metadata model and lock down rendering and fallback behavior with targeted tests and verification guidance.
**Depends on:** Phase 08.1
**Plans:** 2/2 complete
**Requirements:** DOC-05, DOC-06, QUAL-06

**Success criteria:**
1. Data model and extractor docs explain the new fields, supported platform behavior, and manual overrides.
2. Examples and customization docs show both profile-style and fallback card usage.
3. Automated and documented manual verification cover follower-count rendering and no-metadata fallback cases.

**Completed plan areas:**
- [x] 09-01: Update data-model and extractor docs with profile metadata/count coverage.
- [x] 09-02: Add rendering regression coverage and milestone-level verification notes for the new card states.

**Details:**
Phase 9 closed the original v1.1 milestone by turning `docs/data-model.md` into the canonical social-card contract, refreshing the customization/extractor docs to match the current public-vs-authenticated support split, adding a dedicated `docs/social-card-verification.md` guide, and broadening generic-state regression coverage across profile cards, fallback cards, share actions, and follower-history artifacts.

### Phase 10: Configurable Rich Card Description Image Row

**Directory:** `10-configurable-rich-card-description-image-row`
**Status:** Complete 2026-03-09
**Goal:** Keep profile-centric rich-card headers intact while optionally rendering a separate full-width description image row when preview media is distinct from the profile image.
**Depends on:** Phase 9
**Plans:** 3/3 complete

**Success criteria:**
1. Maintainers can control the extra rich-card description-image row globally and per site/platform without disturbing avatar-first profile headers.
2. Rich-card media capture and validation preserve meaningful profile-vs-preview image separation for supported profile sources and stop requiring unused preview media when the row is disabled.
3. Rich cards render the new full-width description-image row between the description and footer/source context with regression coverage and maintainer-facing configuration docs.

**Completed plan areas:**
- [x] 10-01: Add global/per-site description-image-row policy resolution and view-model support.
- [x] 10-02: Preserve meaningful distinct preview images and align validation with avatar-first profile cards.
- [x] 10-03: Render the full-width description-image row, update docs, and lock in regression coverage.

**Details:**
Add a follow-up rich-card layout pass for Substack-style links and similar cases where profile imagery and description/preview imagery serve different purposes. Keep the first row focused on profile identity, keep the description/source row intact, and add an optional third row for a full-width description image when it improves the card. Make the extra row configurable both globally and per-site so maintainers can opt in or out without losing the existing profile treatment.

### Phase 11: Historical Follower Tracking + Growth Charts

**Directory:** `11-historical-follower-tracking-growth-charts`
**Status:** Complete 2026-03-10
**Goal:** Persist nightly follower snapshots into publicly accessible append-only per-platform CSV histories, then add an app surface for cross-platform follower-growth charts with a SolidJS-friendly charting choice.
**Depends on:** Phase 10
**Plans:** 3/3 complete
**Requirements:** Follow-up scope outside the original v1.1 requirement catalog

**Success criteria:**
1. Nightly follower-count collection appends to platform-specific CSV histories without forcing a shared all-platform column layout.
2. GitHub Actions can publish updated follower-history CSVs directly to `main`, and the generated CSV assets remain publicly accessible for the site and external consumers.
3. The app exposes a follower-growth view that charts every tracked platform count over time, with the SolidJS charting library choice researched and documented.

**Completed plan areas:**
- [x] 11-01: Define append-only per-platform CSV schemas, storage locations, and nightly snapshot-writing rules.
- [x] 11-02: Wire the publication path so GitHub Actions can update and ship the public follower-history CSV assets safely.
- [x] 11-03: Research SolidJS-compatible chart libraries, select the graphing approach, and build the follower-growth analytics surface.

**Details:**
Favor one CSV per platform so new networks can be added or removed without reshaping one large shared history table. The completed implementation now publishes `public/history/followers/*.csv` plus an index manifest, updates them through a nightly GitHub Actions workflow that deploys in the same run, and lazy-loads an ECharts-based analytics surface from both the profile header and history-aware cards.

### Phase 12: Add Share Button in Each Card Next to Analytics

**Directory:** `12-add-share-button-in-each-card-next-to-analytics`
**Status:** Complete 2026-03-10
**Goal:** Add a native web-share button to each history-aware card, placed to the right of the analytics button, without regressing card semantics or the current analytics controls.
**Depends on:** Phase 11
**Plans:** 2/2 complete
**Requirements:** Follow-up scope outside the original v1.1 requirement catalog

**Success criteria:**
1. Cards that currently expose analytics actions also expose a card-level share button immediately to the right of analytics.
2. The share action invokes the native Web Share flow when available and falls back cleanly when it is not.
3. Card-level share and analytics actions remain visually aligned in the card header area without breaking the anchor semantics or mobile layout.

**Completed plan areas:**
- [x] 12-01: Define the shared card-action contract and native-share fallback behavior for card-level sharing.
- [x] 12-02: Render the new share button next to analytics, add focused regression/accessibility coverage, and verify desktop/mobile layout.

**Details:**
Keep the card share affordance aligned with the current profile-level share behavior, but scoped to the specific card destination rather than the whole profile. The completed implementation now uses a shared Web Share utility for both profile and card surfaces, exposes analytics then share on history-aware cards, and preserves the sibling card-action semantics established in Phase 11.

## Milestones

- ✅ **v1.0** — Shipped 2026-02-23. 6 phases, 16 plans. [Archive](./milestones/v1.0-ROADMAP.md)
- 🚧 **v1.1** — Defined 2026-03-07. 7 phases planned (including inserted Phase 08.1), 6 complete.

## Historical References

- Requirements archive: `.planning/milestones/v1.0-REQUIREMENTS.md`
- Audit report: `.planning/milestones/v1.0-MILESTONE-AUDIT.md`
- Milestone index: `.planning/MILESTONES.md`
