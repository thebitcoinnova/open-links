# Roadmap: OpenLinks

## Active Milestone: v1.2 Profile Quick Links + Header Usability Polish

**Status:** Planned (2026-03-27)
**Phases:** 15-17
**Total Plans:** 8
**Requirements:** 11

## Overview

v1.2 keeps scope tight around the profile header: add a Quick Links strip above the top-level action bar for popular social/profile destinations, derive it from the existing top-level link data instead of a second config surface, and use the work to improve the header's mobile usability, accessibility, and regression coverage.

## Phases

### Phase 15: Quick Links Foundation

**Goal:** Derive eligible Quick Links from existing top-level links with deterministic ordering, empty-state suppression, and no duplicate maintainer workflow.
**Status:** ✅ Complete (2026-03-27)
**Depends on:** Phase 14
**Requirements:** QLINK-02, QLINK-03, QLINK-04, MAINT-01
**Plans:** 3 plans

Plans:
- [x] 15-01: Define quick-link eligibility rules, major-platform priority, and derivation helpers from enabled top-level links.
- [x] 15-02: Wire the header-facing quick-link view model and hide the section cleanly when no eligible links exist.
- [x] 15-03: Add focused tests for derivation, filtering, and deterministic ordering.

**Details:**
- Reuse the existing known-site registry and icon system rather than adding new dependencies or remote brand assets.
- Keep `data/links.json` as the only source of truth for both the full card list and the new header shortcut surface.
- Limit the initial strip to recognizable major-platform destinations instead of every possible known site.

**Success Criteria:**
- Quick Links derive from enabled top-level links already present in the main card list.
- Only eligible major-platform social/profile destinations appear in the strip.
- Ordering is deterministic and stable across builds.
- The header can suppress the section entirely when no quick links qualify.

**Success Criteria Met:**
- Quick Links now derive from enabled `links[]` data through a pure resolver rather than `profileLinks` or another registry.
- Eligibility stays bounded to supported social/profile-style platforms, with the approved priority list and one-winner-per-platform behavior covered by tests.
- Route-to-header Quick Links state now exists as a non-visual seam, keeping visible-strip work deferred to Phase 16.
- Focused helper/header tests, `bun run typecheck`, and `bun run build` all passed for the foundation layer.

### Phase 16: Profile Header Quick Links UI + Responsive Polish

**Goal:** Render a compact, icon-first Quick Links strip above the profile action bar with accessible labels and resilient mobile/desktop layout behavior.
**Status:** ✅ Complete (2026-03-28)
**Depends on:** Phase 15
**Requirements:** QLINK-01, QLINK-05, HEAD-01, HEAD-02, HEAD-03
**Plans:** 3 plans

Plans:
- [x] 16-01: Build a dedicated Quick Links header component and insert it above the existing profile action bar.
- [x] 16-02: Add responsive spacing, wrapping, and visual-hierarchy polish so the header remains clean on mobile and desktop.
- [x] 16-03: Finish focus states, link titles, and empty-state spacing polish without weakening the current share/copy/QR action row.

**Details:**
- Quick Links should feel like shortcuts into the existing link set, not a second action bar or a replacement for the cards.
- External platform marks stay compact, secondary, and unmodified in line with current brand-use guidance.
- The action bar remains the home for share/copy/QR interactions; Quick Links stay scoped to direct destination links.

**Success Criteria:**
- Visitors see a recognizable icon-first Quick Links row above the profile action bar when eligible links exist.
- Each quick link is keyboard-accessible and exposes a descriptive accessible name and title.
- The header remains usable on narrow mobile widths without clipping, crowding, or losing hierarchy.
- If no eligible links exist, the profile header omits the strip without leaving placeholder chrome.

**Success Criteria Met:**
- The profile header now renders a dedicated visible Quick Links strip above the action bar when eligible links exist and hides it completely when empty.
- The strip stays icon-first and heading-free, with explicit outbound labels/titles and no active/current state.
- Responsive styling keeps the strip centered, multi-line by default, and lighter than the action bar while providing a subtle overflow hint on mobile.
- Focused Quick Links/header tests, `bun run typecheck`, and `bun run build` all passed for the visible-strip contract.

### Phase 17: Docs + Regression Hardening for Quick Links

**Goal:** Document the new header behavior and lock in automated/manual verification for derivation, accessibility, and responsive rendering.
**Depends on:** Phase 16
**Requirements:** QUAL-07, DOC-08
**Plans:** 2 plans

Plans:
- [ ] 17-01: Update maintainer-facing docs for Quick Links derivation and any material profile-header behavior changes.
- [ ] 17-02: Add milestone-level regression coverage and verification notes for eligibility, ordering, accessibility, and empty-state behavior.

**Details:**
- Keep docs aligned with the repo's preferred AI/Studio-first maintainer workflow and avoid introducing a parallel manual config path.
- Explicitly note that the milestone is renderer-level and should not require downstream `open-links-sites` contract changes.

**Success Criteria:**
- Maintainer docs explain how Quick Links derive from existing top-level links and when the section appears.
- Automated coverage verifies derivation, ordering, accessibility labels, and empty-state suppression.
- Verification notes cover the responsive header behavior needed for mobile and desktop confidence.
- Downstream contract impact is reviewed and documented as renderer-only unless scope changes during implementation.

## Milestones

- ✅ **v1.1** — Shipped 2026-03-10. 7 phases, 22 plans, 66 tasks. [Archive](./milestones/v1.1-ROADMAP.md)
- ✅ **v1.0** — Shipped 2026-02-23. 6 phases, 16 plans. [Archive](./milestones/v1.0-ROADMAP.md)

## Historical References

- Requirements archives:
  - `.planning/milestones/v1.1-REQUIREMENTS.md`
  - `.planning/milestones/v1.0-REQUIREMENTS.md`
- Audit reports:
  - `.planning/milestones/v1.1-MILESTONE-AUDIT.md`
  - `.planning/milestones/v1.0-MILESTONE-AUDIT.md`
- Milestone index: `.planning/MILESTONES.md`
