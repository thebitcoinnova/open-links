# Phase 6: Docs + Extensibility Surface - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

## Phase Boundary

Finalize onboarding and extension documentation so developers (and AI-assisted workflows) can customize and publish OpenLinks without source-diving. This phase documents bootstrap, data model usage, theming/layout extension points, deployment troubleshooting, and future adapter guidance; it does not implement new runtime capabilities.

## Implementation Decisions

### Onboarding Flow Depth
- Use a quickstart-first onboarding flow in README for fastest path to first successful local run and deploy.
- Include happy-path plus common deploy misconfiguration checks in onboarding flow.
- Treat audience as hybrid: general developers plus AI-agent-assisted maintainers.
- Start onboarding with one canonical starter example.
- Add a dedicated markdown file that acts as an AI agent wizard/skill to guide user updates with opt-out choices and links to deeper docs.
- Surface the AI-guided wizard option prominently in README.

### Data Model Documentation Shape
- Structure docs as README overview plus a deep-dive document at `docs/data-model.md`.
- Include simple and rich link documentation with:
  - inline snippets,
  - annotated full examples,
  - copy-paste starter presets.
- Validation troubleshooting should include common errors plus command output interpretation.
- Extension namespace docs (`custom`) should include:
  - dos/don’ts,
  - collision examples,
  - naming conventions/template keys.

### Theming and Layout Extensibility Docs
- Document full customization progression:
  - token-only edits,
  - scoped custom CSS overrides,
  - advanced new-theme pattern.
- Include explicit “add a new layout mode” extension recipe.
- Include strong maintainability guardrails:
  - recommended checklist,
  - anti-patterns,
  - migration notes.
- Present extension guidance as:
  - extension-point tables (file, purpose, risk),
  - decision-tree mapping (“if you want X, change Y”).

### Deployment and Adapter Guidance
- Deployment docs should include:
  - checklist,
  - symptom->fix table,
  - local/CI diagnostic command flow.
- Split deployment docs into:
  - README quick path,
  - `docs/deployment.md`,
  - `docs/adapter-contract.md`.
- Keep future host-adapter guidance high-level/conceptual (no formal implementation contract details in this phase).
- Include provisional custom-domain guidance with caveats.
- Add high-level instructions for adventurous static hosting beyond GitHub Pages (for example S3 and other top static hosts), clearly marked as non-primary/non-guaranteed support.

### Claude's Discretion
- Exact file naming for the AI wizard markdown doc, as long as README links to it prominently.
- Exact doc section ordering and formatting style (tables vs lists) where decision content remains intact.
- Exact set of “top hosting platforms” to highlight, provided they remain high-level and caveated.

## Specific Ideas

- AI-guided repo customization should be discoverable from README without replacing direct manual editing docs.
- Deep-dive docs should reduce source-diving by mapping “what to change” to concrete files/fields.
- Deployment troubleshooting should stay practical and command-oriented.

## Deferred Ideas

- First-class non-GitHub deployment adapter implementation remains out of scope (documentation only in this phase).

---

*Phase: 06-docs-extensibility-surface*
*Context gathered: 2026-02-23*
