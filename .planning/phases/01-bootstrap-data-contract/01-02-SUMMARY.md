---
phase: 01-bootstrap-data-contract
plan: 02
subsystem: infra
tags: [validation, ajv, schema, strict-mode]
requires:
  - phase: 01-01
    provides: split data files and schema baselines
provides:
  - Executable data validation CLI with strict mode
  - Policy rules for URL schemes and custom-core conflicts
  - Dual output channels for human and machine consumers
affects: [phase-01-docs, phase-04-cicd, phase-05-quality]
tech-stack:
  added: [ajv, ajv-formats]
  patterns: [schema-plus-policy-validation, strict-warning-escalation]
key-files:
  created:
    - scripts/validation/rules.ts
    - scripts/validation/format-output.ts
    - data/examples/invalid/bad-scheme.json
    - data/examples/invalid/conflict-keys.json
  modified:
    - scripts/validate-data.ts
    - package.json
key-decisions:
  - "Validation separates structural schema checks from OpenLinks policy checks"
  - "Strict mode treats warnings as failures while standard mode allows warnings"
patterns-established:
  - "Validation issues always include remediation guidance"
  - "Validation output can be rendered as human text or JSON"
requirements-completed: [DATA-04, DATA-05, DATA-06]
duration: 31min
completed: 2026-02-22
---

# Phase 1: Bootstrap + Data Contract Summary

**Delivered schema enforcement plus policy-aware validation with strict-mode and machine-readable reporting**

## Performance

- **Duration:** 31 min
- **Started:** 2026-02-22T16:39:00Z
- **Completed:** 2026-02-22T17:10:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Replaced placeholder validation with executable AJV-backed schema validation CLI.
- Added policy rule engine for scheme allowlist and custom-key conflict detection.
- Added deterministic human + JSON output rendering and wired validation into `prebuild`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build schema validation command with strict-mode support** - `41884e1` (feat)
2. **Task 2: Add policy checks for URL schemes and custom-key conflicts** - `dc4f2f9` (feat)
3. **Task 3: Provide human + machine-readable output formats** - `ceed52c` (feat)

**Plan metadata:** (recorded in docs commit for this plan)

## Files Created/Modified
- `scripts/validate-data.ts` - core validation orchestration and CLI argument handling
- `scripts/validation/rules.ts` - policy checks (unknown keys, schemes, custom conflicts)
- `scripts/validation/format-output.ts` - output formatting abstractions
- `data/examples/invalid/bad-scheme.json` - URL scheme failure fixture
- `data/examples/invalid/conflict-keys.json` - custom conflict failure fixture
- `package.json` - prebuild + validator command wiring

## Decisions Made
- Kept validation policy enforcement local to scripts rather than overloading JSON schema logic.
- Added fixture-based invalid examples to verify expected error categories quickly.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Initial AJV import mode did not support Draft 2020-12 by default; switched to `ajv/dist/2020` and resolved schema loading cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Validation layer is stable and ready for documentation and starter example integration in 01-03.
- Build pipeline now enforces data contract locally before packaging.

---
*Phase: 01-bootstrap-data-contract*
*Completed: 2026-02-22*
