# Phase 7: Social Profile Metadata Pipeline - Research

**Researched:** 2026-03-07
**Domain:** profile-centric link metadata, manual/generated merge semantics, Instagram + YouTube audience-stat extraction
**Confidence:** HIGH

## User Constraints (from 07-CONTEXT.md)

### Locked Decisions
- Use platform-native audience fields rather than a generic stats array.
- Save and render a single metric when that is all a platform exposes.
- Prefer raw numeric values when available.
- If only display text is available, parse to a numeric value when reliable and also preserve the original raw text.
- Manual metadata always overrides extractor-derived audience counts.
- First pass is limited to Instagram and YouTube.
- Capture audience stats only for URLs that clearly resolve to profile or account pages.
- Partial platform support is acceptable in this phase.
- Unsupported platforms should omit the new fields entirely.
- Missing expected stats on a supported profile should produce a strong warning, not a build failure.
- Manual metadata may include only the fields the maintainer knows.
- For Instagram and YouTube profile links, the canonical profile image should be the account or channel avatar, not a generic social preview image.
- If only a generic preview image is available, leave the profile image empty and warn.
- Preserve avatar and preview image separately so later card rendering can use them independently.

### Claude's Discretion
- Exact field names for parsed numeric values versus preserved raw text.
- Exact warning/report copy and payload shape.
- Exact heuristics for deciding when a URL is clearly a profile page, as long as they stay conservative.

### Deferred Ideas (Out of Scope)
- Broaden audience-stat support to X, LinkedIn, Facebook, Medium, and other existing extractors.
- Update extractor-authoring skills/workflows for audience-stat capture in future platform work.
- Add post/video/verified-style metrics beyond the first-pass follower/following/subscriber fields.

## Summary

Phase 7 should extend the existing rich-metadata pipeline rather than introduce a second social-profile data system. The current code already has the right seams:

1. `schema/links.schema.json`, `src/lib/content/load-content.ts`, and `scripts/enrichment/types.ts` define the shared metadata contract.
2. `scripts/enrich-rich-links.ts` and `scripts/authenticated-extractors/cache.ts` merge generated/authenticated metadata into that contract.
3. `scripts/authenticated-extractors/plugins/instagram-auth-browser.ts` and `scripts/authenticated-extractors/plugins/youtube-auth-browser.ts` already fetch public metadata and avatar-like images, but only persist generic title/description/image fields.
4. `scripts/sync-content-images.ts` and `src/lib/content/load-content.ts` currently materialize only `metadata.image`, so a new `profileImage`-style field will need its own localization path.

Current gaps that matter for planning:

- Generated enrichment currently merges as `{...manual, ...generated}`, so extractor output overrides manual metadata by default. That conflicts with the locked manual-override rule for profile-specific fields.
- The authenticated cache schema only supports `title`, `description`, `image`, and `sourceLabel`, so there is no place yet for avatar-vs-preview separation or audience counts.
- Instagram already exposes follower/following values inside the cached description text, but they are not parsed into structured fields.
- Current YouTube cached metadata includes a channel avatar but no structured subscriber count, so YouTube will need extractor-specific parsing beyond the generic `parseMetadata` helper.
- `images:sync` ignores any future `profileImage` field, so manual remote avatars would bypass the current baked-asset workflow unless explicitly added.

Recommended delivery split:
1. **Contract + precedence:** add profile-specific metadata fields, parsed/raw companion values, manual override semantics, and warning policy.
2. **Extractor persistence:** teach Instagram and YouTube extraction paths to capture stats/avatar separately and emit strong warnings for expected missing stats.
3. **Runtime consumption:** materialize/profile-localize the new image field and expose normalized social-profile metadata to card view-model helpers without redesigning the cards yet.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `typescript` | `5.9.3` | Shared metadata contracts across runtime and scripts | Existing pipeline already depends on shared TS interfaces. |
| `ajv` | `8.x` | JSON schema enforcement for manual/authenticated metadata | Existing validation flow already uses AJV-backed schemas. |
| Built-in `fetch` + current extractor helpers | Bun/Node runtime | Public metadata and asset retrieval | No new dependency is required for first-pass Instagram/YouTube capture. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing `resolveHandleFromUrl` / `resolveLinkHandle` helpers | current repo | Conservative profile URL applicability checks | Reuse for Instagram/YouTube profile detection instead of inventing duplicate URL heuristics. |
| Node `test` + focused fixture files | runtime built-in | Parser/extractor regression coverage | Add targeted tests if extractor parsing grows beyond generic OG metadata. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Platform-native fields | Generic `stats[]` array | Conflicts with locked decision and makes Phase 8 rendering more ambiguous. |
| Generic OG/Twitter metadata only | Platform-specific extractor parsing | Generic metadata misses structured counts and cannot distinguish avatar from preview content reliably. |
| Live runtime count fetches | Build-time saved metadata only | Runtime fetching violates the deterministic static-build constraint. |

