# Phase 5: Quality Hardening (Perf/A11y/SEO) - Research

**Researched:** 2026-02-23
**Domain:** SEO metadata, accessibility quality enforcement, performance budget gating, CI quality diagnostics
**Confidence:** HIGH

## User Constraints (from CONTEXT.md)

### Locked Decisions
- SEO baseline is comprehensive (not minimal) and must include strong social-sharing metadata.
- Metadata precedence must support a fallback chain from global defaults to section/link-level overrides.
- In standard mode, missing metadata should auto-fill and emit warnings.
- Social preview image is optional, but deterministic fallback behavior is required.
- Diagnostics should include explicit remediation steps.
- Accessibility baseline requires full keyboard operability across all interactive surfaces.
- Screen-reader semantics must include meaningful labels/context for key content.
- Contrast/focus regressions should warn in standard mode and fail in strict mode.
- Accessibility verification should combine automated checks with a lightweight manual smoke checklist.
- Performance budgets should target both mobile and desktop.
- Budgeting should include a top-level gate and metric-level checks.
- Standard mode should warn on performance regressions.
- Measured routes should be configurable with sensible defaults.
- PR blocking remains on required lane; strict quality checks run on `main` pushes.
- Failure output should include summary, artifacts/log links, and remediation checklist per failed domain.
- If a configured blocking domain fails, the overall gate fails.

### Claude's Discretion
- Exact tool selection for quality checks.
- Exact threshold values as long as policy (standard warning vs strict failure where required) is preserved.
- Exact CI job decomposition and report formatting.

## Summary

Phase 5 should introduce a unified quality contract spanning SEO, accessibility, and performance, then enforce that contract in CI with actionable diagnostics. The strongest implementation pattern for this codebase is:

1. Add explicit quality config to `data/site.json` + `schema/site.schema.json`.
2. Add a single quality runner script that executes domain checks and outputs deterministic diagnostics (human + JSON).
3. Wire baseline quality checks into required CI (blocking for required thresholds).
4. Keep stricter checks on the non-blocking strict lane to preserve current CI policy.

This aligns with current repository patterns (schema-driven config, strict/standard dual modes, remediation-first diagnostics in scripts and CI).

## Standard Stack

### Core

| Tool | Purpose | Why It Fits |
|------|---------|-------------|
| Structured site config + schema validation | Centralize quality thresholds/policies in JSON | Matches existing OpenLinks data-contract approach. |
| Unified TypeScript quality runner (`scripts/`) | Domain checks + output formatting + exit semantics | Reuses current validation/enrichment script patterns. |
| Lighthouse CI (`@lhci/cli`) or equivalent runtime audit entrypoint | Perf + SEO category metrics against built site | Suitable for static-site budget regression checks. |
| Axe-based accessibility scan (`axe-core` automation) | Deterministic accessibility assertions | Covers semantic/interaction baseline in CI. |

### Supporting

| Tool/Pattern | Purpose | When to Use |
|--------------|---------|-------------|
| Manual smoke checklist artifact (markdown/json) | Ensure keyboard/screen-reader expectations are explicitly tracked | Every phase-5 quality run, especially CI summaries. |
| Route list config in site data | Control which views are measured | For future route expansion while defaulting to profile/home. |
| Domain-specific remediation mappings | Convert failed assertions into actionable guidance | On every failed quality check report. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Unified quality runner | Separate per-tool ad-hoc scripts only | Simpler initial setup, weaker cross-domain diagnostics consistency. |
| Required+strict dual policy | Make strict blocking in Phase 5 | Stronger enforcement but conflicts with locked CI policy for this phase. |
| Config-driven budgets | Hardcoded constants in scripts | Less flexible for forks and harder to document/extend. |

## Architecture Patterns

### Pattern 1: Quality Contract in `site.json`

Define SEO defaults, accessibility policy knobs, and performance budgets in site-level config with schema typing. This keeps quality behavior fork-friendly and version-controlled.

### Pattern 2: Standard/Strict Dual Execution Modes

Mirror existing validate/enrich semantics:
- Standard: enforce required baseline failures while preserving warning diagnostics.
- Strict: escalate warning-level domains (contrast/focus and stricter budgets) to failures.

### Pattern 3: Domain-Partitioned Diagnostics

Each domain (SEO, A11y, Perf) should emit:
- pass/fail/warn status
- impacted route/selector/metric
- clear remediation guidance

Then aggregate into one summary for CI output and one machine-readable JSON artifact.

### Pattern 4: CI Lane Integration by Policy

- Required lane: blocking baseline quality checks on PR/push.
- Strict lane: stricter quality checks on `main` push, non-blocking signal in this phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Perf/SEO synthetic audit engine | Custom browser profiler | Lighthouse-compatible audit flow | Better metric consistency and lower maintenance. |
| Accessibility heuristic parser | Custom regex/DOM approximations | Axe-based rule engine + curated assertions | More reliable signal quality. |
| CI-only unstructured logs | Raw command output only | Structured report + summary-first output | Faster triage and better remediation UX. |

## Common Pitfalls

### Pitfall 1: Thresholds disconnected from config
**What goes wrong:** Budgets drift across scripts and CI jobs.
**How to avoid:** Single source of truth in `site.json` quality config consumed by scripts.

### Pitfall 2: A11y checks pass but keyboard UX still broken
**What goes wrong:** Rule scanners miss interaction flow issues.
**How to avoid:** Add explicit keyboard smoke steps and keep them versioned in quality check output.

### Pitfall 3: Performance checks too noisy
**What goes wrong:** Flaky failures from unstable environment assumptions.
**How to avoid:** Define deterministic run conditions and use clear warning/failure policy between standard and strict modes.

### Pitfall 4: SEO metadata appears valid but social previews degrade
**What goes wrong:** Missing/weak OG/Twitter fallback values.
**How to avoid:** Deterministic fallback generation plus warning diagnostics that call out missing source fields.

## Open Questions

1. **Exact budget numbers for desktop/mobile and metric thresholds**
   - Recommendation: establish conservative baseline numbers first, then tighten after first CI baseline run.

2. **Final tool split for accessibility checks (single tool vs hybrid)**
   - Recommendation: use one deterministic automated runner plus explicit keyboard smoke assertions to reduce ambiguity.

## Sources

### Primary (HIGH confidence)
- `.planning/phases/05-quality-hardening-perf-a11y-seo/05-CONTEXT.md`
- `.planning/ROADMAP.md` (Phase 5 goals/success criteria)
- `.planning/REQUIREMENTS.md` (QUAL-01..QUAL-05)
- Existing codebase patterns:
  - `scripts/validate-data.ts`
  - `scripts/validation/format-output.ts`
  - `.github/workflows/ci.yml`
  - `src/routes/index.tsx`
  - `index.html`

## Metadata

**Research scope:** quality policy shape, script/CI integration patterns, diagnostics strategy

**Confidence breakdown:**
- Repo integration approach: HIGH
- CI policy alignment: HIGH
- Tool choice compatibility: MEDIUM-HIGH
- Threshold calibration specifics: MEDIUM

**Research date:** 2026-02-23
**Valid until:** 2026-03-25

---

*Phase: 05-quality-hardening-perf-a11y-seo*
*Research completed: 2026-02-23*
*Ready for planning: yes*
