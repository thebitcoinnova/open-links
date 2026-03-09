# Phase 10: Configurable Rich Card Description Image Row - Research

**Researched:** 2026-03-09
**Domain:** avatar-first rich-card layout, distinct preview/profile media handling, global/per-site policy resolution, validation implications
**Confidence:** HIGH

## User Constraints

### Locked Decisions
- For Substack and similar rich cards with distinct identity imagery and social/description imagery, keep the profile image and identity metadata in the first row.
- Keep the description as its own row instead of merging it into the image or header block.
- Add a separate full-width row for the description/social image rather than reusing the current inline lead slot.
- The extra image row must be configurable so maintainers can disable it when they do not want the extra media.
- Configuration needs both a global default and a per-site/platform override path.
- Existing avatar-first profile treatment should remain intact when the extra row is disabled or when there is no distinct preview image.

### Claude's Discretion
- Exact config field names and override-map shape.
- Whether override keys should resolve through known-site ids, domains, or both.
- Exact footer placement once the new image row is inserted.
- Exact validation rule changes for rich links that no longer need preview media to render.

### Deferred Ideas (Out of Scope)
- Full platform-specific card templates beyond this extra image row.
- Reworking simple-card layouts around the same extra media row.
- Live/runtime fetching of alternate description images outside the existing enrichment/cache flow.

## Summary

Phase 10 can build on the current profile-card system without introducing a separate card family, but it needs one policy layer and one data/validation correction before the UI work lands cleanly:

1. `src/lib/ui/social-profile-metadata.ts` already distinguishes `profileImageUrl` from `previewImageUrl` and exposes `hasDistinctPreviewImage`, which is exactly the signal needed for the optional row.
2. `src/lib/ui/rich-card-policy.ts` already centralizes rich-card description and media decisions, but it only supports one rendered media slot (`leadKind` + `leadImageUrl`).
3. `src/components/cards/NonPaymentLinkCardShell.tsx` and the current CSS grid only model `lead -> summary -> description -> footer`, so there is no place yet for a full-width media row between description and footer.
4. `schema/site.schema.json` and `src/lib/content/load-content.ts` already support global `site.ui.richCards` policy, but there is no per-site rich-card policy map yet.
5. `src/lib/icons/known-sites-data.ts` provides stable known-site ids and domain aliases, which is the cleanest existing seam for per-site/platform overrides.
6. `scripts/validate-data.ts` still requires a renderable `metadata.image` for every rich link when rich cards are enabled, even though an avatar-first profile card can render without preview media if the new row is disabled.
7. `scripts/enrichment/public-augmentation.ts` currently collapses Substack profile media so `image` and `profileImage` end up identical, which means the new row will never render for the current seeded Substack profile until that parser/cache behavior is corrected.

Recommended delivery split:
1. **Policy contract + resolution:** add a new `site.ui.richCards` policy surface for the description-image row with global defaults plus per-site overrides resolved through known-site ids and host fallbacks.
2. **Distinct media capture + validation alignment:** preserve meaningful preview-vs-profile image separation for supported profile sources (Substack first) and stop treating preview images as mandatory when the runtime no longer depends on them.
3. **Shell/CSS/docs/regressions:** teach the shared rich-card shell to render the new row after the description, then document and test the new behavior and override precedence.

## Standard Stack

### Core

| Tool/Surface | Purpose | Why It Fits |
|--------------|---------|-------------|
| Existing `site.ui.richCards` schema/type pipeline | New configuration contract for the extra row | Current rich-card policy already lives under `site.ui.richCards`, so this is the natural home for global defaults. |
| `KNOWN_SITES` + `resolveKnownSite(...)` | Per-site/platform override resolution | Stable ids and alias/domain matching already exist; Phase 10 should reuse them instead of inventing a parallel site registry. |
| Shared view-model logic in `src/lib/ui/rich-card-policy.ts` | One place to resolve row visibility and row image URL | Current card components are intentionally thin, so new precedence should stay in the policy layer. |
| Shared shell/CSS in `NonPaymentLinkCardShell.tsx` + `base.css`/`responsive.css` | Rich-card row insertion without forking card families | The current non-payment shell already unifies rich/simple presentation and can absorb one rich-only row cleanly. |

