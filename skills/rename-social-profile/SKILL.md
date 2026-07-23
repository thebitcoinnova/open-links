---
name: rename-social-profile
description: Preserve one social profile's cache and follower-history continuity when its public handle or username changes. Use for requests such as "changed my handle", "renamed my profile", "new username", or "keep my analytics/history after this social URL changed". Do not use for replacement accounts or uncertain ownership; those require a new link ID through ordinary add/remove CRUD.
---

# Rename Social Profile

## Overview

Treat a verified handle change as a source-identity transition inside one stable OpenLinks link ID. Update current URLs, capture fresh cache and audience data for the new source, and append to the existing link-ID history series without rewriting factual historical handles or URLs.

## Safety Contract

- Confirm explicitly that the old and new URLs are the same account before applying a rename.
- Preserve the existing `links[].id`. The link ID is the history-series identity.
- Stop when ownership is uncertain, the platform changes, or the destination is a replacement account. Create a new link ID through ordinary CRUD instead.
- Never normalize, edit, delete, or backfill historical follower rows to the new handle.
- Never reuse old public-cache metadata, images, audience counts, validators, or timestamps for a new source identity.
- Do not use enrichment bypasses or `allowKnownBlocker` to complete this workflow.

## Workflow

### 1. Start from a current, valid repository

Follow `AGENTS.md` startup sync and install rules. Run:

```bash
bun run validate:data
```

If validation reports a public-cache identity mismatch caused by an already-edited URL, continue with this workflow; do not manually copy the stale cache entry to the new source.

### 2. Inspect the read-only plan

Run:

```bash
bun run social:profile:rename -- \
  --link-id <link-id> \
  --new-url <new-profile-url> \
  --format json
```

Use `--profile-link-label <label>` only when the old URL appears more than once in `profile.profileLinks`. Review:

- old and new platform, URL, and handle;
- the exact profile-link match;
- whether public-cache identity changes;
- history CSV path and pre-change row count.

Stop if the command reports a platform replacement, ambiguous profile link, or identity conflict.

### 3. Snapshot history before applying

The CLI intentionally does not modify follower history. Preserve a byte-level baseline before the later refresh:

```bash
history_csv="public/history/followers/<link-id>.csv"
history_snapshot="$(mktemp)"
cp "$history_csv" "$history_snapshot"
pre_change_rows="$(($(wc -l < "$history_snapshot") - 1))"
```

If the CSV does not exist, record a zero-row baseline instead of creating historical data by hand.

### 4. Apply the confirmed same-account rename

Only after explicit same-account confirmation, run:

```bash
bun run social:profile:rename -- \
  --link-id <link-id> \
  --new-url <new-profile-url> \
  --apply \
  --confirm-same-account \
  --format json
```

The command must update the matching `data/links.json` row and at most one matching `data/profile.json` `profileLinks` row. It must leave the history CSV and index untouched.

If the active URL already equals the new URL, a `no_change` report is expected. Continue to the cache refresh when validation still reports an old cache identity.

### 5. Capture fresh metadata and audience data

Refresh the base public cache first, then the browser-derived audience snapshot:

```bash
mkdir -p .ci-diagnostics
bun run enrich:rich:strict:write-cache
bun run public:rich:sync -- \
  --only-link <link-id> \
  --summary-json .ci-diagnostics/public-rich-sync-summary.json
```

Require a successful fresh capture for the renamed source. A failed or incomplete new-source capture must not replace the old cache entry and must not append a history observation.

### 6. Append to the stable link-ID series

Run:

```bash
bun run followers:history:sync -- \
  --public-rich-sync-summary .ci-diagnostics/public-rich-sync-summary.json
```

Confirm that:

- the same `public/history/followers/<link-id>.csv` gained the new observation;
- old rows still contain their original handles and canonical URLs;
- `public/history/followers/index.json` now describes the newest handle and observation;
- no second CSV was created for the new handle.

For a pre-existing CSV, verify its historical prefix byte-for-byte:

```bash
historical_prefix="$(mktemp)"
head -n "$((pre_change_rows + 1))" "$history_csv" > "$historical_prefix"
cmp "$history_snapshot" "$historical_prefix"
```

### 7. Verify and report

Run the repository-required checks, including:

```bash
bun run validate:data
bun run build
bun run quality:check
```

Report the stable link ID, old/new handles and URLs, cache refresh result, history row count before/after, byte-equivalence result for old rows, and latest index entry. Mention `open-links-sites` compatibility: schemas, link IDs, CSV paths, and index shape remain unchanged.

## Replacement Accounts

A replacement account is not a rename even when it uses the same platform or display name. Add it with a new link ID, remove or disable the old current link through ordinary CRUD, and keep the old CSV as historical data. Never merge two accounts' audience series.
