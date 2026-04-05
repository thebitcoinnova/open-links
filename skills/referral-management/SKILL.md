---
name: referral-management
description: Interview-driven referral catalog CRUD, inbox/MCP referral import, batch planning, and upstream-worthy shared catalog follow-up for OpenLinks.
---

# Referral Management Skill

Use this skill when OpenLinks referral work involves:

- reusable families, offers, or matcher/link shapes,
- shared-vs-fork catalog scope decisions,
- batch referral authoring from a user-approved inbox or Gmail MCP server,
- reviewing which referral links should land in `data/links.json` versus the fork-local overlay,
- preparing a clean upstream-worthy shared catalog follow-up.

Do not use this skill for payment/tip-card icon work or for rich-metadata extractor authoring. If a candidate link cannot become a rich card through the normal public path, hand off to `skills/create-new-rich-content-extractor/SKILL.md`.

## Branches

### 1) Normal referral catalog CRUD

Use this branch when the user already knows which referral links or families they want to add.

1. Confirm whether the requested reusable knowledge belongs in:
   - shared catalog: `data/policy/referral-catalog.json`
   - fork-local overlay: `data/policy/referral-catalog.local.json`
   - link-only authoring in `data/links.json`
2. Keep `links[].referral` as the runtime/render contract.
3. Prefer manual disclosures first. Use catalog-backed defaults when the matcher/family/offer really is reusable.
4. If the generic shared portion would help upstream or other forks, keep the fork update local first and then prepare a clean upstream follow-up that excludes fork-owned paths.

### 2) Inbox / MCP referral import

Use this branch when the user wants referral links mined from email.

1. Do not query inbox tools until the user explicitly grants permission for that mailbox or MCP server.
2. Build a minimal, gitignored candidate file first. Do not store raw email bodies, cookies, tokens, or screenshots in the repo.
3. Resolve and audit tracking-heavy links before planning:

```bash
bun run referrals:import:resolve -- --input .cache/referral-management/inbox-candidates.json --output .cache/referral-management/inbox-candidates.resolved.json --report .cache/referral-management/referral-resolve-report.json
```

4. Review the resolver report and, when needed, set `approvedUrl` on any `review_required` candidate you want to carry forward.
5. Run the deterministic planner on the resolved candidate file:

```bash
bun run referrals:import:plan -- --input .cache/referral-management/inbox-candidates.resolved.json
```

6. Review the generated table and proposal JSON with the user before any repo write.
7. After approval, apply the accepted batch:

```bash
bun run referrals:import:apply -- --proposal .cache/referral-management/referral-import-plan.json --all-planned
```

Or apply a reviewed subset:

```bash
bun run referrals:import:apply -- --proposal .cache/referral-management/referral-import-plan.json --only candidate-a,candidate-b
```

8. After apply, run the normal referral verification path:
   - `bun run enrich:rich:strict`
   - `bun run images:sync`
   - `bun run validate:data`
   - `bun run build`
   - `bun run quality:check`
9. If enrichment blocks on a candidate, stop that item and follow the repo’s blocker-choice workflow instead of silently enabling overrides.

Load `references/inbox-mcp-import.md` when you need the candidate contract, MCP search heuristics, permission gate wording, resolver/planner/apply command details, or the review gate for tracking-only links.

### 3) Upstream-worthy shared follow-up

Use this branch after a fork-local update exposed a generic family/offer/matcher that would help other forks.

1. Keep the local fork update working even if the shared follow-up is deferred.
2. Keep `data/policy/referral-catalog.local.json` out of the upstream diff.
3. Limit the shared PR to reusable catalog/docs/test changes.

Load `references/shared-catalog-follow-up.md` when you need the scope rule and PR hygiene checklist.

## Notes

- Imported HTTP(S) referrals should stay on `type: "rich"` by default.
- Prefer known-site icon resolution first and fall back to `globe` only when no known site resolves.
- Preserve `enrichment.profileSemantics="non_profile"` for signup/invite URLs on supported profile families.
- The planner supports five dispositions: `match_existing_catalog`, `create_local_catalog`, `propose_shared_catalog`, `link_only`, and `skip`.

## References

- Inbox permission gate, MCP search heuristics, candidate contract, planner/apply commands, and blocker handoff:
  `references/inbox-mcp-import.md`
- Shared-vs-fork scope and upstream PR hygiene:
  `references/shared-catalog-follow-up.md`
- Canonical referral runtime contract:
  `docs/data-model.md`
- Day-2 CRUD flow:
  `docs/openclaw-update-crud.md`
