---
status: in_progress
phase: 08-social-profile-card-ui-refresh
source: [08-01-SUMMARY.md, 08-02-SUMMARY.md, 08-03-SUMMARY.md]
started: 2026-03-07T19:37:19Z
updated: 2026-03-07T19:37:19Z
---

## Current Test

1

## Tests

### 1. Rich social cards show profile-style headers with audience counts
expected: Load the homepage and inspect the Instagram and YouTube cards. Each should show a circular avatar, a clear handle, and the saved audience counts in the header area. The YouTube card should visibly show the subscriber count.
result: pending

### 2. Rich social cards keep clean content and source context below the header
expected: On the Instagram and YouTube cards, the body copy should read as content/description first, with source branding below it. Instagram should no longer repeat the follower-count copy inside the description body.
result: pending

### 3. Non-profile rich cards still render stable fallback layouts
expected: Check a few non-profile rich cards such as GitHub, Facebook, or LinkedIn. They should still look coherent and readable, with no broken spacing, missing content, or odd placeholder behavior.
result: pending

### 4. Simple-card links still scan clearly after the refresh
expected: Check the plain simple-card link(s), such as OpenLinks. They should still feel compact and readable next to the refreshed rich cards, without broken alignment or confusing source/branding treatment.
result: pending

### 5. Mobile-width wrapping stays intentional for social profile cards
expected: On a narrow/mobile viewport, Instagram and YouTube should wrap handle, metrics, and source rows cleanly without clipping, overlap, or unreadable compression.
result: pending

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0

## Gaps

none yet
