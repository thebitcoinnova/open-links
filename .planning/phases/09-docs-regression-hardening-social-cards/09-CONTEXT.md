# Phase 9: Docs + Regression Hardening for Social Cards - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

## Phase Boundary

Document the expanded social-profile metadata and card system, then harden regression and verification guidance around the current runtime behavior. This phase covers maintainer-facing docs, examples, and verification framing for the already-built profile-description, rich-card media-row, follower-history analytics, and card-share surfaces. It does not add new product capabilities.

## Implementation Decisions

### Docs Focus

- Phase 9 should update all relevant documentation surfaces, not just one file.
- The follower-history and card-share work should appear as a clear subsection within the broader social-card documentation story.
- The docs set should serve both maintainer-facing usage guidance and system-behavior explanation, with each document tailored to its purpose.
- Prefer canonical deep-dive docs with lighter cross-links elsewhere instead of repeating full explanations across every doc.

### Example Strategy

- Examples should cover all key states introduced across the milestone:
  - profile cards with counts
  - `profileDescription` overrides
  - analytics/share action rows
  - no-history / fallback cards
- It is acceptable to show raw public artifact examples such as `history/followers/index.json` and one representative CSV.
- Use the current seeded links/platforms from the repo rather than abstract placeholder examples.
- Lead with minimal starter examples first, then expand into richer examples afterward.

### Verification Surface

- Phase 9 should explicitly document manual verification for all major user-visible states:
  - desktop and mobile layout
  - profile-level share
  - card-level share
  - analytics page controls
  - card modal behavior
  - no-history cards
- The docs should include both:
  - a short maintainer checklist
  - a more narrative verification guide
- When automated tests already cover a behavior, the docs should mention that coverage instead of treating manual verification as isolated.
- Verification guidance should include the public artifact layer as well as UI checks, including `history/followers/index.json` and at least one CSV.

### Regression Priorities

- Do not artificially prioritize one regression class over another in Phase 9; treat the major states as roughly equal in importance.
- Regression coverage should favor generic state coverage before seeded-link-specific behavior, while still using seeded links as examples where helpful.
- For the analytics/share area, preserve both:
  - action order
  - behavior/fallback semantics
- Treat documentation drift as a real regression class. If docs/examples no longer match runtime behavior, that should be considered a bug to fix within this phase.

### Claude's Discretion

- Decide which docs become the canonical deep dives versus lighter cross-linked summaries.
- Decide the exact split between automated-verification notes and manual-verification narrative, as long as both are present.
- Choose the most readable ordering of examples across minimal starter flows and richer follow-up examples.

## Specific Ideas

- The current seeded links are acceptable as concrete examples for profile cards, analytics/share action rows, and public follower-history artifacts.
- The follower-history and share-button work should not be buried as incidental notes; they should appear as a clearly named subsection in the broader social-card docs pass.
- Minimal starter examples should stay copy-pasteable and not force maintainers to understand the full advanced data model before getting value.

## Deferred Ideas

None. Discussion stayed within the Phase 9 boundary.

---

*Phase: 09-docs-regression-hardening-social-cards*
*Context gathered: 2026-03-10*
