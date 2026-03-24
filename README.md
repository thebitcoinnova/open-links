# OpenLinks

<!-- coding-and-architecture-requirements-readme-badges:begin -->
[![GitHub Stars](https://img.shields.io/github/stars/pRizz/open-links)](https://github.com/pRizz/open-links)
[![CI](https://github.com/pRizz/open-links/actions/workflows/ci.yml/badge.svg)](https://github.com/pRizz/open-links/actions/workflows/ci.yml)
[![Deploy Pages](https://github.com/pRizz/open-links/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/pRizz/open-links/actions/workflows/deploy-pages.yml)
[![License](https://img.shields.io/github/license/pRizz/open-links?s)](./LICENSE)
[![TypeScript 5.9.3](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SolidJS 1.9.11](https://img.shields.io/badge/SolidJS-1.9.11-2C4F7C?logo=solid&logoColor=white)](https://www.solidjs.com/)
[![Vite 7.3.1](https://img.shields.io/badge/Vite-7.3.1-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
<!-- coding-and-architecture-requirements-readme-badges:end -->

OpenLinks is a personal, free, open source, version-controlled static website generator for social links.

This project is developer-first, but that does not mean raw JSON should be your default CRUD surface. For most maintainers, the recommended path is:

1. Use the repo's AI workflows/skills and checked-in automation docs for repo-native CRUD.
2. Use the Studio webapp when the browser-based self-serve editor fits your workflow.
3. Drop to direct JSON edits only when you need lower-level control or a manual fallback.
<!-- OPENLINKS_SCREENSHOT_ANCHOR -->
<!-- OPENLINKS_SCREENSHOT_START -->
![OpenLinks preview](docs/assets/openlinks-preview.png)
<!-- OPENLINKS_SCREENSHOT_END -->

## Logo Assets

- Governance doc: [docs/logo-governance.md](docs/logo-governance.md)
- Global primary logo: `public/branding/openlinks-logo/openlinks-logo.svg`
- Explicit V2 alias: `public/branding/openlinks-logo/openlinks-logo-v2.svg`
- Archived non-winning V2 marks: `public/branding/openlinks-logo/v2/archive/`
- Runtime browser icon set (main app): `public/`
- Runtime browser icon set (Studio): `packages/studio-web/public/`
- Regenerate runtime brand assets: `bun run branding:assets`

## Site Badge

OpenLinks generates one canonical site badge asset during `dev` and `build` at:

- `<deployed-origin>/badges/openlinks.svg`

Canonical live example for this repo:

[![OpenLinks Site](https://openlinks.us/badges/openlinks.svg)](https://openlinks.us/)

Default behavior:

- label is fixed to `OpenLinks`
- message defaults to `profile.name`
- optional override lives at `site.sharing.badge.message`
- set `site.sharing.badge.enabled` to `false` to stop publishing the badge

Example override in `data/site.json`:

```json
{
  "sharing": {
    "badge": {
      "message": "My OpenLinks"
    }
  }
}
```

Recommended Markdown embed once your site is deployed:

```md
[![My OpenLinks](https://<your-domain>/badges/openlinks.svg)](https://<your-domain>/)
```

GitHub Pages fork example:

```md
[![My OpenLinks](https://<owner>.github.io/<repo>/badges/openlinks.svg)](https://<owner>.github.io/<repo>/)
```

## Why OpenLinks

- Static SolidJS site with minimal runtime complexity.
- Version-controlled content in `data/*.json`.
- Schema + policy validation with actionable remediation output.
- Rich and simple card support with build-time enrichment.
- Payments and tips links with multi-rail support, styled QR codes, and fullscreen scan mode.
- Build-time profile-avatar materialization with local fallback behavior.
- Build-time rich/SEO image materialization with local-only runtime behavior.
- Offline-friendly public app shell with cached same-origin assets and graceful analytics fallback after first online visit.
- GitHub Actions CI + AWS canonical deploy + GitHub Pages mirror pipeline already wired.
- Theme and layout controls designed for forking and customization.
- Data-driven typography overrides via `data/site.json` (`ui.typography`).

## Scope and Audience

### Intended audience

- Developers who are comfortable editing JSON and markdown.
- Maintainers using AI agents to automate content updates.

### Out of scope for v1

- User auth/account system.
- CMS or WYSIWYG editor.
- Traffic analytics or pageview dashboards.
- Plugin marketplace.

## Quickstart

For full walkthrough and troubleshooting, see [Quickstart](https://raw.githubusercontent.com/pRizz/open-links/main/docs/quickstart.md).

### Cursor Remote Environment

This repo is already configured for Cursor-managed remote workspaces via [`.cursor/environment.json`](.cursor/environment.json).

Remote bootstrap behavior:

- uses a Node 20 base image because Bun is the primary runtime in the managed workspace
- runs `bash .cursor/install.sh` during install to pin Bun from `package.json` and run `bun install`
- runs `bash .cursor/start.sh` when the remote shell starts
- persists `/workspace/.cache`, `/workspace/node_modules`, and Bun's install cache across sessions

Recommended first commands in a remote shell:

```bash
bun run validate:data
bun run typecheck
bun run dev
```

If you are working on Studio in a remote shell without Docker, skip `docker compose -f docker-compose.studio.yml up --build` and use the manual path from [`docs/studio-self-serve.md`](docs/studio-self-serve.md):

```bash
cp .env.studio.example .env.studio
bun run studio:db:migrate
bun run studio:api:dev
bun run studio:web:dev
```

### Recommended CRUD Paths

- Preferred for repo-native maintenance: use the repo's AI workflows/skills through [OpenClaw Update/CRUD Contract](https://raw.githubusercontent.com/pRizz/open-links/main/docs/openclaw-update-crud.md), [OpenClaw Bootstrap Contract](https://raw.githubusercontent.com/pRizz/open-links/main/docs/openclaw-bootstrap.md), [AI-Guided Customization Wizard](https://raw.githubusercontent.com/pRizz/open-links/main/docs/ai-guided-customization.md), [Linktree Bootstrap Extractor](https://raw.githubusercontent.com/pRizz/open-links/main/docs/linktree-bootstrap.md), [`skills/cache-rich-link-assets/SKILL.md`](skills/cache-rich-link-assets/SKILL.md) when rich-link image assets need to be committed, and [`skills/openlinks-fork-identity-presence/SKILL.md`](skills/openlinks-fork-identity-presence/SKILL.md) when you want other websites, repos, docs, or services to point back to your deployed OpenLinks fork.
- Preferred for browser-based CRUD: use [OpenLinks Studio](https://raw.githubusercontent.com/pRizz/open-links/main/docs/studio-self-serve.md) when the self-serve onboarding/editor already covers your workflow.
- Manual fallback: edit `data/*.json` directly only when you intentionally want the lower-level path or need to work outside the currently supported AI/Studio flows.

### Repo Skills

The repository currently ships these repo-local skill entrypoints under `skills/`:

- [`skills/openlinks-fork-identity-presence/SKILL.md`](skills/openlinks-fork-identity-presence/SKILL.md): help other websites, apps, repos, docs, and service profiles point back to your deployed OpenLinks fork using its canonical URL and brand assets.
- [`skills/cache-rich-link-assets/SKILL.md`](skills/cache-rich-link-assets/SKILL.md): persist rich-card images and related metadata into the committed cache after link changes.
- [`skills/create-new-rich-content-extractor/SKILL.md`](skills/create-new-rich-content-extractor/SKILL.md): public-first workflow for deciding and implementing new rich metadata support when existing enrichment is insufficient.

### 1) OpenClaw Bootstrap (Recommended)

Paste this one-liner into OpenClaw, Claude, or Codex (the prompts are mostly compatible with any coding agent):

<!-- OPENCLAW_BOOTSTRAP_PROMPT:start -->
```text
Follow https://raw.githubusercontent.com/pRizz/open-links/main/docs/openclaw-bootstrap.md exactly for this repository. Execute Required Execution Policy, End-to-End OpenClaw Sequence, Automation and Identity Confirmation Rule, Social Discovery and Inference Contract, Deployment Verification Contract, Structured URL Reporting Schema, README Deploy URL Marker-Block Contract, and Final Output Contract exactly as written. If an existing setup is detected, ask the single route-confirmation and switch to https://raw.githubusercontent.com/pRizz/open-links/main/docs/openclaw-update-crud.md when selected.
```
<!-- OPENCLAW_BOOTSTRAP_PROMPT:end -->

Use this path when this is the first setup for a new fork or local clone.

### 2) OpenClaw Update/CRUD (Existing Fork or Local Repo)

Paste this one-liner into OpenClaw, Claude, or Codex:

<!-- OPENCLAW_UPDATE_PROMPT:start -->
```text
Follow https://raw.githubusercontent.com/pRizz/open-links/main/docs/openclaw-update-crud.md exactly for this repository. Execute Required Startup Handshake (including conditional customization-audit selectors), Defaults, Customization Audit Path (Optional), Repository Resolution, Dirty Local Repository Handling, Interaction Modes, Identity and Discovery Policy, Update/CRUD Execution Sequence, Final Output Contract, and Required reason codes exactly as written. When customization_path=customization-audit, use https://raw.githubusercontent.com/pRizz/open-links/main/docs/customization-catalog.md as the checklist source.
```
<!-- OPENCLAW_UPDATE_PROMPT:end -->

Use this path for day-2 maintenance when the user likely already has a fork and/or local clone.

### 3) Create your own repository (Manual Path)

Use this approach:

1. Fork this repository.

### 4) Clone and install

```bash
git clone <your-repo-url>
cd open-links
bun install
```

If you have a Linktree and want a bootstrap seed for profile/avatar/social/content links before editing `data/*.json`, run:

```bash
bun run bootstrap:linktree -- --url https://linktr.ee/<handle>
```

If your links use authenticated extractors (`links[].enrichment.authenticatedExtractor`), run guided cache setup before first `dev`/`build`:

```bash
bun run setup:rich-auth
```

If you use Medium, X, or Primal rich links and want the optional public audience metrics cached locally, run:

```bash
bun run public:rich:sync -- --only-link medium
bun run public:rich:sync -- --only-link x
bun run public:rich:sync -- --only-link primal
```

If you want to refresh the public follower-history artifacts locally before the nightly automation does it on `main`, run:

```bash
bun run followers:history:sync
```

### 5) Update your data

Preferred path:

- use the repo AI workflows/skills and the docs above for routine CRUD
- use OpenLinks Studio when you want the browser-based self-serve path

Manual fallback:

- edit these files directly when you need the lower-level path

- `data/profile.json` - identity and profile details.
- `data/links.json` - simple/rich/payment links, groups, ordering.
- `data/site.json` - theme, UI, quality, and deployment-related config.

Linktree-assisted bootstrap:

- use `bun run bootstrap:linktree -- --url https://linktr.ee/<handle>` to generate reviewable profile/link candidates before editing `data/profile.json` and `data/links.json`

Starter presets:

- `data/examples/minimal/`
- `data/examples/grouped/`
- `data/examples/invalid/` (intentional failures for testing)

### 6) Validate and run locally

```bash
bun run validate:data
bun run dev
```

### 7) Build production output

```bash
bun run build
bun run preview
```

## OpenClaw Deployment URLs

OpenClaw should update only the rows between the exact marker lines below:

- rewrite only marker-bounded rows,
- commit only if normalized URL/status values changed.

OPENCLAW_DEPLOY_URLS_START
| target | status | primary_url | additional_urls | evidence |
|--------|--------|-------------|-----------------|----------|
| aws | active | https://openlinks.us/ | none | Deploy Production -> Deploy AWS Canonical Site |
| github-pages | active | https://prizz.github.io/open-links/ | canonical=https://openlinks.us/ | Deploy Production -> Deploy GitHub Pages Mirror |
OPENCLAW_DEPLOY_URLS_END

## AI-Guided Path (Optional)

If you want an AI agent workflow with explicit checkpoints and manual opt-outs, use the [AI-Guided Customization Wizard](https://raw.githubusercontent.com/pRizz/open-links/main/docs/ai-guided-customization.md). For automation-first execution paths, use [OpenClaw Bootstrap Contract](https://raw.githubusercontent.com/pRizz/open-links/main/docs/openclaw-bootstrap.md) for first-time setup and [OpenClaw Update/CRUD Contract](https://raw.githubusercontent.com/pRizz/open-links/main/docs/openclaw-update-crud.md) for day-2 changes.

Recommended flow:

1. Start with [Quickstart](https://raw.githubusercontent.com/pRizz/open-links/main/docs/quickstart.md).
2. Prefer [OpenClaw Update/CRUD Contract](https://raw.githubusercontent.com/pRizz/open-links/main/docs/openclaw-update-crud.md) or [AI-Guided Customization Wizard](https://raw.githubusercontent.com/pRizz/open-links/main/docs/ai-guided-customization.md) for routine repo-native CRUD.
3. Use [OpenLinks Studio](https://raw.githubusercontent.com/pRizz/open-links/main/docs/studio-self-serve.md) when you want the browser-based self-serve path.
4. Use [Data Model](https://raw.githubusercontent.com/pRizz/open-links/main/docs/data-model.md) and [Customization Catalog](https://raw.githubusercontent.com/pRizz/open-links/main/docs/customization-catalog.md) as the contract/reference layer.
5. Use [Social Card Verification Guide](https://raw.githubusercontent.com/pRizz/open-links/main/docs/social-card-verification.md) after changing profile-card metadata, follower history, analytics, or share behavior.

## First Production Deploy (Quick Path)

1. Push to `main`.
2. In GitHub repository settings, set Pages source to **GitHub Actions**.
3. For the upstream `openlinks.us` deploy, run `bun run deploy:setup` first, then rerun with `--apply` once the check-mode summary is clean.
4. Wait for:
   - `.github/workflows/ci.yml` to succeed.
   - `.github/workflows/deploy-pages.yml` (`Deploy Production`) to deploy.
5. Open `https://openlinks.us/` and the Pages mirror URL from the deployment job summary.

Local parity commands:

```bash
bun run ci:required
bun run ci:strict
```

Then use:

- [Deployment Operations Guide](https://raw.githubusercontent.com/pRizz/open-links/main/docs/deployment.md) for full troubleshooting and diagnostics flow.
- [OpenClaw Bootstrap Contract](https://raw.githubusercontent.com/pRizz/open-links/main/docs/openclaw-bootstrap.md) for deployment URL reporting and README marker-block updates.
- [OpenClaw Update/CRUD Contract](https://raw.githubusercontent.com/pRizz/open-links/main/docs/openclaw-update-crud.md) for existing repo update sessions and interaction-mode behavior.
- [Linktree Bootstrap Extractor](https://raw.githubusercontent.com/pRizz/open-links/main/docs/linktree-bootstrap.md) for Linktree-first bootstrap of profile/link candidates.
- [Adapter Contract Guide](https://raw.githubusercontent.com/pRizz/open-links/main/docs/adapter-contract.md) for future non-GitHub host planning.

## OpenLinks Studio (Experimental Control Plane)

This repository now includes a multi-service self-serve control plane for non-technical onboarding and browser-based CRUD edits:

- `packages/studio-web` - marketing + onboarding + editor (Solid + Tailwind + shadcn-solid style components)
- `packages/studio-api` - GitHub auth/app workflows, fork provisioning, content validation/commit, deploy status, sync endpoints
- `packages/studio-worker` - scheduled sync trigger worker
- `packages/studio-shared` - shared contracts

See [docs/studio-self-serve.md](docs/studio-self-serve.md) for local setup, Railway deployment, env variables, and GitHub App setup.
Track implementation phases in [docs/studio-phase-checklist.md](docs/studio-phase-checklist.md).

Studio workspace tooling is Bun-first:

- `bun install`
- `bun run studio:typecheck`
- `bun run studio:lint`
- `bun run studio:format`

High-signal deployment checks:

1. `required-checks` job in `.github/workflows/ci.yml` is green.
2. `Deploy AWS Canonical Site` job in `.github/workflows/deploy-pages.yml` is green when AWS deploy is enabled.
3. `Deploy GitHub Pages Mirror` job in `.github/workflows/deploy-pages.yml` is green or intentionally skipped as a no-op.
4. `Verify Production Deployment` is green when AWS deploy is enabled.
5. If deploy fails, review workflow summaries and diagnostics artifacts.

## Validation and Build Commands

### Core commands

- `bun run avatar:sync` - fetch profile avatar into `public/cache/profile-avatar/`, write the committed manifest `data/cache/profile-avatar.json`, and refresh the gitignored runtime overlay `data/cache/profile-avatar.runtime.json`.
- `bun run enrich:rich` - run non-strict rich metadata enrichment (diagnostic/manual mode) with known-blocker + authenticated-cache policy enforcement; routine runs leave `data/cache/rich-public-cache.json` unchanged and only update the local runtime overlay when needed.
- `bun run enrich:rich:write-cache` - run non-strict rich enrichment and explicitly persist refreshed public metadata into `data/cache/rich-public-cache.json`.
- `bun run enrich:rich:strict` - run policy-enforced rich metadata enrichment (blocking mode) with known-blocker + authenticated-cache policy enforcement; routine runs leave `data/cache/rich-public-cache.json` unchanged and only update the local runtime overlay when needed.
- `bun run enrich:rich:strict:write-cache` - run policy-enforced rich enrichment and explicitly persist refreshed public metadata into `data/cache/rich-public-cache.json`.
- `bun run public:rich:sync` - refresh public browser-derived Medium/X/Primal profile audience metrics into the committed stable cache at `data/cache/rich-public-cache.json` and the local runtime overlay at `data/cache/rich-public-cache.runtime.json` (non-auth, operator-invoked).
- `bun run followers:history:sync` - append the current follower/subscriber snapshots into the public CSV history files under `public/history/followers/` and refresh `public/history/followers/index.json`.
- `bun run setup:rich-auth` - first-run authenticated cache setup (captures only missing/invalid authenticated cache entries).
- `bun run auth:rich:sync` - guided authenticated rich-cache capture (updates `data/cache/rich-authenticated-cache.json` + `public/cache/rich-authenticated/*`).
- `bun run auth:rich:clear` - clear authenticated cache entries and unreferenced local assets (selector-driven; supports `--dry-run`).
- `bun run auth:extractor:new -- --id <id> --domains <csv> --summary "<summary>"` - scaffold a new authenticated extractor plugin + policy + registry wiring.
- `bun run linkedin:debug:bootstrap` - LinkedIn debug bootstrap (agent-browser checks + browser binary install check).
- `bun run linkedin:debug:login` - LinkedIn debug login watcher (autonomous auth-state polling; multi-factor authentication optional).
- `bun run linkedin:debug:validate` - LinkedIn authenticated metadata debug validator.
- `bun run linkedin:debug:validate:cookie-bridge` - LinkedIn debug validator with cookie-bridge HTTP diagnostic.
- `bun run images:sync` - fetch rich-card/SEO remote images into the committed cache at `public/cache/content-images/`, write the stable manifest `data/cache/content-images.json`, and refresh the gitignored runtime overlay `data/cache/content-images.runtime.json`.
- Cache-backed fetches are governed by the committed per-domain registry `data/policy/remote-cache-policy.json`. New remote hosts must be added there in the same change batch as link/extractor updates.
- `bun run dev` - start local dev server (predev runs strict enrichment in read-only public-cache mode and fails on blocking enrichment policy issues).
- `bun run validate:data` - schema + policy checks (standard mode).
- `bun run validate:data:strict` - fails on warnings and errors.
- `bun run validate:data:json` - machine-readable validation output.
- `bun run build` - avatar sync + strict enrichment + content-image sync + validation + production build. The strict enrichment pre-step updates only the local runtime overlay unless you intentionally ran a `*:write-cache` command beforehand; `images:sync` refreshes committed content-image cache artifacts when image bytes change.
- `bun run build:strict` - avatar sync + strict enrichment + content-image sync + strict validation + build. The strict enrichment pre-step updates only the local runtime overlay unless you intentionally ran a `*:write-cache` command beforehand; `images:sync` refreshes committed content-image cache artifacts when image bytes change.
- `bun run preview` - serve built output.
- `bun run typecheck` - TypeScript checks.

### Nightly follower history

- Workflow: `.github/workflows/nightly-follower-history.yml`
- Public artifacts:
  - `public/history/followers/*.csv`
  - `public/history/followers/index.json`
- Local parity:
  - `bun run enrich:rich:strict:write-cache`
  - `bun run public:rich:sync`
  - `bun run followers:history:sync`
  - `bun run build`
- The workflow commits directly to `main` and deploys Pages in the same run. This avoids depending on downstream workflow fan-out from a bot-authored push.

### Authenticated Cache Lifecycle

Canonical paths:

- `data/cache/rich-authenticated-cache.json`
- `public/cache/rich-authenticated/`
- `output/playwright/auth-rich-sync/`

Setup/refresh flow:

- First-run idempotent setup (only missing/invalid cache entries): `bun run setup:rich-auth`
- Targeted refresh: `bun run auth:rich:sync -- --only-link <link-id>`
- Forced refresh (even when cache is already valid): `bun run auth:rich:sync -- --only-link <link-id> --force`

Clear flow:

- Dry run clear for one link: `bun run auth:rich:clear -- --only-link <link-id> --dry-run`
- Apply clear for one link: `bun run auth:rich:clear -- --only-link <link-id>`
- Apply clear for all authenticated cache entries: `bun run auth:rich:clear -- --all`
- Recapture after clear: `bun run setup:rich-auth` (or `bun run auth:rich:sync -- --only-link <link-id>`)

### Quality commands

- `bun run quality:check` - standard quality gate.
- `bun run quality:strict` - strict quality gate.
- `bun run quality:strict:ci` - CI strict gate with advisory-only performance findings.
- `bun run quality:json` - standard quality JSON report.
- `bun run quality:strict:json` - strict quality JSON report.

### CI parity commands

- `bun run ci:required` - required CI checks.
- `bun run ci:strict` - strict CI signal checks with advisory-only performance findings.

## Data Contract Rules (High-Level)

### URL schemes

Allowed URL schemes:

- `http`
- `https`
- `mailto`
- `tel`

Payment-enabled links and payment rails additionally support:

- `bitcoin`
- `lightning`
- `ethereum`
- `solana`

### Extension namespace

Use `custom` for extension metadata:

- top-level `custom` in `profile`, `links`, and `site`
- per-link `custom` in each link object

Unknown top-level keys are allowed but warned. `custom` keys that collide with core keys fail validation.

For full data model details and examples, see [Data Model](https://raw.githubusercontent.com/pRizz/open-links/main/docs/data-model.md).

## Troubleshooting (Quick)

### Validation fails

- Re-run `bun run validate:data` and inspect path-specific remediation lines.
- Check URL schemes and required fields.
- Move extension fields into `custom` and avoid reserved-key collisions.

### Build fails

- Re-run with `bun run build` and inspect first failing command output.
- If strict mode fails, compare `bun run validate:data` vs `bun run validate:data:strict`.
- Re-run blocking enrichment diagnostics: `bun run enrich:rich:strict`.
- Check canonical blocker registry: `data/policy/rich-enrichment-blockers.json`.
- Check authenticated extractor policy: `data/policy/rich-authenticated-extractors.json`.
- Check authenticated cache manifest: `data/cache/rich-authenticated-cache.json`.
- Review known blocked rich-metadata domains and timestamped attempt history: `docs/rich-metadata-fetch-blockers.md`.
- Review authenticated extractor architecture/workflow: `docs/authenticated-rich-extractors.md`.
- Check `site.ui.richCards.enrichment` policy (`failureMode`, `failOn`, `allowManualMetadataFallback`) in `data/site.json`.
- If rich-card images look clipped, set `site.ui.richCards.imageFit=contain` (or per-link override with `links[].metadata.imageFit`).
- If a blocked domain must be tested anyway, set explicit override on that link: `links[].enrichment.allowKnownBlocker=true`.
- If `authenticated_cache_missing` is reported, run `bun run setup:rich-auth` (or `bun run auth:rich:sync -- --only-link <link-id>`) and commit cache manifest/assets.
- To reset stale/bad authenticated cache data, clear entries first with `bun run auth:rich:clear -- --only-link <link-id>` (or `--all`), then recapture with `bun run setup:rich-auth`.
- If `metadata_missing` is blocking, add at least one manual field under `links[].metadata` (`title`, `description`, or `image`) or remediate remote OG/Twitter metadata.
- If a manual or enriched rich-link image changed, run `bun run images:sync` and commit `data/cache/content-images.json` plus `public/cache/content-images/*` when they update.
- Temporary emergency bypass (local only): `OPENLINKS_RICH_ENRICHMENT_BYPASS=1 bun run build`.
- Force-refresh avatar cache when needed: `bun run avatar:sync -- --force` (or set `OPENLINKS_AVATAR_FORCE=1`).
- Force-refresh rich/SEO image cache when needed: `bun run images:sync -- --force` (or set `OPENLINKS_IMAGES_FORCE=1`).

### Pages deploy fails

- Confirm CI passed on `main`.
- Confirm Pages source is GitHub Actions.
- Check deploy workflow summary for remediation notes.
- Verify base-path settings if publishing from a project page.

## Docs Map

- [Quickstart](https://raw.githubusercontent.com/pRizz/open-links/main/docs/quickstart.md)
- [OpenClaw Bootstrap Contract](https://raw.githubusercontent.com/pRizz/open-links/main/docs/openclaw-bootstrap.md)
- [OpenClaw Update/CRUD Contract](https://raw.githubusercontent.com/pRizz/open-links/main/docs/openclaw-update-crud.md)
- [Agent Triage Contract](https://raw.githubusercontent.com/pRizz/open-links/main/AGENTS.md)
- [Customization Catalog](https://raw.githubusercontent.com/pRizz/open-links/main/docs/customization-catalog.md)
- [Data Model](https://raw.githubusercontent.com/pRizz/open-links/main/docs/data-model.md)
- [Payment Card Effect Samples](https://raw.githubusercontent.com/pRizz/open-links/main/docs/payment-card-effect-samples.md)
- [Rich Metadata Fetch Blockers](https://raw.githubusercontent.com/pRizz/open-links/main/docs/rich-metadata-fetch-blockers.md)
- [Rich Enrichment Blockers Registry](https://raw.githubusercontent.com/pRizz/open-links/main/docs/rich-enrichment-blockers-registry.md)
- [Authenticated Rich Extractors](https://raw.githubusercontent.com/pRizz/open-links/main/docs/authenticated-rich-extractors.md)
- [Create New Rich Content Extractor](https://raw.githubusercontent.com/pRizz/open-links/main/docs/create-new-rich-content-extractor.md)
- [LinkedIn Authenticated Metadata Debug Runbook](https://raw.githubusercontent.com/pRizz/open-links/main/docs/linkedin-authenticated-metadata-debug-runbook.md)
- [Repo Skill: OpenLinks Fork Identity Presence](skills/openlinks-fork-identity-presence/SKILL.md)
- [Repo Skill: Cache Rich Link Assets](skills/cache-rich-link-assets/SKILL.md)
- [Repo Skill: Create New Rich Content Extractor](skills/create-new-rich-content-extractor/SKILL.md)
- [AI-Guided Customization Wizard](https://raw.githubusercontent.com/pRizz/open-links/main/docs/ai-guided-customization.md)
- [Theming and Layout Extensibility](https://raw.githubusercontent.com/pRizz/open-links/main/docs/theming-and-layouts.md)
- [Deployment Operations Guide](https://raw.githubusercontent.com/pRizz/open-links/main/docs/deployment.md)
- [Adapter Contract Guide](https://raw.githubusercontent.com/pRizz/open-links/main/docs/adapter-contract.md)

## Repository Structure

- `data/` - source content JSON and generated artifacts.
- `schema/` - JSON schemas.
- `scripts/` - validation, enrichment, and quality runners.
- `src/` - SolidJS app.
- `.github/workflows/` - CI and deploy automation.
- `.planning/` - project planning and phase artifacts.

## Contributions and Feedback

If extractor workflows helped you build new or improved extractors, kindly consider opening a pull request against https://github.com/pRizz/open-links so everyone can benefit.
Feedback on extractor workflows and docs is appreciated.

## License

MIT (see `LICENSE`).
