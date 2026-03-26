# Railway Deployment Guide

This guide covers the provider-native Railway target for forked OpenLinks sites.

## What Is Checked In

Railway support is repo-owned:

- `railway.toml` defines the Railway build and deploy behavior.
- `bun run deploy:build:railway` builds `.artifacts/deploy/railway`.
- Railway serves that artifact through `scripts/deploy/serve-static-site.ts`.
- `bun run deploy:setup:railway` normalizes tracked canonical settings and README deploy rows after you know the live Railway URL.

Railway deploys stay root-path:

- target id: `railway`
- asset base path: `/`
- primary vs mirror behavior depends on whether the live Railway URL matches the current primary canonical host.

## First Deploy

1. Push your fork to `main`.
2. Confirm `.github/workflows/ci.yml` is green for that SHA.
3. In Railway, create a new project from your GitHub repo and let Railway read the checked-in `railway.toml`.
4. In Railway service settings:
   - keep the deploy branch on `main`
   - enable `Wait for CI`
5. Wait for the first successful Railway deploy.
6. In the Railway networking settings, generate the public domain.
7. Copy the live Railway URL, usually `https://<service>.up.railway.app`.
8. Register that URL in the repo:

```bash
bun run deploy:setup:railway -- --apply --public-origin=https://<service>.up.railway.app
```

9. If you want Railway to become the primary canonical host instead of GitHub Pages, promote it explicitly:

```bash
bun run deploy:setup:railway -- --apply --public-origin=https://<service>.up.railway.app --promote-primary
```

10. Commit and push the tracked changes from step 8 or step 9.
11. Let Railway redeploy the new commit.

## Verify the Live Site

Verify the current pushed SHA:

```bash
bun run deploy:verify:live -- --target=railway --public-origin=https://<service>.up.railway.app
```

Check the README row if you want a manual one-off update:

```bash
bun run deploy:readme:urls:update -- \
  --target=railway \
  --primary-url=https://<service>.up.railway.app \
  --additional-urls=canonical=https://<primary-host> \
  --evidence="Railway -> live /build-info.json"
```

## Expected Behavior

- If Railway is not primary, it should emit `noindex, nofollow` and canonicalize to the current primary host.
- If Railway is promoted to primary, it should become indexable and GitHub Pages should switch to mirror behavior.
- `railway.toml` narrows auto-deploy triggers so Studio-only work does not redeploy the public site.
- The checked-in start command serves the finalized deployment artifact and preserves SPA fallback behavior.

## Badge Example

Once Railway is live, your badge URL is:

- `https://<service>.up.railway.app/badges/openlinks.svg`

Markdown example:

```md
[![My OpenLinks](https://<service>.up.railway.app/badges/openlinks.svg)](https://<service>.up.railway.app/)
```

## Custom Domain Follow-Up

V1 is provider-URL first. After the provider URL is healthy, you can add a Railway custom domain manually in the Railway dashboard.

When the custom domain is live, rerun the setup command with the custom domain:

```bash
bun run deploy:setup:railway -- --apply --public-origin=https://<your-domain> --promote-primary
```

Then commit, push, redeploy, and rerun `bun run deploy:verify:live`.
