# Phase 4: CI/CD + GitHub Pages Delivery - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

## Phase Boundary

Guarantee automated validation, build, and deployment to GitHub Pages for this repository and forks/templates. This phase defines CI/deploy workflow behavior, gate policy, and Pages path handling; it does not add non-GitHub hosting targets.

## Implementation Decisions

### CI Trigger and Gating Policy
- PR CI should run only for pull requests targeting `main`.
- Required PR checks should run: `validate:data`, `typecheck`, and `build`.
- Warnings are allowed in required checks; only command failures should block merge.
- Full CI should run on all direct pushes.
- Do not enforce an author/owner-only execution gate for CI jobs.

### Deployment Promotion Behavior
- Deployment should run automatically on push to `main` after checks succeed.
- Manual deployment (`workflow_dispatch`) should also be available.
- Deployment should prefer reusing the CI build artifact for the same commit, with rebuild fallback if artifact reuse is unavailable.
- No actor-based gating for deploy (supports maintainers and AI-agent-driven commits as long as workflow security is preserved).
- Concurrent deploys should cancel older in-progress runs and keep the newest run.

### GitHub Pages Target and Base-Path Expectations
- Pages mode should be configurable, with default behavior optimized for Project Pages (`https://<user>.github.io/<repo>/`).
- Base path handling should be config-driven with sensible defaults/auto behavior (not hardcoded globally).
- Repository-name path handling should auto-detect from GitHub context, with optional manual override.
- Misconfigured Pages target/source should fail deployment with clear remediation steps.

### CI Failure and Diagnostics UX
- Failure output should include both concise summary and raw command output, with summary first.
- Diagnostic artifacts/log bundles should upload only on failure.
- PR feedback should include logs, a workflow summary, and a PR comment with key failure highlights/remediation.
- In Phase 4, strict-check failures should be treated as non-blocking warnings when standard checks pass.

### Claude's Discretion
- Exact GitHub Actions workflow file split (single workflow vs CI/deploy split) as long as behavior matches the decisions above.
- Exact artifact naming and retention policy.
- Exact implementation mechanics for PR commenting and summary formatting.

## Specific Ideas

- Keep workflows security-safe without relying on actor identity gating.
- Favor artifact reuse to reduce redundant rebuild cost while preserving reliability via rebuild fallback.
- Make deployment misconfiguration failures highly actionable (clear remediation text, not generic failure).

## Deferred Ideas

- Non-GitHub deployment targets (AWS/Railway adapters) remain out of scope for this phase.
- Final strict-gating policy (blocking vs non-blocking) can be tightened in later quality-hardening phases.

---

*Phase: 04-ci-cd-github-pages-delivery*
*Context gathered: 2026-02-23*
