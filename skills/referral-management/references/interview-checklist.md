# Referral Management Interview Checklist

Use this checklist before editing the referral catalog, local overlay, or
`links[].referral` data.

Do not skip the scope questions. They decide whether the change belongs in the
shared catalog, the fork-local overlay, or only the runtime link data.

## 1. Request Shape

- What is the maintainer asking for?
- Is this:
  - a new family/program,
  - a new offer variant,
  - a new matcher/link shape,
  - a link-level `catalogRef`,
  - or only manual referral disclosure edits?
- Which saved link ids or URLs are in scope?

## 2. Canonical Program Identity

- What is the public program or family name?
- What is the canonical public landing page?
- What is the canonical terms or disclosure page, if different?
- Which hosts belong to the family?
- Is the program already represented in `data/policy/referral-catalog.json`?

## 3. Offer Variant Details

- What is the exact offer label?
- What kind is it:
  - `referral`
  - `affiliate`
  - `promo`
  - `invite`
- What does the visitor get?
- What does the site owner/project get?
- What short `offerSummary` is safe to publish?
- What short `termsSummary` is safe to publish?
- Is there a `termsUrl`?
- Is there a code that should be stored separately?
- Are there regional, campaign, time-window, or eligibility differences?

## 4. Matcher and Link Shape

- Which hosts should match?
- Is the shape driven by:
  - exact path,
  - path prefix,
  - query keys,
  - shortener redirect,
  - or multiple forms?
- Is there an existing matcher that should be extended instead of adding a new one?
- Can the matcher be described declaratively and explained in plain language?
- What explanation string should a future maintainer read and immediately understand?

## 5. Link-Level Runtime Contract

- Should the saved link point at catalog data via `links[].referral.catalogRef`?
- Which of these fields should still be authored manually on the link?
  - `visitorBenefit`
  - `ownerBenefit`
  - `offerSummary`
  - `termsSummary`
  - `termsUrl`
  - `code`
- Does the link need `enrichment.profileSemantics: "non_profile"`?
- Is `referral: {}` enough for now, or is real disclosure copy available?

## 6. Shared vs Fork-Local Scope

- Should this change help other forks?
- Would the family/offer/matcher be generic if published upstream?
- Is the data private, temporary, campaign-specific, or fork-personalized?
- Should it live in:
  - `data/policy/referral-catalog.json`, or
  - `data/policy/referral-catalog.local.json`?
- If fork-local, does the maintainer understand that the local overlay is fork-owned and should stay out of upstream PRs?

## 7. Upstream PR Hygiene

- If the change is broadly reusable, should a clean upstream PR be prepared?
- Which files are truly shared and should go into that PR?
- Confirm that `data/policy/referral-catalog.local.json` stays excluded from the upstream PR scope.
- If the current branch includes fork-owned content, should the shared change be rebuilt from upstream before opening the PR?

## 8. Downstream and Verification

- Does this change touch shared contract or policy surfaces that `open-links-sites` mirrors?
- Should downstream maintainers be prompted to review `docs/downstream-open-links-sites.md`?
- Which verification applies?
  - `bun run biome:check`
  - `bun run validate:data`
  - `bun run enrich:rich:strict`
  - `bun run build`

## 9. Pre-Edit Summary

Before editing, summarize back:

- change type
- family/offer/matcher decision
- target files
- manual override fields
- shared vs fork-local decision
- whether an upstream PR recommendation will be included
