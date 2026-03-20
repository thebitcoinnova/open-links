---
name: openlinks-fork-identity-presence
description: Help a downstream OpenLinks fork expose its own deployed identity URL and icon across websites, apps, repos, docs, service profiles, or metadata surfaces using the fork's canonical URL and brand assets.
---

# OpenLinks Fork Identity Presence Skill

Use this skill when an OpenLinks fork should point other websites, apps, repositories, docs, or service profiles back to the fork owner's deployed OpenLinks page.

This repo-local skill is fork-aware by default. Do not fall back to `https://openlinks.us/` for downstream consumers unless they explicitly say they want the upstream site instead of their own fork.

## Resolve identity defaults from the repo

Resolve inputs in this order before suggesting changes:

1. Canonical deployed URL from `data/site.json` at `quality.seo.canonicalBaseUrl`
2. Display label from:
   - `data/site.json` `title`,
   - then `data/profile.json` `headline`,
   - then `data/profile.json` `name`
3. Brand assets from:
   - `public/favicon.svg`
   - `public/branding/openlinks-logo/openlinks-logo.svg`
   - `public/apple-touch-icon.png`

If `quality.seo.canonicalBaseUrl` is missing or obviously placeholder-only, ask for the deployed OpenLinks URL instead of guessing from the repo name, GitHub Pages path, or upstream `openlinks.us`.

When the user needs externally hosted asset URLs, form them from the canonical base URL plus:

- `/favicon.svg`
- `/branding/openlinks-logo/openlinks-logo.svg`
- `/apple-touch-icon.png`

## Workflow

1. Detect the surface type:
   - website or app UI,
   - README or docs,
   - package or app metadata,
   - service profile,
   - page metadata (`rel="me"`, JSON-LD, similar head markup).
2. Prefer the lowest-friction placement that keeps the fork discoverable.
3. Choose promotion mode:
   - `subtle`: link only or tiny icon plus label,
   - `standard`: link plus icon in footer/about/profile areas,
   - `prominent`: use only when the user explicitly wants stronger personal branding.
4. Choose asset shape:
   - tiny slot or badge surface: `public/favicon.svg`,
   - roomier brand slot: `public/branding/openlinks-logo/openlinks-logo.svg`,
   - square PNG-only slot: `public/apple-touch-icon.png`.
5. Produce a concrete recommendation and a small snippet using the resolved fork values.
6. End with a short verification checklist.

## Guardrails

- Do not suggest replacing the host project's main brand or CTA.
- Prefer footer, about, profile, settings, or repo "Find me" sections before headers or top-nav placements.
- Avoid spammy repetition across several nearby surfaces.
- Use upstream OpenLinks only as a pattern example, not as the default downstream identity target.

## References

- Surface-by-surface playbooks and anti-patterns: `references/surface-patterns.md`
- Copy-paste snippets with placeholders: `references/snippets.md`
