---
phase: 24-referral-catalog-skill-management
plan: 01
subsystem: referral-contracts
tags: [referral, catalog, validation, fork-owned, downstream]
requires:
  - 23-03
provides:
  - shared referral catalog schema and seeded data
  - optional fork-local referral catalog overlay contract
  - link-level catalog reference validation and fork-safety regression coverage
affects: [24-02, 24-03, open-links-sites, fork-sync, fork-reset]
tech-stack:
  added: []
  patterns:
    - schema-validated referral catalog data under data/policy
    - fork-owned overlay protection via config-backed sync tests
    - actionable catalog id and link-reference validation
key-files:
  created:
    - data/policy/referral-catalog.json
    - data/policy/referral-catalog.local.json
    - schema/referral-catalog.schema.json
    - .planning/phases/24-referral-catalog-skill-management/24-01-SUMMARY.md
  modified:
    - schema/links.schema.json
    - src/lib/content/referral-fields.ts
    - scripts/validate-data.ts
    - scripts/validate-data.test.ts
    - scripts/reset-fork-template.test.ts
    - scripts/lib/upstream-sync.test.ts
    - config/fork-owned-paths.json
key-decisions:
  - "Keep links[].referral as the outward runtime contract and add catalogRef as an optional nested authoring pointer instead of a parallel top-level link field."
  - "Use one shared referral catalog schema for both the upstream catalog and the optional fork-local overlay, with local entries overriding by stable id when present."
  - "Prove the shared-vs-fork-owned split through reset and upstream-sync tests so forks and open-links-sites consumers do not rely on documentation alone."
patterns-established:
  - "Referral catalog ids are stable familyId/offerId/matcherId strings, and validation reports broken relationships at the source file or link path that needs fixing."
  - "The concrete data/policy/referral-catalog.local.json overlay path is fork-owned and preserved by fork maintenance flows."
requirements-completed: []
duration: 1h 10m
completed: 2026-03-31
---

# Phase 24 Plan 01 Summary

**Phase 24 now has a first-class referral catalog contract with fork-local overlay protection and actionable link reference validation**

## Accomplishments

- Added [`data/policy/referral-catalog.json`](/Users/peterryszkiewicz/.codex/worktrees/a075/open-links/data/policy/referral-catalog.json) and [`schema/referral-catalog.schema.json`](/Users/peterryszkiewicz/.codex/worktrees/a075/open-links/schema/referral-catalog.schema.json) as the shared upstream catalog seam, seeded with Club Orange family, offer, and matcher ids.
- Added the concrete [`data/policy/referral-catalog.local.json`](/Users/peterryszkiewicz/.codex/worktrees/a075/open-links/data/policy/referral-catalog.local.json) overlay and marked it fork-owned in [`config/fork-owned-paths.json`](/Users/peterryszkiewicz/.codex/worktrees/a075/open-links/config/fork-owned-paths.json) so fork reset and upstream sync preserve local referral catalog content.
- Extended [`schema/links.schema.json`](/Users/peterryszkiewicz/.codex/worktrees/a075/open-links/schema/links.schema.json), [`src/lib/content/referral-fields.ts`](/Users/peterryszkiewicz/.codex/worktrees/a075/open-links/src/lib/content/referral-fields.ts), and [`scripts/validate-data.ts`](/Users/peterryszkiewicz/.codex/worktrees/a075/open-links/scripts/validate-data.ts) so `links[].referral.catalogRef` is typed, normalized, schema-validated, and checked against merged catalog ids with explicit error messages.
- Added regression coverage in [`scripts/validate-data.test.ts`](/Users/peterryszkiewicz/.codex/worktrees/a075/open-links/scripts/validate-data.test.ts), [`scripts/reset-fork-template.test.ts`](/Users/peterryszkiewicz/.codex/worktrees/a075/open-links/scripts/reset-fork-template.test.ts), and [`scripts/lib/upstream-sync.test.ts`](/Users/peterryszkiewicz/.codex/worktrees/a075/open-links/scripts/lib/upstream-sync.test.ts) to prove schema failures, bad references, reset preservation, and fork-owned sync behavior.

## Task Commits

1. **Task 1: Add the shared referral catalog schema and seeded upstream catalog file** - `ceae334`
2. **Task 2: Add link-level catalog reference typing, concrete overlay validation, and fork-owned sync coverage** - `d1acb99`

Plan metadata is recorded in the commit that adds this summary.

## Decisions Made

- Preserved downstream compatibility for `open-links-sites` by introducing catalog authoring and validation only; no runtime/render behavior or existing manual referral shape changed in this wave.
- Kept matcher fields declarative with hosts, path, and query predicates so later runtime lookup stays explainable instead of depending on hidden script logic.
- Treated the local overlay file as a concrete tracked contract with empty defaults, rather than leaving overlay support implicit or documentation-only.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `bun run validate:data`
- `bun test src/lib/content/referral-fields.test.ts scripts/validate-data.test.ts scripts/reset-fork-template.test.ts scripts/lib/upstream-sync.test.ts`
- `bun run test:deploy`
- `bun run typecheck`
- `bun run biome:check`
- `bun run studio:lint`
- `bun run studio:typecheck`
- `bun run --filter @openlinks/studio-api test`
- `bun run studio:test:integration`

## Issues Encountered

- Task-level commits initially tripped the repo pre-commit guard because CI-relevant files from Task 2 were still unstaged during the Task 1 commit attempt. I resolved that by stashing the second-task work with `git stash push --keep-index`, committing Task 1 cleanly, then restoring and committing Task 2.

## User Setup Required

None.

## Next Phase Readiness

- Phase 24-02 can now build runtime catalog loading and matcher resolution on top of a stable schema/data contract instead of reopening the base shape.
- `open-links-sites` remains downstream-safe in this wave because the shared catalog is additive, `links[].referral` stays backward compatible, and the fork-local overlay path is explicitly excluded from shared-upstream sync behavior.

---
*Phase: 24-referral-catalog-skill-management*
*Completed: 2026-03-31*
