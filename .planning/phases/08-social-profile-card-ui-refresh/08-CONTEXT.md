# Phase 8: Social Profile Card UI Refresh - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

## Phase Boundary

Rebuild simple and rich card presentation around profile identity cues while preserving existing content and source context. This phase uses the `socialProfile` data added in Phase 7 to change the visible card UI; broader layout modes like a configurable grid or unrelated new browsing modes are outside this phase.

## Implementation Decisions

### Rich Card Header
- Rich cards should use a profile-style top row with a circular avatar on the left and a text stack on the right.
- The design should prioritize mobile-first visual parity with how the underlying social platforms present profile identity.
- The exact text stack may vary by platform if needed; the UI should stay flexible enough for platform-specific header differences later.
- After the profile header, rich cards should continue with description or content first, then source branding, logo, and link context after it.

### Simple Card Density
- Simple cards should keep the current leading-visual slot, but use a circular avatar there when profile metadata exists.
- A two-line header block is acceptable when handle and audience stats are present.
- On mobile, prefer natural wrapping and extra lines over dropping handle, stats, or source context.
- Simple cards without profile metadata can still pick up some of the new profile-card visual language, but should stay compact and scannable.

### Metric Presentation
- Labels should remain platform-native when possible, such as `followers`, `following`, and `subscribers`.
- Counts should use compact formatting for large values.
- Metric order should follow the platform's native order rather than a project-wide fixed order.
- Metrics should default to inline text-style presentation rather than badge-heavy chips, unless a specific platform strongly suggests otherwise.

### Fallback States
- Partial profile metadata should still use the profile-style layout rather than falling back to the old generic card structure.
- Links with no profile metadata should only inherit subtle pieces of the new visual language rather than fully mimicking profile cards.
- When both a profile image and a preview image exist on a rich card, the circular profile image should be treated as the primary identity image in the header, and the preview image can still appear below in the existing round-rect media style.
- When a preview image exists but no profile avatar exists, rich cards may continue showing the preview image while omitting the avatar.
- The overall card list should feel unified for now, while keeping room to differentiate social-profile cards more aggressively in a later phase if desired.

### Claude's Discretion
- Exact per-platform header copy and text hierarchy, as long as the result stays mobile-first and feels close to native platform profile presentation.
- Exact wrapping behavior, spacing, and typography needed to make two-line simple-card headers and inline metrics feel intentional.
- Exact styling details that carry the new profile-card language into fallback cards without making non-profile links feel forced.

## Specific Ideas

- "We should prioritize mobile look and feel parity with the platforms themselves."
- Rich cards should feel like real social profiles rather than generic link previews.
- If both avatar and preview imagery exist, use both: circular avatar in the header and round-rect preview media below it.
- Inline metric text is a better default than chips because it more closely matches how most platforms display profile counts.

## Deferred Ideas

- A configurable or toggleable grid of cards instead of a flat list.
- Stronger visual differentiation between social-profile cards and non-profile cards beyond the unified treatment chosen for Phase 8.
- Deeper platform-specific template branching if future platforms require more than flexible text-stack variations.

---

*Phase: 08-social-profile-card-ui-refresh*
*Context gathered: 2026-03-07*