### Supporting

| Tool/Surface | Purpose | When to Use |
|--------------|---------|-------------|
| `scripts/enrichment/public-augmentation.ts` | Preserve distinct profile/preview images where the source exposes both | Required for Substack and any other supported profile source that currently collapses the two image roles. |
| `scripts/validate-data.ts` | Align preview-image requirements with the new runtime policy | Needed so maintainers are not forced to keep unused preview images just to satisfy old rich-card checks. |
| Existing card-policy and rendering tests | Regression coverage for precedence, row visibility, and platform-specific behavior | Best place to prove global defaults, per-site overrides, and row ordering without adding a second test harness. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New nested description-image-row policy under `site.ui.richCards` | Reuse legacy `mobile.imageLayout` | Wrong abstraction: that setting is mobile-only, deprecated, and intentionally a runtime no-op today. |
| Known-site keyed overrides | Raw host-string overrides only | Custom domains and alias handling become brittle, and maintainers have to memorize normalization rules. |
| Full-width row after description | Reuse the left lead slot for preview media | Conflicts with the requested avatar-first header and collapses profile identity back into preview-first layout. |
| Validation aligned to rendered media usage | Keep preview image mandatory for all rich links | Forces unused metadata for avatar-first profile cards and makes the new opt-out policy misleading. |

## Architecture Patterns

### Pattern 1: Resolve the extra row as policy, not component-local heuristics

The new row should resolve in `rich-card-policy.ts` from:
- global default
- per-site override
- distinct-preview-image availability

This keeps JSX declarative and avoids duplicating site matching or precedence rules in components/tests.

### Pattern 2: Treat description-image media as a second rendered slot, not a replacement lead

Keep:
- row 1: avatar + title + handle/metrics
- row 2: description text
- row 3: full-width description image (when enabled and distinct)
- footer/source row after that

This matches the request and keeps profile identity primary.

### Pattern 3: Preserve or suppress distinct media at the source-specific normalization layer

Whether a second image is meaningful belongs in source-specific parsing/normalization, not in generic card code. Substack is the main current example because the public augmentation path intentionally collapses the OG preview into the avatar slot today.

### Pattern 4: Validate only what the runtime actually needs

Non-profile rich cards still need preview media. Avatar-first profile cards should only require preview media when a configured runtime surface actually renders it. Otherwise validation should focus on title/description/profile-image completeness instead of stale preview-image assumptions.

## Current Code Seams

### Media Resolution

- `src/lib/ui/social-profile-metadata.ts`
  - resolves `profileImageUrl`
  - resolves `previewImageUrl`
  - computes `hasDistinctPreviewImage`
- This is already the right runtime seam for determining whether an extra description-image row is even possible.

### Card Policy + Rendering

- `src/lib/ui/rich-card-policy.ts`
  - resolves description source
  - resolves lead visual
  - builds the shared non-payment card view model
- `src/components/cards/NonPaymentLinkCardShell.tsx`
  - renders the shared grid shell
  - currently has no full-width media row after the description
- `src/styles/base.css` / `src/styles/responsive.css`
  - current grid areas are `lead`, `summary`, `description`, `footer`
  - rich preview media is only styled for the inline lead slot

### Configuration

- `schema/site.schema.json` and `src/lib/content/load-content.ts`
  - already expose `site.ui.richCards.*`
  - currently support global policy only, not per-site overrides
- `src/lib/icons/known-sites-data.ts`
  - exposes stable ids like `substack`, `medium`, `github`, `x`
  - already understands aliases and canonical domains

### Validation + Enrichment

- `scripts/validate-data.ts`
  - currently errors when any rich link lacks a renderable preview image
- `scripts/enrichment/public-augmentation.ts`
  - Substack parser currently sets `image` to `profileImage` when an avatar is available
  - this prevents `hasDistinctPreviewImage` from ever becoming `true` for the seeded Substack profile
