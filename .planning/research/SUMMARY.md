# Project Research Summary

**Project:** OpenLinks
**Domain:** Developer-first static social links site generator
**Researched:** 2026-02-22
**Confidence:** HIGH

## Executive Summary

OpenLinks sits in the "link-in-bio" space but with a developer-owned, repository-first operating model. The most robust architecture is a SolidJS static site generated from schema-validated JSON, deployed through GitHub Actions to GitHub Pages. This aligns directly with the product goal: fork/template, edit data, push, publish.

The recommended approach is schema-first and CI-enforced. Treat JSON as the contract, enforce it before every build, and keep rendering/theme systems decoupled so forks can customize deeply without rewriting core logic. Rich cards should be supported, but metadata enrichment must be resilient and optional so external network instability does not undermine reliability.

The largest risks are schema drift across forks, fragile metadata fetching, and polish-induced accessibility regressions. These are manageable with versioned schemas, fallback-rich pipelines, and non-negotiable quality gates in CI.

## Key Findings

### Recommended Stack

SolidStart + SolidJS with TypeScript provides a modern static-capable frontend foundation with strong SEO and performance characteristics. AJV-based schema validation gives deterministic build quality, and GitHub-native workflows provide the best onboarding and deployment path for template/fork users.

**Core technologies:**
- **SolidStart + SolidJS**: Static rendering and component UI model — modern and suitable for polished link pages.
- **JSON Schema + AJV**: Content contract and validation — prevents broken fork deployments.
- **GitHub Actions + GitHub Pages**: Automated validation/build/deploy — matches product distribution strategy.

### Expected Features

This domain expects profile identity, clean link cards, responsive design, theme support, and strong SEO/accessibility basics. OpenLinks-specific differentiation comes from schema rigor, mixed simple/rich card support, and customization/deployment extensibility.

**Must have (table stakes):**
- Profile + link cards with known platform icons
- Responsive UI with dark/light support
- GitHub-based automated deploy flow

**Should have (competitive):**
- JSON schema validation and typed errors
- Theme tokens + layout extension points
- Optional build-time rich metadata previews

**Defer (v2+):**
- CLI CRUD tool
- In-site GitHub PR editor
- Full deployment adapter suite beyond Pages

### Architecture Approach

Use a three-layer model: authoring/config (`data/` + `schema/`), deterministic build pipeline (validate -> optional enrich -> prerender), and hosting workflows (GitHub Pages first, adapters later). Keep deployment-provider details outside app code and keep themes decoupled from card data.

**Major components:**
1. **Data contract and validator** — defines and enforces schema.
2. **Rendering and theming system** — turns validated data into accessible, extensible UI.
3. **Deployment automation** — validates, builds, and publishes reliably.

### Critical Pitfalls

1. **Fragile metadata fetches** — avoid by making enrichment optional with strict fallback behavior.
2. **Schema drift in forks** — avoid via versioned schemas and migration guidance.
3. **Shallow theming architecture** — avoid by tokenizing themes and isolating layout templates.
4. **A11y/SEO regressions under visual polish** — avoid with CI quality gates and manual smoke checks.
5. **GitHub Pages path misconfiguration** — avoid with centralized base path config and deploy verification.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Data Contract + Validation Foundation
**Rationale:** Everything depends on trusted content structure.
**Delivers:** JSON schemas, validation scripts, sample data, clear error reporting.
**Addresses:** Table-stakes reliability and contributor experience.
**Avoids:** Schema drift and broken builds.

### Phase 2: Core UI + Theme Architecture
**Rationale:** User-facing value starts once data can render reliably.
**Delivers:** Solid profile page, simple cards, dark/light default themes, tokenized styling.
**Uses:** SolidStart rendering and component boundaries.
**Implements:** Rendering/theming architecture components.

### Phase 3: Rich Cards + Metadata Enrichment
**Rationale:** Differentiator after core flow is stable.
**Delivers:** Rich card type, optional build-time metadata enrichment, fallback logic.
**Addresses:** Differentiation without runtime fragility.

### Phase 4: Quality Hardening (Perf/A11y/SEO)
**Rationale:** Production readiness requires measurable quality gates.
**Delivers:** CI checks, Lighthouse baselines, accessibility and SEO regression guards.
**Avoids:** "Looks done but isn't" launch failures.

### Phase 5: GitHub Template + Deployment Hardening
**Rationale:** Distribution and maintainability close the loop.
**Delivers:** Template-first onboarding docs, GitHub Pages workflow polish, extension points for future deploy adapters.
**Implements:** First-class fork/template experience.

### Phase Ordering Rationale

- Validation first prevents downstream churn and broken UI assumptions.
- Theming architecture must be set before rich features to avoid rework.
- Rich metadata is intentionally sequenced after stable simple-card rendering.
- Quality and deployment hardening close risk gaps before broader adoption.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3:** Metadata enrichment policy (timeouts, retry strategy, cache invalidation).
- **Phase 5:** Deployment adapter abstraction for non-GitHub targets.

Phases with standard patterns (skip research-phase):
- **Phase 1:** JSON schema + AJV validation flow is well-documented.
- **Phase 2:** Solid component/theming patterns are established.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified via official Solid and GitHub docs plus package registry versions |
| Features | HIGH | Strong alignment between domain expectations and user-stated goals |
| Architecture | HIGH | Conventional static-pipeline model with clear extension points |
| Pitfalls | HIGH | Common failure modes are concrete and actionable for this scope |

**Overall confidence:** HIGH

### Gaps to Address

- **Rich metadata policy:** Decide strict behavior for cache TTL, failed-domain retries, and manual overrides.
- **Theme contract boundaries:** Define what is guaranteed stable API vs customizable internals for forks.

## Sources

### Primary (HIGH confidence)

- [SolidStart docs](https://docs.solidjs.com/solid-start) — framework and app model
- [Solid static generation docs](https://docs.solidjs.com/solid-start/building-your-application/rendering/static-site-generation-ssg) — SSG behavior
- [GitHub Pages custom workflow docs](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) — deployment workflow actions
- npm registry (`npm view`) snapshots on 2026-02-22 — stack version verification

### Secondary (MEDIUM confidence)

- Comparable feature sets from link-page products (Linktree/Carrd class tools)

### Tertiary (LOW confidence)

- None required for current scope

---
*Research completed: 2026-02-22*
*Ready for roadmap: yes*
