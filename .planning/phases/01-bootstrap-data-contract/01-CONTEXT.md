# Phase 1: Bootstrap + Data Contract - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

## Phase Boundary

Establish the template-ready repository foundation and schema-validated JSON data contract for OpenLinks. This phase covers starter project bootstrap, data shape decisions, validation behavior, extension handling, and initial starter content/layout scaffolding needed for downstream feature phases.

## Implementation Decisions

### Data Shape
- Use an extended profile model in v1: include core identity fields plus richer profile metadata blocks.
- Link objects use required baseline identity fields plus metadata-capable fields for richer rendering later.
- Support hybrid organization: flat list remains valid, optional user-defined groups are allowed, and explicit user-defined ordering is supported.
- Unknown fields may exist at top level with warnings rather than immediate hard failure.

### Validation Behavior
- Validation model is three-tiered: errors, warnings, and optional strict mode (strict mode can fail on warnings).
- Validation runs locally in prebuild flows and in CI.
- URL policy allows `http`, `https`, and selected special schemes (for example `mailto`, `tel`).
- Output must provide both human-friendly summaries and machine-readable details.
- Error and warning messages should be highly descriptive and include remediation/actionable guidance wherever possible.

### Extension Model
- Support both top-level and per-entity custom blocks (for example site-level, profile-level, and per-link custom payloads).
- Any custom key conflict with core schema keys fails validation explicitly.
- Custom fields get basic type validation (string/number/boolean/object/array), not full deep semantic validation in this phase.
- Compatibility guarantee for custom fields is best-effort, not a strict stable contract.

### Starter Experience
- Fresh forks start with a minimal profile and three starter links.
- Use split data files and include a starter examples directory for alternate/reference setups.
- README onboarding should include: edit data -> run local validate/build -> push, plus a first-publish checklist.
- Include two starter themes in configuration with one active by default.

### Claude's Discretion
- Exact JSON field naming conventions where user intent is already captured semantically.
- Exact warning/error formatting layout as long as both human and machine-readable outputs are present.
- Exact file/folder names for examples and docs as long as split-file + examples strategy is preserved.

## Specific Ideas

- Validation feedback should not only report failure, but also suggest what to change.
- Grouping should be optional and user-configurable, with ordering controlled explicitly by user data.
- Strict mode should be available for users who want higher safety in CI.

## Deferred Ideas

- None — discussion stayed within phase scope.

---

*Phase: 01-bootstrap-data-contract*
*Context gathered: 2026-02-22*
