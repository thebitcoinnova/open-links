# Project Research Summary

**Project:** OpenLinks
**Domain:** v1.2 profile-header quick links and usability polish
**Researched:** 2026-03-27
**Confidence:** HIGH

## Executive Summary

The next milestone should stay narrow: add a profile-header Quick Links strip above the existing action bar, and use that work to tighten the top-of-page usability without reopening broader layout or data-model architecture. The codebase already has the required primitives: the profile header owns the right insertion point, the known-site registry can classify popular platforms, and the icon system already bundles recognizable SVGs for the relevant brands.

The strongest implementation path is to derive Quick Links from enabled top-level social links in `data/links.json`. That preserves one source of truth, avoids new authoring burden, and fits the repo's developer-first model. External brand guidance from GitHub, LinkedIn, X, and YouTube all point in the same direction: keep the marks small, secondary, unmodified, and linked directly to the matching profile/channel.

## Key Findings

### Stack additions

- No new dependency is required.
- Reuse `simple-icons@15.22.0` through the existing icon pipeline.
- Add one small resolver helper and one focused header component instead of expanding `ProfileHeader.tsx` inline.

### New feature table stakes

- Quick Links render only when eligible known-site social/profile links exist.
- The strip appears above the profile action bar and stays compact on mobile.
- Each icon links directly to the corresponding destination and has accessible labeling.
- Ordering is deterministic and based on expected major-platform priority.

### Watch out for

- Do not create a second source of truth separate from `links[]`.
- Do not let Quick Links absorb share/copy/QR or other app actions.
- Do not ship icon-only controls without descriptive accessible names.
- Do not enlarge or modify platform marks in ways that conflict with official brand guidance.

## Recommended Requirement Categories

### Quick Links Discovery

- Derive eligible major-platform destinations from existing top-level links.
- Show a compact, recognizable icon lineup above the action bar.
- Hide the section entirely when there are no qualifying links.

### Header Interaction and Accessibility

- Ensure icon links are keyboard-accessible and clearly labeled.
- Preserve the current action bar behavior and hierarchy.
- Keep the header usable at narrow mobile widths.

### Maintainer Model

- Keep `links.json` as the canonical source for destinations.
- Avoid requiring duplicate manual configuration for the same social accounts.
- Keep the feature compatible with the current known-site/icon architecture.

## Roadmap Implications

Recommended roadmap shape:

1. **Phase 15: Quick Links Foundation**
   - Add resolver logic, eligibility rules, ordering, and tests.
   - Confirm the strip derives from existing links without new data-model complexity.

2. **Phase 16: Profile Header UI + Responsive Polish**
   - Add the visual strip to `ProfileHeader`.
   - Tune spacing, focus states, wrapping, and small-screen behavior.

3. **Phase 17: Docs + Regression Hardening**
   - Update relevant docs if the header behavior changes materially.
   - Add regression coverage for accessibility and empty-state behavior.

## Sources

### Primary

- Local code inspection on 2026-03-27:
  - `src/components/profile/ProfileHeader.tsx`
  - `src/routes/index.tsx`
  - `src/lib/icons/known-sites-data.ts`
  - `src/lib/icons/known-site-icons.tsx`
  - `src/lib/icons/site-icon-graphics.ts`
  - `src/lib/links/link-kind.ts`
  - `data/links.json`
  - `package.json`
- [X brand guidelines PDF](https://about.x.com/content/dam/about-twitter/x/brand-toolkit/x-brand-guidelines.pdf)
- [YouTube Brand Resources and Guidelines](https://www.youtube.com/yt/about/brand-resources/)
- [LinkedIn [in] Logo guidelines](https://brand.linkedin.com/in-logo)
- [GitHub Logo guidance](https://brand.github.com/foundations/logo)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | The repo already has the needed dependencies and icon infrastructure. |
| Features | HIGH | The user-defined milestone is narrow and aligns with established profile-link UX patterns. |
| Architecture | HIGH | Quick Links fit cleanly into existing header and known-site seams. |
| Pitfalls | HIGH | Main risks are straightforward: duplication, accessibility, mobile density, and brand misuse. |

**Overall confidence:** HIGH

---
*Research completed: 2026-03-27*
*Ready for requirements: yes*
