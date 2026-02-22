---
status: complete
phase: 01-bootstrap-data-contract
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md]
started: 2026-02-22T18:05:00Z
updated: 2026-02-22T22:18:37Z
---

## Current Test

[testing complete]

## Tests

### 1. Homepage renders starter profile and cards
expected: Running `npm run dev` and loading the app shows starter profile content plus grouped link cards from split data files.
result: pass

### 2. Split data edit reflects in UI
expected: Changing a visible field in `data/profile.json` (for example `headline`) and refreshing updates the page content.
result: pass

### 3. Baseline validation passes
expected: `npm run validate:data` succeeds with 0 errors and 0 warnings for default `data/*.json`.
result: pass

### 4. Invalid URL scheme is rejected with remediation
expected: `npm run validate:data -- --links data/examples/invalid/bad-scheme.json` fails and reports unsupported scheme with fix guidance.
result: pass

### 5. Custom key conflicts are rejected
expected: `npm run validate:data -- --links data/examples/invalid/conflict-keys.json` fails and reports custom/reserved key collisions with remediation text.
result: pass

### 6. README onboarding guidance is actionable
expected: README includes clear fork/template setup, local validate/build flow, first publish checklist, strict mode notes, and troubleshooting guidance.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0

## Gaps

none yet
