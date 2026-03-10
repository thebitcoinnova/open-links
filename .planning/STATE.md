# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-09)

**Core value:** A developer can fork/template the repo, edit structured link data, and reliably publish a polished personal links site with minimal friction.
**Current focus:** Phase 9 planning for docs and regression hardening around the expanded profile-description metadata surface, with Phase 10, Phase 11, and Phase 12 follow-up work already implemented ahead of the original dependency order

## Current Position

Phase: 09-docs-regression-hardening-social-cards
Plan: 0 of 0 (phase not planned)
Status: Ready to discuss Phase 9 after completing the out-of-order Phase 12 card-sharing follow-up
Completed Follow-up Phase: 12-add-share-button-in-each-card-next-to-analytics
Last activity: 2026-03-10 - Completed Phase 12 by adding card-level native share actions beside analytics buttons while Phase 9 remains the next unfinished milestone step.

Progress: [########--] 86%

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

- Phase 08.1 inserted after Phase 8: custom profile descriptions need dedicated contract, capture, UI, and Studio work before the broader docs/regression pass in Phase 9.

- 2026-03-08: Phase 10 added for configurable rich-card description image rows when profile and preview imagery should render separately.
- 2026-03-09: Phase 10 completed ahead of the original dependency order; rich profile cards now support a configurable full-width description-image row with Substack as the seeded distinct-image example.
- 2026-03-10: Phase 11 added for append-only public follower-history CSVs and an app surface to chart audience growth across tracked platforms.
- 2026-03-10: Phase 11 completed with public history CSV artifacts, a nightly commit-and-deploy workflow, and a lazy-loaded analytics UI reachable from the profile header and history-aware cards.
- 2026-03-10: Phase 12 added for card-level native share actions positioned beside the new analytics buttons.
- 2026-03-10: Phase 12 completed with a shared Web Share utility, profile/card share parity, and a two-button card action row for history-aware cards.

### Pending Todos

- Phase 9 needs docs and regression hardening for the expanded profile metadata fields, card states, Studio guidance, maintainer customization guidance, and the new follower-history analytics surface.
- Phase 10 no longer blocks future card-template experimentation; the shared shell now supports an additional rich-only media row without forking the card system.
- Phase 12 no longer blocks broader docs/regression coverage; card-level sharing now matches the current native/fallback share posture and action-row layout.

### Blockers/Concerns

- Only Instagram and YouTube have first-pass audience extraction; broader social coverage remains future work.
- Audience parsing still depends on platform-specific text surfaces, so new extractors must keep parsed counts and raw text aligned.
- The current dataset still exercises the social profile treatment primarily through rich cards; broader template branching and grid/toggle layout ideas remain future work.
- The analytics surface now lazy-loads a dedicated chart chunk successfully, but that on-demand chunk is still substantial and should stay code-split as Phase 9 and later work evolve it.

## Session Continuity

Last session: 2026-03-10 02:30
Stopped at: Phase 11 completed and verified out of dependency order; the next planned milestone step is to discuss or plan Phase 9.
Resume file: .planning/ROADMAP.md
