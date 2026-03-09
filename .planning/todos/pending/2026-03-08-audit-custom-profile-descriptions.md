---
created: 2026-03-08T21:35
title: Audit custom profile descriptions
area: general
files:
  - data/cache/rich-public-cache.json:69
  - schema/links.schema.json:170
  - src/lib/ui/rich-card-policy.ts:191
  - src/lib/ui/social-profile-metadata.ts:126
  - src/components/cards/social-profile-card-rendering.test.tsx:287
  - packages/studio-web/src/pages/EditorPage.tsx:221
  - docs/data-model.md:488
  - skills/create-new-rich-content-extractor/SKILL.md:24
---

## Problem

Some platforms expose a user-authored profile bio/description that is not the same as the page-level header, Open Graph, or oEmbed description currently flowing through rich enrichment. X is the clearest example: the profile has a custom personal description, but the current public cache and card description logic appear to collapse everything into a single `description` field. That risks losing intent, makes it hard to distinguish fetched header copy from profile-authored copy, and likely means other supported social profiles and extractor guidance have the same blind spot.

We should audit the currently supported websites, existing public/authenticated cache entries, and extractor/skill guidance to determine where a distinct profile description exists, where we are dropping it today, and how cards should prefer or surface it without regressing generic rich-card fallback behavior.

## Solution

Introduce a first-class field for profile-authored descriptions/bios alongside the existing fetched page description, then audit supported platforms and extractors to populate it when available. Update schemas, cache manifests, load/merge logic, social-profile card rendering, and Studio/editor affordances so cards can intentionally display the custom profile description while still preserving existing fallback rules for non-profile links.

As part of the same pass, audit the extractor authoring workflow and related docs/skills so new or existing platform support explicitly captures both page metadata description and custom profile description where the site exposes both. Add regression coverage around X plus at least one other platform to prove the distinction is stored and rendered correctly.
