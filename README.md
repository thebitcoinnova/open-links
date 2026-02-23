# OpenLinks

OpenLinks is a personal, free, open source, version-controlled static website generator for social links.

This project is developer-first: fork or template the repo, edit JSON, push, and publish.

## Why OpenLinks

- Static SolidJS site with minimal runtime complexity.
- Version-controlled content in `data/*.json`.
- Schema + policy validation with actionable remediation output.
- Rich and simple card support with build-time enrichment.
- Build-time profile-avatar materialization with local fallback behavior.
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

For full walkthrough and troubleshooting, see [Quickstart](docs/quickstart.md).

### 1) Create your own repository

Use one of:

1. Fork this repository.
2. Use this repository as a template.

### 2) Clone and install

```bash
git clone <your-repo-url>
cd open-links
npm install
```

### 3) Update your data

Edit these files:

- `data/profile.json` - identity and profile details.
- `data/links.json` - simple/rich links, groups, ordering.
- `data/site.json` - theme, UI, quality, and deployment-related config.

Starter presets:

- `data/examples/minimal/`
- `data/examples/grouped/`
- `data/examples/invalid/` (intentional failures for testing)

### 4) Validate and run locally

```bash
npm run validate:data
npm run dev
```

### 5) Build production output

```bash
npm run build
npm run preview
```

## AI-Guided Path (Optional)

If you want an AI agent to drive setup and updates with opt-out checkpoints, use the [AI-Guided Customization Wizard](docs/ai-guided-customization.md).

Recommended flow:

1. Start with [Quickstart](docs/quickstart.md).
2. Use [Data Model](docs/data-model.md) while shaping content.
3. Run the AI wizard to automate repeatable CRUD updates.

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

- [Deployment Operations Guide](docs/deployment.md) for full troubleshooting and diagnostics flow.
- [Adapter Contract Guide](docs/adapter-contract.md) for future non-GitHub host planning.

High-signal deployment checks:

1. `required-checks` job in `.github/workflows/ci.yml` is green.
2. `deploy` job in `.github/workflows/deploy-pages.yml` is green.
3. Deploy summary includes a published URL.
4. If deploy fails, review workflow summary remediation and diagnostics artifacts.

## Validation and Build Commands

### Core commands

- `npm run avatar:sync` - fetch profile avatar into `public/generated/` and write `data/generated/profile-avatar.json`.
- `npm run dev` - start local dev server.
- `npm run validate:data` - schema + policy checks (standard mode).
- `npm run validate:data:strict` - fails on warnings and errors.
- `npm run validate:data:json` - machine-readable validation output.
- `npm run build` - avatar sync + enrichment + validation + production build.
- `npm run build:strict` - avatar sync + strict enrichment + strict validation + build.
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

### Extension namespace

Use `custom` for extension metadata:

- top-level `custom` in `profile`, `links`, and `site`
- per-link `custom` in each link object

Unknown top-level keys are allowed but warned. `custom` keys that collide with core keys fail validation.

For full data model details and examples, see [Data Model](docs/data-model.md).

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

### Pages deploy fails

- Confirm CI passed on `main`.
- Confirm Pages source is GitHub Actions.
- Check deploy workflow summary for remediation notes.
- Verify base-path settings if publishing from a project page.

## Docs Map

- [Quickstart](docs/quickstart.md)
- [Data Model](docs/data-model.md)
- [AI-Guided Customization Wizard](docs/ai-guided-customization.md)
- [Theming and Layout Extensibility](docs/theming-and-layouts.md)
- [Deployment Operations Guide](docs/deployment.md)
- [Adapter Contract Guide](docs/adapter-contract.md)

## Repository Structure

- `data/` - source content JSON and generated artifacts.
- `schema/` - JSON schemas.
- `scripts/` - validation, enrichment, and quality runners.
- `src/` - SolidJS app.
- `.github/workflows/` - CI and deploy automation.
- `.planning/` - project planning and phase artifacts.

## License

MIT (see `LICENSE`).
