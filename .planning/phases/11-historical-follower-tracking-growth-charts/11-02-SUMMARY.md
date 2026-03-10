---
phase: 11-historical-follower-tracking-growth-charts
plan: 02
subsystem: workflow-publication
tags: [github-actions, public-artifacts, automation, docs]
requires:
  - phase: 11-historical-follower-tracking-growth-charts
    plan: 01
    provides: append-only CSV contract, sync command, and validator-backed history artifacts
affects: [phase-11-ui, deployment, maintainer-ops]
tech-stack:
  added: []
  patterns: [same-run-pages-deploy, local-command-parity, committed-public-history]
key-files:
  created:
    - .github/workflows/nightly-follower-history.yml
    - public/history/followers/index.json
    - public/history/followers/github.csv
    - public/history/followers/instagram.csv
    - public/history/followers/medium.csv
    - public/history/followers/primal.csv
    - public/history/followers/substack.csv
    - public/history/followers/x.csv
    - public/history/followers/youtube.csv
  modified:
    - package.json
    - README.md
    - data/cache/rich-public-cache.json
key-decisions:
  - "The nightly workflow commits follower-history artifacts to `main` and deploys Pages in the same run instead of relying on suppressed workflow fan-out from `GITHUB_TOKEN` pushes."
  - "Local maintainers and GitHub Actions both use the same `bun run followers:history:sync` command for parity."
patterns-established:
  - "Public follower-history artifacts are first-class committed assets alongside the public rich cache."
  - "Workflow docs and local commands stay aligned through README updates in the same change batch."
requirements-completed: []
duration: not-tracked
completed: 2026-03-10
---

# Phase 11 Plan 02 Summary

**Automated nightly follower-history publication, seeded the first public history artifacts, and documented the maintainer workflow**

## Performance

- **Completed:** 2026-03-10
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Added `bun run followers:history:sync` to the main package-script surface so local reproduction and automation share the same entrypoint.
- Seeded the initial public follower-history CSVs plus `public/history/followers/index.json` for the seven currently tracked platforms with audience data.
- Added `.github/workflows/nightly-follower-history.yml` to refresh public audience data, append history rows, commit the public artifacts to `main`, and deploy Pages in the same workflow run.
- Updated `README.md` with the new local command, workflow name, public artifact paths, and the reason the workflow deploys in the same run instead of relying on downstream automation.
- Captured the first committed follower-history snapshots directly from the repo’s current public metadata state.

## Task Commits

No atomic task commits were created during local phase execution.

## Files Created/Modified

- `.github/workflows/nightly-follower-history.yml` - nightly capture, commit, and same-run Pages deploy flow
- `package.json` - local `followers:history:sync` command
- `README.md` - maintainer docs for follower-history artifacts and automation
- `public/history/followers/*.csv` - seeded per-platform public history files
- `public/history/followers/index.json` - public manifest for analytics discovery
- `data/cache/rich-public-cache.json` - refreshed stable public audience cache feeding the history snapshots

## Decisions Made

- Kept the workflow on the public browser-sync path only for now, since the currently tracked audience counts come from public sources and the same-run deploy path is the safest default without adding new secret assumptions.
- Treated the public history assets as committed content, not ephemeral workflow artifacts, so maintainers can audit and edit them directly in git if needed.

## Deviations from Plan

- The workflow deploys Pages directly after the commit step rather than dispatching the existing deploy workflow, because the same-run deploy path is clearer and avoids depending on undocumented token behavior.

## Issues Encountered

- None after the contract layer was stabilized. The workflow and local command both operated against the same generated history shape.

## User Setup Required

None beyond normal GitHub Actions and Pages setup already required by the repo.

## Next Phase Readiness

- The public app can now rely on real committed history data instead of mocked fixtures.
- The profile header and card-level analytics entry points can safely fetch published history assets from deterministic public paths.

## Verification

- `bun run followers:history:sync`
- `bun run validate:data`
- `bun run build`
- Workflow path review against `.github/workflows/nightly-follower-history.yml`

---
*Phase: 11-historical-follower-tracking-growth-charts*
*Completed: 2026-03-10*
