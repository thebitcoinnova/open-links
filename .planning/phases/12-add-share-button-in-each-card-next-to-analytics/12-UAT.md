---
status: diagnosed
phase: 12-add-share-button-in-each-card-next-to-analytics
source:
  - 12-01-SUMMARY.md
  - 12-02-SUMMARY.md
started: 2026-03-10T09:12:00Z
updated: 2026-03-10T10:50:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Profile Share Parity
expected: The profile-level Share button still works as before, including native share or clipboard fallback behavior and short-lived feedback.
result: issue
reported: "There is a bug when I share and click Copy, because it copies not only the link, but also some text, so I cannot directly paste into the web browser, for example, I got \"https://primal.net/peterryszkiewicz%20Nostr%20profile%20and%20notes\""
severity: major

### 2. History-Aware Card Action Row
expected: History-aware cards now show two actions in order: analytics first, share second. The pair should read like one header action row instead of a separate side column.
result: pass

### 3. Card Share Action
expected: Clicking a card-level share button should target that specific card URL and trigger native share when available, or copy that card URL when native share is unavailable.
result: issue
reported: "pass except I also get the page title, so it is not directly copy-pasteable; perhaps this is expected"
severity: major

### 4. No-Action Cards Stay Clean
expected: Cards without follower-history data should not gain a broken or empty action row.
result: issue
reported: "One bug is that even cards without history should still show the Share button but I do not see it"
severity: major

### 5. Card Share Feedback
expected: If native share is unavailable and the card falls back to copying the link, the card should show short-lived feedback without breaking card layout or interaction.
result: pass

## Summary

total: 5
passed: 2
issues: 3
pending: 0
skipped: 0

## Gaps

- truth: "Profile-level share copy produces a clean URL that can be pasted directly into a browser address bar."
  status: failed
  reason: "User reported: There is a bug when I share and click Copy, because it copies not only the link, but also some text, so I cannot directly paste into the web browser, for example, I got \"https://primal.net/peterryszkiewicz%20Nostr%20profile%20and%20notes\""
  severity: major
  test: 1
  root_cause: "The shared `shareLink(...)` helper currently includes `text` and `title` in the native Web Share payload. On the user's platform, the share-sheet Copy action serializes that richer payload into a pasted string that mixes the URL with surrounding text, so the result is no longer a clean browser-pasteable URL."
  artifacts:
    - path: "src/lib/share/share-link.ts"
      issue: "Native share payload always carries `title`/`text` when provided, even when clean URL copy behavior is more important than richer share metadata."
    - path: "src/components/profile/ProfileHeader.tsx"
      issue: "Profile share currently passes `headline` into the shared share helper, which contributes to the mixed copy payload."
  missing:
    - "Add a copy-safe share mode or payload policy that can omit extra text/title when direct URL copy behavior matters."
    - "Add regression coverage for share helper payload selection so profile share can produce a clean URL-oriented copy result."
  debug_session: ""
- truth: "Card-level share copy produces a clean card URL rather than a URL with appended title or page text."
  status: failed
  reason: "User reported: pass except I also get the page title, so it is not directly copy-pasteable; perhaps this is expected"
  severity: major
  test: 3
  root_cause: "Card share uses the same shared `shareLink(...)` helper and currently passes both `label` and `description` into the native share payload. The platform Copy action therefore includes more than the raw URL, causing the copied result to contain card text instead of a clean card URL."
  artifacts:
    - path: "src/routes/index.tsx"
      issue: "Card share actions always pass descriptive text into the share helper payload."
    - path: "src/lib/share/share-link.ts"
      issue: "The helper does not currently distinguish between 'rich share' payloads and 'URL-only copy-safe' payloads."
  missing:
    - "Adjust card share payload construction so copy results remain URL-clean."
    - "Add focused tests for the card share payload path after the helper is updated."
  debug_session: ""
- truth: "Cards without follower-history data still expose the card-level share action."
  status: failed
  reason: "User reported: One bug is that even cards without history should still show the Share button but I do not see it"
  severity: major
  test: 4
  root_cause: "The card action list in `src/routes/index.tsx` is gated entirely on `historyEntry`; when a card has no follower-history data, the route returns an empty action list instead of rendering share-only. That couples share visibility to analytics availability."
  artifacts:
    - path: "src/routes/index.tsx"
      issue: "Card action resolution returns `[]` when no history entry exists, suppressing share for non-history cards."
  missing:
    - "Decouple share availability from analytics availability so cards without history can still render a share-only action row."
    - "Add regression coverage proving cards without history still show share while history-aware cards show analytics then share."
  debug_session: ""
