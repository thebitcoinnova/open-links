# Lessons

## 2026-03-06

- What went wrong: I treated `@pryszkie` inside the Primal page's Open Graph description as the Primal account handle, even though the text referred to a different app profile.
- Preventive rule: Do not infer a platform-specific handle from freeform metadata text unless the text explicitly identifies that same platform or the handle appears in a platform-native field or URL shape.
- Trigger signal to catch it earlier: Metadata contains mixed-product language like "On the Orange Pill App @..." while the page URL belongs to `primal.net`.

## 2026-03-10

- What went wrong: I assumed it was harmless to include descriptive `text`/`title` fields in the shared Web Share payload, but on the user's platform the native share-sheet Copy action serialized that richer payload into a pasted string that was no longer a clean URL.
- Preventive rule: When a share action needs to support copy-paste into a browser or other URL-only targets, treat “clean URL copy” as a first-class requirement and test or design the native share payload accordingly instead of assuming richer share metadata is always safe.
- Trigger signal to catch it earlier: The feature involves the native share-sheet Copy action or the user is likely to paste the shared result directly into an address bar.

## 2026-03-10

- What went wrong: I scoped the new card-level share button to only the analytics-enabled/history-aware cards because I mirrored the Phase 11 action subset too literally.
- Preventive rule: When adding a second action beside an existing scoped action, confirm whether the new action should inherit the same availability constraint or be available more broadly before locking the implementation and tests.
- Trigger signal to catch it earlier: The user describes the new control broadly as “each card” or later reports missing share on non-history cards as a bug.

## 2026-03-10

- What went wrong: I improved the Phase 9 docs around the data model and verification surfaces, but I did not make the preferred maintainer workflow explicit enough: the recommended CRUD path is via the repo AI skills or the Studio webapp, not raw JSON editing by default.
- Preventive rule: When writing maintainer docs for editable data surfaces, state the recommended CRUD path explicitly and distinguish it from the lower-level/manual fallback path.
- Trigger signal to catch it earlier: The docs talk extensively about fields, examples, and direct file edits, but do not clearly prioritize the AI-skill and Studio workflows near the top.