## Architecture Patterns

### Pattern 1: Separate Avatar Identity From Preview Imagery

**What:** Keep a dedicated profile-avatar field separate from the existing preview/content image field.
**Why:** Phase 8 needs circular identity chrome without reusing potentially misleading OG preview art.
**Where:** `schema/links.schema.json`, `scripts/authenticated-extractors/types.ts`, `scripts/sync-content-images.ts`, `src/lib/content/load-content.ts`.

### Pattern 2: Field-Level Manual Override Merging

**What:** Merge generated/authenticated metadata into manual metadata with explicit precedence for profile-specific fields instead of whole-object replacement.
**Why:** Current `mergeMetadata()` behavior in `scripts/enrich-rich-links.ts` overwrites manual values, which conflicts with locked decisions.
**Where:** `scripts/enrich-rich-links.ts`, `src/lib/content/load-content.ts`, possibly a shared helper if merge rules need reuse.

### Pattern 3: Extractor-Specific Audience Parsers on Top of Generic Metadata Fetch

**What:** Keep the generic `parseMetadata()` helper for title/description/preview basics, then layer platform-specific parsing in Instagram/YouTube extractor plugins for counts and true avatar capture.
**Why:** Generic OG metadata is insufficient for structured stats, especially YouTube subscriber counts.
**Where:** `scripts/authenticated-extractors/plugins/instagram-auth-browser.ts`, `scripts/authenticated-extractors/plugins/youtube-auth-browser.ts`.

### Pattern 4: Warning-Only Partial Coverage With Explicit Report Signals

**What:** Treat expected-but-missing stats as strong warnings in validation/reporting rather than hard errors.
**Why:** Locked phase behavior allows partial support and avoids blocking builds on incomplete public metadata.
**Where:** `scripts/enrichment/report.ts`, `scripts/validate-data.ts`, authenticated cache validation helpers.

## Recommended Project Structure

