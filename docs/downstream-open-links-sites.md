# `open-links-sites` Downstream Synopsis

[`open-links-sites`](https://github.com/pRizz/open-links-sites) is an active
downstream project built on top of this repository. Its current role is to act
as a control repo for many individual OpenLinks sites while delegating person
page rendering and much of the low-level contract surface to upstream
[`open-links`](https://github.com/pRizz/open-links).

This synopsis reflects the downstream repo state inspected on 2026-03-25.

## What The Downstream Repo Owns

- Canonical per-person source data lives under `people/<id>/`.
- Each person directory includes repo-local orchestration metadata in
  `person.json` plus upstream-shaped `profile.json`, `links.json`, and
  `site.json`.
- Person assets stay under `people/<id>/assets/`.
- Generated workspaces live under `generated/` and are treated as disposable.
- The repo adds thin orchestration for multi-person management, landing-page
  generation, and deployment planning.

## How It Uses `open-links`

- It mirrors upstream OpenLinks schemas through `schemas/upstream/*.schema.json`
  and treats the three-file data contract as the canonical person-page input.
- Its materialization flow copies support files out of this repo, including
  `schema/`, `data/policy/`,
  `data/cache/rich-authenticated-cache.json`, and
  `public/history/followers/`.
- Its import/enrichment flow materializes a disposable workspace, then runs
  upstream `open-links` scripts there for rich-link enrichment, avatar sync,
  content-image sync, public rich sync, and validation.
- Its site build flow asks the upstream `open-links` repo to build each
  person-page site, then wraps those outputs in a root landing page and
  multi-site deployment layer.

## Current Integration Shape

- Upstream pinning lives in `config/upstream-open-links.json`.
- Scheduled downstream automation runs `bun run sync:upstream:main` and compares the pinned
  commit with `pRizz/open-links` `main`. This sync flow is meant for downstream/fork repos, not the canonical `pRizz/open-links` repo itself.
- Its GitHub workflows clone this repo during upstream-sync and deploy flows.
- Release verification in the downstream repo builds against the pinned
  `open-links` commit and runs smoke checks over the generated site output.

## Compatibility Surfaces To Watch In This Repo

Changes in this repo are especially likely to affect `open-links-sites` when
they touch:

- `schema/` or the meaning of `data/profile.json`, `data/links.json`, and
  `data/site.json`
- `data/policy/`, authenticated cache support files, or
  `public/history/followers`
- script entrypoints, flags, or assumptions used by downstream materialize,
  import, enrich, validate, or build flows
- build/render output conventions relied on by downstream smoke checks,
  manifest planning, or site assembly

## Referral-Specific Compatibility Notes

The referral milestone now has two distinct downstream surfaces:

- `links[].referral` remains the additive runtime/render contract.
- `data/policy/referral-catalog.json` is the shared higher-level authoring layer that seeds that runtime contract.

The most important compatibility rule is to keep those layers distinct when you
review an upstream pin bump.

### Shared Surfaces To Review

Review downstream impact whenever the upstream change touches any of these:

- `schema/links.schema.json`
- `schema/referral-catalog.schema.json`
- `data/policy/referral-catalog.json`
- `src/lib/content/referral-fields.ts`
- `src/lib/content/referral-catalog.ts`
- scripts that validate, enrich, or report referral data
- docs that redefine referral authoring or shared-vs-fork workflow

Concrete downstream guidance:

1. When you update the upstream `open-links` pin, review the referral contract notes in `docs/data-model.md`.
2. Verify that `links[].referral` still reads as the runtime/render contract your downstream repo expects to mirror.
3. Verify that any shared catalog changes under `data/policy/referral-catalog.json` are acceptable for your downstream materialization flow.
4. Recheck any downstream tooling that mirrors or validates shared policy files when the catalog schema changes.

### Fork-Local Overlay Handling

`data/policy/referral-catalog.local.json` is the fork-owned overlay side of the
referral model. Treat it differently from the shared catalog.

Rules:

1. Do not treat `data/policy/referral-catalog.local.json` as upstream-shared contract data.
2. Do not include `data/policy/referral-catalog.local.json` in upstream PR diffs.
3. If a downstream repo wants local-only referral catalog additions, keep them on that repo's fork-owned side instead of assuming they came from upstream.
4. If a fork discovers a generic family, offer, or matcher that would help other forks, upstream the shared portion in `data/policy/referral-catalog.json` and keep any local overlay-only data separate.

### Runtime Contract Reminder

Downstream repos should continue to think in this order:

1. `links[].referral` is what runtime/render consumers read.
2. `catalogRef` is a higher-level pointer nested inside that runtime object.
3. Manual link-level fields still override catalog defaults.
4. Generated/public enrichment remains assistive rather than authoritative.

That means a downstream repo can adopt shared catalog improvements without
treating the catalog file itself as a replacement for the existing runtime link
shape.

### UI-Only Versus Shared-Contract Changes

Treat these as lower-risk downstream changes:

- referral badge styling
- sibling terms-link layout
- other card-presentation-only tweaks

Treat these as higher-risk and worthy of explicit review:

- schema changes
- shared policy changes
- runtime merge/preference changes
- script entrypoint or validation behavior changes

This note is about compatibility awareness, not a promise that every change
requires cross-repo updates. The intent is to make downstream impact explicit
when those shared surfaces change.
