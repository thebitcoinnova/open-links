# Quickstart

This guide is the fastest path from fork/template to first successful local run and GitHub Pages deployment.

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

- Node.js 22.x (matches CI workflow).
- npm (bundled with Node).
- A GitHub account with permission to create repositories.

### Project assumptions

- You are comfortable editing JSON and committing changes.
- You can work directly in your own repository.

## Manual Bootstrap Your Repository

Use one approach:

1. **Fork** this repository if you want to pull upstream updates.
2. **Use this template** for a fresh standalone repository.

After repo creation:

```bash
git clone <your-repo-url>
cd open-links
npm install
```

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

## Run Locally

### Validate data

```bash
npm run validate:data
```

### Start dev server

```bash
npm run dev
```

`npm run dev` runs `avatar:sync`, `enrich:rich`, and `images:sync` first (`predev`) so profile/rich/SEO images are baked into local assets.

### Build production output

```bash
npm run build
npm run preview
```

`npm run build` runs avatar sync, rich enrichment, and content-image sync before validation/build.

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
npm run validate:data
npm run typecheck
npm run build
npm run quality:check
```

For strict parity:

```bash
npm run ci:required
npm run ci:strict
```

## Common Setup Problems

### Problem: Validation errors on required fields

Symptoms:

- `npm run validate:data` exits non-zero.
- Error paths point to missing values in `data/*.json`.

Fix:

1. Fill required fields (`name`, `headline`, `bio`, link `id/label/url/type`, etc.).
2. Re-run `npm run validate:data`.

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

### Problem: Build passes locally but Pages path is wrong

Symptoms:

- App loads partially on project-page URL.
- CSS/JS assets 404.

Fix:

1. Check `PAGES_BASE_MODE` assumptions (`project` is default).
2. Rebuild with alternate mode locally:

```bash
PAGES_BASE_MODE=root npm run build
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
2. Run `npm run validate:data`.
3. Run `npm run build`.
4. Commit and push.
5. Verify CI and deploy jobs.

If you want OpenClaw to handle this update loop with interaction mode selection, optional identity-research opt-out, and a customization-audit branch, use:

- `docs/openclaw-update-crud.md`

If your avatar source changed but cache is still valid, force refresh with:

```bash
npm run avatar:sync -- --force
```

If rich/SEO image sources changed but cache is still valid, force refresh with:

```bash
npm run images:sync -- --force
```

## Next Guides

- Root docs: `README.md`
- OpenClaw bootstrap contract: `docs/openclaw-bootstrap.md`
- OpenClaw update contract: `docs/openclaw-update-crud.md`
- Customization catalog: `docs/customization-catalog.md`
- Data model deep dive: `docs/data-model.md`
- AI-guided customization wizard: `docs/ai-guided-customization.md`
- Deployment operations: `docs/deployment.md`
