# Phase 6: Docs + Extensibility Surface - Research

**Researched:** 2026-02-23
**Domain:** onboarding docs architecture, data-model documentation, theming/layout extension guidance, deployment/troubleshooting and adapter strategy docs
**Confidence:** HIGH

## User Constraints (from CONTEXT.md)

### Locked Decisions
- README should be quickstart-first and optimized for fastest path to first local run + first deploy.
- README must surface an AI-guided wizard path prominently (without replacing manual docs).
- Documentation should serve both developers and AI-agent-assisted maintainers.
- Data-model docs should be split into overview + deep dive and include:
  - simple and rich examples,
  - annotated snippets,
  - copy-paste presets.
- Validation guidance should include common errors, interpretation help, and remediation steps.
- Extension metadata guidance must clearly define safe `custom` usage, collisions, and naming conventions.
- Theming docs should cover full depth:
  - token-only edits,
  - scoped CSS overrides,
  - advanced theme creation.
- Layout customization guidance should include an explicit "add layout mode" recipe.
- Extensibility docs should include guardrails, anti-patterns, and maintainability checklists.
- Deployment docs should include:
  - checklist,
  - symptom -> fix table,
  - local/CI diagnostics flow.
- Deployment guidance should be split into:
  - README quick path,
  - `docs/deployment.md`,
  - `docs/adapter-contract.md`.
- Future host-adapter guidance should stay conceptual (no runtime implementation in this phase).
- Include high-level adventurous-host instructions (for example S3/static hosts) with explicit caveats.
- Include provisional custom-domain guidance with caveats.

### Claude's Discretion
- Final filename for the AI-guided wizard markdown doc.
- Exact section ordering and presentation style.
- Specific non-primary hosts highlighted, provided support boundaries are clear.

## Summary

Phase 6 should produce a docs system where README is the entrypoint and deeper docs are discoverable, practical, and tied directly to the current codebase. The strongest implementation pattern for this repo is:

1. Keep README compact and action-first.
2. Move full explanations into focused docs under `docs/`.
3. Use explicit path/command references so contributors can customize without source-diving.
4. Keep deployment portability guidance high-level and clearly labeled as "advanced / non-primary."

## Recommended Documentation Architecture

### 1) README as fast-path index (required)

README should provide:
- fork/template bootstrap steps,
- local run + validation commands,
- first GitHub Pages publish path,
- common first-run troubleshooting pointers,
- a docs map with links to deep dives,
- a prominent link to the AI-guided wizard flow.

### 2) Dedicated docs deep dives

Create docs files focused by concern:
- `docs/quickstart.md`: expanded bootstrap and first deploy details.
- `docs/data-model.md`: profile/links/site model, simple + rich examples, validation remediation.
- `docs/theming-and-layouts.md`: token/CSS/theme/layout extension recipes and guardrails.
- `docs/deployment.md`: Pages flow, diagnostics, troubleshooting, and advanced-host caveats.
- `docs/adapter-contract.md`: conceptual adapter expectations and static artifact contract.
- `docs/ai-guided-customization.md`: guided AI-maintainer workflow with opt-out choices.

This split aligns directly with Phase 6 success criteria and keeps doc maintenance local to each domain.

## Documentation Patterns to Reuse from Existing Repo

### Pattern 1: Command parity with package scripts

Docs should only reference real commands already defined in `package.json`:
- `npm run dev`
- `npm run validate:data`
- `npm run validate:data:strict`
- `npm run build`
- `npm run build:strict`
- `npm run quality:check`

### Pattern 2: Source-aligned references

When documenting customization, reference concrete files already present:
- data model: `data/profile.json`, `data/links.json`, `data/site.json`, `schema/*.schema.json`
- theming: `src/styles/tokens.css`, `src/styles/themes/*.css`, `src/lib/theme/theme-registry.ts`
- layout/composition: `src/lib/ui/layout-preferences.ts`, `src/lib/ui/composition.ts`, `src/components/layout/LinkSection.tsx`
- deployment: `.github/workflows/ci.yml`, `.github/workflows/deploy-pages.yml`, `vite.config.ts`

### Pattern 3: Remediation-first troubleshooting

Troubleshooting tables should be symptom -> probable cause -> exact fix command/path. This is consistent with prior phase diagnostics style.

## Common Pitfalls and Mitigations

### Pitfall 1: README overload
**What goes wrong:** README becomes long and hard to scan.
**How to avoid:** Keep README as concise quickstart + docs map; move deep details to `docs/`.

### Pitfall 2: Docs drift from code paths
**What goes wrong:** Guidance references stale filenames or old commands.
**How to avoid:** Tie each deep-dive section to current file paths and script names from repo.

### Pitfall 3: Overpromising non-primary hosts
**What goes wrong:** Users treat advanced host notes as fully supported adapters.
**How to avoid:** Mark advanced-host guidance as high-level and unsupported-by-default in v1.

### Pitfall 4: "AI wizard" not discoverable
**What goes wrong:** AI-assisted flow exists but users cannot find it.
**How to avoid:** Place AI wizard link near README quickstart and docs index.

## Open Questions

1. Exact title naming for the AI wizard doc (functionally unconstrained; only discoverability matters).
2. Degree of custom-domain detail (decision already narrowed to provisional guidance with caveats).

## Sources

### Primary (HIGH confidence)
- `.planning/phases/06-docs-extensibility-surface/06-CONTEXT.md`
- `.planning/ROADMAP.md` (Phase 6 requirements and success criteria)
- `.planning/REQUIREMENTS.md` (BOOT-03, THEME-03, THEME-04, DEP-05, DOC-01..DOC-04)
- Existing implementation surfaces:
  - `README.md`
  - `package.json`
  - `data/*.json`
  - `schema/*.schema.json`
  - `src/styles/**`
  - `src/lib/theme/**`
  - `src/lib/ui/**`
  - `.github/workflows/ci.yml`
  - `.github/workflows/deploy-pages.yml`
  - `vite.config.ts`

## Metadata

**Research scope:** documentation information architecture and extension/deployment guidance strategy

**Confidence breakdown:**
- Requirements alignment: HIGH
- Codepath-to-doc mapping: HIGH
- Deployment portability framing: HIGH
- Advanced-host instructions detail level: MEDIUM-HIGH

**Research date:** 2026-02-23
**Valid until:** 2026-03-30

---

*Phase: 06-docs-extensibility-surface*
*Research completed: 2026-02-23*
*Ready for planning: yes*
