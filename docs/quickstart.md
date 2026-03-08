# Quickstart

This guide is the fastest path from fork to first successful local run and GitHub Pages deployment.

## Preferred: OpenClaw One-Message Paths

Choose the path that matches your current state:

- Use `docs/openclaw-bootstrap.md` if you are doing first-time setup.
- Use `docs/openclaw-update-crud.md` if you already have a fork and/or local clone.

### Path A: Bootstrap (First-Time Setup)

Paste this one-liner into OpenClaw:

```text
Follow docs/openclaw-bootstrap.md exactly for this repository. Execute Required Execution Policy, End-to-End OpenClaw Sequence, Automation and Identity Confirmation Rule, Social Discovery and Inference Contract, Deployment Verification Contract, Structured URL Reporting Schema, README Deploy URL Marker-Block Contract, and Final Output Contract exactly as written. If an existing setup is detected, ask the single route-confirmation and switch to docs/openclaw-update-crud.md when selected.
```

### Path B: Update/CRUD (Existing Fork or Local Repo)

Paste this one-liner into OpenClaw:

```text
Follow docs/openclaw-update-crud.md exactly for this repository. Execute Required Startup Handshake (including conditional customization-audit selectors), Defaults, Customization Audit Path (Optional), Repository Resolution, Dirty Local Repository Handling, Interaction Modes, Identity and Discovery Policy, Update/CRUD Execution Sequence, Final Output Contract, and Required reason codes exactly as written. When customization_path=customization-audit, use docs/customization-catalog.md as the checklist source.
```

Use the manual steps below only when you are not using OpenClaw.

## Before You Start

### Prerequisites

- Bun 1.3+ (matches CI runtime).
- Node.js 22.x (optional compatibility runtime for ecosystem tooling).
- A GitHub account with permission to create repositories.

### Project assumptions

- You are comfortable editing JSON and committing changes.
- You can work directly in your own repository.

## Manual Bootstrap Your Repository

Use this approach:

1. **Fork** this repository if you want to pull upstream updates.

After repo creation:

```bash
git clone <your-repo-url>
cd open-links
bun install
```

## Optional: Enable Pre-Commit Hooks

OpenLinks ships Husky-based pre-commit hooks for fast local checks.

For existing clones, run:

```bash
bun run prepare
```

Hook behavior:

- Always runs staged Biome auto-fix/check and re-stages updates.
- Runs `bun run validate:data` only when staged paths touch `data/`, `schema/`, or `scripts/`.
- Runs `bun run typecheck` only when staged paths touch TS/config inputs.
- Runs `bun run quality:embedded-code` only when staged paths touch `scripts/`.
- Runs `bun run studio:check` only when staged paths touch `packages/` or `docs/studio-self-serve.md`.
- Does **not** run `build`, `ci:required`, `enrich:rich*`, or `images:sync`.

Temporary bypass options:

- `git commit --no-verify`
- `HUSKY=0 git commit ...`

Manual Biome commands:

- `bun run biome:check` (repo-wide read-only checks)
- `bun run biome:fix` (repo-wide autofix pass)

If your configuration uses authenticated rich extractors (`links[].enrichment.authenticatedExtractor`), complete first-run cache setup before `dev`/`build`:

```bash
bun run setup:rich-auth
```

Authenticated rich cache paths:

- `data/cache/rich-authenticated-cache.json`
- `public/cache/rich-authenticated/`
- `output/playwright/auth-rich-sync/` (diagnostics, gitignored)

Optional public rich-browser diagnostics:

- `output/playwright/public-rich-sync/` (gitignored)

## Configure Your First Site

Edit the three primary content files:

- `data/profile.json`
- `data/links.json`
- `data/site.json`

If you want a starter preset, copy from:

- `data/examples/minimal/`
- `data/examples/grouped/`

Recommended first pass:

1. Set your `profile.name`, `profile.headline`, `profile.bio`.
2. Replace starter links in `data/links.json`.
3. Set `site.title` and `site.description`.
4. Pick an initial theme in `site.theme.active` (default recommendation: `sleek`).
5. Set rich-card image fit in `site.ui.richCards.imageFit`:
   - `contain` (default, preserves full preview image content)
   - `cover` (fills media tile, may clip wide images)

## Run Locally

### Validate data

```bash
bun run validate:data
```

If you want Medium, X, or Primal audience metrics cached through the public browser path, run this before `dev` or after your profile changes:

```bash
bun run public:rich:sync -- --only-link medium
bun run public:rich:sync -- --only-link x
bun run public:rich:sync -- --only-link primal
```

### Start dev server

```bash
bun run dev
```

`bun run dev` runs `avatar:sync`, `enrich:rich:strict`, and `images:sync` first (`predev`) so profile/rich/SEO images are baked into local assets and blocking enrichment issues fail early.

### Build production output

```bash
bun run build
bun run preview
```

`bun run build` runs avatar sync, strict rich enrichment, and content-image sync before validation/build.

## First Deployment to GitHub Pages

### 1) Push to `main`

```bash
git add .
git commit -m "feat: personalize OpenLinks data"
git push
```

### 2) Enable Pages with GitHub Actions

In your repository settings:

1. Go to **Pages**.
2. Set **Build and deployment source** to **GitHub Actions**.

### 3) Verify workflows

Check workflow runs:

- `.github/workflows/ci.yml` (required checks and strict signals)
- `.github/workflows/deploy-pages.yml` (deploy job)

