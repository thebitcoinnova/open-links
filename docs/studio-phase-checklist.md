# Studio Phase Checklist

This checklist is the delivery tracker for OpenLinks Studio.

Use this file as the source of truth for implementation status, priorities, and next actions.

## Update Rules

1. Update this checklist in every Studio-related PR.
2. Move an item to `done` only after implementation + verification commands pass.
3. Add new scope under the relevant phase with a priority tag (`P0`, `P1`, `P2`, `P3`).
4. If work is blocked, keep the item unchecked and append `BLOCKED: <reason>`.

## Status Key

- `[ ]` not started
- `[/]` in progress
- `[x]` done

## Current Priorities

- `P0` End-to-end production path: auth + fork provisioning + save + sync + deploy visibility.
- `P0` Railway production readiness and secret wiring.
- `P1` Security hardening (captcha, webhook raw body verification, stronger token/session controls).
- `P1` Test coverage (API integration + UI flows).

## Phase 1: Scaffold and Platform Foundation

- [x] `P0` Monorepo `packages/` structure (`studio-web`, `studio-api`, `studio-worker`, `studio-shared`)
- [x] `P0` Workspace scripts and package wiring
- [x] `P0` Database schema and migration runner
- [x] `P1` Dockerfiles and local compose for Studio services
- [x] `P1` Bun-first package/runtime setup
- [x] `P1` Studio Docker dependency-drift guardrails (workspace manifest parity in Dockerfiles + pre-commit lockfile sync gate + path-scoped CI Docker build checks)

## Phase 2: GitHub Auth and Session Management

- [x] `P0` GitHub OAuth start + callback endpoints
- [x] `P0` Session cookie lifecycle and session persistence
- [x] `P0` Encrypted token storage in DB
- [/] `P1` Token refresh resilience edge cases and retries
- [/] `P1` GitHub App installation verification hardening

## Phase 3: Onboarding Flow

- [x] `P0` Guided onboarding UI (account guidance, connect GitHub, install app, provision fork)
- [x] `P0` Onboarding status endpoint and blockers
- [/] `P1` Publish verification UX (deep diagnostics and troubleshooting guidance)
- [ ] `P2` Onboarding analytics funnel and drop-off instrumentation

## Phase 4: CRUD Editor

- [x] `P0` Guided forms for `profile`, `links`, and `site`
- [x] `P0` Advanced JSON mode
- [x] `P0` Dirty-state indicator and validation flow
- [/] `P1` Richer field coverage for advanced `site.ui` options
- [/] `P1` Guided `links[].metadata.profileDescription` editing for supported social profile links
- [ ] `P2` Undo/redo and change history in UI

## Phase 5: Save, Validation, Deploy Visibility

- [x] `P0` Validate endpoint wired to schemas
- [x] `P0` Direct commit pipeline for core data files
- [x] `P0` Deploy status polling endpoint and UI panel
- [x] `P1` Operation log endpoint + basic UI list
- [ ] `P1` Better commit conflict remediation UX

## Phase 6: Upstream Sync Worker

- [x] `P0` Internal sync endpoint and worker trigger
- [x] `P0` Conflict handling state (`sync_conflict` + disable auto-sync)
- [/] `P1` Scheduled execution on Railway with observability and alerting
- [ ] `P2` Manual conflict resolution helper workflow

## Phase 7: Security, Quality, Launch Readiness

- [x] `P0` CAPTCHA/anti-abuse on public onboarding entry points
- [x] `P0` Webhook raw-body verification hardening
- [x] `P0` End-to-end integration tests for auth/provision/save/sync
- [x] `P0` Production env placeholder fail-fast preflight for Studio build targets (`web`/`api`/`worker`)
- [x] `P1` Accessibility remediation for onboarding/editor interaction semantics and live status messaging
- [ ] `P1` Security review checklist and runbook completion
- [ ] `P1` Launch checklist and production incident playbook

## Backlog and Future Ideas

- [ ] `P2` PR-based save mode option (in addition to direct-to-main)
- [ ] `P2` Template-mode fallback provisioning
- [ ] `P2` User-selectable sync policy and intervals
- [ ] `P3` Multi-repo management dashboard
- [ ] `P3` Collaboration and role-based access controls
