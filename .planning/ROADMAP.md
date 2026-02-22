# Roadmap: OpenLinks

## Overview

OpenLinks moves from a schema-validated data foundation to a polished static SolidJS experience, then hardens deploy and quality workflows for reliable fork/template use. The roadmap prioritizes deterministic publishing first, then rich card differentiation, and finally extensibility/documentation that enables long-term customization and host portability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Bootstrap + Data Contract** - Establish template-ready repository setup and schema-validated JSON model.
- [ ] **Phase 2: Core UI + Theme Foundation** - Deliver profile page, simple cards, responsive layout, and baseline theming.
- [ ] **Phase 3: Rich Cards + Content Enrichment** - Add configurable rich card support with resilient fallback behavior.
- [ ] **Phase 4: CI/CD + GitHub Pages Delivery** - Automate validation, build, and deployment on GitHub.
- [ ] **Phase 5: Quality Hardening (Perf/A11y/SEO)** - Add and enforce quality gates for production readiness.
- [ ] **Phase 6: Docs + Extensibility Surface** - Finalize customization/deployment extension docs and onboarding guidance.

## Phase Details

### Phase 1: Bootstrap + Data Contract
**Goal**: Create a working starter project with a stable JSON schema and validation pipeline.
**Depends on**: Nothing (first phase)
**Requirements**: BOOT-01, BOOT-02, DATA-01, DATA-02, DATA-04, DATA-05, DATA-06
**Success Criteria** (what must be TRUE):
  1. Developer can fork/template the repo and run a successful local build with starter data.
  2. Profile and links JSON schemas validate required fields and approved URL schemes.
  3. Invalid JSON fails with actionable error output pointing to exact fields.
  4. Extension fields are supported in a documented safe namespace without breaking core rendering.
**Plans**: 3 plans

Plans:
- [ ] 01-01: Scaffold SolidJS project structure, starter data files, and schema files.
- [ ] 01-02: Implement validation scripts and wire validation into build/prebuild flow.
- [ ] 01-03: Add starter examples and basic contributor guidance for data edits.

### Phase 2: Core UI + Theme Foundation
**Goal**: Render an attractive, responsive profile page with simple cards and baseline theming.
**Depends on**: Phase 1
**Requirements**: UI-01, UI-02, UI-04, UI-05, UI-06, THEME-01, THEME-02
**Success Criteria** (what must be TRUE):
  1. Profile page renders entirely from validated JSON content.
  2. Simple cards display icon, label, and destination link correctly.
  3. UI is responsive at mobile and desktop breakpoints with usable tap targets.
  4. Dark mode is default, light mode is available, and mode preference persists.
  5. At least two themes are available using token-based styling.
**Plans**: 3 plans

Plans:
- [ ] 02-01: Build profile layout and simple card components with accessible semantics.
- [ ] 02-02: Implement theme token system with two starter themes and mode persistence.
- [ ] 02-03: Add responsive behavior and visual polish for card-based UI.

### Phase 3: Rich Cards + Content Enrichment
**Goal**: Support per-link simple/rich card configuration with resilient preview fallback.
**Depends on**: Phase 2
**Requirements**: DATA-03, UI-03
**Success Criteria** (what must be TRUE):
  1. Each link can be configured as simple or rich in JSON.
  2. Rich cards render preview metadata when available.
  3. Rich cards gracefully fall back to safe defaults when metadata is missing or fetch fails.
  4. Metadata enrichment does not make core build/deploy flow unreliable.
**Plans**: 2 plans

Plans:
- [ ] 03-01: Extend schema/types and rendering logic for rich card variant.
- [ ] 03-02: Implement optional build-time metadata enrichment with timeout and fallback behavior.

### Phase 4: CI/CD + GitHub Pages Delivery
**Goal**: Guarantee automated validation, build, and deployment to GitHub Pages.
**Depends on**: Phase 3
**Requirements**: DEP-01, DEP-02, DEP-03, DEP-04
**Success Criteria** (what must be TRUE):
  1. PR and push workflows run schema validation and build checks automatically.
  2. Mainline changes produce deployable static artifacts.
  3. GitHub Pages deployment publishes successfully without manual intervention.
  4. Base path/project-page configuration works for deployed assets.
**Plans**: 2 plans

Plans:
- [ ] 04-01: Implement CI workflow for validation, tests, and static build.
- [ ] 04-02: Implement Pages deployment workflow with environment/path handling.

### Phase 5: Quality Hardening (Perf/A11y/SEO)
**Goal**: Enforce measurable quality gates so generated sites are fast, accessible, and discoverable.
**Depends on**: Phase 4
**Requirements**: QUAL-01, QUAL-02, QUAL-03, QUAL-04, QUAL-05
**Success Criteria** (what must be TRUE):
  1. Page metadata supports strong SEO and social sharing.
  2. Keyboard navigation and screen-reader semantics pass baseline accessibility checks.
  3. Color contrast and focus states meet defined accessibility thresholds.
  4. Build output meets agreed performance baseline for initial load.
  5. CI blocks merges/deploys when quality checks regress below thresholds.
**Plans**: 3 plans

Plans:
- [ ] 05-01: Add SEO metadata generation and verification checks.
- [ ] 05-02: Implement accessibility audits and keyboard/screen-reader smoke coverage.
- [ ] 05-03: Add performance budget checks and CI gating.

### Phase 6: Docs + Extensibility Surface
**Goal**: Finish onboarding and extension guidance for themes, layouts, and future deploy targets.
**Depends on**: Phase 5
**Requirements**: BOOT-03, THEME-03, THEME-04, DEP-05, DOC-01, DOC-02, DOC-03, DOC-04
**Success Criteria** (what must be TRUE):
  1. README fully documents fork/template bootstrap and first deployment path.
  2. JSON data model docs include clear simple/rich examples and validation expectations.
  3. Theming docs explain custom CSS and layout template extension points.
  4. Deployment docs include Pages troubleshooting and adapter-extension guidance.
  5. New contributors can follow docs to customize and publish without source-diving.
**Plans**: 3 plans

Plans:
- [ ] 06-01: Write complete bootstrap/data model documentation with examples.
- [ ] 06-02: Document theme and layout extension APIs with practical customization steps.
- [ ] 06-03: Document deployment flow, troubleshooting, and host adapter strategy.

## Progress

**Execution Order:**
Phases execute in numeric order: 2 -> 2.1 -> 2.2 -> 3 -> 3.1 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Bootstrap + Data Contract | 0/3 | Not started | - |
| 2. Core UI + Theme Foundation | 0/3 | Not started | - |
| 3. Rich Cards + Content Enrichment | 0/2 | Not started | - |
| 4. CI/CD + GitHub Pages Delivery | 0/2 | Not started | - |
| 5. Quality Hardening (Perf/A11y/SEO) | 0/3 | Not started | - |
| 6. Docs + Extensibility Surface | 0/3 | Not started | - |
