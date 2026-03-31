---
phase: 23-automatic-referral-benefit-extraction
plan: 02
subsystem: public-browser-referral-fallback
tags: [referral, enrichment, browser-fallback, public-pages]
requires:
  - 23-01
provides:
  - generic public browser capture for referral pages
  - fallback-only benefit extraction wiring
  - reusable rendered-text artifact capture
affects: [public-browser-capture, enrich-rich-links, generated-referral-fields]
tech-stack:
  added: []
  patterns: [public-first-browser-fallback, shared-extraction-rules, rendered-text-artifacts]
key-files:
  created:
    - scripts/enrichment/public-browser.test.ts
    - scripts/embedded-code/browser/referral/extract-public-referral-text.js
    - .planning/phases/23-automatic-referral-benefit-extraction/23-02-SUMMARY.md
  modified:
    - scripts/enrichment/public-browser.ts
    - scripts/enrich-rich-links.ts
    - scripts/enrichment/public-augmentation.test.ts
key-decisions:
  - "Browser automation is a fallback only after static extraction leaves visitor or owner benefits unresolved."
  - "Rendered browser text must feed back through the same explicit-only extraction helper instead of creating a second ruleset."
  - "Auth-gated or non-HTML targets remain out of scope for this fallback path."
patterns-established:
  - "Referral browser capture writes runner artifacts under the public-rich-sync output tree without changing the public enrichment contract."
requirements-completed:
  - ENR-01
  - ENR-02
duration: not-tracked
completed: 2026-03-31
---

# Phase 23 Plan 02 Summary

**JS-heavy public referral pages now have a generic browser fallback**

## Accomplishments

- Added `capturePublicReferralTextFromBrowser()` in `scripts/enrichment/public-browser.ts` to collect rendered public referral text, title, current URL, and high-signal candidate strings from a generic browser session.
- Wired `scripts/enrich-rich-links.ts` so browser capture only runs for HTML-like public referral strategies after static extraction leaves visitor or owner benefits unresolved.
- Fed browser-captured text back through the same explicit-only extraction rules from Phase 23-01, which keeps behavior consistent across static and fallback paths.

## Decisions Made

- Browser fallback stays public-only and skips auth-gated content instead of drifting into authenticated extractor territory.
- HTML strategies are eligible; XML/oEmbed-only referral strategies are not.
- The fallback only merges `visitorBenefit` and `ownerBenefit` back into generated referral output, leaving the rest of the generated payload untouched.

## Deviations from Plan

- Instead of broadening `scripts/public-rich-sync.test.ts`, the fallback gained a dedicated focused regression file in `scripts/enrichment/public-browser.test.ts`. This kept the new browser-specific assertions small and deterministic.

## Verification

- `bun test scripts/enrichment/public-augmentation.test.ts scripts/enrichment/public-browser.test.ts`
- `bun run typecheck`

---
*Phase: 23-automatic-referral-benefit-extraction*
*Completed: 2026-03-31*
