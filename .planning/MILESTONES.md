# Milestones

## v1.3 - Referral Links + Offer Transparency

**Status:** ✅ Shipped (2026-03-31)  
**Tag:** `v1.3`  
**Scope:** Phases 18-24, 19 plans, 38 tracked tasks

### Delivered

- Referral links now ship as a first-class additive `links[].referral` contract with manual-first precedence.
- Public referral enrichment now resolves canonical landing pages, captures offer/terms details, and can fill explicit visitor/owner benefits conservatively.
- Referral transparency now renders directly in cards through visible disclosure, benefit rows, and sibling terms-link treatment.
- The repo now proves the live manual-first Club Orange flow and also supports a shared referral catalog plus fork-local overlay.
- Maintainers now have a dedicated sibling `skills/referral-management` workflow and aligned downstream-safe docs for referral catalog CRUD.

### Artifacts

- Roadmap archive: `.planning/milestones/v1.3-ROADMAP.md`
- Requirements archive: `.planning/milestones/v1.3-REQUIREMENTS.md`
- Audit report: `.planning/v1.3-MILESTONE-AUDIT.md`

---

## v1.2 - Profile Quick Links + Header Usability Polish

**Status:** ✅ Shipped (2026-03-28)  
**Tag:** `v1.2`  
**Scope:** Phases 15-17, 8 plans, 24 tasks

### Delivered

- Quick Links now derive from eligible top-level social/profile links instead of a second registry or `profileLinks`.
- The profile header now renders a visible, responsive, icon-first Quick Links strip above the action bar.
- The strip ships with explicit outbound accessibility semantics and clean empty-state behavior.
- Maintainer docs and the verification guide now document the shipped Quick Links behavior and verification path.

### Artifacts

- Roadmap archive: `.planning/milestones/v1.2-ROADMAP.md`
- Requirements archive: `.planning/milestones/v1.2-REQUIREMENTS.md`
- Audit report: `.planning/v1.2-MILESTONE-AUDIT.md`

---

## v1.1 - Social Profile Metadata + Card Refresh

**Status:** ✅ Shipped (2026-03-10)  
**Tag:** `v1.1`  
**Scope:** Phases 7-12 plus inserted Phase 08.1, 22 plans, 66 tasks

### Delivered

- Supported social links now persist profile-centric metadata, audience counts, and profile-authored descriptions.
- Simple and rich cards now render supported social links as profile-style surfaces with stable fallback behavior.
- Rich profile cards can optionally render a separate full-width description-image row when preview media is distinct.
- OpenLinks now publishes public follower-history artifacts and a lazy-loaded analytics surface.
- Card-level share actions now sit beside analytics, and maintainer docs route routine CRUD toward AI workflows or Studio before manual JSON editing.

### Artifacts

- Roadmap archive: `.planning/milestones/v1.1-ROADMAP.md`
- Requirements archive: `.planning/milestones/v1.1-REQUIREMENTS.md`
- Audit report: `.planning/milestones/v1.1-MILESTONE-AUDIT.md`

---

## v1.0 - OpenLinks Initial Release

**Status:** ✅ Shipped (2026-02-23)  
**Tag:** `v1.0`  
**Scope:** Phases 1-6, 16 plans, 48 tasks

### Delivered

- SolidJS static website foundation with validated split JSON content model.
- Rich-card rendering + enrichment with robust fallback behavior.
- CI required/strict checks and GitHub Pages deploy automation.
- SEO/accessibility/performance quality gates integrated into build and CI.
- Full developer docs suite for onboarding, customization, deployment, and future adapter planning.

### Artifacts

- Roadmap archive: `.planning/milestones/v1.0-ROADMAP.md`
- Requirements archive: `.planning/milestones/v1.0-REQUIREMENTS.md`
- Audit report: `.planning/milestones/v1.0-MILESTONE-AUDIT.md`

---

Use `$gsd-new-milestone` to begin v1.4 planning.
