# Lessons

## lesson-validate-platform-native-handles | 2026-03-06

1. Date: 2026-03-06
2. What went wrong: I treated `@pryszkie` inside the Primal page's Open Graph description as the Primal account handle, even though the text referred to a different app profile.
3. Preventive rule: Do not infer a platform-specific handle from freeform metadata text unless the text explicitly identifies that same platform or the handle appears in a platform-native field or URL shape.
4. Trigger signal to catch it earlier: Metadata contains mixed-product language like "On the Orange Pill App @..." while the page URL belongs to `primal.net`.

## lesson-share-payload-preserves-clean-url-copy | 2026-03-10

1. Date: 2026-03-10
2. What went wrong: I assumed it was harmless to include descriptive `text`/`title` fields in the shared Web Share payload, but on the user's platform the native share-sheet Copy action serialized that richer payload into a pasted string that was no longer a clean URL.
3. Preventive rule: When a share action needs to support copy-paste into a browser or other URL-only targets, treat “clean URL copy” as a first-class requirement and test or design the native share payload accordingly instead of assuming richer share metadata is always safe.
4. Trigger signal to catch it earlier: The feature involves the native share-sheet Copy action or the user is likely to paste the shared result directly into an address bar.

## lesson-confirm-action-availability-scope | 2026-03-10

1. Date: 2026-03-10
2. What went wrong: I scoped the new card-level share button to only the analytics-enabled/history-aware cards because I mirrored the Phase 11 action subset too literally.
3. Preventive rule: When adding a second action beside an existing scoped action, confirm whether the new action should inherit the same availability constraint or be available more broadly before locking the implementation and tests.
4. Trigger signal to catch it earlier: The user describes the new control broadly as “each card” or later reports missing share on non-history cards as a bug.

## lesson-prioritize-repo-native-crud-workflows | 2026-03-10

1. Date: 2026-03-10
2. What went wrong: I improved the Phase 9 docs around the data model and verification surfaces, but I did not make the preferred maintainer workflow explicit enough: the recommended CRUD path is via the repo AI skills or the Studio webapp, not raw JSON editing by default.
3. Preventive rule: When writing maintainer docs for editable data surfaces, state the recommended CRUD path explicitly and distinguish it from the lower-level/manual fallback path.
4. Trigger signal to catch it earlier: The docs talk extensively about fields, examples, and direct file edits, but do not clearly prioritize the AI-skill and Studio workflows near the top.

## lesson-native-share-success-is-target-ambiguous | 2026-03-11

1. Date: 2026-03-11
2. What went wrong: I treated a resolved native Web Share promise as if it meant the user had merely opened the share sheet, but on the user's platform the same flow can end with the share-sheet Copy action, making a `Share opened` toast misleading.
3. Preventive rule: When the platform share sheet does not reveal which target the user picked, do not toast a guessed post-selection outcome; only show copy-specific feedback when the app itself performed the copy or has explicit signal.
4. Trigger signal to catch it earlier: A Web Share flow is followed by an OS/browser target like `Copy`, but the API surface only returns success/dismissal with no selected-target detail.

## lesson-preserve-share-completion-feedback | 2026-03-11

1. Date: 2026-03-11
2. What went wrong: I fixed the misleading `Share opened` toast by silencing native-share success entirely, but that removed the only completion acknowledgement the user still expected from the Share flow.
3. Preventive rule: When softening an ambiguous success message, preserve an explicit completion acknowledgement unless the user asked for silence; prefer changing the wording over removing the signal altogether.
4. Trigger signal to catch it earlier: A user reports a misleading toast on success, but the interaction still clearly benefits from some visible “done” feedback.

## lesson-use-intent-level-share-wording | 2026-03-11

1. Date: 2026-03-11
2. What went wrong: I shifted the share-success wording toward copy-specific language (`link copied`) even after the user asked for more generic share feedback.
3. Preventive rule: When success wording is meant to cover multiple underlying completion paths, choose user-facing copy that reflects the broader intent (`shared`) rather than the implementation detail (`copied`).
4. Trigger signal to catch it earlier: The success state can happen through more than one mechanism, or the user explicitly asks for more generic wording.

## lesson-seed-route-controlled-initial-state | 2026-03-11

