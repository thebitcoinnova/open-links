# Architecture Research

**Domain:** OpenLinks v1.2 profile-header quick links and usability polish
**Researched:** 2026-03-27
**Confidence:** HIGH

## Recommended Architecture

### System Overview

```text
data/links.json + data/profile.json
        ↓
known-site + link-kind resolution
        ↓
profile quick-link derivation
        ↓
ProfileHeader quick-links strip
        ↓
existing profile action bar
```

The key architectural point is that Quick Links should be derived from the same `links[]` content that already drives the full card list. This keeps one source of truth and avoids introducing a new profile-header-specific link registry.

## Integration Points

### Existing components to extend

| Area | Role in milestone | Notes |
|------|-------------------|-------|
| `src/components/profile/ProfileHeader.tsx` | Render insertion point | The strip should sit between profile copy and the current `BottomActionBar`. |
| `src/routes/index.tsx` | Pass-through only | Likely no new page-level state should be required. |
| `src/lib/icons/known-sites-data.ts` | Platform detection | Use to determine which links count as Quick Links. |
| `src/lib/icons/known-site-icons.tsx` | Glyph rendering | Reuse rather than inventing new SVG ownership. |
| `src/lib/links/link-kind.ts` | Link classification | Use to filter out contact and generic links. |

### Recommended new seams

| New seam | Responsibility | Why |
|----------|----------------|-----|
| `resolveProfileQuickLinks(...)` helper | Convert content links into a small, ordered header lineup | Keeps derivation testable and out of JSX. |
| `QuickLinksStrip` component | Render icon links with labels, titles, and responsive layout | Keeps `ProfileHeader.tsx` readable and isolated. |

## Data Flow Recommendation

### Eligibility rules

Quick Links should be derived from links that are:

1. Enabled
2. URL-backed
3. Resolved as a known site
4. In a curated popular-platform subset for the milestone

Recommended initial subset:
- X
- YouTube
- GitHub
- LinkedIn
- Instagram
- Facebook
- Medium
- Substack

This keeps the header fast to scan while still matching the user's stated “popular and well known platforms” goal.

### Ordering rules

Recommended ordering approach:

1. First by milestone-defined platform priority
2. Then by existing content order as a stable tie-breaker

That preserves expectation for common social destinations without making the maintainer re-order data just for the header.

## Suggested Build Order

1. Add a resolver helper with tests for eligibility and ordering.
2. Add a focused `QuickLinksStrip` component.
3. Insert the strip into `ProfileHeader` above the action bar.
4. Add responsive styling and focus/hover behavior.
5. Update any docs/tests affected by the new header behavior.

## Architectural Constraints

| Constraint | Impact |
|-----------|--------|
| One source of truth in `links.json` | Quick Links should not require duplicate entries in `profileLinks`. |
| Static render first | No runtime fetches or platform lookups for header icons. |
| Existing action bar remains primary for share/copy/QR | Quick Links must complement, not replace, the action bar. |
| Known-site registry already exists | Platform qualification should piggyback on it instead of inventing new string matching. |

## What to Avoid

### Avoid 1: Reusing `profileLinks` as the source

`profileLinks` is currently an optional profile field, but it is not wired into rendering and would force maintainers to curate a second list. That is the wrong abstraction for a header shortcut surface intended to mirror real social links already present in the card list.

### Avoid 2: Full action-bar semantics

Quick Links are external destinations, not app actions. They should render as links, not buttons, and should not inherit active/toggle semantics from the bottom action bar.

### Avoid 3: Per-platform special casing in the view

The view should not carry one-off JSX branches for YouTube, X, LinkedIn, and so on. Platform-specific behavior belongs in the resolver and the existing icon registry.

## Sources

- Local code inspection on 2026-03-27:
  - `src/components/profile/ProfileHeader.tsx`
  - `src/routes/index.tsx`
  - `src/lib/icons/known-sites-data.ts`
  - `src/lib/icons/known-site-icons.tsx`
  - `src/lib/links/link-kind.ts`
  - `src/lib/content/load-content.ts`
- [LinkedIn [in] Logo guidelines](https://brand.linkedin.com/in-logo)
- [YouTube Brand Resources and Guidelines](https://www.youtube.com/yt/about/brand-resources/)
- [GitHub Logo guidance](https://brand.github.com/foundations/logo)
- [X brand guidelines PDF](https://about.x.com/content/dam/about-twitter/x/brand-toolkit/x-brand-guidelines.pdf)

---
*Architecture research for: OpenLinks v1.2 quick links milestone*
*Researched: 2026-03-27*
