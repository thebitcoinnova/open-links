# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-29)

**Core value:** A developer can fork/template the repo, edit structured link data, and reliably publish a polished personal links site with minimal friction.
**Current focus:** Phase 18 is planned; ready to execute the referral contract work

## Current Position

Phase: 18-referral-contract-link-plumbing
Plan: —
Status: Phase 18 planned; ready for `$gsd-execute-phase 18`
Next Phase: Phase 18 - Referral Contract + Link Plumbing
Active Milestone: v1.3-referral-links-offer-transparency
Completed Milestone: v1.2-profile-quick-links-header-usability-polish
Last activity: 2026-03-29 - Planned Phase 18 into three executable plans with research and verification.

Progress: [----------] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 28
- Average duration: 27 min
- Total execution time: 12.8 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 3 | 92 min | 31 min |
| 2 | 3 | 115 min | 38 min |
| 3 | 2 | 98 min | 49 min |
| 4 | 2 | 60 min | 30 min |
| 5 | 3 | 115 min | 38 min |
| 6 | 3 | 4 min | 1 min |
| 7 | 3 | 25 min | 8 min |
| 8 | 3 | 45 min | 15 min |
| 08.1 | 3 | 154 min | 51 min |
| 10 | 3 | 60 min | 20 min |

**Recent Trend:**
- Last 3 plans: 20 min, 22 min, 18 min
- Trend: Stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

- Keep referral support additive to existing `simple` and `rich` links rather than introducing a dedicated referral link type.
- Treat manual referral disclosure fields as authoritative; extracted offer terms are assistive hints, not legal guarantees.
- Prefer generic public referral augmentation plus manual fallback before reaching for program-specific authenticated extractors.
- Preserve the v1.0 static architecture and add social profile metadata as an optional extension to the existing link model.
- Keep follower and following data build-time only; do not introduce live runtime platform API dependencies.
- Keep profile avatars separate from preview images through cache, runtime localization, and card-facing helpers.
- Preserve manual profile-specific overrides field-by-field instead of replacing whole metadata objects.
- Use the full profile-style card treatment only when supported profile metadata is present; keep unsupported cards in a quieter unified fallback shell.
- Suppress duplicate preview media when a social profile avatar and preview resolve to the same asset.
- Reuse shared description/source logic across rich and simple cards so render-mode switches do not fork profile behavior.
- Treat profile-authored descriptions as a separate metadata field from fetched page/header descriptions instead of overloading the existing `description` field.
- Supported social profile cards should prefer explicit `profileDescription` when present, while non-profile links stay on the existing fetched/manual description rules.
- X profile bios should come from the public rendered DOM, while LinkedIn can reconcile the public generic description with the cached authenticated bio without forcing a new auth refresh.

### Roadmap Evolution

- 2026-03-29: Milestone v1.3 started for referral links + offer transparency.
- 2026-03-29: Phases 18-21 added for referral contract plumbing, public referral enrichment, referral card UX, and maintainer docs/verification.
- Phase 08.1 inserted after Phase 8: custom profile descriptions need dedicated contract, capture, UI, and Studio work before the broader docs/regression pass in Phase 9.
- 2026-03-08: Phase 10 added for configurable rich-card description image rows when profile and preview imagery should render separately.
- 2026-03-09: Phase 10 completed ahead of the original dependency order; rich profile cards now support a configurable full-width description-image row with Substack as the seeded distinct-image example.
- 2026-03-10: Phase 11 added for append-only public follower-history CSVs and an app surface to chart audience growth across tracked platforms.
- 2026-03-10: Phase 11 completed with public history CSV artifacts, a nightly commit-and-deploy workflow, and a lazy-loaded analytics UI reachable from the profile header and history-aware cards.
- 2026-03-10: Phase 12 added for card-level native share actions positioned beside the new analytics buttons.
- 2026-03-10: Phase 12 completed with a shared Web Share utility, profile/card share parity, and a two-button card action row for history-aware cards.
- 2026-03-11: Phase 13 added as a post-v1.1 follow-up to replace inline action feedback with toast-based UI while deferring dialog-library standardization.
- 2026-03-11: Phase 13 completed with a shell-level `solid-sonner` toaster, shared clipboard fallback reuse, payment-copy toast feedback, and desktop/mobile built-preview verification.
- 2026-03-11: Phase 14 added as a post-v1.1 follow-up to replace the hand-rolled dialog/modal implementation with a library-backed solution.
- 2026-03-11: Phase 14 completed with a shared `AppDialog` wrapper backed by `@kobalte/core`, plus migrated analytics/payment modal consumers and analytics built-preview verification.

### Pending Todos

- Execute Phase 18 with `$gsd-execute-phase 18`.
- Keep the accepted v1.x tech debt visible during referral work: `/` bundle budgets, fallback social-image warnings, and analytics chunk size.
- Fix first-render theme initialization so saved light/dark mode is applied before mount and does not flash the wrong theme on first paint.

### Blockers/Concerns

- `links[].referral` is a compatibility-sensitive schema addition for `open-links-sites`, so contract docs and downstream notes need to stay explicit.
- `bun run quality:check` still fails the `/` performance budgets for both mobile and desktop.
- SEO still warns that social preview metadata is using the deterministic fallback image.
- Broader social audience extraction coverage remains future work, and new extractors still need parsed counts plus raw text to stay aligned.
- The analytics surface now lazy-loads a dedicated chart chunk successfully, but that on-demand chunk is still substantial and should stay code-split or be reduced in a later pass.

## Session Continuity

Last session: 2026-03-29 12:50
Stopped at: Phase 18 planned; next step is `$gsd-execute-phase 18`.
Resume file: .planning/phases/18-referral-contract-link-plumbing/18-01-PLAN.md