1. Date: 2026-03-11
2. What went wrong: I added the page-level analytics transition with `analyticsPageOpen` still defaulting to `false` and only syncing from the URL in `onMount`, which broke the refresh-into-analytics untoggle path because the first render did not honor `?analytics=all`.
3. Preventive rule: When route or query params control which major view is initially active, seed the initial signal/state directly from the URL before mount instead of relying on a post-mount synchronization effect.
4. Trigger signal to catch it earlier: A feature introduces animated view swapping or other stateful first-render logic while the same view can also be opened via a persisted URL query parameter.

## lesson-duplicate-brand-marks-are-opt-in | 2026-03-22

1. Date: 2026-03-22
2. What went wrong: I added a secondary teal logo silhouette behind the main OpenLinks mark in the new social preview without first checking whether the user wanted layered logo treatment or a cleaner single-mark composition.
3. Preventive rule: When refreshing brand art, keep decorative duplicate marks opt-in and validate whether the user wants a cleaner primary-mark presentation before shipping layered logo motifs.
4. Trigger signal to catch it earlier: The design introduces a repeated brand mark behind the hero logo or other ornamental branding that is not required for the core composition.

## lesson-align-hero-mark-to-derived-center | 2026-03-22

1. Date: 2026-03-22
2. What went wrong: I centered the social-preview logo group by eye instead of matching its transform to the actual glow/ring center, which left the primary mark visibly high relative to the radar circles.
3. Preventive rule: When placing a hero mark inside concentric shapes, derive the transform from the target center and scale rather than eyeballing the offset.
4. Trigger signal to catch it earlier: The composition includes a logo over centered rings/glow, but the transform values do not mathematically align the mark's 50/50 local center to the background center point.

## lesson-size-svg-badges-from-content | 2026-03-22

1. Date: 2026-03-22
2. What went wrong: I hard-coded the social-preview eyebrow pill width and text baseline, so the `OPEN SOURCE LINKS` label could outgrow its background instead of the pill adapting to the content.
3. Preventive rule: When rendering SVG pills or badges around copy, derive rect geometry and vertical text alignment from the label, font size, letter spacing, and padding instead of freezing magic dimensions.
4. Trigger signal to catch it earlier: An SVG badge uses a fixed rect width and hand-tuned text coordinates even though the label is tracked uppercase text or may change over time.

## lesson-verify-rasterized-text-layout | 2026-03-22

1. Date: 2026-03-22
2. What went wrong: I treated the first auto-width pill fix as durable even though it still sized and centered the labels from heuristic font estimates while the PNG renderer was free to use fallback fonts, so the exported social card could remain visibly misaligned.
3. Preventive rule: When a design artifact is rasterized by a headless renderer, validate the final rendered output against the exact fonts and measurement engine the renderer uses before declaring the layout stable.
4. Trigger signal to catch it earlier: The layout fix depends on estimated text metrics, `dominant-baseline`, or other approximations while the render pipeline does not explicitly pin the fonts or measure actual glyph bounds.

## lesson-inline-raster-assets-in-composed-qr-badges | 2026-03-26 20:23

1. Date: 2026-03-26 20:23
2. What went wrong: The dual-identity QR badge change composed raster profile photos into an SVG data URL by leaving the photo as an external asset reference, which rendered the vector site logo but left the photo badge white in the actual QR dialog.
3. Preventive rule: When composing QR badge SVGs that mix vector marks with raster photos or avatars, inline the raster assets as `data:` URLs before handing the composed SVG to the QR renderer instead of relying on nested external image references.
4. Trigger signal to catch it earlier: Any QR or badge change that generates an SVG data URL containing `<image href="/cache/...jpg">`, `<image href="/cache/...png">`, or other external raster paths should be treated as a likely rendering bug and verified with an embedded-asset test before shipping.

## lesson-sync-and-install-before-work | 2026-03-27 05:21

1. Date: 2026-03-27 05:21
2. What went wrong: I started work on a stale local checkout and only synchronized with `origin/main` later during commit/push, which turned the integration into a rebase/conflict exercise instead of starting from the current upstream state. I also did not make `bun install` part of the default startup routine.
3. Preventive rule: Before substantive work in `open-links`, first run `git fetch origin --prune`, then a safe `git pull --ff-only`, and then `bun install` from the repo root unless the user explicitly asks to work against the unsynced local state or a higher-priority constraint forbids mutation.
4. Trigger signal to catch it earlier: Any new coding task that starts on a local branch without a same-turn fetch/pull check and dependency sync should be treated as out of policy before implementation begins.

