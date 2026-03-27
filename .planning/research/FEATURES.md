# Feature Research

**Domain:** OpenLinks v1.2 profile-header quick links and usability polish
**Researched:** 2026-03-27
**Confidence:** HIGH

## Feature Landscape

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Quick access to major social destinations | Users expect the most recognizable platforms to be one tap away | LOW | Best implemented as a compact icon lineup above the action bar. |
| Direct mapping to real profile/channel links | Shortcut surfaces must land on the user's actual destination | LOW | Derive from enabled top-level links, not placeholder config. |
| Mobile-safe responsive layout | The header is primarily consumed on phones | MEDIUM | The strip cannot crowd or weaken the existing share/copy/QR controls. |
| Accessible labels and keyboard behavior | Icon-only controls are otherwise ambiguous | LOW | Each icon needs a descriptive label, title, and clear focus state. |
| Stable ordering | Users scan quick-link rows by expectation, not randomness | LOW | Prefer a predictable platform-priority order with fallback to content order. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Auto-derived Quick Links from `links.json` | No second maintainer workflow and no duplicated data entry | MEDIUM | Fits the repo's developer-first data model. |
| Eligibility rules based on known-site detection | Keeps the strip limited to recognizable destinations like X, YouTube, GitHub, LinkedIn, Instagram | MEDIUM | Reuses the existing known-site registry. |
| Header-level polish around discoverability | Gives the profile top section a clearer hierarchy before users hit the larger card list | MEDIUM | Supports the broader usability-polish framing of the milestone. |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full branded wordmarks beside every icon | Feels explicit | Inflates header height and conflicts with platform-brand guidance | Use icon-only buttons with screen-reader labels and hover titles |
| User-managed duplicate quick-link lists | Seems configurable | Adds config drift against `links[]` | Auto-derive from existing enabled links |
| Showing every known-site link | Feels comprehensive | Overcrowds the header and weakens “quick” scanning | Limit to a curated popular-platform subset and/or a max visible count |
| Non-profile destinations in the strip | Feels flexible | Breaks the mental model of “jump to my socials” | Keep Quick Links scoped to recognized social/profile endpoints |

## Expected Behavior

### Core user flow

1. A visitor lands on the profile page.
2. Above the current share/copy/QR action bar, they see a compact row of recognizable platform icons.
3. Tapping an icon opens that specific profile or channel link directly.
4. If the user has no eligible major-platform links, the Quick Links section does not render.

### Common expectations

- The strip should feel faster to scan than the full card list.
- Quick Links should not replace the full cards; they are shortcuts into the same destinations.
- The lineup should prefer common social platforms before niche destinations.
- The strip should remain visually secondary to the name/headline/bio and not overpower the page identity.

## Recommended Scope for v1.2

### In milestone

- [ ] Quick Links strip in the top-level profile header above the action bar
- [ ] Auto-derivation from enabled known-site profile/channel links in `links.json`
- [ ] Recognizable icon treatment for popular platforms already supported by the repo
- [ ] Responsive wrapping/overflow behavior that keeps the header usable on mobile
- [ ] Accessible labels, focus states, and external-link semantics

### Reasonable adjacent polish

- [ ] Header spacing and hierarchy adjustments needed to fit Quick Links cleanly
- [ ] Tests for quick-link eligibility, ordering, and empty-state suppression
- [ ] Small documentation updates if maintainer-facing behavior changes materially

### Defer to later milestone

- [ ] Manual per-platform ordering controls
- [ ] Separate Quick Links configuration in Studio
- [ ] Per-theme or per-platform badge styles beyond the default treatment
- [ ] Analytics or counters embedded into the Quick Links strip

## Proposed Categories for Requirements

### Quick Links Discovery

- Which platforms qualify for the strip
- How the links are ordered
- When the strip renders vs stays hidden

### Header Interaction and Accessibility

- Keyboard and screen-reader semantics
- External-link behavior and titles
- Mobile layout behavior when the strip is long

### Maintainer Model

- No duplicate data entry
- Predictable derivation from existing link metadata
- Clear fallback when links are unsupported or generic

## Sources

- Local code inspection on 2026-03-27:
  - `src/components/profile/ProfileHeader.tsx`
  - `src/lib/icons/known-sites-data.ts`
  - `src/lib/content/social-profile-fields.ts`
  - `data/links.json`
  - `data/profile.json`
- [YouTube Brand Resources and Guidelines](https://www.youtube.com/yt/about/brand-resources/)
- [LinkedIn [in] Logo guidelines](https://brand.linkedin.com/in-logo)
- [GitHub Logo guidance](https://brand.github.com/foundations/logo)
- [X brand guidelines PDF](https://about.x.com/content/dam/about-twitter/x/brand-toolkit/x-brand-guidelines.pdf)

---
*Feature research for: OpenLinks v1.2 quick links milestone*
*Researched: 2026-03-27*
