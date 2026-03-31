# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-29)

**Core value:** A developer can fork/template the repo, edit structured link data, and reliably publish a polished personal links site with minimal friction.
**Current focus:** Phase 23 is now planned and ready for execution; Phase 24 remains queued behind it for referral catalog and skill-driven management

## Current Position

Phase: 23-automatic-referral-benefit-extraction
Plan: 23-01, 23-02, 23-03
Status: Phase 23 planned; ready for `$gsd-execute-phase 23`
Next Phase: Phase 23 - Automatic Referral Benefit Extraction
Active Milestone: v1.3-referral-links-offer-transparency
Completed Milestone: v1.2-profile-quick-links-header-usability-polish
Last activity: 2026-03-31 - Planned Phase 23 into three waves covering static benefit extraction, public browser fallback, and report/artifact hardening.

Progress: [#########-] 90%

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

- Keep referral presentation additive to the shared non-payment card model instead of creating a separate card family.
- Keep referral `offerSummary` precedence at the card view-model layer rather than changing the base description resolver.
- Keep `termsUrl` as a quiet sibling interaction outside the main card anchor to avoid nested-link behavior.
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
- 2026-03-29: Phase 18 completed with an additive `links[].referral` contract, generated `{ metadata, referral }` manifest support, referral warning policy, and example datasets.
- 2026-03-30: Phase 19 completed with generalized public referral target normalization, generated referral completeness/provenance output, and explicit regression/report coverage.
- 2026-03-30: Phase 20 completed with visible referral disclosure badges, benefit rows, sibling terms links, and focused non-referral/accessibility regression coverage in the shared card shell.
- 2026-03-30: Phase 21 completed with canonical referral authoring docs, top-level verification guidance, and explicit downstream review breadcrumbs for the additive referral contract.
- 2026-03-30: Milestone audit found the missing source-authored referral flow proof gap; Phase 22 was added to close it before archiving v1.3.
- 2026-03-30: Phase 22 completed with live source-authored Club Orange referral proof, focused real-data regressions, and refreshed audit evidence that the manual-first gap is closed.
- 2026-03-30: Phase 23 added for public-first, explicit-only automatic visitor/owner benefit extraction with static parsing first, browser fallback second, and manual precedence preserved.
- 2026-03-31: Phase 23 planned into three waves: static explicit-only benefit extraction, conditional public browser fallback for JS-heavy public pages, and report/artifact hardening with real generated output.
- 2026-03-31: Phase 24 added for a shared upstream referral catalog, optional link-level catalog references plus overrides, and a sibling referral-management skill with upstream-PR prompting for generic additions.
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

- Execute Phase 23 with `$gsd-execute-phase 23`.
- Plan Phase 24 after Phase 23 if referral catalog and skill-driven management remain the next infrastructure step.
- Keep the accepted v1.x tech debt visible during referral work: `/` bundle budgets, fallback social-image warnings, and analytics chunk size.
- Fix first-render theme initialization so saved light/dark mode is applied before mount and does not flash the wrong theme on first paint.
- Fix referral card content layout so referral disclosure content stays in the same column as normal card content.

### Blockers/Concerns

- `links[].referral` is a compatibility-sensitive schema addition for `open-links-sites`, so contract docs and downstream notes need to stay explicit.
- Phase 23 must stay generic/public-first and avoid drifting into inference-heavy or bespoke per-program extractor work by default.
- Phase 24 should preserve `links[].referral` as the runtime contract while introducing shared catalog data, optional references, and fork-aware upstream contribution flow.
- `bun run quality:check` still fails the `/` performance budgets for both mobile and desktop.
- SEO still warns that social preview metadata is using the deterministic fallback image.
- Broader social audience extraction coverage remains future work, and new extractors still need parsed counts plus raw text to stay aligned.
- The analytics surface now lazy-loads a dedicated chart chunk successfully, but that on-demand chunk is still substantial and should stay code-split or be reduced in a later pass.

## Session Continuity

Last session: 2026-03-30 09:45
Stopped at: Phase 22 is complete; next step is `$gsd-discuss-phase 23` or `$gsd-plan-phase 23`.
Resume file: .planning/phases/23-automatic-referral-benefit-extraction/23-CONTEXT.md
