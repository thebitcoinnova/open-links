# Phase 15: Quick Links Foundation - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

## Phase Boundary

Derive the Quick Links foundation from existing top-level links: define which links are eligible, how they are ordered, how same-platform ties are resolved, and when the header-facing quick-links set should be empty. This phase covers derivation and foundation behavior only, not the final visual fit/count decisions or new end-user configuration surfaces.

## Implementation Decisions

### Platform eligibility

- Quick Links should only consider the social/profile-style platforms that OpenLinks already treats as profile destinations.
- Eligibility should include both the biggest mainstream social platforms and the current OpenLinks-supported profile-style platforms.
- Do not treat the entire known-site/icon registry as eligible by default.

### Ordering policy

- Default ordering should be platform priority first, then existing `links[]` content order.
- Initial default priority list:
  - X
  - YouTube
  - Instagram
  - LinkedIn
  - GitHub
  - Facebook
  - Medium
  - Substack
  - Primal
  - Club Orange
- Any remaining eligible profile-style platforms should follow in existing content order.

### Duplicate and tie handling

- Only one Quick Link winner is allowed per platform.
- Phase 15 should support a same-platform canonical marker to break ties when multiple links map to the same platform.
- The canonical marker is only for tie-breaking within a platform; it should not force inclusion outside the default eligibility rules.

### Phase split with UI work

- Phase 15 should derive the full eligible Quick Links set.
- Phase 16 should decide how many quick links fit visually in the header and how that fit behaves on screen.

### Claude's Discretion

- Exact data shape and field name for the same-platform canonical quick-link marker.
- Exact definition of the eligible-platform list as long as it stays limited to OpenLinks-supported social/profile-style destinations and honors the locked default priority order.

## Specific Ideas

- A marker like `quick-link-canonical` can identify the winning quick link when more than one link points at the same platform.
- The Quick Links strip should default to being on when eligible links exist; configuration to disable or reorder it belongs later.
- The default priority should favor the major social destinations first but still include the currently supported OpenLinks profile-style platforms.

## Deferred Ideas

- Fully configurable or overrideable Quick Links ordering.
- Per-link hide/show controls for Quick Links.
- Whole-bar disable or hide controls for the Quick Links section.
- Bootstrap and CRUD skill updates so repo skills automatically add or maintain the canonical quick-link marker.

---

*Phase: 15-quick-links-foundation*
*Context gathered: 2026-03-27*
