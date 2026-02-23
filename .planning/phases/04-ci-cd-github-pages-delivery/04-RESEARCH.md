# Phase 4: CI/CD + GitHub Pages Delivery - Research

**Researched:** 2026-02-23
**Domain:** GitHub Actions CI orchestration, GitHub Pages artifact deploy flow, branch/path handling
**Confidence:** HIGH

## User Constraints (from CONTEXT.md)

### Locked Decisions
- PR CI should run only for pull requests targeting `main`.
- Required PR checks are `validate:data`, `typecheck`, and `build`.
- Warnings are allowed for required checks; only command failures block merge.
- Full CI should run on all direct pushes.
- No actor/owner gate should block CI or deploy execution.
- Deploy should run automatically on push to `main`, and also support manual `workflow_dispatch`.
- Deployment should prefer CI artifact reuse, with rebuild fallback when artifact reuse is unavailable.
- Concurrent deploys should cancel older in-progress runs and keep newest.
- Pages mode should be configurable with project-pages-optimized default behavior.
- Base path should be config-driven with auto/default handling, not hardcoded globally.
- Repo-name path handling should auto-detect from GitHub context with optional override.
- Misconfigured Pages target/source should fail with clear remediation.
- Failure UX should include summary-first output plus raw logs, artifact upload on failure, and PR comment feedback.
- For Phase 4, strict-check failures are warning-only when standard checks pass.

### Claude's Discretion
- Whether to use one workflow with multiple jobs or split workflows, as long as promotion behavior remains correct.
- Exact artifact naming and retention windows.
- Exact PR comment formatting and summary content structure.

### Deferred Ideas (OUT OF SCOPE)
- Non-GitHub deployment targets/adapters.
- Tightening strict checks from warning-only to blocking (deferred to later quality phase).

## Summary

Phase 4 should establish a deterministic GitHub-native release path:
1) CI checks on PR/push,
2) build artifact generation,
3) controlled Pages deployment on main/manual trigger,
4) actionable diagnostics.

The most reliable path for this project is an artifact-first Pages pipeline using official Pages actions (`configure-pages`, `upload-pages-artifact`, `deploy-pages`) and workflow conditions to separate check execution from deploy promotion.

Recommendation: implement in two slices aligned to roadmap plans:
- **04-01:** CI workflow gates and artifact production.
- **04-02:** Deploy workflow/job with artifact reuse fallback, concurrency cancellation, and branch/path-safe Pages handling.

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| GitHub Actions workflow syntax | current | CI orchestration and Pages deploy control | Native platform mechanism for branch/PR/push policies. |
| `actions/checkout` | `v5` | Checkout repo content in CI jobs | Current official checkout action line. |
| `actions/setup-node` | `v4` | Deterministic Node setup and npm caching | Standard Node CI setup. |
| `actions/configure-pages` | `v5` | Configure Pages deploy context/base metadata | Official Pages setup action. |
| `actions/upload-pages-artifact` | `v4` | Upload static artifact (`dist`) for Pages deploy | Official Pages artifact handoff. |
| `actions/deploy-pages` | `v4` | Publish artifact to GitHub Pages | Official deploy step for Pages. |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `actions/upload-artifact` | `v4` | Upload failure diagnostics/log bundles | Use on CI failure paths only. |
| `actions/github-script` | `v7` | PR comment summary for failures/warnings | Use when workflow runs in PR context. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Artifact-first Pages deployment | Rebuild-only deploy job | Simpler to wire, slower and less deterministic for promotion. |
| Summary + PR comment diagnostics | Logs-only diagnostics | Less implementation work, weaker contributor feedback loop. |
| Cancel-in-progress deploy concurrency | Queue all deploys | More predictable history, slower publish turnaround and stale deploy risk. |

## Architecture Patterns

### Recommended Project Structure

```text
.github/
  workflows/
    ci.yml
    deploy-pages.yml
```

*(Single-workflow with multi-jobs is also valid if it preserves all locked behaviors.)*

### Pattern 1: Policy-Driven Trigger Matrix

**What:** Use workflow trigger conditions and job-level `if:` guards to separate PR checks, push checks, and deploy promotion.
**When to use:** Always in this phase, because PR and main deploy behaviors differ.

### Pattern 2: Artifact-First Promotion with Rebuild Fallback

**What:** Prefer deployment from CI-produced artifact for the same commit; rebuild only when artifact cannot be retrieved.
**When to use:** Main/manual deploy paths.

### Pattern 3: Branch-Aware Pages Base Path Handling

**What:** Keep base path dynamic from repo context with optional override.
**When to use:** For fork/template compatibility across project pages and potential user pages.

