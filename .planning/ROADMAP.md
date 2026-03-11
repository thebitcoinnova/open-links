# Roadmap: OpenLinks

## Active Milestone

No active versioned milestone. The post-v1.1 Phase 13 follow-up is complete, and the next step is `$gsd-new-milestone`.

### Phase 13: Replace Inline Action Feedback with Toasts

**Goal:** Replace transient inline share/copy status copy with toast-based feedback on the public site while keeping the current custom dialog surfaces in place.
**Status:** ✅ Complete (2026-03-11)
**Depends on:** Phase 12
**Plans:** 2 plans

Plans:
- [x] 13-01: Add a global `solid-sonner` toast host and migrate profile/card share feedback off inline status outputs.
- [x] 13-02: Extract shared clipboard copy helpers, migrate payment-rail copy feedback, and finish toast theming plus regression coverage.

**Details:**
- Adopt `solid-sonner` for the public-site toast layer because it fits the current lightweight SolidJS stack without pulling in a broader component system.
- Replace the inline share/copy status outputs in the profile header and shared non-payment card shell with a reusable toast feedback seam.
- Audit adjacent copy/share interactions for the same toast pattern, but defer dialog-library standardization unless a later phase adds enough modal surface area to justify it.

**Success Criteria Met:**
- Profile-level and card-level share actions now use a shell-level `solid-sonner` toaster instead of inline status outputs.
- Share fallback and payment-rail copy now reuse one clipboard helper and one toast-based feedback model.
- The existing analytics/payment dialogs remain custom, and built-preview checks confirmed the new toast surface stays in-bounds on desktop and mobile.

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
