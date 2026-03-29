# Deployment Operations Guide

This guide covers OpenLinks public-site deployment behavior, diagnostics, and operator flows across all supported targets.

## Supported Targets

- `aws`: canonical upstream production site at `https://openlinks.us/`
- `github-pages`: default fork-safe public site or mirror at `https://<owner>.github.io/<repo>/`
- `render`: provider-native static-site target driven by `render.yaml`
- `railway`: provider-native GitHub deploy target driven by `railway.toml`

Only one public host should be primary at a time. The primary host is indexable. Every other host must noindex and canonicalize to the primary host.

Fork-safe default:

- GitHub Pages remains the primary host until the fork owner explicitly promotes Render, Railway, or a custom domain.

## Deployment Architecture

OpenLinks now uses two deployment models:

1. GitHub Actions-managed upstream deploys for AWS + GitHub Pages:
   - `.github/workflows/ci.yml` runs required checks and builds target-aware deploy artifacts on successful pushes.
   - `.github/workflows/deploy-pages.yml` (`Deploy Production`) consumes those artifacts, deploys AWS when enabled, deploys the GitHub Pages mirror when needed, and runs post-deploy verification when AWS is enabled.
2. Provider-native fork deploys for Render + Railway:
   - Render reads `render.yaml`, builds `.artifacts/deploy/render`, and publishes it as a static site.
   - Railway reads `railway.toml`, builds `.artifacts/deploy/railway`, and serves that artifact through the checked-in Bun static server.
   - Both provider-native targets should be configured to wait for GitHub CI before deploying.

## Primary-Host Contract

Primary-host selection is controlled by:

- `OPENLINKS_PRIMARY_CANONICAL_ORIGIN` at build time, and
- tracked `data/site.json` `quality.seo.canonicalBaseUrl` once a host has been promoted.

Target behavior is dynamic:

- if a target's public URL matches the primary canonical origin, it is indexable;
- otherwise it is treated as a mirror and emits `noindex, nofollow`.

## Artifact Contract

Target-aware artifacts are built under `.artifacts/deploy/<target>` and include:

- `deploy-manifest.json`
- `.nojekyll`
- target-aware `robots.txt`
- target-aware `build-info.json`
- target-aware asset-path assertions

The provider-native targets publish those checked artifacts directly:

- Render publishes `.artifacts/deploy/render`
- Railway serves `.artifacts/deploy/railway`

## Operator Commands

All mutating setup commands default to check mode. Add `--apply` to write tracked changes.

### Existing AWS + Pages flow

```bash
bun run deploy:build
bun run deploy:setup
bun run deploy:aws:bootstrap
bun run deploy:aws:publish --artifact=.artifacts/deploy/aws
bun run deploy:pages:plan --artifact=.artifacts/deploy/github-pages
bun run deploy:verify
```

### Provider-native fork targets

```bash
bun run deploy:build:render
bun run deploy:build:railway
bun run deploy:setup:render
bun run deploy:setup:railway
bun run deploy:verify:live -- --target=render --public-origin=https://<service>.onrender.com
bun run deploy:verify:live -- --target=railway --public-origin=https://<service>.up.railway.app
bun run deploy:readme:urls:update -- --target=render --primary-url=https://<service>.onrender.com --additional-urls=canonical=https://<primary-host> --evidence="Render -> live /build-info.json"
```

Use the provider-specific guides for full first-run steps:

- `docs/deployment-render.md`
- `docs/deployment-railway.md`

## Standard Flows

### Upstream `openlinks.us`

1. Push to `main`.
2. Verify `.github/workflows/ci.yml` succeeded and uploaded `deploy-aws-site` plus `deploy-pages-site`.
3. Verify `.github/workflows/deploy-pages.yml` (`Deploy Production`) succeeded.
4. Confirm:
   - `Deploy AWS Canonical Site` succeeded when AWS deploy is enabled.
   - `Deploy GitHub Pages Mirror` succeeded or intentionally skipped as a no-op.
   - `Verify Production Deployment` succeeded when AWS deploy is enabled.

### Fork default: GitHub Pages primary

