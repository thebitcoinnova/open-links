# Deployment Operations Guide

This guide covers OpenLinks deployment behavior, diagnostics, and troubleshooting.

Primary supported target in v1:

- GitHub Pages via GitHub Actions workflows in this repository.

## Deployment Architecture

OpenLinks deployment uses a two-workflow model:

1. CI workflow validates and builds.
2. Deploy workflow publishes `dist` to GitHub Pages.

### Workflow files

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-pages.yml`

### Artifact contract

CI publishes build artifact:

- `openlinks-dist`

Deploy workflow behavior:

- tries artifact reuse first,
- rebuilds as fallback if artifact is unavailable.

## Pre-Deploy Checklist

Before expecting a successful deploy:

- [ ] `main` branch contains your latest content.
- [ ] `npm run ci:required` passes locally.
- [ ] GitHub Pages source is set to GitHub Actions.
- [ ] `data/site.json` validates and builds.
- [ ] Required CI checks are passing in GitHub.

## Standard Deploy Flow (GitHub Pages)

### Step 1: Push to `main`

```bash
git add data/profile.json data/links.json data/site.json
git commit -m "docs: update OpenLinks content"
git push
```

### Step 2: Verify CI workflow

In GitHub Actions:

- open CI run (`CI` workflow),
- confirm `Required Checks` succeeded,
- check whether `openlinks-dist` artifact was uploaded.

### Step 3: Verify deploy workflow

`Deploy Pages` should run automatically after successful CI workflow run on `main`.

Confirm:

- deploy job status is success,
- deployment step produced a URL,
- URL serves your updated content.

## Manual Deploy Dispatch

`Deploy Pages` supports manual dispatch with inputs:

- `base_mode` (`project`, `root`, `auto`)
- `base_path` (explicit path, must start/end with `/`)
- `repo_name_override` (optional repository name override)

Use manual dispatch when:

- you need to test path behavior,
- CI artifact was missing and you want rebuild fallback,
- troubleshooting environment/path assumptions.

## Base Path Behavior

Base path resolution is controlled by `vite.config.ts` and workflow env vars.

### Modes

- `project`: publish under `/<repo-name>/` (default Pages project mode)
- `root`: publish under `/`
- `auto`: project mode in GitHub Actions, root mode locally

### Local parity checks

Project mode (default):

```bash
npm run build
```

Root mode test:

```bash
PAGES_BASE_MODE=root npm run build
```

Explicit path test:

```bash
BASE_PATH=/custom-links/ npm run build
```

## Diagnostics Command Flow

Run these in order when troubleshooting deployment failures:

```bash
npm run validate:data
npm run typecheck
npm run build
npm run quality:check
```

Then strict parity:

```bash
npm run ci:required
npm run ci:strict
```

If required lane fails locally, resolve before re-running CI.

## CI and Deploy Diagnostics Artifacts

On failures, workflows emit diagnostic artifacts.

### CI workflow artifacts

- `ci-diagnostics-required` (required lane failures)
- `ci-diagnostics-strict` (strict lane warnings/failures)

### Deploy workflow artifacts

- `deploy-pages-diagnostics` (deployment failure context)

Also inspect workflow step summaries for remediation suggestions.

## Symptom -> Fix Matrix

| Symptom | Likely Cause | Fix |
|--------|--------------|-----|
| CI fails on `validate:data` | schema/policy mismatch in `data/*.json` | run `npm run validate:data`, fix path-specific errors, commit |
| CI fails on `build` | enrichment/validation/build issue | run `npm run build` locally, fix first failing command |
| CI strict lane reports warnings | strict mode escalates warnings | run `npm run ci:strict`, resolve warning-level issues |
| Deploy workflow does not trigger | CI did not succeed on `main` | ensure successful CI run on `main`, then re-push or re-run |
| Deploy fails: invalid `base_path` | missing leading/trailing slash | use `/value/` format in manual dispatch |
| Deployed page loads without CSS/JS | base path mismatch | test `PAGES_BASE_MODE`/`BASE_PATH`, rebuild and redeploy |
| Deploy artifact missing | CI artifact unavailable | manual dispatch deploy to use rebuild fallback |
| Pages URL shows stale content | older deploy finished after newer push | re-run deploy, verify latest commit SHA in workflow |

## Failure Triage Playbook

When deployment fails:

1. Identify failing workflow and failing step.
2. Read step summary first.
3. Download diagnostics artifact if available.
4. Reproduce using local parity command.
5. Apply smallest fix.
6. Re-run affected workflow.

## Quick References

### Validation and quality

- `scripts/validate-data.ts`
- `scripts/quality/run-quality-checks.ts`

### Build and base-path config

- `vite.config.ts`

### Workflows

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-pages.yml`

## Known Support Boundary (v1)

Supported and tested path:

- GitHub Actions + GitHub Pages

Not first-class in v1:

- direct adapter implementations for non-GitHub hosts
- custom-domain automation tooling

Those are documented as future-facing guidance in `docs/adapter-contract.md`.

## Related Docs

- `README.md`
- `docs/quickstart.md`
- `docs/adapter-contract.md`

## Advanced Static Hosting (Best-Effort)

These options are possible for adventurous maintainers, but they are not first-class supported in v1.

### General approach

1. Build locally or in CI:

```bash
npm run validate:data
npm run build
```

2. Upload `dist/` to your chosen static host.
3. Configure host path behavior to match your base-path strategy.
4. Validate loaded assets, canonical metadata, and link behavior.

### AWS S3 + CloudFront (high-level)

- Upload contents of `dist/` to an S3 bucket.
- Configure CloudFront origin to that bucket.
- Handle SPA/static path behavior with index/error document settings.
- Invalidate cache after deploy.

### Cloudflare Pages (high-level)

- Configure build command (`npm run build`) and output dir (`dist`).
- Ensure environment and path assumptions match your repo mode.
- Validate route and asset loading for project vs root paths.

### Netlify (high-level)

- Configure build command (`npm run build`) and publish dir (`dist`).
- Use redirects/headers only when needed.
- Confirm generated metadata and image paths remain valid.

### Railway/static hosting variants (high-level)

- Publish static `dist/` output using platform static-site settings.
- Ensure fallback route behavior does not break asset serving.
- Verify HTTPS endpoint and cache refresh behavior after updates.

## Provisional Custom-Domain Guidance (v1)

Custom domains are possible, but support in v1 is documentation-level only.

Recommended baseline regardless of host:

1. Configure DNS to point to your host endpoint.
2. Enable HTTPS certificate management on the host/CDN.
3. Update canonical metadata base URL in `data/site.json` under `quality.seo.canonicalBaseUrl`.
4. Re-run:

```bash
npm run build
npm run quality:check
```

5. Validate social preview and canonical URLs in deployed output.

Caveats:

- DNS propagation delays can look like deploy failures.
- Cached metadata previews may lag after domain changes.
- Host-specific domain validation steps vary and are not standardized here.
