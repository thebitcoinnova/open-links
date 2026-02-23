# Phase 5: Quality Hardening (Perf/A11y/SEO) - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

## Phase Boundary

Enforce measurable quality gates so generated OpenLinks sites are fast, accessible, and discoverable. This phase defines SEO, accessibility, and performance quality policies plus CI gating behavior; it does not add new product capabilities outside quality hardening.

## Implementation Decisions

### SEO Metadata Policy
- Adopt a comprehensive metadata baseline (not minimal): strong SEO + social sharing coverage.
- Metadata precedence should support a full fallback chain: global defaults, section/link-level overrides, and deterministic fallback behavior.
- In standard (non-strict) mode, missing metadata should auto-fill with fallback values and emit warnings.
- Social preview images are optional, but deterministic fallback image behavior is required when explicit images are absent.
- Build diagnostics should include actionable metadata remediation steps.

### Accessibility Quality Bar
- Keyboard accessibility baseline: full interactive surface must be keyboard-operable (not core flow only).
- Screen-reader baseline: meaningful landmarks/labels and contextual announcements for key interactive content.
- Contrast/focus policy: warn in standard mode, fail in strict mode.
- Accessibility verification source: automated audits plus a lightweight manual smoke checklist.

### Performance Budget Targets
- Budget baseline should cover both mobile and desktop targets.
- Budget model should be hybrid: top-level pass/fail threshold plus metric-level thresholds.
- Performance reporting should include detailed diagnostics and remediation guidance when budgets are exceeded.
- In standard mode, regressions warn (not fail).
- Measured pages should be configurable with sensible defaults.

### CI Quality Gate Behavior
- PR blocking should remain on required lane only for this phase (strict remains advisory).
- Strict quality checks should run on pushes to `main`.
- Failure output should include summary + detailed artifacts/log links + explicit remediation checklist per failed quality domain.
- If a configured blocking quality domain fails, overall gate fails.

### Claude's Discretion
- Exact toolchain selection for SEO/a11y/perf audits as long as decisions above are satisfied.
- Exact quality threshold values and baseline numbers, provided they align with dual-target and hybrid-budget policy.
- Exact CI job decomposition and report formatting mechanics.

## Specific Ideas

- Keep diagnostics highly actionable: each failure should clearly map to a remediation path.
- Prefer deterministic fallback behavior (especially metadata/social previews) over silent omissions.
- Preserve the existing required-vs-strict lane strategy while expanding quality signal coverage.

## Deferred Ideas

- None - discussion stayed within phase scope.

---

*Phase: 05-quality-hardening-perf-a11y-seo*
*Context gathered: 2026-02-23*
