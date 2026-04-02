# Deployment Operations Guide

This guide covers the config-driven deployment system for OpenLinks.

## Source Of Truth

Deployment topology now lives in `config/deployment.json`.

It controls:

- `primaryTarget`
- `enabledTargets`
- per-target `publicOrigin`
- optional target settings such as AWS `priceClass`

`deploy:setup -- --apply` is the sync point that updates the site-facing outputs from that topology:

- `data/site.json` `quality.seo.canonicalBaseUrl`
- README deploy URL rows

Compatibility wrappers such as `deploy:setup:render -- --public-origin=... --promote-primary` still exist for one migration cycle, but the primary operator flow is now:

```bash
bun run deploy:plan
bun run deploy:setup -- --apply
git push origin main
```

## Supported Targets

- `github-pages`: default fork-safe target
- `aws`: CloudFront + S3 + Route 53 target
- `render`: provider-native static host
- `railway`: provider-native static host via the checked-in Bun server

Only one public host should be primary at a time. The primary host is indexable. Every other enabled host must emit `noindex, nofollow` and canonicalize to the primary host.

## Command Surface

Topology-first commands:

```bash
bun run deploy:plan
bun run deploy:setup -- --apply
bun run deploy:build
bun run deploy:publish -- --target=<aws|github-pages>
bun run deploy:verify
```

Live-target verification:

```bash
bun run deploy:verify:live -- --target=render --public-origin=https://<service>.onrender.com
bun run deploy:verify:live -- --target=railway --public-origin=https://<service>.up.railway.app
```

Target-specific setup wrappers remain available while the old flow is phased out:

- `bun run deploy:setup:render -- --public-origin=...`
- `bun run deploy:setup:railway -- --public-origin=...`
- `bun run deploy:setup:aws`
- `bun run deploy:setup:github`

## Workflow Architecture

- `.github/workflows/ci.yml`
  - runs required checks
  - builds artifacts only for enabled targets
  - uploads only the artifacts that exist
- `.github/workflows/deploy-production.yml`
  - resolves enabled targets from `config/deployment.json`
  - publishes AWS only when the target is enabled and GitHub AWS opt-in is set
  - publishes GitHub Pages only when that target is enabled
  - verifies the enabled topology after publish

Provider-native targets remain externally published by their hosting platforms, but their canonical/README behavior still flows from `config/deployment.json`.

## Standard Flows

### Pages-Primary Fork

1. Keep `config/deployment.json` on the default Pages-first topology.
2. Run `bun run deploy:setup -- --apply`.
3. Push to `main`.
4. Verify `.github/workflows/ci.yml` and `.github/workflows/deploy-production.yml`.
5. Confirm the Pages URL serves the current build.

### AWS Primary + Pages Mirror

1. Edit `config/deployment.json` to:
   - enable `aws` and `github-pages`
   - set `primaryTarget` to `aws`
   - set `targets.aws.publicOrigin` to the intended canonical HTTPS origin
2. Run `bun run deploy:setup -- --apply`.
3. Ensure GitHub repo settings include:
   - `OPENLINKS_ENABLE_AWS_DEPLOY=true`
   - `AWS_DEPLOY_ROLE_ARN`
4. Push to `main`.
5. Verify:
   - `Deploy AWS Site`
   - `Deploy GitHub Pages`
   - `Verify Production Deployment`

### Provider-Native Primary

1. Set the provider target `publicOrigin` in `config/deployment.json`.
2. Set `primaryTarget` to that provider.
3. Run `bun run deploy:setup -- --apply`.
4. Push to `main` and let the provider redeploy.
5. Verify with `bun run deploy:verify:live`.

## URL Reporting Contract

Use this stable schema in chat and README rows:

| target | status | primary_url | additional_urls | evidence |
|--------|--------|-------------|-----------------|----------|
| aws | success/warning/failed | `<aws-url>` | `none` or `canonical=<primary-host>` | `deploy-production.yml -> Deploy AWS Site` |
| github-pages | success/warning/failed | `<pages-url>` | `none` or `canonical=<primary-host>` | `deploy-production.yml -> Deploy GitHub Pages` |
| render | success/warning/failed | `<render-url>` | `none` or `canonical=<primary-host>` | `Render -> live /build-info.json` |
| railway | success/warning/failed | `<railway-url>` | `none` or `canonical=<primary-host>` | `Railway -> live /build-info.json` |

## Diagnostics

GitHub Actions artifacts:

- `ci-diagnostics-required`
- `ci-diagnostics-strict`
- `deploy-production-aws-diagnostics`
- `deploy-production-pages-diagnostics`
- `deploy-production-verify-diagnostics`

Local diagnostics:

- `.codex/logs/deploy/`
- `output/cache-revalidation/`
- live `/build-info.json`

## Symptom -> Fix Matrix

| Symptom | Likely Cause | Fix |
|--------|--------------|-----|
| `deploy:setup` updates `data/site.json` or README unexpectedly | `config/deployment.json` changed or was stale | review `bun run deploy:plan`, then rerun `bun run deploy:setup -- --apply` |
| AWS job is skipped | AWS target disabled in config or GitHub AWS opt-in is missing | enable `aws` in `config/deployment.json`, then set `OPENLINKS_ENABLE_AWS_DEPLOY` and `AWS_DEPLOY_ROLE_ARN` |
| Pages job is skipped | GitHub Pages target is disabled in config | enable `github-pages` in `config/deployment.json` |
| `deploy:verify` blocks on DNS readiness | the configured AWS domain does not resolve publicly yet | wait for Route 53 + CloudFront propagation, then rerun `bun run deploy:verify` |
| Provider target canonicalizes to the wrong host | `primaryTarget` or provider `publicOrigin` is wrong in config | update `config/deployment.json`, rerun `bun run deploy:setup -- --apply`, then redeploy |
| README deploy rows are stale | topology changed but setup was not rerun | rerun `bun run deploy:setup -- --apply` |

## Related Docs

- `README.md`
- `docs/quickstart.md`
- `docs/deployment-render.md`
- `docs/deployment-railway.md`
- `docs/openclaw-bootstrap.md`
- `docs/openclaw-update-crud.md`
