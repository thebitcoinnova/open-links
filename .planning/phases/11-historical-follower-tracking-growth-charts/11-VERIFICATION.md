---
phase: 11-historical-follower-tracking-growth-charts
verified: 2026-03-10T02:30:00Z
status: passed
score: 16/16 must-haves verified
---

# Phase 11: Historical Follower Tracking + Growth Charts Verification Report

**Phase Goal:** Persist nightly follower snapshots into publicly accessible append-only per-platform CSV histories, then add an app surface for cross-platform follower-growth charts with a SolidJS-friendly charting choice.  
**Verified:** 2026-03-10T02:30:00Z  
**Status:** passed

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Nightly follower-count collection appends to platform-specific CSV histories without forcing a shared all-platform column layout. | ✓ VERIFIED | `scripts/follower-history/append-history.ts`, `scripts/sync-follower-history.ts`, `public/history/followers/*.csv`, and `public/history/followers/index.json` now define and exercise one append-only CSV per platform. |
| 2 | GitHub Actions can publish updated follower-history CSVs directly to `main`, and the generated CSV assets remain publicly accessible for the site and external consumers. | ✓ VERIFIED | `.github/workflows/nightly-follower-history.yml` commits refreshed history files to `main`, and the public artifacts live under `public/history/followers/`. |
| 3 | The app exposes a follower-growth view that charts every tracked platform count over time, with the SolidJS charting choice researched and implemented. | ✓ VERIFIED | `src/routes/index.tsx`, `src/components/analytics/FollowerHistoryChart.tsx`, `src/components/analytics/FollowerHistoryModal.tsx`, and the Phase 11 research file show the implemented ECharts-backed analytics surface. |

**Score:** 3/3 roadmap truths verified

### Plan Must-Haves

| Plan | Must-Have Summary | Status | Evidence |
|------|-------------------|--------|----------|
| 11-01 | Public history lives in static per-platform CSV artifacts. | ✓ VERIFIED | `public/history/followers/*.csv` and `src/lib/analytics/follower-history.ts`. |
| 11-01 | History rows stay append-only and preserve observed decreases/unchanged counts. | ✓ VERIFIED | `scripts/follower-history/append-history.ts`, `scripts/follower-history/append-history.test.ts`, and repeated `followers:history:sync` runs. |
| 11-01 | Shared runtime parsing uses the same row contract as the snapshot writer. | ✓ VERIFIED | `src/lib/analytics/follower-history.ts` powers both parsing and chart transforms, and the writer imports that contract. |
| 11-01 | `validate:data` catches malformed history artifacts or index drift. | ✓ VERIFIED | `scripts/validate-data.ts` and `scripts/validate-data.test.ts`. |
| 11-02 | One stable local sync command reproduces the nightly history refresh. | ✓ VERIFIED | `package.json` exposes `bun run followers:history:sync`. |
| 11-02 | The nightly workflow does not rely on suppressed `GITHUB_TOKEN` workflow fan-out. | ✓ VERIFIED | `.github/workflows/nightly-follower-history.yml` commits and deploys in the same run. |
| 11-02 | Initial CSV/index artifacts are checked in under the public history root. | ✓ VERIFIED | `public/history/followers/index.json` plus seven committed CSV files. |
| 11-02 | Maintainer docs explain the workflow and local parity path. | ✓ VERIFIED | `README.md` now documents the workflow, artifact locations, and local commands. |
| 11-03 | The profile header has a dedicated analytics button left of `Share`. | ✓ VERIFIED | `src/components/profile/ProfileHeader.tsx` and `src/components/profile/ProfileHeader.test.tsx`. |
| 11-03 | The full analytics surface defaults to a 30-day minimal view with switchable ranges. | ✓ VERIFIED | `src/routes/index.tsx` and the analytics page controls. |
| 11-03 | Cards with history data expose a platform analytics icon and modal while cards without history remain unchanged. | ✓ VERIFIED | `src/components/cards/NonPaymentLinkCardShell.tsx`, `src/components/analytics/FollowerHistoryModal.tsx`, and `src/components/cards/non-payment-card-accessibility.test.tsx`. |
| 11-03 | Single-platform views can toggle between raw counts and growth rate. | ✓ VERIFIED | `src/components/analytics/FollowerHistoryModal.tsx` and `src/components/analytics/FollowerHistoryChart.tsx`. |
| 11-03 | The chart bundle stays off the default route path through lazy loading. | ✓ VERIFIED | `src/routes/index.tsx` lazy-loads both analytics components, and the build output shows separate analytics chunks from the main route bundle. |

**Score:** 13/13 plan must-have groups verified

### Required Artifact Checks

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/analytics/follower-history.ts` | Shared history contract, parsing, filtering, and transforms | ✓ EXISTS + SUBSTANTIVE | Powers both the writer and runtime analytics. |
| `scripts/sync-follower-history.ts` | Deterministic snapshot command | ✓ EXISTS + SUBSTANTIVE | Reads current metadata sources and appends public history rows. |
| `scripts/validate-data.ts` | History artifact validation | ✓ EXISTS + SUBSTANTIVE | Enforces public history index/file parity and row correctness. |
| `public/history/followers/index.json` | Public history manifest | ✓ EXISTS + SUBSTANTIVE | Lists the current published follower-history datasets. |
| `.github/workflows/nightly-follower-history.yml` | Same-run capture/commit/deploy automation | ✓ EXISTS + SUBSTANTIVE | Handles nightly publication without downstream workflow fan-out assumptions. |
| `src/components/analytics/FollowerHistoryChart.tsx` | Chart primitive for raw/growth views | ✓ EXISTS + SUBSTANTIVE | Lazy-loadable ECharts wrapper. |
| `src/components/analytics/FollowerHistoryModal.tsx` | Platform drill-down modal | ✓ EXISTS + SUBSTANTIVE | Reuses the shared chart primitive and range/mode controls. |
| `src/routes/index.tsx` | Analytics page and modal orchestration | ✓ EXISTS + SUBSTANTIVE | Fetches published history and exposes both analytics entry points. |
| `README.md` | Maintainer-facing workflow and command docs | ✓ EXISTS + SUBSTANTIVE | Documents workflow name, artifact paths, and local parity commands. |

**Artifacts:** 9/9 verified

## Requirements Coverage

Phase 11 did not receive formal requirement IDs during planning; the roadmap explicitly marked requirements as TBD. Verification therefore used roadmap truths and plan must-haves instead of a requirement-ID table.

## Automated Verification Runs

- `bun test src/lib/analytics/follower-history.test.ts scripts/follower-history/append-history.test.ts scripts/validate-data.test.ts src/components/cards/non-payment-card-accessibility.test.tsx src/components/profile/ProfileHeader.test.tsx` -> passed
- `bun run followers:history:sync` -> passed
- `bun run typecheck` -> passed
- `bun run biome:check` -> passed
- `bun run validate:data` -> passed
- `bun run build` -> passed

## Anti-Patterns Found

None.

## Human Verification Required

None.

## Gaps Summary

**No gaps found.** Phase 11 goal achieved. Phase 9 remains the next incomplete milestone step for docs and regression hardening.

## Verification Metadata

**Verification approach:** roadmap truths + plan must-haves + artifact checks + build/test evidence  
**Automated checks:** 6 passed, 0 failed  
**Human checks required:** 0  
**Total verification time:** 1 execution session

---
*Verified: 2026-03-10T02:30:00Z*
*Verifier: Codex (orchestrated execution)*
