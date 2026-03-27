# Pitfalls Research

**Domain:** OpenLinks v1.2 profile-header quick links and usability polish
**Researched:** 2026-03-27
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Duplicate link sources drift apart

**What goes wrong:**
Quick Links are sourced from `profileLinks` or a new config block while the main cards still come from `links[]`, so the header and the card list stop matching.

**Why it happens:**
Teams optimize for quick implementation and accidentally create a second authoring path.

**How to avoid:**
Derive Quick Links from enabled top-level `links[]` items and keep one source of truth.

**Warning signs:**
A platform appears in the header but not the card list, or vice versa.

**Phase to address:**
Quick Links foundation phase.

---

### Pitfall 2: Icon-only UI ships without usable labels

**What goes wrong:**
Sighted users can infer the brand, but keyboard and screen-reader users get ambiguous or repetitive controls.

**Why it happens:**
The visual design focuses on “just icons” and forgets that the semantic name has to travel somewhere else.

**How to avoid:**
Every quick link needs an explicit accessible name, descriptive title, visible focus treatment, and correct anchor semantics.

**Warning signs:**
Tests only assert icon rendering, not labels or keyboard focus order.

**Phase to address:**
Quick Links foundation phase.

---

### Pitfall 3: Header density regresses on mobile

**What goes wrong:**
The Quick Links strip plus the existing action bar crowd the top of the page, causing wrapping chaos or pushing core identity content too far down.

**Why it happens:**
Desktop-first spacing assumptions do not survive narrow screens.

**How to avoid:**
Design the strip as a compact secondary row, test at small phone widths, and cap the number of visible quick links if needed.

**Warning signs:**
Three or more wrapped rows in the profile header, clipped icons, or action controls pushed below the fold.

**Phase to address:**
Quick Links UI phase.

---

### Pitfall 4: Platform marks are treated like product branding

**What goes wrong:**
The header uses oversized logos, recolored marks, or combinations that imply endorsement.

**Why it happens:**
The team treats platform icons as decorative art instead of trademarked brand assets.

**How to avoid:**
Use the existing approved icon shapes, keep them secondary, do not modify them, and link them only to the matching platform destination.

**Warning signs:**
Wordmarks appear in the strip, icons are custom-styled beyond contrast-safe theming, or the section visually dominates the page title.

**Phase to address:**
Quick Links UI phase.

---

### Pitfall 5: Quick Links become another nav system

**What goes wrong:**
The strip starts absorbing analytics toggles, copy/share actions, or non-social shortcuts and stops being a clean “jump to major platforms” surface.

**Why it happens:**
Once a new row exists, unrelated actions get added to it.

**How to avoid:**
Keep the strip scoped to direct external social/profile destinations only; leave share/copy/QR in the existing action bar.

**Warning signs:**
Buttons and links are mixed, or the section label no longer describes the contents accurately.

**Phase to address:**
Requirements and roadmap scoping.

## Brand-Use Watchouts

| Platform | Watchout | Safer implementation |
|----------|----------|----------------------|
| X | Black/white treatment and clear space should be preserved | Use a compact monochrome-capable mark in a small icon lineup |
| YouTube | Full logo use is more constrained than icon use | Use the icon only, and only when linking to the actual channel |
| LinkedIn | The full LinkedIn logo is restricted; the `[in]` mark is the social-lineup treatment | Use the `[in]` icon treatment only |
| GitHub | Social-button use is fine, but the mark cannot imply endorsement or become the site's own branding | Keep the GitHub icon secondary and unmodified |

## Verification Traps

- [ ] The strip hides itself when no eligible platforms exist.
- [ ] The strip order is deterministic.
- [ ] Every icon link has a descriptive accessible name.
- [ ] Small-screen rendering stays intact above the action bar.
- [ ] The action bar still works and remains visually distinct.

## Sources

- Local code inspection on 2026-03-27:
  - `src/components/profile/ProfileHeader.tsx`
  - `src/lib/icons/known-sites-data.ts`
  - `src/lib/icons/site-icon-graphics.ts`
  - `src/lib/links/link-kind.ts`
- [X brand guidelines PDF](https://about.x.com/content/dam/about-twitter/x/brand-toolkit/x-brand-guidelines.pdf)
- [YouTube Brand Resources and Guidelines](https://www.youtube.com/yt/about/brand-resources/)
- [LinkedIn [in] Logo guidelines](https://brand.linkedin.com/in-logo)
- [GitHub Logo guidance](https://brand.github.com/foundations/logo)

---
*Pitfalls research for: OpenLinks v1.2 quick links milestone*
*Researched: 2026-03-27*
