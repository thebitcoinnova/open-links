# Phase 21: Maintainer CRUD Guidance + Docs + Verification - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Keep referral authoring easy through the recommended AI CRUD/manual paths and document the new contract, limits, and downstream impact accurately. This phase is about maintainer-facing guidance, verification messaging, README/docs discovery, and downstream compatibility notes; it does not add first-class Studio referral controls, new extraction behavior, or new runtime/product features.

</domain>

<decisions>
## Implementation Decisions

### Maintainer path hierarchy
- Repo-native AI CRUD is the primary maintainer path for referral authoring and day-2 updates.
- OpenClaw/update-contract and the AI-guided customization docs should be the main recommended flow rather than being presented as just one option among equals.
- Studio remains the browser-based CRUD path when it fits the workflow, but referral authoring there should currently be described honestly as relying on Advanced JSON rather than first-class referral controls.
- Direct JSON edits should be documented as the manual fallback / advanced-user escape hatch, not the default recommendation.
- README and quickstart should surface referral support and point maintainers toward the deeper CRUD/docs pages rather than hiding referral docs only in lower-level references.

### Referral docs depth
- The full canonical `links[].referral` contract should live in one primary reference location: `docs/data-model.md`.
- Phase 21 should use a small curated example set rather than a giant matrix.
- The preferred example set:
  - a minimal referral marker example,
  - a richer full disclosure example with both sides plus `termsUrl`,
  - a one-sided or supported-family example that uses `enrichment.profileSemantics: "non_profile"`.
- Manual-vs-generated precedence should be documented in two layers:
  - a short rule near the top (`manual wins, generated fills blanks`),
  - a deeper but still concise explanation that covers field-level behavior, provenance, and warnings.
- Generated referral fields such as completeness/provenance should be documented lightly in main authoring docs so maintainers know what they are seeing, with fuller detail deferred to verification/debug-oriented docs.

### Verification and limits messaging
- Phase 21 should recommend script-backed verification, not just prose advice.
- The docs should say plainly that public extraction is assistive, incomplete, and not the authoritative legal/commercial source of truth.
- Maintainers should be warned about the main referral warning classes they are likely to hit:
  - thin/soft referral disclosure warnings,
  - manual/generated drift warnings,
  - supported-profile `non_profile` nudges,
  - partial extraction and stale-cache warnings where relevant.
- Main authoring docs should contain a short “after adding a referral link, check these things” checklist.
- Deeper verification material should explain commands, report meanings, and warning interpretation in more detail.

### Downstream compatibility guidance
- `links[].referral` should be framed as an additive schema change that still deserves downstream review on sync.
- Downstream compatibility should not live only in the dedicated downstream doc; it should be breadcrumbed where maintainers are likely to read:
  - `README.md`
  - `docs/data-model.md`
  - referral authoring docs / CRUD guidance
  - `docs/downstream-open-links-sites.md`
- The docs should explicitly distinguish renderer/UI-only referral changes from shared contract/schema changes so downstream maintainers know when a change is materially relevant.
- Phase 21 should include lightweight concrete downstream guidance:
  - when bumping the upstream pin, review the referral contract/docs notes first,
  - if downstream mirrors upstream schemas/data-model assumptions, verify the additive `links[].referral` shape is acceptable,
  - later UI-only referral changes are lower-risk than schema/policy/script changes.

### Claude's Discretion
- Planning can choose the exact doc split between README, quickstart, data-model, OpenClaw CRUD docs, and verification sections as long as the primary path hierarchy and canonical contract location remain clear.
- Planning can decide the exact verification commands/checklist wording as long as the path remains script-backed and the “assistive, not authoritative” position stays explicit.

</decisions>

<specifics>
## Specific Ideas

- The referral feature should be discoverable from top-level maintainer entry points, not only from deep data-model docs.
- README/quickstart should answer “Can I do referral links here?” quickly and route to the right maintainer workflow.
- `docs/data-model.md` should stay the canonical place to understand the actual referral contract and examples.
- Verification guidance should help maintainers interpret warnings before they hit them blindly during `validate:data` or enrichment runs.
- Downstream breadcrumbs should reduce the chance that maintainers miss when a referral change is just UI polish versus shared contract surface.

</specifics>

<deferred>
## Deferred Ideas

- First-class Studio referral forms and richer Studio referral previews remain deferred to a later phase or milestone.
- New extractor capabilities, authenticated referral flows, or stronger compliance workflows are out of scope for this phase.
- Broader downstream automation/process changes beyond lightweight compatibility guidance are deferred.

</deferred>

---

*Phase: 21-maintainer-crud-guidance-docs-verification*
*Context gathered: 2026-03-30*
