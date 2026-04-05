# Quickstart

This guide is the fastest path from fork to first successful local run and first public deployment.

## Preferred: OpenClaw One-Message Paths

Choose the path that matches your current state:

- Use `docs/openclaw-bootstrap.md` if you are doing first-time setup.
- Use `docs/openclaw-update-crud.md` if you already have a fork and/or local clone.

### Path A: Bootstrap (First-Time Setup)

Paste this one-liner into OpenClaw:

<!-- OPENCLAW_BOOTSTRAP_PROMPT:start -->
```text
Follow https://raw.githubusercontent.com/pRizz/open-links/main/docs/openclaw-bootstrap.md exactly for this repository. Execute Required Execution Policy, End-to-End OpenClaw Sequence, Automation and Identity Confirmation Rule, Social Discovery and Inference Contract, Deployment Verification Contract, Structured URL Reporting Schema, README Deploy URL Marker-Block Contract, and Final Output Contract exactly as written. If an existing setup is detected, ask the single route-confirmation and switch to https://raw.githubusercontent.com/pRizz/open-links/main/docs/openclaw-update-crud.md when selected.
```
<!-- OPENCLAW_BOOTSTRAP_PROMPT:end -->

### Path B: Update/CRUD (Existing Fork or Local Repo)

Paste this one-liner into OpenClaw:

<!-- OPENCLAW_UPDATE_PROMPT:start -->
```text
Follow https://raw.githubusercontent.com/pRizz/open-links/main/docs/openclaw-update-crud.md exactly for this repository. Execute Required Startup Handshake (including conditional customization-audit selectors), Defaults, Customization Audit Path (Optional), Repository Resolution, Dirty Local Repository Handling, Interaction Modes, Identity and Discovery Policy, Update/CRUD Execution Sequence, Final Output Contract, and Required reason codes exactly as written. When customization_path=customization-audit, use https://raw.githubusercontent.com/pRizz/open-links/main/docs/customization-catalog.md as the checklist source.
```
<!-- OPENCLAW_UPDATE_PROMPT:end -->

Use the manual steps below only when you are not using OpenClaw.

