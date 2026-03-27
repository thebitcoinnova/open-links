# Stack Research

**Domain:** OpenLinks v1.2 profile-header quick links and usability polish
**Researched:** 2026-03-27
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `solid-js` | `1.9.11` | Profile-header UI composition | Already owns the public profile header and action bar, so Quick Links can stay in the existing component model. |
| TypeScript | `5.9.3` | Typed quick-link derivation and config normalization | The milestone depends on safe mapping from `links.json` into a smaller profile-header navigation surface. |
| `simple-icons` | `15.22.0` | Popular platform glyphs | Already powers the repo's known-site icon system, so no new icon package is needed. |
| Existing OpenLinks known-site registry | repo-local | Platform/domain/icon resolution | `src/lib/icons/known-sites-data.ts` and `src/lib/icons/site-icon-graphics.ts` already cover the popular platforms this milestone needs. |

### Supporting Libraries

| Library / Module | Purpose | When to Use |
|------------------|---------|-------------|
| `src/components/profile/ProfileHeader.tsx` | Header composition seam | Use as the insertion point for the Quick Links strip above the existing action bar. |
| `src/lib/icons/known-sites-data.ts` | Detect known platforms from `icon` or URL | Use to derive which top-level links qualify for Quick Links. |
| `src/lib/icons/known-site-icons.tsx` | Render approved icon glyphs already bundled in the app | Use for compact icon-only quick-link buttons. |
| `src/lib/links/link-kind.ts` | Normalize link types and schemes | Use to exclude contact/generic links from the Quick Links lineup. |
| Existing Biome + TypeScript checks | Regression guard | Use to keep the milestone low-risk because this feature touches shared header UI. |

## Recommended Additions

| Add | Why | Notes |
|-----|-----|-------|
| Small profile-header quick-link resolver module | Keeps derivation logic out of the view file | Recommended path: derive from existing `links.json`, not `profileLinks`. |
| Dedicated `QuickLinksStrip` component | Isolates layout, keyboard labels, and responsive behavior | Keeps `ProfileHeader.tsx` below the file-size threshold and easier to test. |
| Header-focused tests | Confirms ordering, eligibility, and accessible labeling | Needed because the new strip sits in a high-traffic part of the page. |

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| A new icon dependency | Existing icon coverage is already broad and bundled | Reuse `simple-icons` through the current known-site graphics pipeline |
| A second social-link source of truth | `profileLinks` plus `links[]` would drift | Derive Quick Links from enabled top-level `links[]` items |
| Remote logo fetches | Adds runtime fragility and trademark inconsistency | Keep local SVG assets from the current icon registry |
| Large branded wordmarks in the strip | Conflicts with platform-brand guidance and steals focus from the profile | Use compact icon buttons with accessible text labels |

## External Brand Guidance Impact

These guidelines affect implementation even though no new package is required:

- **X:** use the current black/white logo treatment and maintain clear space; the guide frames the mark as a signpost for where audiences can find you.
- **YouTube:** explicitly allows the icon in a social icon lineup when it links to a YouTube channel; do not use the full wordmark in icon rows.
- **LinkedIn:** the `[in]` mark is the allowed social-lineup treatment for members linking to their profile; do not use the full LinkedIn wordmark.
- **GitHub:** the Invertocat is allowed as a social button to link to a GitHub profile or project, but it must stay secondary and unmodified.

## Integration Recommendation

### Preferred implementation

1. Reuse the existing known-site registry to classify eligible links.
2. Derive a compact Quick Links array from enabled top-level social/profile links.
3. Render the strip in `ProfileHeader` above the current `BottomActionBar`.
4. Keep the visual treatment secondary: icon-only or icon-primary buttons, strong accessible labels, direct external links.

### Avoided implementation

1. Adding milestone-specific JSON fields before the auto-derived behavior is proven.
2. Making Quick Links depend on rich-metadata success.
3. Treating the strip as a second navigation system with view toggles or analytics state.

## Sources

- Local code inspection on 2026-03-27:
  - `src/components/profile/ProfileHeader.tsx`
  - `src/lib/icons/known-sites-data.ts`
  - `src/lib/icons/known-site-icons.tsx`
  - `src/lib/icons/site-icon-graphics.ts`
  - `src/lib/links/link-kind.ts`
  - `package.json`
- [X brand guidelines PDF](https://about.x.com/content/dam/about-twitter/x/brand-toolkit/x-brand-guidelines.pdf)
- [YouTube Brand Resources and Guidelines](https://www.youtube.com/yt/about/brand-resources/)
- [LinkedIn [in] Logo guidelines](https://brand.linkedin.com/in-logo)
- [GitHub Logo guidance](https://brand.github.com/foundations/logo)

---
*Stack research for: OpenLinks v1.2 quick links milestone*
*Researched: 2026-03-27*
