# Lessons

## 2026-03-06

- What went wrong: I treated `@pryszkie` inside the Primal page's Open Graph description as the Primal account handle, even though the text referred to a different app profile.
- Preventive rule: Do not infer a platform-specific handle from freeform metadata text unless the text explicitly identifies that same platform or the handle appears in a platform-native field or URL shape.
- Trigger signal to catch it earlier: Metadata contains mixed-product language like "On the Orange Pill App @..." while the page URL belongs to `primal.net`.