Referral links are supported through the same day-2 CRUD path. Prefer OpenClaw or the AI-guided customization docs first, use Studio only when Advanced JSON is acceptable for the change, and keep direct JSON edits as the manual fallback. The canonical referral contract lives in `docs/data-model.md`.

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
bun run fork:reset
```

`bun run fork:reset` rewrites the repo to the minimal starter profile, clears inherited upstream badges/caches/history, and empties the README deploy URL rows before you personalize the fork.

Dry-run the cleanup first when you want to inspect the reset surface:

```bash
bun run fork:reset --check
```

When you want to pull new upstream changes into your fork later, use:

```bash
bun run sync:upstream:main
```

This command is for forks and downstream repos, not the canonical `pRizz/open-links` repo. It syncs `upstream/main` into `origin/main` through a disposable integration worktree, so it still works when your current worktree is detached or when local `main` is checked out elsewhere. Fork-owned personalized paths are preserved only when every overlap is covered by `config/fork-owned-paths.json`. Shared-file conflicts still require manual resolution.

When the sync stops on conflicts, the local CLI now reports `Shared conflicts:` and `Fork-owned conflicts:` separately. Only the shared list is the manual blocker; the fork-owned list is reported so you can see what the preservation helper already recognized.

Use `bun run sync:upstream` only when you intentionally want the lower-level attached-branch sync helper for diagnostics or compatibility.

## Cursor Remote Environment

If you are opening this repository in a Cursor-managed remote workspace, the repo bootstrap is already checked in:

- `.cursor/environment.json` selects the base image and persisted cache directories.
- `.cursor/install.sh` installs the Bun version pinned in `package.json` and runs `bun install`.
- `.cursor/start.sh` restores Bun on `PATH` for each shell session.

Bun is the primary runtime in the managed workspace. The Node.js 22 prerequisite above remains the optional local compatibility runtime for tooling outside the managed environment.

Recommended first commands after the workspace opens:

```bash
bun run fork:reset
bun run validate:data
bun run typecheck
bun run dev
```

If you need Studio in a remote shell without Docker, use the manual service path instead of Compose:

```bash
cp .env.studio.example .env.studio
bun run studio:db:migrate
bun run studio:api:dev
bun run studio:web:dev
```

Start `bun run studio:worker:dev` in a separate shell when you need the scheduled sync worker locally.

## Optional: Enable Pre-Commit Hooks

OpenLinks ships Husky-based pre-commit hooks for fast local checks.

For existing clones, run:

```bash
bun run prepare
```

Hook behavior:

- Always runs staged Biome auto-fix/check and re-stages updates.
- Runs `bun run validate:data:hook` only when staged paths touch `data/`, `schema/`, or `scripts/`.
- Commit-time validation is hook-aware for generated rich artifacts: it still runs schema/policy/config checks, but only enforces generated rich metadata/image checks when staged paths touch rich metadata/image inputs.
- Runs `bun run typecheck` only when staged paths touch TS/config inputs.
- Runs `bun run quality:embedded-code` only when staged paths touch `scripts/`.
- Runs `bun run studio:check` only when staged paths touch `packages/` or `docs/studio-self-serve.md`.
- Runs a non-mutating required parity lane on CI-relevant staged paths:
  - `bun run ci:required:typecheck`
  - `bun run ci:required:hook:build`
  - `bun run ci:required:hook:quality`
  - `bun run ci:required:studio-integration`
- Does **not** run tracked-output generators like `avatar:sync`, `enrich:rich*`, or `images:sync` during commit-time parity, even though `images:sync` now refreshes committed cache artifacts under `data/cache/content-images.json` and `public/cache/content-images/`.
- Full repo-wide rich-artifact validation still happens in normal `bun run validate:data`, `bun run build`, and CI.
- Writes hook-only quality artifacts under `.cache/openlinks-precommit/` (gitignored).

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

If you already have a Linktree, you can bootstrap reviewable profile/link candidates before editing `data/*.json`:

```bash
bun run bootstrap:linktree -- --url https://linktr.ee/<handle>
```

Edit the three primary content files:

- `data/profile.json`
- `data/links.json`
- `data/site.json`

If you want a starter preset, copy from:

- `data/examples/minimal/`
- `data/examples/grouped/`

Recommended first pass:

1. Set your `profile.name`, `profile.headline`, `profile.bio`.
2. Replace starter links in `data/links.json`, or start from the Linktree extractor output if you used it.
3. Set `site.title` and `site.description`.
4. Pick an initial theme in `site.theme.active` (default recommendation: `sleek`).
5. Set rich-card image fit in `site.ui.richCards.imageFit`:
   - `contain` (default, preserves full preview image content)
   - `cover` (fills media tile, may clip wide images)
6. Optional: customize the generated site badge copy in `site.sharing.badge.message` or disable badge publishing with `site.sharing.badge.enabled=false`.

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

The built-in audience analytics page is already enabled by default. It becomes visible once follower-history artifacts exist, so after refreshing audience-capable links you should also run:

```bash
bun run followers:history:sync
```

Then commit the updated files under `public/history/followers/`.

### Start dev server

```bash
bun run dev
```

`bun run dev` runs `avatar:sync`, `enrich:rich:strict`, and `images:sync` first (`predev`) so profile/rich/SEO images are baked into committed local cache assets and blocking enrichment issues fail early. The strict enrichment step is read-only for `data/cache/rich-public-cache.json`; it only updates the local runtime overlay unless you explicitly run `bun run enrich:rich:strict:write-cache`. `avatar:sync` writes stable avatar-cache outputs to `data/cache/profile-avatar.json` and `public/cache/profile-avatar/`, while volatile avatar revalidation state lives in `data/cache/profile-avatar.runtime.json` (gitignored). `images:sync` writes stable image-cache outputs to `data/cache/content-images.json` and `public/cache/content-images/`, while volatile revalidation headers live in `data/cache/content-images.runtime.json` (gitignored).

### Build production output

```bash
bun run build
bun run preview
```

`bun run build` runs avatar sync, strict rich enrichment, and content-image sync before validation/build. Like `bun run dev`, the strict enrichment step keeps `data/cache/rich-public-cache.json` unchanged unless you explicitly ran `bun run enrich:rich:strict:write-cache`. When image bytes change, `images:sync` updates the committed stable image-cache artifacts in the repo. Cache-backed fetches across avatar/image/public/authenticated pipelines are governed by `data/policy/remote-cache-policy.json`; add new domains there whenever a change introduces a new remote host. If a public-augmentation rich link picks up new generated metadata and should stay deployable from a fresh CI runner, run `bun run enrich:rich:strict:write-cache` before commit so cold-run deploys can fall back to committed public cache when the remote source is transiently unavailable.

## First Production Deploy

### 1) Push to `main`

```bash
git add .
git commit -m "feat: personalize OpenLinks data"
git push
```

### 2) Choose your target

Upstream ships `config/deployment.defaults.json` with the shared baseline. In a fork, create or update `config/deployment.json` to override that baseline for your site.

#### GitHub Pages (default fork-safe primary)

1. In repository settings, open **Pages**.
2. Open the fork’s **Actions** tab. If GitHub shows **Workflows aren’t being run on this forked repository**, click **Enable workflows** once.
3. If you clicked **Enable workflows** after your first bootstrap push, push again on `main` so the newly enabled workflows receive a fresh event.
4. Set **Build and deployment source** to **GitHub Actions**.
5. Sync tracked deployment outputs:

```bash
bun run deploy:setup -- --apply
```

6. Verify:
   - `.github/workflows/ci.yml` succeeded
   - `.github/workflows/deploy-production.yml` (`Deploy Production`) published the Pages site
7. Open the Pages URL from the workflow summary.

#### Render (provider-native)

1. Follow `docs/deployment-render.md`.
2. Build command is already checked in through `render.yaml`.
3. After the first provider deploy, either update the fork overlay `config/deployment.json` directly or use the compatibility wrapper to register the live URL:

```bash
bun run deploy:setup:render -- --apply --public-origin=https://<service>.onrender.com
```

4. Add `--promote-primary` only if Render should become the canonical host.

#### Railway (provider-native)

1. Follow `docs/deployment-railway.md`.
2. Build and deploy commands are already checked in through `railway.toml`.
3. After the first provider deploy and public-domain generation, either update the fork overlay `config/deployment.json` directly or use the compatibility wrapper to register the live URL:

```bash
bun run deploy:setup:railway -- --apply --public-origin=https://<service>.up.railway.app
```

4. Add `--promote-primary` only if Railway should become the canonical host.

#### AWS flow

In a fork overlay, set `aws` enabled, keep `github-pages` enabled if you want a mirror, and set `primaryTarget` to `aws`. Then run:

```bash
bun run deploy:plan
bun run deploy:setup
```

When the summaries show the expected GitHub/AWS plan, rerun the mutating steps with `--apply`.

### 3) Verify the live target

For GitHub Pages and upstream AWS, verify GitHub workflow summaries.

For Render or Railway, verify the live target directly:

```bash
bun run deploy:verify:live -- --target=render --public-origin=https://<service>.onrender.com
bun run deploy:verify:live -- --target=railway --public-origin=https://<service>.up.railway.app
```

OpenLinks also publishes a canonical SVG badge for your deployed site:

- custom domain: `https://<your-domain>/badges/openlinks.svg`
- GitHub Pages fork: `https://<owner>.github.io/<repo>/badges/openlinks.svg`
- Render fork: `https://<service>.onrender.com/badges/openlinks.svg`
- Railway fork: `https://<service>.up.railway.app/badges/openlinks.svg`

Recommended Markdown embed:

```md
[![My OpenLinks](https://<deployed-origin>/badges/openlinks.svg)](https://<deployed-origin>/)
```

## Optional Manual Deploy Dispatch

`Deploy Production` still supports manual dispatch for the enabled GitHub-hosted targets, and it is now config-driven:

- dispatch it on `main`,
- the workflow builds fresh deploy artifacts when it cannot reuse CI outputs,
- AWS runs only when the opt-in variable and secret are present.

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

`bun run ci:strict` matches the GitHub Actions strict lane and keeps performance findings advisory-only while preserving other strict failures.

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
7. For `metadata_missing`, add at least one manual metadata field under `links[].metadata` (`title`, `description`, or `image`) or improve target-site OG/Twitter metadata. After adding or changing remote image URLs, run `bun run images:sync` and commit `data/cache/content-images.json` plus `public/cache/content-images/*` when they change.
8. Temporary emergency local bypass:

```bash
OPENLINKS_RICH_ENRICHMENT_BYPASS=1 bun run build
```

### Problem: `deploy:verify` blocks on DNS readiness

Symptoms:

- Verification reports that the configured AWS domain does not resolve publicly yet.

Fix:

1. Confirm the effective AWS public origin from `config/deployment.defaults.json` plus optional `config/deployment.json` is correct.
2. Confirm the Route 53 hosted zone exists and the CloudFormation stack has created alias records.
3. Wait for propagation.
4. Rerun:

```bash
bun run deploy:verify
```

### Problem: Deploy workflow fails to find artifact

Symptoms:

- Deploy workflow reports a missing deploy artifact.

Fix:

1. Verify CI succeeded on `main` and uploaded `deploy-aws-site` plus `deploy-pages-site`.
2. Re-run `Deploy Production` manually on `main`; it can rebuild artifacts as fallback.

### Problem: deployment tests fail because a change assumed upstream-only hosting

Symptoms:

- `bun run test:deploy` fails on a fork after a change to canonical, robots, Pages, or deploy verification logic.
- Assertions assume one hardcoded host instead of the config-driven topology.

Fix:

1. Replace hardcoded upstream expectations with shared deployment helpers from `src/lib/deployment-config.ts` or `scripts/lib/live-deploy-verify.ts`.
2. Cover both cases in tests:
   - default Pages-primary topology
   - explicit AWS-primary topology with GitHub Pages as a mirror
3. Re-run:

```bash
bun run test:deploy
```

### Problem: a fork still contains upstream profile, link, badge, or deploy URL data

Symptoms:

- `data/profile.json`, `data/links.json`, or `data/site.json` still look like upstream starter content.
- the fork deployment overlay still reflects an old topology.
- README deploy rows still point at previous hosts.
- badges, follower history, avatar cache, or rich metadata still reference the upstream seed identity.

Fix:

1. Preview the cleanup:

```bash
bun run fork:reset --check
```

2. Reset the fork to the minimal starter baseline:

```bash
bun run fork:reset
```

3. If the repo is no longer obviously starter state but you intentionally want a full wipe, rerun with:

```bash
bun run fork:reset --force
```

### Problem: Render or Railway still canonicalizes to the wrong host

Symptoms:

- The provider site is live, but `<link rel="canonical">` still points at GitHub Pages or another host.
- The provider page still emits `noindex, nofollow` after you meant to promote it.

Fix:

1. Update the fork deployment overlay so the provider has the correct `publicOrigin` and is the `primaryTarget`, or use the compatibility wrapper:

```bash
bun run deploy:setup:render -- --apply --public-origin=https://<service>.onrender.com --promote-primary
# or
bun run deploy:setup:railway -- --apply --public-origin=https://<service>.up.railway.app --promote-primary
```

2. Commit and push the resulting `config/deployment.json`, `data/site.json`, and `README.md` changes.

### Problem: `quality:check` warns that SEO title or description is using fallback content

Symptoms:

- `bun run quality:check` reports `SEO_TITLE_FALLBACK` or `SEO_DESCRIPTION_FALLBACK`.
- The site resolves SEO metadata from `profile.name`, `profile.bio`, or `site.title`/`site.description` instead of explicit SEO config.

Fix:

1. Add explicit defaults under `data/site.json`:

```json
{
  "quality": {
    "seo": {
      "canonicalBaseUrl": "https://<owner>.github.io/<repo>/",
      "socialImageFallback": "/generated/seo/social-preview.png",
      "defaults": {
        "title": "Your Name | short SEO title",
        "description": "Short search and social summary for the site."
      }
    }
  }
}
```

2. If the fork has promoted Render, Railway, AWS, or a custom domain, replace `canonicalBaseUrl` with that primary HTTPS origin.
3. Re-run:

```bash
bun run quality:check
bun run build
```
4. Let the provider redeploy the new commit.
5. Re-run:

```bash
bun run deploy:verify:live -- --target=<render|railway> --public-origin=https://<live-url>
```

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

Commit `data/cache/content-images.json` and any changed `public/cache/content-images/*` assets if the refreshed bytes differ.

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
- Render deployment: `docs/deployment-render.md`
- Railway deployment: `docs/deployment-railway.md`