1. Push to `main`.
2. Open the fork’s **Actions** tab. If GitHub shows **Workflows aren’t being run on this forked repository**, click **Enable workflows** once.
3. If you enabled workflows after the first setup push, push again (an empty commit is fine) so GitHub has a fresh `main` push event to run.
4. In GitHub repository settings, set Pages source to **GitHub Actions**.
5. Verify `.github/workflows/ci.yml` succeeded.
6. Verify `.github/workflows/deploy-pages.yml` published the Pages site.
7. Confirm the live Pages URL serves the current build.

### Fork optional: Render or Railway

1. Keep GitHub Actions CI enabled on `main`.
2. Connect the repo to the provider using the checked-in config file.
3. Enable the provider's "wait for CI" / equivalent gate.
4. Generate the provider public URL.
5. Run the matching setup script in apply mode with `--public-origin=...`.
6. Add `--promote-primary` only when you want that provider URL to become the canonical host.
7. Verify the live provider URL with `bun run deploy:verify:live`.

## URL Reporting Contract (OpenClaw)

Use the same stable schema across all targets:

| target | status | primary_url | additional_urls | evidence |
|--------|--------|-------------|-----------------|----------|
| aws | success/warning/failed | `https://openlinks.us/` | `none` | `deploy-pages.yml -> Deploy AWS Canonical Site` |
| github-pages | success/warning/failed | `<pages-url>` | `none` or `canonical=<primary-host>` | `deploy-pages.yml -> Deploy GitHub Pages Mirror` |
| render | success/warning/failed | `<render-url>` | `none` or `canonical=<primary-host>` | `Render -> live /build-info.json` |
| railway | success/warning/failed | `<railway-url>` | `none` or `canonical=<primary-host>` | `Railway -> live /build-info.json` |

Forks should report:

- `github-pages` by default
- `render` when configured
- `railway` when configured
- `aws` only when the fork explicitly opted into the upstream AWS flow

## Diagnostics

### GitHub Actions artifacts

- `ci-diagnostics-required`
- `ci-diagnostics-strict`
- `deploy-production-aws-diagnostics`
- `deploy-production-pages-diagnostics`
- `deploy-production-verify-diagnostics`

### Provider-native diagnostics

- Render deploy logs in the Render dashboard
- Railway deploy logs in the Railway dashboard
- live `build-info.json` at the deployed public URL
- local `.codex/logs/deploy/` summaries for `deploy:setup:*`, `deploy:build:*`, and `deploy:verify*`

## Symptom -> Fix Matrix

| Symptom | Likely Cause | Fix |
|--------|--------------|-----|
| `deploy:setup:aws` blocks in check mode | Route 53 hosted zone for `openlinks.us` is not ready | finish hosted-zone/delegation setup, then rerun check mode |
| AWS job is skipped in GitHub Actions | `OPENLINKS_ENABLE_AWS_DEPLOY` or `AWS_DEPLOY_ROLE_ARN` is missing | run `bun run deploy:setup:github --apply` or set the repo variable/secret manually |
| Pages job skips as a no-op | live mirror manifest already matches the built artifact | no action needed |
| Render or Railway stays `noindex` after promotion | tracked primary canonical origin still points at GitHub Pages or another host | rerun the matching setup script with `--apply --public-origin=<live-url> --promote-primary`, commit, and let the provider redeploy |
| Render or Railway row is missing from README | provider URL was not registered after first deploy | run `bun run deploy:setup:render -- --apply --public-origin=<live-url>` or `bun run deploy:setup:railway -- --apply --public-origin=<live-url>` |
| Fresh fork shows zero workflow runs and Pages stays on GitHub 404 | GitHub has not enabled workflows for the fork yet | open the fork’s **Actions** tab, click **Enable workflows**, then push again on `main` |
| `deploy:verify` blocks on DNS readiness | apex alias record has not propagated yet | wait for Route 53 + CloudFront propagation, then rerun |
| Deploy workflow does not trigger | CI did not succeed on `main` | fix CI first, then push or manually dispatch `Deploy Production` |
| Deploy artifact is missing | CI did not build/upload the deploy artifacts | rerun CI on `main` or manually dispatch `Deploy Production` |

## Related Docs

- `README.md`
- `docs/quickstart.md`
- `docs/deployment-render.md`
- `docs/deployment-railway.md`
- `docs/openclaw-bootstrap.md`
- `docs/openclaw-update-crud.md`
