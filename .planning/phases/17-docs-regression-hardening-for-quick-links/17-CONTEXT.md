# Phase 17: Docs + Regression Hardening for Quick Links - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

## Phase Boundary

Document the new Quick Links behavior for maintainers and lock in a light-but-sufficient regression and verification surface so the feature remains stable after the milestone. This phase covers documentation and regression hardening only, not new Quick Links capabilities or new configuration surfaces.

## Implementation Decisions

### Documentation surfaces

- The clearest Quick Links behavior explanation should live in `docs/data-model.md` because the feature is derived from existing `links[]` data.
- `docs/customization-catalog.md` should also explain the surface because maintainers look there for available UI/customization behaviors.
- Add one lightweight discovery note in a higher-level maintainer-facing entry point such as `README.md` or `docs/quickstart.md`, but keep it brief rather than duplicating the full explanation.
- Do not expand Studio/self-serve docs in this phase unless the current Quick Links behavior is already surfaced there.

### Documentation framing

- Document Quick Links as automatic behavior derived from existing top-level social/profile links.
- Explain that Quick Links are intentionally constrained by default.
- State clearly that Quick Links do not use a separate manual registry.
- Note that deeper configurability is deferred for future work rather than implying controls that do not yet exist.

### Regression scope

- Keep the regression surface intentionally light and high-signal.
- The minimum regression coverage should protect:
  - Quick Links render when eligible links exist
  - Quick Links disappear when no eligible links exist
  - Quick Links preserve explicit outbound labels and titles
  - Quick Links stay above the action bar without breaking the action row
- Do not expand this phase into heavy visual snapshots or a large responsive matrix unless an obvious gap is discovered during execution.

### Downstream and maintainer guidance

- Be somewhat explicit that Quick Links are a renderer-level feature only.
- State that this phase does not change the `open-links-sites` data/schema contract.
- State that maintainers do not need a second workflow beyond existing `links[]` authoring.

### Claude's Discretion

- Choose the exact higher-level discovery surface (`README.md` vs `docs/quickstart.md`) based on where the existing maintainer guidance reads most naturally.
- Choose the exact wording and placement of the renderer-only/downstream note as long as it is clear and brief.
- Tighten or refresh a small number of existing tests if execution discovers an obvious coverage gap while staying within the intentionally light regression scope.

## Specific Ideas

- The docs should present Quick Links as “derived from your existing top-level social/profile links” rather than as a configurable widget.
- The regression hardening should act as a guardrail for the visible-strip contract from Phase 16, not as a second full verification phase.
- The downstream note should be short, direct, and framed around “no contract change” rather than sounding alarming.

## Deferred Ideas

- New Quick Links configuration surfaces or author controls.
- Studio-specific Quick Links controls or documentation beyond what is already true in the shipped UI.
- Comprehensive visual snapshot coverage or broad responsive test matrices.

---

*Phase: 17-docs-regression-hardening-for-quick-links*
*Context gathered: 2026-03-28*
