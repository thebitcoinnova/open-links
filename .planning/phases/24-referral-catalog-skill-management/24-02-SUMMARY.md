---
phase: 24-referral-catalog-skill-management
plan: 02
subsystem: content
tags: [referral, catalog, runtime, provenance, vite, bun]
requires:
  - phase: 24-referral-catalog-skill-management
    provides: "Shared referral catalog schema, seeded catalog data, and link-level catalog refs"
provides:
  - "Runtime referral catalog resolver with explicit ref and deterministic matcher lookup"
  - "Catalog-aware referral merge precedence and provenance in load-content"
  - "Focused regression coverage for catalog resolution and runtime referral loading"
affects: [open-links-sites, referral-enrichment, referral-management-skill]
tech-stack:
  added: []
  patterns:
    - "Manual > catalog > generated referral merge precedence"
    - "Deterministic matcher resolution with tie/no-guess fallback"
key-files:
  created:
    - src/lib/content/referral-catalog.ts
    - src/lib/content/referral-catalog.test.ts
  modified:
    - src/lib/content/referral-fields.ts
    - src/lib/content/referral-fields.test.ts
    - src/lib/content/load-content.ts
    - src/lib/content/load-content.referral.test.ts
key-decisions:
  - "Explicit catalog refs block matcher fallback when they are present, so runtime does not guess around an invalid or ambiguous explicit reference."
  - "Catalog data fills referral fields before generated data, while manual link fields remain authoritative field-by-field."
  - "Runtime tests use the pure merge seam instead of calling Vite-only import.meta.glob loaders directly under Bun."
patterns-established:
  - "Catalog seeds carry the existing links[].referral shape, including catalogRef, so downstream render consumers stay compatible."
  - "Catalog-derived provenance is recorded alongside manual and generated sources without widening the public card contract."
requirements-completed: []
duration: 23min
completed: 2026-03-31
---

# Phase 24: Referral Catalog + Skill-Driven Management Summary

**Runtime referral loading now resolves shared catalog defaults through explicit refs or deterministic URL matchers, then merges them into the existing `links[].referral` contract with explainable manual/catalog/generated provenance.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-03-31T10:44:00Z
- **Completed:** 2026-03-31T11:07:15Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Added a dedicated runtime catalog module that merges `data/policy/referral-catalog.json` with the optional `data/policy/referral-catalog.local.json` overlay, resolves explicit refs, and performs deterministic matcher lookup without weak host-only guesses.
- Widened referral provenance so runtime merges can distinguish `manual`, `catalog`, and `generated` field sources while keeping `links[].referral` as the outward runtime/render contract.
- Moved `load-content` onto a catalog-aware merge path so links like `cluborange-referral` get catalog-backed defaults and matcher-derived `catalogRef` data without changing the downstream `open-links-sites` card contract.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build a dedicated catalog resolver for explicit refs and deterministic matcher lookup** - `2101bee` (feat)
2. **Task 2: Merge catalog-backed referral defaults into load-content with widened provenance** - `970fb68` (feat)

**Plan metadata:** `this commit` (docs)

## Files Created/Modified
- `src/lib/content/referral-catalog.ts` - Loads and merges the shared/local referral catalog, resolves explicit refs, and performs deterministic matcher lookup.
- `src/lib/content/referral-catalog.test.ts` - Covers overlay merge behavior, explicit refs, matcher resolution, and no-guess fallback.
- `src/lib/content/referral-fields.ts` - Adds `catalog` provenance and catalog-aware manual-overrides merge precedence.
- `src/lib/content/referral-fields.test.ts` - Verifies catalog provenance normalization and manual/catalog/generated merge ordering.
- `src/lib/content/load-content.ts` - Threads catalog resolution into runtime content loading while preserving the existing referral render contract.
- `src/lib/content/load-content.referral.test.ts` - Proves the Club Orange runtime merge order and non-catalog fallback behavior through the content-loading seam.

## Decisions Made
- Explicit refs now resolve before matcher fallback, and an unresolved explicit ref does not fall through to matcher inference.
- Matcher lookup requires at least one specific path/query constraint and returns `undefined` on ties instead of guessing.
- Catalog values seed `kind`, disclosure copy, and matcher-derived `catalogRef`, but generated enrichment still fills runtime-only fields such as completeness and normalized URLs when catalog data leaves them blank.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Moved Vite-only JSON loading behind lazy helpers for Bun test compatibility**
- **Found during:** Task 1 and Task 2 verification
- **Issue:** The new catalog module initially used top-level `import.meta.glob`, which Bun does not provide during `bun test`, and `load-content` had the same test-host limitation for any new direct import path.
- **Fix:** Deferred `import.meta.glob` access behind lazy helper functions and shifted the runtime referral test onto the pure merge seam that `load-content` uses.
- **Files modified:** `src/lib/content/referral-catalog.ts`, `src/lib/content/load-content.ts`, `src/lib/content/load-content.referral.test.ts`
- **Verification:** `bun test src/lib/content/referral-catalog.test.ts src/lib/content/referral-fields.test.ts`, `bun test src/lib/content/load-content.referral.test.ts`, `bun run typecheck`
- **Committed in:** `970fb68` (part of task commits)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix kept scope inside the planned runtime/test files and made the new catalog seam verifiable under the repo’s Bun test runner without changing app behavior.

## Issues Encountered

- Bun test does not expose `import.meta.glob`, so runtime JSON lookup had to stay lazy and test-facing code had to target pure merge seams instead of Vite loaders.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 24 now has a reusable runtime catalog seam that later enrichment migration and referral-management skill work can build on directly.
- Downstream compatibility for `open-links-sites` remains explicit: the rendered/runtime consumer still reads `links[].referral`, and the new catalog data only seeds or annotates that existing contract.

---
*Phase: 24-referral-catalog-skill-management*
*Completed: 2026-03-31*
