# Deployment Operations Guide

This guide covers the config-driven deployment system for OpenLinks.

## Source Of Truth

Deployment topology is now resolved from:

- shared upstream baseline: `config/deployment.defaults.json`
- optional fork overlay: `config/deployment.json`

It controls:

- `primaryTarget`
- `enabledTargets`
- per-target `publicOrigin`
- optional target settings such as AWS `priceClass`

`deploy:setup -- --apply` is the sync point that updates the site-facing outputs from the effective merged topology:

- `data/site.json` `quality.seo.canonicalBaseUrl`
- README deploy URL rows

Compatibility wrappers such as `deploy:setup:render -- --public-origin=... --promote-primary` still exist for one migration cycle, but the primary operator flow is now:

```bash
bun run deploy:plan
bun run deploy:setup -- --apply
git push origin main
```

After any deployment naming or topology refactor, rerun `bun run deploy:setup -- --apply` before expecting `Deploy Production` to succeed. That step rotates the config-derived IAM role/policy references and the GitHub `AWS_DEPLOY_ROLE_ARN` secret to the current deployment model.

When GitHub setup is in scope, `deploy:setup` now performs a read-only GitHub admin preflight before any AWS mutations. Use a repo-admin `gh` identity for the full flow, or split the work into `bun run deploy:setup:aws -- --apply` now and `bun run deploy:setup:github -- --apply` later with repo-admin access.

`bun run deploy:aws:bootstrap --apply` now auto-deletes empty terminal rollback shells (`ROLLBACK_COMPLETE` or `ROLLBACK_FAILED`) before retrying stack creation. If rollback state still has live resources or outputs, bootstrap still stops and reports manual CloudFormation recovery.

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
  - resolves enabled targets from deployment defaults plus optional overlay
  - publishes AWS only when the target is enabled and GitHub AWS opt-in is set
  - publishes GitHub Pages only when that target is enabled
  - verifies the enabled topology after publish

Provider-native targets remain externally published by their hosting platforms, but their canonical/README behavior still flows from the effective merged topology.

## Standard Flows

### Pages-Primary Fork

1. In a fork, create or update `config/deployment.json` so the effective topology is Pages-primary.
2. Run `bun run deploy:setup -- --apply`.
3. Push to `main`.
4. Verify `.github/workflows/ci.yml` and `.github/workflows/deploy-production.yml`.
5. Confirm the Pages URL serves the current build.

### AWS Primary + Pages Mirror

1. In a fork overlay, edit `config/deployment.json` to:
   - enable `aws` and `github-pages`
   - set `primaryTarget` to `aws`
   - set `targets.aws.publicOrigin` to the intended canonical HTTPS origin
2. Run `bun run deploy:setup -- --apply`.
   - This step requires repo-admin `gh` access because it preflights and updates GitHub environments, Pages, secrets, and variables.
3. Ensure GitHub repo settings include:
   - `OPENLINKS_ENABLE_AWS_DEPLOY=true`
   - `AWS_DEPLOY_ROLE_ARN`
4. Push to `main`.
5. Verify:
   - `Deploy AWS Site`
   - `Deploy GitHub Pages`
   - `Verify Production Deployment`

### Provider-Native Primary

1. Set the provider target `publicOrigin` in `config/deployment.json` or use the provider setup wrapper to write the overlay.
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
| `deploy:setup` updates `data/site.json` or README unexpectedly | deployment defaults or overlay changed, or the overlay is stale | review `bun run deploy:plan`, then rerun `bun run deploy:setup -- --apply` |
| `deploy:setup` fails immediately at `GitHub admin preflight` | the current `gh` identity can authenticate but cannot administer repository environments, Pages, secrets, or variables | authenticate `gh` as a repo admin and rerun `bun run deploy:setup -- --apply`, or run `bun run deploy:setup:aws -- --apply` now and finish `bun run deploy:setup:github -- --apply` later with admin access |
| `Deploy AWS Site` fails with CloudFormation `AccessDenied` after a deployment refactor | the attached IAM policy or GitHub `AWS_DEPLOY_ROLE_ARN` secret still points at pre-refactor role/policy names | rerun `bun run deploy:setup -- --apply`, confirm the config-derived role ARN/policy are active, then rerun `Deploy Production` |
| `deploy:aws:bootstrap --apply` ends in `ROLLBACK_FAILED` with `s3:DeleteBucket` denied for `SiteBucket` | the active deploy role can create the site bucket but cannot delete it during CloudFormation rollback | update the deploy policy to include `s3:DeleteBucket`, rerun `bun run deploy:setup:aws -- --apply` (and patch the legacy role if GitHub still uses it), delete the failed stack shell, then rerun `Deploy Production` |
| `deploy:aws:bootstrap --apply` stops on `ROLLBACK_COMPLETE` or `ROLLBACK_FAILED` before creating a new change set | the stack is a terminal rollback shell from an earlier failed create | bootstrap now auto-deletes empty rollback shells; if it still stops, inspect the reported remaining resources/outputs, complete manual CloudFormation recovery, then rerun `Deploy Production` |
| `deploy:aws:bootstrap --apply` reports `SiteDistribution` / `cloudfront:TagResource` access denied during stack create | the active deploy role can create CloudFront resources but cannot tag the distribution during CloudFormation provisioning | update the deploy policy to include `cloudfront:TagResource` (and `cloudfront:UntagResource`), rerun `bun run deploy:setup:aws -- --apply` and patch the legacy role if GitHub still uses it, delete the failed rollback shell, then rerun `Deploy Production` |
| AWS job is skipped | AWS target is disabled in the effective topology or GitHub AWS opt-in is missing | enable `aws` in the effective topology, then set `OPENLINKS_ENABLE_AWS_DEPLOY` and `AWS_DEPLOY_ROLE_ARN` |
| Pages job is skipped | GitHub Pages is disabled in the effective topology | enable `github-pages` in the effective topology |
| `deploy:verify` blocks on DNS readiness | the configured AWS domain does not resolve publicly yet | wait for Route 53 + CloudFront propagation, then rerun `bun run deploy:verify` |
| Provider target canonicalizes to the wrong host | `primaryTarget` or provider `publicOrigin` is wrong in the effective topology | update the overlay, rerun `bun run deploy:setup -- --apply`, then redeploy |
| README deploy rows are stale | topology changed but setup was not rerun | rerun `bun run deploy:setup -- --apply` |

## Related Docs

- `README.md`
- `docs/quickstart.md`
- `docs/deployment-render.md`
- `docs/deployment-railway.md`
- `docs/openclaw-bootstrap.md`
- `docs/openclaw-update-crud.md`