### Pattern 4: Summary-First Failure UX

**What:** Emit concise status/remediation summary and then raw logs; publish failure artifact bundles and PR comment context.
**When to use:** On any CI/deploy failure path.

### Anti-Patterns to Avoid
- Hardcoding `base: "/repo-name/"` without repo-context fallback.
- Running deploy on PR events.
- Requiring actor-based gating for safety (breaks automation and does not replace proper workflow permissions).
- Treating strict-check warnings as blocking in this phase (conflicts with locked policy).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pages deployment transport | Custom `gh-pages` push scripts | Official Pages actions pipeline | Lower maintenance and first-class permissions model. |
| Workflow diagnostics formatting everywhere | Repeated shell `echo` blocks | Centralized summary section + reusable comment step | Consistent operator/developer feedback. |
| Base path derivation in multiple files | Ad-hoc env parsing in workflows and app | Single source strategy (`vite.config.ts` + controlled env inputs) | Prevents path drift and broken assets. |

## Common Pitfalls

### Pitfall 1: Deploys from wrong ref/context
**What goes wrong:** Pages deploy runs for non-main pushes or PR contexts.
**How to avoid:** explicit `if:` guard for deploy job (`push main` or manual dispatch only).

### Pitfall 2: Artifact mismatch between CI and deploy
**What goes wrong:** Deploy uses stale or mismatched build outputs.
**How to avoid:** include commit/run identifiers in artifact strategy and fallback rebuild path when artifact retrieval fails.

### Pitfall 3: Pages base path regression on forks
**What goes wrong:** deployed site loads broken assets under fork repo names.
**How to avoid:** preserve dynamic base behavior using `GITHUB_REPOSITORY` and override controls already in `vite.config.ts`.

### Pitfall 4: Unactionable CI failures
**What goes wrong:** contributors only get long raw logs without clear next action.
**How to avoid:** job summary + PR comment with short failure reasons and remediation hints.

## Code Examples

### Trigger and deploy split (conceptual)

```yaml
on:
  pull_request:
    branches: [main]
  push:
    branches: ["**"]
  workflow_dispatch:
```

### Deploy job guard (conceptual)

```yaml
if: github.event_name == 'workflow_dispatch' || (github.event_name == 'push' && github.ref == 'refs/heads/main')
```

### Deploy concurrency (conceptual)

```yaml
concurrency:
  group: pages-${{ github.ref }}
  cancel-in-progress: true
```

## State of the Art (2024-2026)

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Branch-push deploy scripts with personal tokens | GitHub Pages official actions with job permissions | Safer defaults, fewer custom scripts. |
| Logs-only failure handling | Summary + artifacts + contextual PR feedback | Faster issue triage for maintainers and contributors. |
| Rebuild-only deploy steps | Artifact-first promotion | Better reproducibility and shorter deploy latency. |

## Open Questions

1. **Workflow topology preference**
   - Known: both split-workflow and single-workflow models can satisfy requirements.
   - Unclear: preferred maintainability tradeoff for this repo.
   - Recommendation: choose split files (`ci.yml`, `deploy-pages.yml`) to align with roadmap plan boundaries.

2. **Manual dispatch default ref behavior**
   - Known: manual deploy is required.
   - Unclear: whether manual deploy should permit arbitrary ref selection or constrain to default branch by default.
   - Recommendation: default to current/default branch with explicit ref override input.

## Sources

### Primary (HIGH confidence)
- `.planning/phases/04-ci-cd-github-pages-delivery/04-CONTEXT.md`
- `.planning/ROADMAP.md` (Phase 4 goal, requirements, success criteria)
- `.planning/REQUIREMENTS.md` (DEP-01..DEP-04)
- Current repo state: `vite.config.ts`, `package.json`, and existing scripts

### External primary docs (HIGH confidence)
- GitHub Docs: Node + Pages workflow examples and official Pages actions (`configure-pages`, `upload-pages-artifact`, `deploy-pages`)
- GitHub Docs: Workflow triggers and conditions (`pull_request`, `push`, `workflow_dispatch`)

## Metadata

**Research scope:** CI trigger/gate policy, artifact promotion, Pages deployment strategy, diagnostics behavior

**Confidence breakdown:**
- Trigger/deploy architecture: HIGH
- Pages action flow: HIGH
- Diagnostics strategy: HIGH
- Edge-case manual-dispatch behavior: MEDIUM

**Research date:** 2026-02-23
**Valid until:** 2026-03-25

---

*Phase: 04-ci-cd-github-pages-delivery*
*Research completed: 2026-02-23*
*Ready for planning: yes*