- `data/cache/rich-public-cache.json`
  - current seeded supported profile entries all have `image` and `profileImage` identical, so the new row would be dormant without targeted data fixes

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-site override resolution | A second platform registry local to rich cards | `KNOWN_SITES` / `resolveKnownSite(...)` | Existing aliases and canonical ids already solve the matching problem. |
| Row visibility checks in JSX | Inline `if` trees that inspect raw metadata fields | Shared policy/view-model fields | Keeps precedence and duplication suppression testable. |
| Generic preview-image suppression in UI | Card components guessing which source images are meaningful | Source-specific parser decisions plus `hasDistinctPreviewImage` | UI should consume normalized semantics, not reverse-engineer them. |
| Preview validation for avatar-first profile cards | Reusing the current blanket rich-image rule | Validation keyed to actual rendered surfaces | Matches maintainer expectations once the row becomes optional. |

## Common Pitfalls

### Pitfall 1: Per-site overrides key off footer labels or raw hosts only
**What goes wrong:** Custom domains and alias domains behave inconsistently, especially for Substack-style custom domains.
**How to avoid:** Resolve overrides through known-site ids first, then fall back to normalized host matching only where needed.

### Pitfall 2: The new row is added, but validation still forces unused preview images
**What goes wrong:** Maintainers turn the row off globally or per-site, yet `validate:data` still fails because `metadata.image` is missing.
**How to avoid:** Make preview-image validation conditional on card type/policy instead of all rich links.

### Pitfall 3: Substack still never shows the new row
**What goes wrong:** The UI work lands, but Substack metadata continues to collapse `image` and `profileImage`, so `hasDistinctPreviewImage` stays false.
**How to avoid:** Update the public augmentation path and checked-in cache/test fixtures before or alongside the renderer.

### Pitfall 4: Footer/source context jumps ahead of the new image row
**What goes wrong:** The request’s intended reading order is lost because source branding stays directly under the description while the new image row gets pushed below it.
**How to avoid:** Insert the media row after description and keep the footer/source row last.

### Pitfall 5: Non-profile rich cards regress into profile-specific layout logic
**What goes wrong:** Shared shell changes accidentally affect article/blog rich cards that still need preview-led layouts.
**How to avoid:** Keep the new row rich-profile-aware and regression-test non-profile cards explicitly.

## Open Questions

1. **What should the config shape be?**
   - Recommendation: `site.ui.richCards.descriptionImageRow` with a global default (`auto` / `off`) plus `sites` overrides keyed by known-site id and normalized host fallback.

2. **Should profile rich cards continue to require preview images?**
   - Recommendation: no, not by default. Once the row is optional, preview images should be required only for cards whose runtime layout actually uses them.

3. **Where should the new row sit relative to the footer/source row?**
   - Recommendation: after the description and before the footer/source row, matching the user request and preserving current footer clarity.

## Sources

### Primary (HIGH confidence)
- `.planning/ROADMAP.md` (Phase 10 goal/details)
- `src/lib/ui/rich-card-policy.ts`
- `src/lib/ui/social-profile-metadata.ts`
- `src/components/cards/NonPaymentLinkCardShell.tsx`
- `src/components/cards/social-profile-card-rendering.test.tsx`
- `src/styles/base.css`
- `src/styles/responsive.css`
- `schema/site.schema.json`
- `src/lib/content/load-content.ts`
- `src/lib/icons/known-sites-data.ts`
- `scripts/validate-data.ts`
- `scripts/enrichment/public-augmentation.ts`
- `scripts/enrichment/public-augmentation.test.ts`
- `data/cache/rich-public-cache.json`

### Secondary (MEDIUM confidence)
- `docs/data-model.md`
- `docs/customization-catalog.md`
- `src/lib/ui/rich-card-description-sourcing.test.ts`
- `src/lib/content/social-profile-fields.test.ts`

## Metadata

**Research scope:** rich-card media policy, card-shell insertion point, per-site override seam, preview-image validation, and current Substack/media normalization behavior

**Confidence breakdown:**
- Current policy/render seams: HIGH
- Per-site override integration path: HIGH
- Validation alignment path: HIGH
- Exact platform audit needed for meaningful second-image preservation: MEDIUM

**Research date:** 2026-03-09
**Valid until:** 2026-04-09

---

*Phase: 10-configurable-rich-card-description-image-row*
*Research completed: 2026-03-09*
*Ready for planning: yes*
