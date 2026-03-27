# OpenLinks

## What This Is

OpenLinks is a developer-first, free, open source, version-controlled static website generator for social media links. Developers fork/template the repo, edit structured JSON content, and publish through CI-driven static deployment.

## Core Value

A developer can fork/template the repo, edit structured link data, and reliably publish a polished personal links site with minimal friction.

## Current Milestone: v1.2 Profile Quick Links + Header Usability Polish

**Goal:** Add a compact Quick Links strip above the top-level profile action bar by deriving major-platform social shortcuts from existing top-level links, while tightening the profile header's usability on mobile and desktop.

**Target features:**
- Quick Links section above the profile action bar for popular, recognizable social platforms such as X, YouTube, GitHub, LinkedIn, and Instagram when matching links exist.
- Auto-derived eligibility and ordering from enabled `data/links.json` entries so maintainers do not manage a second shortcut list.
- Header-level responsive, accessibility, and spacing polish needed to fit the new shortcut strip cleanly without weakening the current share/copy/QR action bar.

## Current State

- **Shipped version:** v1.1 (2026-03-10)
- **Active milestone:** v1.2 (requirements definition in progress)
- **Latest delivered scope:** v1.1 shipped phases 7-12 plus inserted Phase 08.1 across 22 plans and 66 summarized tasks, followed by the Phase 13-14 post-v1.1 toast and dialog follow-up
- **Primary stack:** SolidJS + TypeScript + JSON schema validation + GitHub Actions + GitHub Pages
- **Quality posture:** SEO/a11y/performance checks remain integrated and CI-gated, with known remaining debt around `/` performance budgets and fallback social-image warnings
- **Extensibility posture:** documented theme/layout/deployment extension pathways plus AI-guided and Studio-assisted CRUD paths for maintainers
- **Maintainer workflow posture:** prefer repo AI workflows/skills or Studio for routine CRUD; use direct JSON editing as the lower-level fallback
- **Planning focus:** define and roadmap the v1.2 Quick Links and header-usability milestone without reopening the broader static-site architecture

## Validated

- ✓ v1.0 foundation validated the fork/template workflow, JSON schema contract, rich/simple cards, CI/CD delivery, and extensibility docs.
- ✓ v1.1 now persists profile-centric social metadata such as handles, profile images, audience counts, and profile-authored descriptions in saved link data.
- ✓ Supported social links now render as profile-style simple and rich cards without regressing fallback cards for unsupported links.
- ✓ Rich profile cards now support an optional full-width description-image row when preview media is distinct from the profile image.
- ✓ OpenLinks now publishes append-only public follower-history artifacts plus a lazy-loaded analytics surface.
- ✓ Profile-level and card-level sharing now use a shared clean-URL Web Share flow.
- ✓ Maintainer docs, Studio guidance, and verification flows now cover the expanded social-card system and explicitly route routine CRUD toward AI workflows or Studio.

## Next Milestone Goals

- Deliver a compact profile-header Quick Links strip that makes major social destinations faster to scan and tap.
- Keep `data/links.json` as the single source of truth for both the full card list and the new header shortcut surface.
- Limit v1.2 to Quick Links plus closely related header polish; defer larger editor/config and broader product-surface expansion work.
- Keep the current static-build and additive-metadata architecture unless a future milestone intentionally reopens those constraints.

## Known Debt Carrying Forward

- `bun run quality:check` still fails the `/` total bundle-byte budgets for both mobile and desktop.
- SEO still warns that social preview metadata is using the deterministic fallback image.
- The analytics chart chunk remains large and should stay code-split or be reduced in a future cleanup pass.
- Broader social coverage, richer platform-specific metrics, and deeper Studio onboarding/editor flows remain future work.

## Out of Scope (Still True)

- Client-side live follower polling or direct platform API fetches - OpenLinks remains a deterministic static build.
- Full native embed/post recreation per platform - profile-style links remain card-based rather than full embed parity.
- First-class non-GitHub hosting adapter implementation - remains future work while product and workflow polish are prioritized.

## Archived Planning Context

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
*Last updated: 2026-03-27 after starting milestone v1.2*
