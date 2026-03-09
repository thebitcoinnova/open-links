# OpenLinks

## What This Is

OpenLinks is a developer-first, free, open source, version-controlled static website generator for social media links. Developers fork/template the repo, edit structured JSON content, and publish through CI-driven static deployment.

## Core Value

A developer can fork/template the repo, edit structured link data, and reliably publish a polished personal links site with minimal friction.

## Current Milestone: v1.1 Social Profile Metadata + Card Refresh

**Goal:** Make supported social links feel like real profile cards by persisting audience metadata and refreshing card presentation around profile identity.

**Target features:**
- Persist profile-centric metadata such as handle, profile image, and follower/following/subscriber-style counts in saved link data for supported domains.
- Separate profile-authored descriptions from fetched page/header descriptions when a supported platform exposes both surfaces.
- Refresh simple and rich cards so profile-style links show circular profile imagery, handles, audience stats, and source context without losing existing description/content cues.
- Update extractor guidance, Studio editing flows, and docs so maintainers understand supported coverage, profile-description capture, manual overrides, and fallback behavior.

## Current State

- **Shipped version:** v1.0 (2026-02-23)
- **Active milestone:** v1.1 planning (started 2026-03-07)
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

### Active (v1.1 scope)

- [ ] Supported profile-style links can persist social identity metadata such as handle, profile image, and audience counts in saved link data.
- [ ] Supported profile-style links can persist a profile-authored description separately from the generic fetched page description.
- [ ] Simple and rich cards present supported social links as profile-like surfaces without regressing current description, branding, and fallback rendering.
- [ ] Maintainer docs, Studio flows, and examples explain the new social metadata fields, profile-description capture, and override/fallback paths.

### Out of Scope

- Client-side live follower polling or direct platform API fetches - OpenLinks remains a deterministic static build.
- Full native embed/post recreation per platform - this milestone focuses on link cards that feel profile-native, not iframe/embed parity.
- In-site editor + PR generation workflow - still deferred behind data-model and card-presentation improvements.
- First-class non-GitHub hosting adapter implementation - remains future work while UI/data polish is prioritized.

## Context

v1.0 validated the developer-first repository model and demonstrated that data-driven static publishing, CI automation, and quality enforcement can coexist with strong customization flexibility.

Recent UI polish work exposed a gap: social profile links still read more like generic cards than native profile surfaces even when handles and richer identity data are already available. v1.1 builds on the existing handle resolver, rich metadata pipeline, and authenticated extractor framework so supported profile links can carry audience counts and profile-first visuals without abandoning deterministic static generation.

## Constraints

- **Tech stack:** SolidJS static build remains primary for current architecture.
- **Source of truth:** JSON content model remains canonical.
- **Runtime data:** No client-side platform API fetching - follower counts and profile stats must come from manual or generated saved metadata.
- **Deployment:** GitHub Pages remains first-class supported path.
- **Compatibility:** Non-profile links and existing fallback behavior must remain intact when profile metadata is absent.
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
| Social profile metadata remains optional and additive | Avoid breaking non-profile links and preserve manual JSON workflows | - Pending |
| Profile-style cards will prioritize identity cues (avatar, handle, audience stats) ahead of source branding | Align the UI with how users recognize social accounts while retaining current content/source context | - Pending |

---
*Last updated: 2026-03-07 after starting milestone v1.1*
