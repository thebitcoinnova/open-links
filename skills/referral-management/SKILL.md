---
name: referral-management
description: Interview-driven workflow for maintaining referral catalog families, offers, matchers, link-level catalog refs, and fork-vs-upstream contribution scope.
---

# Referral Management Skill

Use this skill when OpenLinks maintainers need to add, update, or review referral catalog data at the authoring layer.

This workflow is for:

- new referral program families
- new offer variants inside an existing family
- new matcher or link-shape coverage
- link-level `links[].referral.catalogRef` adoption
- manual referral overrides on top of catalog-backed defaults
- deciding whether a change belongs in the shared catalog or the fork-local overlay

This workflow is not for:

- authenticated rich extractor work
- public-vs-authenticated metadata triage
- payment/tip card icon or QR badge wiring
- general non-referral rich-link troubleshooting

If the problem is missing rich metadata rather than referral catalog authoring, use:

- `docs/create-new-rich-content-extractor.md`
- `skills/create-new-rich-content-extractor/SKILL.md`

## Goals

1. Keep `links[].referral` as the runtime/render contract.
2. Treat the catalog as the higher-level authoring layer.
3. Interview the maintainer before editing files.
4. Keep `data/policy/referral-catalog.local.json` clearly fork-owned.
5. Prompt for a clean upstream PR when a generic shared catalog improvement would help other forks.
6. Keep downstream `open-links-sites` compatibility explicit whenever shared catalog/schema/runtime surfaces move.

## Primary Files This Skill May Touch

- `data/policy/referral-catalog.json`
- `data/policy/referral-catalog.local.json`
- `data/links.json`
- `docs/data-model.md`
- `docs/customization-catalog.md`
- `docs/openclaw-update-crud.md`
- `docs/ai-guided-customization.md`
- `docs/downstream-open-links-sites.md`

## Read Before Editing

1. `docs/data-model.md`
2. `docs/customization-catalog.md`
3. `docs/openclaw-update-crud.md`
4. `docs/downstream-open-links-sites.md`
5. `skills/referral-management/references/interview-checklist.md`

If the request might be heading toward authenticated extraction, also read:

- `docs/create-new-rich-content-extractor.md`
- `skills/create-new-rich-content-extractor/SKILL.md`

## Required Interview

Do not start editing catalog or link files until you have the answers to these categories:

1. Change type
   - Is this a new family, a new offer variant, a new matcher/link shape, or only a link-level override?
2. Canonical program identity
   - What is the public program/family name?
   - What is the canonical public landing or terms URL?
3. Offer variant details
   - What is the safe public benefit text?
   - Are there jurisdiction, time-window, or eligibility caveats?
4. Matcher and link shape
   - Which hosts, path shapes, query keys, or shortener patterns should map to the offer?
5. Link-level runtime needs
   - Should the link use `links[].referral.catalogRef`?
   - Which manual fields should still override catalog defaults?
6. Scope decision
   - Is this reusable shared knowledge that belongs upstream?
   - Or is it fork-local overlay data that should stay in `data/policy/referral-catalog.local.json`?

Use `skills/referral-management/references/interview-checklist.md` as the concrete questionnaire.

## Authoring Model

Keep these layers distinct:

1. Shared catalog authoring
   - `data/policy/referral-catalog.json`
   - Use for generic families, offers, and matchers that are broadly reusable across forks.
2. Fork-local overlay authoring
   - `data/policy/referral-catalog.local.json`
   - Use for fork-specific additions, experiments, local campaigns, or overrides that should not ship upstream.
3. Runtime/render contract
   - `links[].referral`
   - Use for explicit per-link disclosures, `catalogRef`, and manual overrides that cards/runtime actually consume.

Manual runtime disclosure fields stay authoritative even when catalog data exists.

## Scope Decision Rules

Choose the smallest correct scope:

- Only edit `links[].referral` when:
  - the request is one-off,
  - the disclosure is local to a single saved link,
  - or the maintainer explicitly wants manual-only authoring.
- Edit the shared catalog when:
  - the family/offer/matcher is generic,
  - the same logic would help multiple forks,
  - or the change improves shared schema/policy/runtime behavior.
- Edit `data/policy/referral-catalog.local.json` when:
  - the catalog item is fork-specific,
  - the offer is private/temporary/localized,
  - or the maintainer does not want the data in upstream shared history.

When in doubt, ask directly whether the maintainer wants the change to help other forks or only this fork.

## Execution Flow

1. Interview first.
   - Work through the checklist and summarize the requested family, offer, matcher, link, and scope decisions before editing.
2. Decide the target layer.
   - Shared catalog, fork-local overlay, link-only runtime override, or a combination.
3. Apply the minimal edit set.
   - Catalog family/offer/matcher data
   - Link `catalogRef`
   - Manual `links[].referral` overrides
   - Doc updates only when workflow guidance or downstream expectations changed
4. Keep runtime truth readable.
   - Do not replace manual disclosure text with catalog data if the manual text is intentionally more precise.
5. Re-run the relevant verification.
6. If the change is broadly useful, prompt for upstream contribution.

## Upstream PR Prompting

If a fork adds a generic family, offer, or matcher that would likely help other forks:

1. Say explicitly that a targeted upstream PR is recommended.
2. Keep the PR scoped to shared files such as:
   - `data/policy/referral-catalog.json`
   - shared docs
   - tests or runtime/schema changes when relevant
3. Keep `data/policy/referral-catalog.local.json` out of that PR.
4. Rebuild the branch from upstream rather than carrying fork-personalized history when needed.
5. Inspect the final diff before the PR and verify no fork-owned overlay paths are included.

Recommended wording:

- "This catalog addition looks generic enough to help other forks. Open a clean upstream PR for the shared catalog/docs change, and keep `data/policy/referral-catalog.local.json` on the fork-only side of the diff."

Do not prompt for an upstream PR when the change is clearly personal, temporary, or fork-specific.

## Extractor Boundary

Stop and switch workflows if the real problem is not catalog authoring but missing metadata capture.

Examples that belong to extractor/public-enrichment workflow instead:

- the referral landing page has no usable public title, image, or description
- the program only becomes understandable after login
- the maintainer is asking for a new authenticated cache or extractor

In that case:

1. Keep any already-collected referral disclosure notes.
2. Explain that referral-management is not extractor-authoring work.
3. Route to `docs/create-new-rich-content-extractor.md` and `skills/create-new-rich-content-extractor/SKILL.md`.

## Verification

Run the smallest relevant set based on what changed:

- docs or skill changes only:
  - `bun run biome:check`
- link or catalog data changes:
  - `bun run validate:data`
  - `bun run enrich:rich:strict`
- runtime/render behavior touched elsewhere:
  - `bun run build`

When shared contract, policy, or script behavior changed, do a downstream consistency pass:

- confirm `links[].referral` still reads as the runtime/render contract
- confirm `data/policy/referral-catalog.local.json` still reads as fork-owned overlay data
- confirm `docs/downstream-open-links-sites.md` still explains the shared-vs-fork split

## Final Response Contract

Every referral-management run should report:

1. Change type
2. Shared vs fork-local decision
3. Files edited
4. Whether `links[].referral.catalogRef` or manual overrides were added/changed
5. Verification run
6. Whether an upstream PR was recommended

## References

- `docs/data-model.md`
- `docs/customization-catalog.md`
- `docs/openclaw-update-crud.md`
- `docs/ai-guided-customization.md`
- `docs/downstream-open-links-sites.md`
- `docs/create-new-rich-content-extractor.md`
- `skills/referral-management/references/interview-checklist.md`
- `skills/create-new-rich-content-extractor/SKILL.md`