```text
schema/
  links.schema.json
  rich-authenticated-cache.schema.json
scripts/
  enrich-rich-links.ts
  sync-content-images.ts
  enrichment/
    types.ts
    report.ts
  authenticated-extractors/
    cache.ts
    types.ts
    plugins/
      instagram-auth-browser.ts
      youtube-auth-browser.ts
src/
  lib/
    content/load-content.ts
    ui/rich-card-policy.ts
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Profile applicability checks | A second custom URL matcher for Instagram/YouTube | Existing handle/profile URL resolution patterns | Keeps "profile-only" behavior consistent across validation and extraction. |
| Audience metric shape | One opaque blob field | Explicit numeric + original-text companions per metric | Supports deterministic UI formatting and auditability. |
| Avatar fallback | Blindly reuse `og:image` as profile avatar | Explicit avatar detection with warning when only preview art exists | Prevents misleading identity chrome in Phase 8. |
| Manual/generated conflict resolution | Whole-object spread merge | Field-level override policy helper | Ensures locked manual-precedence rule is enforceable and testable. |

## Common Pitfalls

### Pitfall 1: Manual values get clobbered by generated metadata
**What goes wrong:** Maintainer-authored counts or profile images disappear after enrichment because generated metadata wins on object spread.
**How to avoid:** Introduce a shared precedence helper for profile-specific fields before extractor work lands.

### Pitfall 2: Non-profile URLs trigger bogus stat extraction
**What goes wrong:** YouTube video URLs or Instagram non-profile routes get treated as profile pages and generate noisy warnings or bad data.
**How to avoid:** Reuse conservative profile URL applicability checks and skip stat extraction when the URL is supported-but-not-profile.

### Pitfall 3: `profileImage` exists in data but never materializes locally
**What goes wrong:** Manual remote avatar URLs bypass `images:sync`, so runtime either renders raw remotes or drops the field unexpectedly.
**How to avoid:** Extend candidate collection and localization for the new avatar field alongside preview image handling.

### Pitfall 4: Warning policy silently disappears into generic `metadata_partial`
**What goes wrong:** Supported Instagram/YouTube profiles miss expected counts, but the report only says "partial metadata" without showing which stat failed.
**How to avoid:** Add explicit expected-stat warning details to enrichment/authenticated-cache reporting.

### Pitfall 5: Scope expands into extra social metrics
**What goes wrong:** Extractors start capturing posts/videos/verified state just because the text is available.
**How to avoid:** Keep first-pass fields limited to follower/following/subscriber-style metrics and defer the rest.

## Code Examples

### Existing merge point that currently overrides manual metadata

```typescript
const merged = { ...(original ?? {}), ...enriched };
```

Phase 7 should replace this with field-level precedence for profile-specific values.

### Existing authenticated cache metadata shape that must expand

```typescript
metadata: {
  title: string;
  description: string;
  image: string;
  sourceLabel?: string;
}
```

Phase 7 needs room for avatar-vs-preview separation and audience fields.

### Current content-image candidate collection only sees preview image

```typescript
const manualImageValue = isRecord(link.metadata) ? link.metadata.image : undefined;
```

Phase 7 needs the equivalent path for a new profile-avatar field.

## Open Questions

1. **Exact field naming**
   - Known: parsed numeric and original raw text must both be preservable.
   - Recommendation: keep a consistent pairing pattern such as `followersCount` + `followersCountRaw`, `followingCount` + `followingCountRaw`, `subscribersCount` + `subscribersCountRaw`, plus a dedicated `profileImage` field.

2. **Where to surface expected-stat warning detail**
   - Known: warnings must be strong and explicit but non-blocking.
   - Recommendation: store missing/expected stat identifiers in enrichment report entries and surface them in `validate:data` human output.

## Sources

### Primary (HIGH confidence)
- `.planning/phases/07-social-profile-metadata-pipeline/07-CONTEXT.md`
- `.planning/ROADMAP.md` (Phase 7 goal + criteria)
- `.planning/REQUIREMENTS.md` (DATA-07, DATA-08, DATA-09)
- `schema/links.schema.json`
- `schema/rich-authenticated-cache.schema.json`
- `src/lib/content/load-content.ts`
- `scripts/enrichment/types.ts`
- `scripts/enrich-rich-links.ts`
- `scripts/enrichment/report.ts`
- `scripts/validate-data.ts`
- `scripts/sync-content-images.ts`
- `scripts/authenticated-extractors/types.ts`
- `scripts/authenticated-extractors/cache.ts`
- `scripts/authenticated-extractors/plugins/instagram-auth-browser.ts`
- `scripts/authenticated-extractors/plugins/youtube-auth-browser.ts`
- `data/cache/rich-authenticated-cache.json`
- `src/lib/identity/handle-resolver.test.ts`

### Secondary (MEDIUM confidence)
- `scripts/enrichment/parse-metadata.test.ts`
- Existing Phase 3 planning artifacts for prior rich-metadata pipeline conventions

## Metadata

**Research scope:** metadata contract, merge precedence, Instagram/YouTube extractor feasibility, asset materialization, warning policy

**Confidence breakdown:**
- Contract and merge-path analysis: HIGH
- Instagram/YouTube extractor fit with current code: HIGH
- Warning/report integration path: HIGH
- Exact field naming recommendation: MEDIUM

**Research date:** 2026-03-07
**Valid until:** 2026-04-07

---

*Phase: 07-social-profile-metadata-pipeline*
*Research completed: 2026-03-07*
*Ready for planning: yes*
