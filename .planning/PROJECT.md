# OpenLinks

## What This Is

OpenLinks is a developer-first, free, open source, version-controlled static website generator for social media links. Developers fork/template the repo, edit structured JSON content, and publish through CI-driven static deployment.

## Core Value

A developer can fork/template the repo, edit structured link data, and reliably publish a polished personal links site with minimal friction.

## Current State

- **Shipped version:** v1.3 (2026-03-31)
- **Active milestone:** none — run `$gsd-new-milestone` to define the next milestone
- **Latest delivered scope:** v1.3 shipped phases 18-24 across 19 plans, adding first-class referral disclosure, public referral enrichment, live source-authored referral proof, a shared referral catalog, and a sibling referral-management skill
- **Primary stack:** SolidJS + TypeScript + JSON schema validation + GitHub Actions + GitHub Pages
- **Quality posture:** SEO/a11y/performance checks remain integrated and CI-gated, with known remaining debt around `/` performance budgets and fallback social-image warnings
- **Extensibility posture:** documented theme/layout/deployment extension pathways plus AI-guided and Studio-assisted CRUD paths for maintainers
- **Maintainer workflow posture:** prefer repo AI workflows/skills or Studio for routine CRUD; use direct JSON editing as the lower-level fallback
- **Planning focus:** no active milestone is defined yet; the next planning step is `$gsd-new-milestone`

## Next Milestone Goals

- Decide whether the next milestone should prioritize:
  - CI/runtime regression hardening for referral and card flows,
  - repo-quality debt cleanup (cache freshness, fallback SEO image, bundle/chunk warnings),
  - or a new user-facing feature area.
- Create a fresh milestone-scoped `REQUIREMENTS.md` via `$gsd-new-milestone`.
- Keep the accepted v1.3 debt visible when choosing the next milestone scope.

## Validated

- ✓ v1.0 foundation validated the fork/template workflow, JSON schema contract, rich/simple cards, CI/CD delivery, and extensibility docs.
- ✓ v1.1 now persists profile-centric social metadata such as handles, profile images, audience counts, and profile-authored descriptions in saved link data.
- ✓ Supported social links now render as profile-style simple and rich cards without regressing fallback cards for unsupported links.
- ✓ Rich profile cards now support an optional full-width description-image row when preview media is distinct from the profile image.
- ✓ OpenLinks now publishes append-only public follower-history artifacts plus a lazy-loaded analytics surface.
- ✓ Profile-level and card-level sharing now use a shared clean-URL Web Share flow.
- ✓ Maintainer docs, Studio guidance, and verification flows now cover the expanded social-card system and explicitly route routine CRUD toward AI workflows or Studio.
- ✓ OpenLinks now derives profile-header Quick Links from eligible top-level social/profile links instead of a second registry.
- ✓ The profile header now ships a visible, responsive, icon-first Quick Links strip with explicit outbound accessibility semantics and clean empty-state behavior.
- ✓ Maintainer docs and the verification guide now accurately explain and verify the shipped Quick Links behavior.
- ✓ Referral links now ship as a first-class additive contract with public enrichment, visible card disclosure UI, a live source-authored proof case, and a shared referral catalog plus sibling referral-management skill.

## Known Debt Carrying Forward

- Default CI still does not cover the full referral runtime/render regression surface.
- LinkedIn authenticated cache remains stale.
- Rumble follower metadata remains partial.
- SEO still warns that social preview metadata is using the deterministic fallback image.
- The analytics chart chunk remains large and should stay code-split or be reduced in a future cleanup pass.
- Content-image sync still relies on cached Facebook imagery after remote `403` responses.
- Broader social coverage, richer platform-specific metrics, and deeper Studio onboarding/editor flows remain future work.

## Out of Scope (Still True)

- Client-side live follower polling or direct platform API fetches - OpenLinks remains a deterministic static build.
- Full native embed/post recreation per platform - profile-style links remain card-based rather than full embed parity.
- First-class non-GitHub hosting adapter implementation - remains future work while product and workflow polish are prioritized.

## Archived Planning Context

<details>
<summary>v1.3 Referral Links + Offer Transparency planning context</summary>

### Goal

Add first-class referral-link support with explicit visitor/owner benefit disclosure, optional build-time offer-term enrichment, and rich-card-ready presentation without introducing a new link type.

### Target Features

- Add a dedicated `links[].referral` contract with transparent fields for what the visitor gets, what the site owner gets, offer/terms summary, terms/source URLs, and a `custom` escape hatch.
- Keep referral links additive to existing `simple` and `rich` cards so maintainers can author arbitrary referral destinations through the normal AI CRUD/manual JSON paths without waiting on a bespoke extractor.
- Extend build-time enrichment/public augmentation so common public referral destinations can follow canonical landing pages and capture promo metadata plus obvious terms when available.
- Reuse the existing rich-card image and brand-icon pipelines so referral links can show promo imagery, source branding, and disclosure details together.
- Update maintainer docs and README surfaces so referral authoring, extraction limits, and downstream contract impact stay explicit.

