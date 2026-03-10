---
status: diagnosed
phase: 11-historical-follower-tracking-growth-charts
source:
  - 11-01-SUMMARY.md
  - 11-02-SUMMARY.md
  - 11-03-SUMMARY.md
started: 2026-03-10T02:35:00Z
updated: 2026-03-10T08:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Profile Header Analytics Entry
expected: On the main links page, the profile header shows a new analytics button immediately left of Share, and clicking it opens the dedicated all-platform analytics view.
result: pass

### 2. Analytics Page Default State
expected: The all-platform analytics view loads in a minimal layout, defaults to the last 30 days, and shows separate platform charts rather than one misleading shared-scale graph.
result: pass

### 3. Analytics Page Range Controls
expected: Switching between 30D, 90D, 180D, and All updates the analytics view without errors or broken layout.
result: pass

### 4. Card-Level Analytics Modal
expected: History-aware cards on the main links page show an analytics button, clicking it opens a platform-specific modal, and cards without published history remain unchanged.
result: issue
reported: "I do not see the analytics buttons in each card unless I have already clicked on the page-level analytics button and come back to the main page. Also, the Analytics button should be in a row in the card headers instead of a new column in the card."
severity: major

### 5. Modal Raw vs Growth Toggle
expected: The platform modal can switch between raw counts and growth views, responds to the same range controls, and closes cleanly back to the page you came from.
result: pass

### 6. Public History Artifact Access
expected: The published history assets are directly reachable as public files, including `history/followers/index.json` and at least one platform CSV path from that index.
result: pass

## Summary

total: 6
passed: 5
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "History-aware cards show analytics buttons immediately on the main links page without requiring a prior visit to the page-level analytics view."
  status: failed
  reason: "User reported: I do not see the analytics buttons in each card unless I have already clicked on the page-level analytics button and come back to the main page."
  severity: major
  test: 4
  root_cause: "Card analytics availability is currently resolved inside `RouteIndex.renderCard(...)` during the initial links render, and the visible link-card subtree does not refresh when the async follower-history index becomes available. Toggling the page-level analytics view forces the list subtree to remount, which is why the per-card buttons only appear after that round trip."
  artifacts:
    - path: "src/routes/index.tsx"
      issue: "Per-card analytics button availability is derived in the route render helper instead of a reliably reactive per-card seam."
  missing:
    - "Move card analytics availability into a reactive per-card path so buttons appear as soon as the history index loads."
    - "Add a regression proving history-aware cards expose analytics buttons on first page load without visiting the page-level analytics view."
  debug_session: ".planning/phases/11-historical-follower-tracking-growth-charts/11-UAT.md"
- truth: "Card analytics controls align within the card header row instead of rendering as a separate new column beside the card."
  status: failed
  reason: "User reported: Also, the Analytics button should be in a row in the card headers instead of a new column in the card."
  severity: cosmetic
  test: 4
  root_cause: "The analytics control is rendered as an absolutely positioned sibling of the anchor shell in `NonPaymentLinkCardShell`, with supporting CSS that treats it like a floating overlay. That keeps it out of the link semantics, but it also makes it read visually like a separate card column instead of a header-row action."
  artifacts:
    - path: "src/components/cards/NonPaymentLinkCardShell.tsx"
      issue: "Card analytics button is rendered outside the summary/header structure."
    - path: "src/styles/base.css"
      issue: "Absolute positioning styles place the analytics control in a floating side position."
  missing:
    - "Reposition the analytics action into the card summary/header row without nesting it inside the link anchor."
    - "Update focused rendering and accessibility coverage for the new card-header action layout."
  debug_session: ".planning/phases/11-historical-follower-tracking-growth-charts/11-UAT.md"
