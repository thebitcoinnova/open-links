# Inbox / MCP Referral Import

Use this reference only when the user wants inbox-driven referral discovery.

## Permission Gate

- Ask for explicit permission before any inbox query.
- Scope the permission to the chosen mailbox or MCP server.
- Keep raw email bodies, cookies, auth headers, screenshots, and copied full-message text out of the repo.
- Save only the normalized candidate JSON under `.cache/referral-management/`.

## MCP Search Heuristics

Start narrow and only widen when the first pass misses obvious candidates.

- Query for terms like `referral`, `invite`, `promo`, `affiliate`, `discount code`, `join with my link`, and `use my link`.
- Prefer messages that contain durable HTTP(S) landing URLs.
- Skip coupon-only emails in v1.
- Split multi-link emails into one normalized candidate per URL.

## Candidate Contract

Raw candidate input path:

`/.cache/referral-management/inbox-candidates.json`

Resolved planner input path:

`/.cache/referral-management/inbox-candidates.resolved.json`

Resolver audit report path:

`/.cache/referral-management/referral-resolve-report.json`

Supported JSON shapes:

- array of candidates
- object with a `candidates` array

Minimal candidate example:

```json
[
  {
    "candidateId": "club-orange-email-1",
    "source": {
      "provider": "gmail-mcp",
      "messageId": "msg_123",
      "subject": "Use my Club Orange referral link"
    },
    "url": "https://signup.cluborange.org/co/pryszkie",
    "confidence": 0.94,
    "catalogScopeHint": "shared",
    "familyLabelHint": "Club Orange"
  }
]
```

Optional hints the planner understands:

- `kindHint`
- `catalogScopeHint`
- `profileSemanticsHint`
- `labelHint`
- `descriptionHint`
- `groupHint`
- `iconHint`
- `familyLabelHint`
- `offerLabelHint`
- `visitorBenefitHint`
- `ownerBenefitHint`
- `offerSummaryHint`
- `termsSummaryHint`
- `termsUrlHint`

Resolver-managed fields:

- `approvedUrl`
- `resolution.status`
- `resolution.originalUrl`
- `resolution.recommendedUrl`
- `resolution.resolvedUrl`
- `resolution.reason`
- `resolution.reviewReason`
- `resolution.terminalStatusCode`
- `resolution.terminalTitle`

Use `approvedUrl` only after reviewing the redirect audit report when the resolver marks a candidate `review_required`.

## Resolver / Review Step

Resolve tracking-heavy links and write the planner-ready candidate file plus audit report:

```bash
bun run referrals:import:resolve -- --input .cache/referral-management/inbox-candidates.json --output .cache/referral-management/inbox-candidates.resolved.json --report .cache/referral-management/referral-resolve-report.json
```

Review expectations:

- `resolved_clear`: the resolver found exactly one strong referral-like web target and set `resolution.recommendedUrl`.
- `review_required`: the redirect chain contained multiple plausible web targets; inspect the report and set `approvedUrl` before planning.
- `unresolved`: the resolver did not find a safe referral-like web target; keep the candidate out of planning until you replace the URL manually or choose a different source link.

## Planner / Apply Commands

Plan:

```bash
bun run referrals:import:plan -- --input .cache/referral-management/inbox-candidates.resolved.json
```

Apply every reviewed actionable item:

```bash
bun run referrals:import:apply -- --proposal .cache/referral-management/referral-import-plan.json --all-planned
```

Apply a reviewed subset:

```bash
bun run referrals:import:apply -- --proposal .cache/referral-management/referral-import-plan.json --only candidate-a,candidate-b
```

## Blocker Handoff

If `bun run enrich:rich:strict` still blocks after the user approves an imported candidate:

1. stop that item,
2. follow the repo’s mandatory blocker-choice flow,
3. use `skills/create-new-rich-content-extractor/SKILL.md` only when the normal public path is insufficient.
