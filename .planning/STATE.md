# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-09)

**Core value:** A developer can fork/template the repo, edit structured link data, and reliably publish a polished personal links site with minimal friction.
**Current focus:** Phase 08.1 execution planning for custom profile description separation ahead of the Phase 9 docs and regression pass

## Current Position

Phase: 08.1-custom-profile-descriptions
Plan: 0 of 3 (phase planned)
Status: Ready to execute Phase 08.1
Queued Follow-up Phase: 10-configurable-rich-card-description-image-row
Last activity: 2026-03-09 - Inserted Phase 08.1 and drafted execution plans for custom profile description separation across metadata, cards, Studio, and extractor guidance.

Progress: [#####-----] 55%

## Performance Metrics

**Velocity:**
- Total plans completed: 22
- Average duration: 25 min
- Total execution time: 9.2 hours

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

**Recent Trend:**
- Last 3 plans: 18 min, 12 min, 15 min
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

### Roadmap Evolution

- Phase 08.1 inserted after Phase 8: custom profile descriptions need dedicated contract, capture, UI, and Studio work before the broader docs/regression pass in Phase 9.

- 2026-03-08: Phase 10 added for configurable rich-card description image rows when profile and preview imagery should render separately.

### Pending Todos

- Phase 08.1 custom profile description separation is planned and ready for execution.
- Phase 9 still needs docs and regression hardening for the expanded profile metadata fields, card states, and maintainer customization guidance after Phase 08.1 lands.

### Blockers/Concerns

- Only Instagram and YouTube have first-pass audience extraction; broader social coverage remains future work.
- Audience parsing still depends on platform-specific text surfaces, so new extractors must keep parsed counts and raw text aligned.
- The current dataset still exercises the social profile treatment primarily through rich cards; broader template branching and grid/toggle layout ideas remain future work.

## Session Continuity

Last session: 2026-03-09 22:07
Stopped at: Phase 08.1 planned with three execution plans; next step is to execute 08.1-01.
Resume file: .planning/phases/08.1-custom-profile-descriptions/08.1-01-PLAN.md
