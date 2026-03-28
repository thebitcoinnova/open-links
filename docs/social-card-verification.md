# Social Card Verification Guide

Use this guide after changing any of the profile-oriented card surfaces:

- social profile metadata capture or merge behavior
- Quick Links derivation or the visible Quick Links strip in the profile header
- `profileDescription` or description-source precedence
- rich-card description-image-row policy
- follower-history artifacts or analytics UI
- profile/card share behavior
- SEO/social preview image generation or fallback asset behavior

For the canonical field contract, use `docs/data-model.md`. For data-driven knob inventory, use `docs/customization-catalog.md`.

If this guide surfaces a docs or behavior issue, prefer fixing it through the repo AI workflows/skills or the Studio webapp when that path fits the change. Manual JSON editing is still the lower-level fallback, but it should not be the implied default maintainer workflow.

## Quick Checklist

- [ ] Desktop: when eligible social/profile links exist, the profile header shows the Quick Links strip above the action bar with icon-only outbound shortcuts and no visible heading.
- [ ] Desktop: when no eligible Quick Links exist, the strip disappears completely and the share/copy/QR action row stays intact beneath the profile copy.
- [ ] Desktop: supported social profile cards still render avatar-first identity rows, handles, and audience metrics where available.
- [ ] Desktop: non-profile fallback cards still use preview/icon-led presentation instead of accidentally switching onto the profile layout.
- [ ] Desktop: banner-shaped rich profile preview images render as compact top banners when the current policy allows it.
- [ ] Desktop: legacy `bottom-row` placement and `compact-end` fallback still render in the right order when configured.
- [ ] Desktop: cards with follower-history data show analytics first and share second in the header action row.
- [ ] Desktop: cards without follower-history data still show share without a broken analytics control.
- [ ] Desktop: the profile header still shows share, and when analytics is available it stays immediately to the left of share.
- [ ] Mobile: the same action rows and profile/fallback layouts remain readable without overlap or action drift.
- [ ] SEO/social: `og:image` and `twitter:image` resolve to the expected local PNG preview path and the rendered image reflects the latest title/copy refresh.
- [ ] Analytics page: `30D` is the default range, and switching to `90D`, `180D`, and `All` updates the charts cleanly.
- [ ] Analytics modal: card-launched platform charts still respond to range changes and raw/growth toggles.
- [ ] Public artifacts: `history/followers/index.json` loads, and at least one listed CSV path is publicly reachable and append-only.
- [ ] Docs drift: any updated examples, commands, platform-support claims, and verification notes still match runtime behavior.
- [ ] Cache refresh: after deploy, refresh the live URL in LinkedIn Post Inspector and confirm the new preview image is shown for new shares.

## Automated Coverage Map

| State | Automated Coverage |
|------|--------------------|
| Quick Links derivation, priority ordering, canonical tie-breaking, empty-result behavior | `src/lib/ui/profile-quick-links.test.ts` |
| Visible Quick Links strip semantics, heading-free render, outbound labels/titles, placement above action bar | `src/components/profile/ProfileQuickLinks.test.tsx` |
| Profile-header quick-link empty/populated state and action-row preservation | `src/components/profile/ProfileHeader.test.tsx` |
| Profile-card rendering, audience metrics, fallback rich/simple presentation | `src/components/cards/social-profile-card-rendering.test.tsx` |
| `profileDescription` precedence, manual/fetched description rules, description-image-row policy | `src/lib/ui/rich-card-description-sourcing.test.ts` |
| Card action-row semantics, top-banner/bottom-row/compact-end accessibility ordering, share-only cards | `src/components/cards/non-payment-card-accessibility.test.tsx` |
| Clean URL share payload and clipboard fallback behavior | `src/lib/share/share-link.test.ts` |
| Follower-history CSV parsing, range filtering, raw/growth point generation | `src/lib/analytics/follower-history.test.ts` |
| Append-only CSV/index writing behavior | `scripts/follower-history/append-history.test.ts` |

Manual checks should complement these tests, not replace them. When a manual check fails, update the automated coverage if that state was not already protected.

## Narrative Walkthrough

### 1. Social profile cards and fallback cards

Use the current seeded links as the smoke set:

- GitHub, X, Instagram, Medium, Primal, Substack, and YouTube for profile-style cards
- a non-profile rich card and a simple icon-led card for fallback behavior

Confirm:

- supported profile links still render avatar-first headers
- handles and audience metrics appear in the header row when the metadata provides them
- non-profile cards still keep preview/icon-led layout and footer source context
- custom-domain source labels still clarify as `Platform · domain` when appropriate

### 2. Description precedence and rich profile preview media

