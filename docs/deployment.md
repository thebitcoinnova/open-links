# Deployment Operations Guide

This guide covers OpenLinks production deployment behavior, diagnostics, and operator flows.

## Supported Targets

- `aws`: canonical production site at `https://openlinks.us/`
- `github-pages`: public noindex mirror at `https://<owner>.github.io/<repo>/`

Forks inherit the workflow and scripts, but AWS stays dormant until the fork owner explicitly opts in with `OPENLINKS_ENABLE_AWS_DEPLOY=true`, `AWS_DEPLOY_ROLE_ARN`, and their own tracked deploy config changes.

## Deployment Architecture

OpenLinks uses a CI-gated two-workflow model:

1. `.github/workflows/ci.yml` runs required checks and builds target-aware deploy artifacts on every successful push to `main`.
2. `.github/workflows/deploy-pages.yml` (`Deploy Production`) consumes those artifacts, deploys AWS when enabled, deploys the GitHub Pages mirror only when its live manifest differs, and runs post-deploy verification when AWS is enabled.

### Artifact contract

CI publishes:

- `deploy-aws-site`
- `deploy-pages-site`

Each artifact is built under `.artifacts/deploy/<target>` and includes:

- `deploy-manifest.json`
- `.nojekyll`
- target-aware `robots.txt`
- target-aware asset-path assertions

## Operator Commands

All mutating deploy commands default to check mode. Add `--apply` to make changes.

```bash
bun run deploy:build
bun run deploy:setup
bun run deploy:aws:bootstrap
bun run deploy:aws:publish --artifact=.artifacts/deploy/aws
bun run deploy:pages:plan --artifact=.artifacts/deploy/github-pages
bun run deploy:verify
```

Use the narrower setup entrypoints when needed:

- `bun run deploy:setup:aws`
- `bun run deploy:setup:github`

### Recommended first-run sequence for `openlinks.us`

```bash
bun run deploy:build
bun run deploy:setup
bun run deploy:aws:bootstrap
bun run deploy:aws:publish --artifact=.artifacts/deploy/aws
bun run deploy:pages:plan --artifact=.artifacts/deploy/github-pages
```

Rerun the mutating steps with `--apply` only after the check-mode summaries look correct.

## Standard Deploy Flow

### Step 1: Push to `main`

```bash
git add data/profile.json data/links.json data/site.json
git commit -m "docs: update OpenLinks content"
git push
```

### Step 2: Verify CI

In GitHub Actions:

- open the `CI` workflow run,
- confirm `Required Checks` succeeded,
- confirm `deploy-aws-site` and `deploy-pages-site` were uploaded on `main`.

### Step 3: Verify Deploy Production

`Deploy Production` should run automatically after successful CI on `main`.

Confirm:

- `Deploy AWS Canonical Site` succeeded when AWS deploy is enabled,
- `Deploy GitHub Pages Mirror` succeeded or intentionally skipped as a no-op,
- `Verify Production Deployment` succeeded when AWS deploy is enabled,
- `https://openlinks.us/` serves the current build,
- the GitHub Pages mirror serves and canonicalizes to `https://openlinks.us/`.

## Manual Dispatch

`Deploy Production` still supports `workflow_dispatch`, but it is now config-driven.

- No base-path inputs are required.
- Dispatching on `main` builds fresh deploy artifacts inside the workflow.
- AWS still runs only when the opt-in variable and secret are present.

## URL Reporting Contract (OpenClaw)

After a successful upstream deploy, OpenClaw should report:

| target | status | primary_url | additional_urls | evidence |
|--------|--------|-------------|-----------------|----------|
| aws | success/warning/failed | `https://openlinks.us/` | `none` | `deploy-pages.yml -> Deploy AWS Canonical Site` |
| github-pages | success/warning/failed | `<pages-url>` | `canonical=https://openlinks.us/` | `deploy-pages.yml -> Deploy GitHub Pages Mirror` |

Forks without AWS opt-in may report only the `github-pages` row.

## Diagnostics Artifacts

### CI workflow artifacts

- `ci-diagnostics-required`
- `ci-diagnostics-strict`

### Deploy workflow artifacts

- `deploy-production-aws-diagnostics`
- `deploy-production-pages-diagnostics`
- `deploy-production-verify-diagnostics`

### Nightly workflow artifact

- `nightly-deploy-diagnostics`

Also inspect workflow step summaries and `.codex/logs/deploy/` when running locally.

## Symptom -> Fix Matrix

| Symptom | Likely Cause | Fix |
|--------|--------------|-----|
| `deploy:setup:aws` blocks in check mode | Route 53 hosted zone for `openlinks.us` is not ready | finish hosted-zone/delegation setup, then rerun check mode |
| AWS job is skipped in GitHub Actions | `OPENLINKS_ENABLE_AWS_DEPLOY` or `AWS_DEPLOY_ROLE_ARN` is missing | run `bun run deploy:setup:github --apply` or set the repo variable/secret manually |
| Pages job skips as a no-op | live mirror manifest already matches the built artifact | no action needed |
| `deploy:verify` blocks on DNS readiness | apex alias record has not propagated yet | wait for Route 53 + CloudFront propagation, then rerun |
| Deploy workflow does not trigger | CI did not succeed on `main` | fix CI first, then push or manually dispatch `Deploy Production` |
| Deploy artifact is missing | CI did not build/upload the deploy artifacts | rerun CI on `main` or manually dispatch `Deploy Production` |

## Related Docs

- `README.md`
- `docs/quickstart.md`
- `docs/openclaw-bootstrap.md`
- `docs/openclaw-update-crud.md`
