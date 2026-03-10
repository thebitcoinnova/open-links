---
status: complete
phase: 09-docs-regression-hardening-social-cards
source:
  - 09-01-SUMMARY.md
  - 09-02-SUMMARY.md
started: 2026-03-10T11:29:30Z
updated: 2026-03-10T11:36:30Z
---

## Current Test

[testing complete]

## Tests

### 1. Canonical Data-Model Deep Dive
expected: `docs/data-model.md` now reads like the canonical social-card deep dive. It should include a minimal supported social-profile starter example, explain `profileDescription` plus audience fields, document the public follower-history artifacts, and describe the analytics/share surfaces. The minimal starter should appear before the richer override/history examples.
result: issue
notes: The docs do not make it clear enough that the recommended CRUD path for this data is via the repo AI skills or the Studio webapp rather than direct manual editing.

### 2. Cross-Linked Reference Docs
expected: `docs/customization-catalog.md`, `docs/authenticated-rich-extractors.md`, and `docs/rich-extractor-public-first-audit.md` should agree on the current public-vs-authenticated support split and mention the follower-history/public-cache story without contradicting the deep-dive docs.
result: skipped

### 3. Verification Guide Discoverability
expected: `README.md` should route maintainers to `docs/social-card-verification.md`, and that guide should include a quick checklist, an automated coverage map, a narrative walkthrough, and explicit public artifact checks.
result: skipped

### 4. Runtime Regression Smoke Check
expected: On the main links page, the previously shipped profile/card behavior should still look intact: profile-header analytics stays left of share, history-aware cards keep analytics then share, no-history cards still show share without a broken analytics control, and fallback cards still render as non-profile cards.
result: pass

### 5. Public Artifact Cross-Check
expected: `history/followers/index.json` and at least one listed platform CSV should still be reachable and match the documented shape: append-only rows with the expected audit columns and no unexpected column drift.
result: pass

## Summary

total: 5
passed: 2
issues: 1
pending: 0
skipped: 2

## Gaps

- Minor: The canonical and related docs need a clearer recommendation that the preferred CRUD path for this data is through the repo AI skills or the Studio webapp, with direct JSON editing framed as the lower-level/manual route.
