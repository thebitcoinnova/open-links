# OpenLinks

## What This Is

OpenLinks is a personal-first, free, open source, version-controlled static website generator for social media links. It is designed so developers can fork or use a GitHub template, edit a JSON data file, and automatically publish their own branded links website. The initial implementation targets GitHub Pages with an architecture intentionally extensible to additional deployment targets.

## Core Value

A developer can fork/template the repo, edit structured link data, and reliably publish a polished personal links site with minimal friction.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Developers can fork/template the repository and publish a personalized links site from JSON data.
- [ ] The project defines and validates a clear JSON schema for profile, links, metadata, and card configuration.
- [ ] SolidJS statically builds a sleek profile + cards UI with dark mode default, light mode support, and at least 1-2 starter themes.
- [ ] Users can configure simple cards and rich cards per-link, with recognizable icons for known services.
- [ ] GitHub Actions validates data, builds the static site, and deploys to GitHub Pages.
- [ ] The architecture supports future deployment target adapters (for example AWS/Railway) without major rewrites.
- [ ] The generated site is performance-focused, accessible, and SEO-ready.
- [ ] Theme selection, custom CSS, and layout templates are exposed for straightforward customization by forks.

### Out of Scope

- Authentication/accounts — V1 targets developer-managed repos and git-driven updates.
- Analytics dashboard — deferred to preserve focus on static publishing core.
- CMS/plugin marketplace — deferred to avoid premature platform complexity.
- Full production CLI — deferred to V2.
- In-site editor with GitHub PR generation — optional nice-to-have after core flow is stable.

## Context

This project starts as a greenfield repo with no existing application code. The intended distribution model is GitHub-native: users fork or start from template, customize structured JSON, and publish via CI. The primary v1 user is a developer comfortable editing repository files directly or delegating edits to an AI coding agent. Design direction emphasizes a modern card-based profile page, strong theming extensibility, and clear separation between data model and presentation.

## Constraints

- **Tech stack**: SolidJS static build — chosen for modern frontend developer experience and static output suitability.
- **Source of truth**: JSON content model with schema validation — required for deterministic builds and AI-friendly editing.
- **Deployment**: GitHub Pages first — fastest path to zero/low-cost publishing.
- **Extensibility**: Deployment abstraction and theming hooks in v1 — prevents lock-in to one host or one UI path.
- **Quality**: Performance, accessibility, and SEO are mandatory quality gates — these are core product expectations, not stretch goals.
- **Audience**: Developer-first v1 — no non-technical UX commitments such as hosted account management.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SolidJS static site architecture | Matches desired frontend stack and static deploy model | — Pending |
| JSON as primary content source | Enables schema validation, git diffs, and automated editing workflows | — Pending |
| GitHub Actions-driven build/deploy | Supports template/fork UX and zero-touch deployment on push | — Pending |
| Default dark mode with light mode support | Aligns with stated UX preference and broad usability | — Pending |
| Simple + rich card support in v1 | Balances fast setup with richer preview capability | — Pending |
| No auth/analytics/CMS/plugins in v1 | Preserves delivery focus on reliable core publish workflow | — Pending |
| Deployment architecture designed for adapters | Allows future GitHub Pages + AWS/Railway without rewrite | — Pending |

---
*Last updated: 2026-02-22 after initialization*
