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

## 2026-03-11

- What went wrong: I treated a resolved native Web Share promise as if it meant the user had merely opened the share sheet, but on the user's platform the same flow can end with the share-sheet Copy action, making a `Share opened` toast misleading.
- Preventive rule: When the platform share sheet does not reveal which target the user picked, do not toast a guessed post-selection outcome; only show copy-specific feedback when the app itself performed the copy or has explicit signal.
- Trigger signal to catch it earlier: A Web Share flow is followed by an OS/browser target like `Copy`, but the API surface only returns success/dismissal with no selected-target detail.

## 2026-03-11

- What went wrong: I fixed the misleading `Share opened` toast by silencing native-share success entirely, but that removed the only completion acknowledgement the user still expected from the Share flow.
- Preventive rule: When softening an ambiguous success message, preserve an explicit completion acknowledgement unless the user asked for silence; prefer changing the wording over removing the signal altogether.
- Trigger signal to catch it earlier: A user reports a misleading toast on success, but the interaction still clearly benefits from some visible “done” feedback.

## 2026-03-11

- What went wrong: I shifted the share-success wording toward copy-specific language (`link copied`) even after the user asked for more generic share feedback.
- Preventive rule: When success wording is meant to cover multiple underlying completion paths, choose user-facing copy that reflects the broader intent (`shared`) rather than the implementation detail (`copied`).
- Trigger signal to catch it earlier: The success state can happen through more than one mechanism, or the user explicitly asks for more generic wording.

## 2026-03-11

- What went wrong: I added the page-level analytics transition with `analyticsPageOpen` still defaulting to `false` and only syncing from the URL in `onMount`, which broke the refresh-into-analytics untoggle path because the first render did not honor `?analytics=all`.
- Preventive rule: When route or query params control which major view is initially active, seed the initial signal/state directly from the URL before mount instead of relying on a post-mount synchronization effect.
- Trigger signal to catch it earlier: A feature introduces animated view swapping or other stateful first-render logic while the same view can also be opened via a persisted URL query parameter.

## 2026-03-22

- What went wrong: I added a secondary teal logo silhouette behind the main OpenLinks mark in the new social preview without first checking whether the user wanted layered logo treatment or a cleaner single-mark composition.
- Preventive rule: When refreshing brand art, keep decorative duplicate marks opt-in and validate whether the user wants a cleaner primary-mark presentation before shipping layered logo motifs.
- Trigger signal to catch it earlier: The design introduces a repeated brand mark behind the hero logo or other ornamental branding that is not required for the core composition.

## 2026-03-22

- What went wrong: I centered the social-preview logo group by eye instead of matching its transform to the actual glow/ring center, which left the primary mark visibly high relative to the radar circles.
- Preventive rule: When placing a hero mark inside concentric shapes, derive the transform from the target center and scale rather than eyeballing the offset.
- Trigger signal to catch it earlier: The composition includes a logo over centered rings/glow, but the transform values do not mathematically align the mark's 50/50 local center to the background center point.

## 2026-03-22

- What went wrong: I hard-coded the social-preview eyebrow pill width and text baseline, so the `OPEN SOURCE LINKS` label could outgrow its background instead of the pill adapting to the content.
- Preventive rule: When rendering SVG pills or badges around copy, derive rect geometry and vertical text alignment from the label, font size, letter spacing, and padding instead of freezing magic dimensions.
- Trigger signal to catch it earlier: An SVG badge uses a fixed rect width and hand-tuned text coordinates even though the label is tracked uppercase text or may change over time.

## 2026-03-22

- What went wrong: I treated the first auto-width pill fix as durable even though it still sized and centered the labels from heuristic font estimates while the PNG renderer was free to use fallback fonts, so the exported social card could remain visibly misaligned.
- Preventive rule: When a design artifact is rasterized by a headless renderer, validate the final rendered output against the exact fonts and measurement engine the renderer uses before declaring the layout stable.
- Trigger signal to catch it earlier: The layout fix depends on estimated text metrics, `dominant-baseline`, or other approximations while the render pipeline does not explicitly pin the fonts or measure actual glyph bounds.
