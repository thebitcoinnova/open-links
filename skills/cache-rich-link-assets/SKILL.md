---
name: cache-rich-link-assets
description: Persist rich-link images and related metadata into the committed OpenLinks cache when links are added or updated.
---

# Cache Rich Link Assets Skill

Use this skill when a link change introduces or updates rich-card metadata, especially manual `metadata.image` values or links that depend on enriched/authenticated metadata.

## Goals

1. Keep rich-card images local and reviewable in git.
2. Preserve deterministic builds by writing committed cache artifacts instead of relying on ephemeral local-only assets.
3. Validate the resulting rich-card path end to end.

## Inputs to collect

- Link id(s)
- Link URL(s)
- Whether the link uses:
  - manual metadata,
  - public enrichment, or
  - authenticated extraction

## Workflow

1. Update the source data first.
   - Edit `data/links.json`.
   - Add or update any manual metadata under `links[].metadata`.

2. Refresh generated metadata when enrichment applies.

```bash
bun run enrich:rich:strict
```

3. Refresh committed image cache assets.

```bash
bun run images:sync
```

4. Validate and build.

```bash
bun run validate:data
bun run build
```

5. Review committed cache outputs.
   - Stable image manifest: `data/cache/content-images.json`
   - Stable image assets: `public/cache/content-images/*`
   - Authenticated metadata/assets when applicable:
     - `data/cache/rich-authenticated-cache.json`
     - `public/cache/rich-authenticated/*`

## Acceptance checks

- The link renders with a local cached image path at runtime.
- `bun run validate:data` passes.
- `bun run build` passes.
- New or changed cache artifacts are included in the same change batch as the link edit.

## Notes

- `data/cache/content-images.runtime.json` is gitignored runtime revalidation state; do not commit it.
- Manual metadata stays in `data/links.json`; public/authenticated metadata caches stay in their existing committed cache files.
