# OpenLinks

[![GitHub Stars](https://img.shields.io/github/stars/pRizz/open-links)](https://github.com/pRizz/open-links)
[![CI](https://github.com/pRizz/open-links/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pRizz/open-links/actions/workflows/ci.yml)
[![Deploy Pages](https://github.com/pRizz/open-links/actions/workflows/deploy-pages.yml/badge.svg?branch=main)](https://github.com/pRizz/open-links/actions/workflows/deploy-pages.yml)
[![License](https://img.shields.io/github/license/pRizz/open-links?s)](https://github.com/pRizz/open-links/blob/main/LICENSE)
[![Node.js 22](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)](https://github.com/pRizz/open-links/blob/main/.github/workflows/ci.yml)
[![TypeScript 5.9](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SolidJS 1.9](https://img.shields.io/badge/SolidJS-1.9-2C4F7C?logo=solid&logoColor=white)](https://www.solidjs.com/)
[![Vite 7.3](https://img.shields.io/badge/Vite-7.3-646CFF?logo=vite&logoColor=white)](https://vite.dev/)

OpenLinks is a personal, free, open source, version-controlled static website generator for social links.

This project is developer-first: fork or template the repo, edit JSON, push, and publish.

## Why OpenLinks

- Static SolidJS site with minimal runtime complexity.
- Version-controlled content in `data/*.json`.
- Schema + policy validation with actionable remediation output.
- Rich and simple card support with build-time enrichment.
- Payments and tips links with multi-rail support, styled QR codes, and fullscreen scan mode.
- Build-time profile-avatar materialization with local fallback behavior.
- Build-time rich/SEO image materialization with local-only runtime behavior.
- GitHub Actions CI + GitHub Pages deploy pipeline already wired.
- Theme and layout controls designed for forking and customization.
- Data-driven typography overrides via `data/site.json` (`ui.typography`).

## Scope and Audience

### Intended audience

- Developers who are comfortable editing JSON and markdown.
- Maintainers using AI agents to automate content updates.

### Out of scope for v1

- User auth/account system.
- CMS or WYSIWYG editor.
- Built-in analytics.
- Plugin marketplace.

## Quickstart

For full walkthrough and troubleshooting, see [Quickstart](https://raw.githubusercontent.com/pRizz/open-links/main/docs/quickstart.md).

### 1) OpenClaw Bootstrap (Recommended)

Paste this one-liner into your OpenClaw instance:

```text
Follow docs/openclaw-bootstrap.md exactly for this repository. Execute Required Execution Policy, End-to-End OpenClaw Sequence, Automation and Identity Confirmation Rule, Social Discovery and Inference Contract, Deployment Verification Contract, Structured URL Reporting Schema, README Deploy URL Marker-Block Contract, and Final Output Contract exactly as written. If an existing setup is detected, ask the single route-confirmation and switch to docs/openclaw-update-crud.md when selected.
```

Use this path when this is the first setup for a new fork or local clone.

### 2) OpenClaw Update/CRUD (Existing Fork or Local Repo)

Paste this one-liner into your OpenClaw instance:

```text
Follow docs/openclaw-update-crud.md exactly for this repository. Execute Required Startup Handshake (including conditional customization-audit selectors), Defaults, Customization Audit Path (Optional), Repository Resolution, Dirty Local Repository Handling, Interaction Modes, Identity and Discovery Policy, Update/CRUD Execution Sequence, Final Output Contract, and Required reason codes exactly as written. When customization_path=customization-audit, use docs/customization-catalog.md as the checklist source.
```

Use this path for day-2 maintenance when the user likely already has a fork and/or local clone.

### 3) Create your own repository (Manual Path)

Use one of:

1. Fork this repository.
2. Use this repository as a template.

### 4) Clone and install

```bash
git clone <your-repo-url>
cd open-links
npm install
```

### 5) Update your data

Edit these files:

- `data/profile.json` - identity and profile details.
- `data/links.json` - simple/rich/payment links, groups, ordering.
- `data/site.json` - theme, UI, quality, and deployment-related config.

Starter presets:

- `data/examples/minimal/`
- `data/examples/grouped/`
- `data/examples/invalid/` (intentional failures for testing)

### 6) Validate and run locally

```bash
npm run validate:data
npm run dev
```

### 7) Build production output

```bash
npm run build
npm run preview
```

## OpenClaw Deployment URLs

OpenClaw should update only the rows between the exact marker lines below:

- rewrite only marker-bounded rows,
- commit only if normalized URL/status values changed.

OPENCLAW_DEPLOY_URLS_START
| target | status | primary_url | additional_urls | evidence |
|--------|--------|-------------|-----------------|----------|
| github-pages | pending | TBD | none | waiting for first successful deploy |
OPENCLAW_DEPLOY_URLS_END

## AI-Guided Path (Optional)

If you want an AI agent workflow with explicit checkpoints and manual opt-outs, use the [AI-Guided Customization Wizard](https://raw.githubusercontent.com/pRizz/open-links/main/docs/ai-guided-customization.md). For automation-first execution paths, use [OpenClaw Bootstrap Contract](https://raw.githubusercontent.com/pRizz/open-links/main/docs/openclaw-bootstrap.md) for first-time setup and [OpenClaw Update/CRUD Contract](https://raw.githubusercontent.com/pRizz/open-links/main/docs/openclaw-update-crud.md) for day-2 changes.

Recommended flow:

1. Start with [Quickstart](https://raw.githubusercontent.com/pRizz/open-links/main/docs/quickstart.md).
2. Use [Data Model](https://raw.githubusercontent.com/pRizz/open-links/main/docs/data-model.md) while shaping content.
3. Use [Customization Catalog](https://raw.githubusercontent.com/pRizz/open-links/main/docs/customization-catalog.md) for complete day-2 data-driven audits.
4. Run the AI wizard to automate repeatable CRUD updates.

## First GitHub Pages Deploy (Quick Path)

1. Push to `main`.
2. In GitHub repository settings, set Pages source to **GitHub Actions**.
3. Wait for:
   - `.github/workflows/ci.yml` to succeed.
   - `.github/workflows/deploy-pages.yml` to deploy.
4. Open the published Pages URL from the deployment job.

Local parity commands:

```bash
npm run ci:required
npm run ci:strict
```

Then use:

- [Deployment Operations Guide](https://raw.githubusercontent.com/pRizz/open-links/main/docs/deployment.md) for full troubleshooting and diagnostics flow.
- [OpenClaw Bootstrap Contract](https://raw.githubusercontent.com/pRizz/open-links/main/docs/openclaw-bootstrap.md) for deployment URL reporting and README marker-block updates.
- [OpenClaw Update/CRUD Contract](https://raw.githubusercontent.com/pRizz/open-links/main/docs/openclaw-update-crud.md) for existing repo update sessions and interaction-mode behavior.
- [Adapter Contract Guide](https://raw.githubusercontent.com/pRizz/open-links/main/docs/adapter-contract.md) for future non-GitHub host planning.

High-signal deployment checks:

1. `required-checks` job in `.github/workflows/ci.yml` is green.
2. `deploy` job in `.github/workflows/deploy-pages.yml` is green.
3. Deploy summary includes a published URL.
4. If deploy fails, review workflow summary remediation and diagnostics artifacts.

## Validation and Build Commands

### Core commands

- `npm run avatar:sync` - fetch profile avatar into `public/generated/` and write `data/generated/profile-avatar.json`.
- `npm run images:sync` - fetch rich-card/SEO remote images into `public/generated/images/` and write `data/generated/content-images.json`.
- `npm run dev` - start local dev server.
- `npm run validate:data` - schema + policy checks (standard mode).
- `npm run validate:data:strict` - fails on warnings and errors.
- `npm run validate:data:json` - machine-readable validation output.
- `npm run build` - avatar sync + enrichment + content-image sync + validation + production build.
- `npm run build:strict` - avatar sync + strict enrichment + content-image sync + strict validation + build.
- `npm run preview` - serve built output.
- `npm run typecheck` - TypeScript checks.

### Quality commands

- `npm run quality:check` - standard quality gate.
- `npm run quality:strict` - strict quality gate.
- `npm run quality:json` - standard quality JSON report.
- `npm run quality:strict:json` - strict quality JSON report.

### CI parity commands

- `npm run ci:required` - required CI checks.
- `npm run ci:strict` - strict CI signal checks.

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

- Re-run `npm run validate:data` and inspect path-specific remediation lines.
- Check URL schemes and required fields.
- Move extension fields into `custom` and avoid reserved-key collisions.

### Build fails

- Re-run with `npm run build` and inspect first failing command output.
- If strict mode fails, compare `npm run validate:data` vs `npm run validate:data:strict`.
- Re-run rich enrichment: `npm run enrich:rich`.
- Force-refresh avatar cache when needed: `npm run avatar:sync -- --force` (or set `OPENLINKS_AVATAR_FORCE=1`).
- Force-refresh rich/SEO image cache when needed: `npm run images:sync -- --force` (or set `OPENLINKS_IMAGES_FORCE=1`).

### Pages deploy fails

- Confirm CI passed on `main`.
- Confirm Pages source is GitHub Actions.
- Check deploy workflow summary for remediation notes.
- Verify base-path settings if publishing from a project page.

## Docs Map

- [Quickstart](https://raw.githubusercontent.com/pRizz/open-links/main/docs/quickstart.md)
- [OpenClaw Bootstrap Contract](https://raw.githubusercontent.com/pRizz/open-links/main/docs/openclaw-bootstrap.md)
- [OpenClaw Update/CRUD Contract](https://raw.githubusercontent.com/pRizz/open-links/main/docs/openclaw-update-crud.md)
- [Customization Catalog](https://raw.githubusercontent.com/pRizz/open-links/main/docs/customization-catalog.md)
- [Data Model](https://raw.githubusercontent.com/pRizz/open-links/main/docs/data-model.md)
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

## License

MIT (see `LICENSE`).
