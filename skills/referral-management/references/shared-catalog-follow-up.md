# Shared Catalog Follow-Up

Use this reference when the local fork update uncovered reusable referral knowledge.

## Scope Rule

- Shared reusable knowledge belongs in `data/policy/referral-catalog.json`.
- Fork-specific or experimental knowledge belongs in `data/policy/referral-catalog.local.json`.
- `links[].referral` remains the runtime/render contract either way.

## Upstream Hygiene

1. Keep the local fork update working first.
2. Rebuild the upstream branch from upstream state, not from a personalized fork branch tip.
3. Exclude fork-owned paths from the upstream diff, especially `data/policy/referral-catalog.local.json`.
4. Limit the upstream PR to shared catalog/docs/test changes.
5. Say explicitly in the PR summary that fork-owned paths were excluded.
