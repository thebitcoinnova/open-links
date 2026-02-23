# OpenLinks

## What This Is

OpenLinks is a developer-first, free, open source, version-controlled static website generator for social media links. Developers fork/template the repo, edit structured JSON content, and publish through CI-driven static deployment.

## Core Value

A developer can fork/template the repo, edit structured link data, and reliably publish a polished personal links site with minimal friction.

## Current State

- **Shipped version:** v1.0 (2026-02-23)
- **Milestone scope delivered:** phases 1-6
- **Primary stack:** SolidJS + TypeScript + JSON schema validation + GitHub Actions + GitHub Pages
- **Quality posture:** SEO/a11y/performance checks integrated and CI-gated
- **Extensibility posture:** documented theme/layout/deployment extension pathways for fork maintainers

## Requirements

### Validated

- ✓ Fork/template-based onboarding and first deploy flow.
- ✓ Schema + policy validated JSON data contract for profile/links/site.
- ✓ Configurable simple/rich cards with resilient fallback behavior.
- ✓ Responsive profile/cards UI with dark-default mode and theme support.
- ✓ Automated CI validation/build plus GitHub Pages deployment workflow.
- ✓ Quality checks (SEO/a11y/perf) integrated into required CI lane.
- ✓ Extensibility docs for theming, layout customization, deployment operations, and adapter expectations.

### Active (Next Milestone Candidates)

- [ ] CLI-assisted CRUD workflow for `data/*.json` (v2 candidate).
- [ ] AI-skill-driven guided content update automation improvements.
- [ ] First-class non-GitHub hosting adapter implementation.
- [ ] Optional in-site editor + PR generation workflow.
- [ ] Custom-domain setup UX hardening.

### Out of Scope

- Authentication/accounts in hosted product form.
- Analytics dashboard as a built-in platform feature.
- CMS/plugin marketplace model.

## Context

v1.0 validated the developer-first repository model and demonstrated that data-driven static publishing, CI automation, and quality enforcement can coexist with strong customization flexibility.

## Constraints

- **Tech stack:** SolidJS static build remains primary for current architecture.
- **Source of truth:** JSON content model remains canonical.
- **Deployment:** GitHub Pages remains first-class supported path.
- **Quality:** Performance, accessibility, and SEO checks remain mandatory release gates.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SolidJS static site architecture | Aligns with static deploy model and desired DX | ✓ Validated in v1.0 |
| JSON as primary content source | Enables deterministic builds and AI-friendly edits | ✓ Validated in v1.0 |
| GitHub Actions build/deploy path | Supports template/fork UX and automation | ✓ Validated in v1.0 |
| Dark-default with light option | Matches UX direction and accessibility goals | ✓ Validated in v1.0 |
| Rich + simple card support in v1 | Balances speed and richer presentation | ✓ Validated in v1.0 |
| Adapter-friendly deployment design | Avoid host lock-in and future rewrites | ✓ Validated by docs/structure in v1.0 |

## Next Milestone Goals

1. Define v1.1 milestone scope and requirements.
2. Decide whether to prioritize deployment adapters, CLI workflow, or editing UX.
3. Preserve CI quality baseline while adding next-scope features.

---
*Last updated: 2026-02-23 after v1.0 milestone completion*