Focus on X-style `profileDescription` and Substack-style distinct preview imagery.

Confirm:

- `profileDescription` wins only for supported social profile links
- non-profile links ignore stray `profileDescription`
- turning `descriptionImageRow` off suppresses the extra preview media without reverting the card to preview-led layout
- default `top-banner` placement only promotes genuinely wide preview images
- legacy `bottom-row` placement still renders the preview after the description
- `compact-end` fallback only appears when the preview misses the banner ratio cutoff and that fallback is enabled
- simple cards do not grow extra profile preview media even if preview media is distinct

### 3. Quick Links strip and profile-header actions

Check the profile header in both states:

- eligible Quick Links exist
- no eligible Quick Links exist
- analytics available
- analytics unavailable

Confirm:

- when eligible links exist, the Quick Links strip renders above the action row
- the strip stays icon-only, with no visible `Quick Links` heading
- each Quick Link exposes an explicit outbound label/title (`Open GitHub`, etc.)
- no active/current selected state appears on the Quick Links shortcuts
- when no eligible links exist, the strip disappears completely instead of leaving placeholder chrome
- analytics appears immediately to the left of share when history data exists
- share remains present even without analytics
- share feedback is short-lived and does not break header layout
- native share uses a clean URL payload, and copy fallback stays browser-paste-safe

### 4. Card action rows

Check both a history-aware card and a no-history card.

Confirm:

- history-aware cards render analytics first, share second
- cards without history still expose share and do not expose a broken analytics control
- action buttons remain siblings outside the anchor
- the row reads as part of the header, not as a separate side column

### 5. Analytics page and analytics modal

Use the profile-header analytics button for the page-level view and any history-aware card for the modal view.

Confirm:

- the all-platform page defaults to `30D`
- the range buttons switch cleanly across `30D`, `90D`, `180D`, and `All`
- platform charts remain mostly separate rather than collapsing into a misleading shared-scale chart
- modal charts still support raw versus growth views and close cleanly back to the originating page

### 6. Public artifact verification

Open the public assets directly:

- `history/followers/index.json`
- one CSV path listed under `entries[].csvPath`

Confirm:

- the index includes `linkId`, `platform`, `handle`, `canonicalUrl`, `audienceKind`, and latest snapshot fields
- the CSV header still matches `observedAt,linkId,platform,handle,canonicalUrl,audienceKind,audienceCount,audienceCountRaw,source`
- newer snapshots append rows instead of rewriting the file into a different column layout
- unchanged counts are still allowed to append a new row

### 7. Docs drift review

Before closing a change, compare runtime behavior against:

- `README.md`
- `docs/data-model.md`
- `docs/customization-catalog.md`
- `docs/authenticated-rich-extractors.md`

Treat stale examples, incorrect platform-support claims, misleading `profileLinks` wording, or missing Quick Links verification notes as real regressions.

### 8. SEO/social preview verification

When the change touches the site preview image or fallback SEO asset, confirm:

- `bun run social:preview:generate` writes `public/generated/seo/social-preview.svg` and `public/generated/seo/social-preview.png`
- `data/site.json` points `quality.seo.socialImageFallback` at `/generated/seo/social-preview.png`
- the built `og:image` and `twitter:image` tags resolve to the expected local PNG path rather than an unresolved remote URL
- the hardcoded last-resort fallback remains `/openlinks-social-fallback.png`
- after deployment, [LinkedIn Post Inspector](https://www.linkedin.com/help/linkedin/answer/a6233775) shows the refreshed preview for the canonical URL

## Suggested Command Set

After social-card changes, the normal focused command set is:

```bash
bun test src/components/cards/social-profile-card-rendering.test.tsx \
  src/lib/ui/profile-quick-links.test.ts \
  src/components/profile/ProfileQuickLinks.test.tsx \
  src/lib/ui/rich-card-description-sourcing.test.ts \
  src/components/cards/non-payment-card-accessibility.test.tsx \
  src/components/profile/ProfileHeader.test.tsx \
  src/lib/share/share-link.test.ts \
  src/lib/analytics/follower-history.test.ts \
  scripts/follower-history/append-history.test.ts \
  scripts/generate-openlinks-brand-assets.test.ts \
  scripts/generate-site-social-preview.test.ts \
  src/lib/seo/resolve-seo-metadata.test.ts
bun run social:preview:generate
bun run typecheck
bun run biome:check
bun run validate:data
bun run build
```

## Milestone Lineage

This guide consolidates the manual verification intent proven across:

- Phase `08.1` custom profile descriptions
- Phase `10` description-image-row controls
- Phase `11` follower-history analytics
- Phase `12` card-level sharing