## lesson-assume-main-when-detached | 2026-03-28 03:16 CDT

1. Date: 2026-03-28 03:16 CDT
2. What went wrong: I treated a detached worktree with no user-specified branch as a hard blocker for startup sync, even though this repo should default to syncing against `main` when no other branch target was requested.
3. Preventive rule: When `open-links` work starts from a detached worktree and the user has not specified a branch, assume `main` as the default sync target and use an explicit fast-forward path against `origin/main` instead of stopping just because `git pull --ff-only` cannot infer a current branch.
4. Trigger signal to catch it earlier: `git status --branch` shows `HEAD (no branch)` during startup sync, and the user has not named a different branch to work against.

## lesson-use-official-brand-assets | 2026-04-04 04:10

1. Date: 2026-04-04 04:10
2. What went wrong: I added the Lemonade icon with a hand-drawn approximation instead of sourcing the official mark, which introduced a visible overlap artifact.
3. Preventive rule: When adding a branded known-site icon, inspect the product's shipped assets first and prefer an official SVG or source-derived path over manual reconstruction.
4. Trigger signal to catch it earlier: A new icon requires custom stroke geometry because no existing library glyph is available.

## lesson-audit-fork-owned-json-before-crud-commit | 2026-04-05 14:31 CDT

1. Date: 2026-04-05 14:31 CDT
2. What went wrong: I bundled Staci's requested fork-owned link edits together with supporting rich-link/cache-policy changes and a few inferred content choices, which made it too easy to miss that some user-facing `data/links.json` copy went beyond the request.
3. Preventive rule: Before committing fork-owned CRUD updates in `open-links`, capture a before/after diff summary for `data/profile.json`, `data/links.json`, and `data/site.json`, and separate explicitly requested edits from supporting generated/cache artifacts in the task summary and final review.
4. Trigger signal to catch it earlier: A fork-owned content task adds or reorders multiple links and also requires policy/cache churn to support rich cards; that combination should trigger a deliberate JSON-only audit before commit.

## lesson-verify-audience-freshness-before-explaining-history | 2026-05-12 09:27 CDT

1. Date: 2026-05-12 09:27 CDT
2. What went wrong: I inferred the Substack follower history was current because the nightly job had appended rows, but the user's dashboard evidence showed the count had been 15 since around April 10 and the appended rows were stale-cache observations.
3. Preventive rule: When debugging audience history drift, first prove freshness from the same run's source refresh evidence before treating appended history rows as current observations.
4. Trigger signal to catch it earlier: A nightly history row repeats the same public-cache count while enrichment logs show blocked refreshes, stale-cache fallback, or HTTP failures for the same platform.

## lesson-verify-ci-runner-before-freshness-claim | 2026-05-16 09:33 CDT

1. Date: 2026-05-16 09:33 CDT
2. What went wrong: I verified Substack audience capture locally and inferred the next nightly CI run would append a fresh row, but GitHub's Ubuntu runner still missed the subscriber count and the workflow remained green while skipping Substack.
3. Preventive rule: When audience freshness depends on browser-rendered capture, verify or inspect the CI-runner artifact path before declaring a durable fix; local browser success is not enough.
4. Trigger signal to catch it earlier: The affected platform renders counts differently by environment, and the workflow uses best-effort capture flags that can commit other platforms while skipping the failed one.

## lesson-vcard-apple-contacts-structured-name | 2026-05-18 22:39 CDT

1. Date: 2026-05-18 22:39 CDT
2. What went wrong: I treated `FN` as sufficient for a person vCard with organization affiliation, but Apple Contacts displayed the `ORG` value as the primary contact name when the card lacked a structured `N` field.
3. Preventive rule: When generating person vCards for address book imports, emit both `FN` and structured `N` fields; keep `ORG` as affiliation metadata, not the only name-bearing structured field.
4. Trigger signal to catch it earlier: A vCard includes `ORG`, `TITLE`, or `ROLE` for a person but has no `N:` line, especially when testing against Apple Contacts or other native address book apps.