When deployment succeeds, open the URL from the deploy job summary.

## Optional Manual Deploy Dispatch

`deploy-pages.yml` supports manual dispatch inputs:

- `base_mode`: `project`, `root`, or `auto`
- `base_path`: explicit override (must start and end with `/`)
- `repo_name_override`: optional project-name override

Use manual dispatch if you need to test base path behavior before changing defaults.

## Local Diagnostics Flow

Run these before opening a CI/deploy issue:

```bash
bun run validate:data
bun run typecheck
bun run build
bun run quality:check
```

For strict parity:

```bash
bun run ci:required
bun run ci:strict
```

## Common Setup Problems

### Problem: Validation errors on required fields

Symptoms:

- `bun run validate:data` exits non-zero.
- Error paths point to missing values in `data/*.json`.

Fix:

1. Fill required fields (`name`, `headline`, `bio`, link `id/label/url/type`, etc.).
2. Re-run `bun run validate:data`.

### Problem: URL scheme rejected

Symptoms:

- Validation message says scheme is not allowed.

Fix:

- Use only `http`, `https`, `mailto`, or `tel` in link URLs.

### Problem: Custom key conflict

Symptoms:

- Validation reports `custom` key conflicts with reserved core key.

Fix:

1. Rename conflicting key under `custom`.
2. Keep core fields in their dedicated schema properties.

### Problem: Build/dev fails on rich metadata enrichment

Symptoms:

- `bun run dev` or `bun run build` stops during `enrich:rich:strict`.
- Output includes `fetch_failed`, `metadata_missing`, `known_blocker`, or `authenticated_cache_missing` diagnostics for one or more links.

Fix:

1. Re-run strict enrichment diagnostics:

```bash
bun run enrich:rich:strict
```

2. Review `site.ui.richCards.enrichment` in `data/site.json`:
   - `failureMode` (`immediate` or `aggregate`)
   - `failOn` (`fetch_failed`, `metadata_missing`)
   - `allowManualMetadataFallback`
3. Review canonical known-blocker policy in `data/policy/rich-enrichment-blockers.json` (see `docs/rich-enrichment-blockers-registry.md`).
4. If using authenticated extractors, verify:
   - `data/policy/rich-authenticated-extractors.json`
   - `data/cache/rich-authenticated-cache.json`
   - committed local assets under `public/cache/rich-authenticated/`
5. For `authenticated_cache_missing`, run:

```bash
bun run setup:rich-auth
```

Or for one link only:

```bash
bun run auth:rich:sync -- --only-link <link-id>
```

Force refresh for one link (even if cache is valid):

```bash
bun run auth:rich:sync -- --only-link <link-id> --force
```

Clear cache entries/assets before recapture:

```bash
bun run auth:rich:clear -- --only-link <link-id>
# or clear all
bun run auth:rich:clear -- --all
```

Then commit cache manifest/assets and rerun build.
6. If a known blocked domain must be tested intentionally, set per-link override: `links[].enrichment.allowKnownBlocker=true`.
7. For `metadata_missing`, add at least one manual metadata field under `links[].metadata` (`title`, `description`, or `image`) or improve target-site OG/Twitter metadata.
8. Temporary emergency local bypass:

```bash
OPENLINKS_RICH_ENRICHMENT_BYPASS=1 bun run build
```

### Problem: Build passes locally but Pages path is wrong

Symptoms:

- App loads partially on project-page URL.
- CSS/JS assets 404.

Fix:

1. Check `PAGES_BASE_MODE` assumptions (`project` is default).
2. Rebuild with alternate mode locally:

```bash
PAGES_BASE_MODE=root bun run build
```

3. If needed, set explicit `BASE_PATH` during manual deploy dispatch.

### Problem: Deploy workflow fails to find artifact

Symptoms:

- Deploy workflow reports no `dist` artifact.

Fix:

1. Verify CI succeeded on `main` and uploaded `openlinks-dist`.
2. Re-run deploy workflow manually; it can rebuild as fallback.

## Day-2 Update Loop

After initial publish, your normal update cycle is:

1. Edit `data/*.json`.
2. Run `bun run validate:data`.
3. Run `bun run build`.
4. Commit and push.
5. Verify CI and deploy jobs.

If you want OpenClaw to handle this update loop with interaction mode selection, optional identity-research opt-out, and a customization-audit branch, use:

- `docs/openclaw-update-crud.md`

If your avatar source changed but cache is still valid, force refresh with:

```bash
bun run avatar:sync -- --force
```

If rich/SEO image sources changed but cache is still valid, force refresh with:

```bash
bun run images:sync -- --force
```

If authenticated rich metadata should be refreshed even with valid cache, run:

```bash
bun run auth:rich:sync -- --only-link <link-id> --force
```

If authenticated rich cache is corrupted or needs a clean reset, run:

```bash
bun run auth:rich:clear -- --only-link <link-id> --dry-run
bun run auth:rich:clear -- --only-link <link-id>
bun run setup:rich-auth
```

## Next Guides

- Root docs: `README.md`
- OpenClaw bootstrap contract: `docs/openclaw-bootstrap.md`
- OpenClaw update contract: `docs/openclaw-update-crud.md`
- Customization catalog: `docs/customization-catalog.md`
- Data model deep dive: `docs/data-model.md`
- Blockers registry guide: `docs/rich-enrichment-blockers-registry.md`
- AI-guided customization wizard: `docs/ai-guided-customization.md`
- Deployment operations: `docs/deployment.md`
