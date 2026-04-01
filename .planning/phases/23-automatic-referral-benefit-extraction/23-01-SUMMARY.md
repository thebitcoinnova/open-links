---
phase: 23-automatic-referral-benefit-extraction
plan: 01
subsystem: static-referral-benefit-extraction
tags: [referral, enrichment, static-analysis, benefits]
requires:
  - 22-01
provides:
  - explicit-only visitor benefit extraction
  - explicit-only owner benefit extraction
  - static-path regression coverage
affects: [public-referral-augmentation, generated-referral-fields]
tech-stack:
  added: []
  patterns: [explicit-only-parsing, additive-generated-fields, manual-precedence]
key-files:
  created:
    - .planning/phases/23-automatic-referral-benefit-extraction/23-01-SUMMARY.md
  modified:
    - scripts/enrichment/public-augmentation.ts
    - scripts/enrichment/public-augmentation.test.ts
key-decisions:
  - "Keep automatic benefit extraction inside the existing public referral augmentation seam instead of creating a parallel subsystem."
  - "Treat visitor and owner benefits as explicit-text-only fields and omit vague marketing copy rather than guessing."
  - "Preserve the existing manual-over-generated merge contract by generating only additive blank-fill fields."
patterns-established:
  - "Referral benefit extraction now accepts optional candidate text arrays so static and later browser paths can share one ruleset."
requirements-completed:
  - ENR-02
duration: not-tracked
completed: 2026-03-31
---

# Phase 23 Plan 01 Summary

**Static public referral parsing can now fill owner and visitor benefits conservatively**

## Accomplishments

- Extended `scripts/enrichment/public-augmentation.ts` so public referral augmentation can resolve `visitorBenefit` and `ownerBenefit` from explicit high-signal landing-page text alongside the existing `offerSummary` / `termsSummary` behavior.
- Added focused static-path coverage in `scripts/enrichment/public-augmentation.test.ts` for visitor-only, owner-only, both-side, browser-candidate reuse, auth-gated skip, and ambiguous-omission cases.
- Kept generated output additive and schema-stable: no new referral fields, no confidence scoring, and no change to manual field precedence.

## Decisions Made

- Static parsing remains the default extraction path for Phase 23.
- Ambiguous promo language is omitted instead of inferred into owner/visitor benefit fields.
- Benefit extraction stays generic and reusable rather than branching by referral program.

## Issues Encountered

- Terms heuristics initially overlapped with simple benefit copy. The extraction rules were tightened so terms parsing stays focused on actual restrictions and conditions instead of duplicating pure benefit phrases.

## Verification

- `bun test scripts/enrichment/public-augmentation.test.ts`
- `bun run typecheck`

---
*Phase: 23-automatic-referral-benefit-extraction*
*Completed: 2026-03-31*