### Constraints

- Manual referral disclosures remain authoritative; extracted terms are assistive and must not silently overwrite explicit author copy.
- The milestone should generalize the existing one-off Club Orange referral behavior instead of growing more domain-specific referral patches.
- First-class Studio referral controls could stay deferred if AI CRUD plus the existing Advanced JSON path already covered the authoring workflow cleanly.

</details>

<details>
<summary>v1.2 Profile Quick Links + Header Usability Polish planning context</summary>

### Goal

Add a compact Quick Links strip above the top-level profile action bar by deriving major-platform social shortcuts from existing top-level links, then tighten that strip's responsive, accessible, and maintainer-facing behavior.

### Target Features

- Derive eligible Quick Links from existing top-level `data/links.json` entries rather than a separate shortcut registry.
- Render a visible, icon-first Quick Links strip above the profile action bar.
- Keep the strip responsive, accessible, and visually lighter than the action row.
- Document the behavior and verification path clearly for maintainers.

### Context

The existing profile header already had share/copy/QR actions and the repo already had strong known-site/icon resolution, but there was no fast path for visitors to jump directly to the most recognizable social destinations. v1.2 built on the existing static data model and header seam rather than reopening the broader architecture.

### Constraints

- **Source of truth:** Quick Links must derive from existing top-level links instead of a second registry.
- **Runtime data:** No client-side platform API fetching or dynamic eligibility lookups.
- **Compatibility:** The action row beneath the strip must remain intact and readable across mobile and desktop.
- **Scope:** Keep the milestone intentionally narrow; defer broader configurability and Studio-specific controls.

### Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Quick Links derive from `links[]` | Avoid drift and second authoring path | ✓ Good |
| One winner per platform with canonical tie-break support | Keep the strip compact and deterministic | ✓ Good |
| Visible strip remains icon-first, heading-free, and lighter than the action bar | Preserve scanability and avoid a second action-bar feel | ✓ Good |
| Docs frame the feature as renderer-level only | Clarifies downstream compatibility and current scope | ✓ Good |

</details>

<details>
<summary>v1.1 Social Profile Metadata + Card Refresh planning context</summary>

### Goal

Make supported social links feel like real profile cards by persisting audience metadata and refreshing card presentation around profile identity.

### Target Features

- Persist profile-centric metadata such as handle, profile image, and follower/following/subscriber-style counts in saved link data for supported domains.
- Separate profile-authored descriptions from fetched page/header descriptions when a supported platform exposes both surfaces.
- Refresh simple and rich cards so profile-style links show circular profile imagery, handles, audience stats, and source context without losing existing description/content cues.
- Update extractor guidance, Studio editing flows, and docs so maintainers understand supported coverage, profile-description capture, manual overrides, and fallback behavior.

### Context

v1.0 validated the developer-first repository model and demonstrated that data-driven static publishing, CI automation, and quality enforcement can coexist with strong customization flexibility.

Recent UI polish work exposed a gap: social profile links still read more like generic cards than native profile surfaces even when handles and richer identity data are already available. v1.1 built on the existing handle resolver, rich metadata pipeline, and authenticated extractor framework so supported profile links could carry audience counts and profile-first visuals without abandoning deterministic static generation.

### Constraints

- **Tech stack:** SolidJS static build remains primary for current architecture.
- **Source of truth:** JSON content model remains canonical.
- **Runtime data:** No client-side platform API fetching - follower counts and profile stats must come from manual or generated saved metadata.
- **Deployment:** GitHub Pages remains first-class supported path.
- **Compatibility:** Non-profile links and existing fallback behavior must remain intact when profile metadata is absent.
- **Quality:** Performance, accessibility, and SEO checks remain mandatory release gates.

### Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SolidJS static site architecture | Aligns with static deploy model and desired DX | ✓ Validated in v1.0/v1.1 |
| JSON as primary content source | Enables deterministic builds and AI-friendly edits | ✓ Validated in v1.0/v1.1 |
| GitHub Actions build/deploy path | Supports template/fork UX and automation | ✓ Validated in v1.0/v1.1 |
| Social profile metadata remains optional and additive | Avoid breaking non-profile links and preserve fallback behavior | ✓ Validated in v1.1 |
| Profile-style cards prioritize identity cues ahead of source branding | Align the UI with how users recognize social accounts while retaining context | ✓ Validated in v1.1 |

</details>

---
*Last updated: 2026-03-31 after archiving the v1.3 milestone*
