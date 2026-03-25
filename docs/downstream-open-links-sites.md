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
- Scheduled automation runs `bun run sync:upstream` and compares the pinned
  commit with `pRizz/open-links` `main`.
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

This note is about compatibility awareness, not a promise that every change
requires cross-repo updates. The intent is to make downstream impact explicit
when those shared surfaces change.
