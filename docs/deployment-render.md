# Render Deployment Guide

This guide covers the provider-native Render target for forked OpenLinks sites.

## What Is Checked In

Render support is repo-owned:

- `render.yaml` declares the Render static-site service.
- `bun run deploy:build:render` builds `.artifacts/deploy/render`.
- `bun run deploy:setup:render` normalizes tracked canonical settings and README deploy rows after you know the live Render URL.

Render deploys stay root-path:

- target id: `render`
- asset base path: `/`
- primary vs mirror behavior depends on whether the live Render URL matches the current primary canonical host.

## First Deploy

1. Push your fork to `main`.
2. Confirm `.github/workflows/ci.yml` is green for that SHA.
3. In Render, create a new service from your GitHub repo and let Render read the checked-in `render.yaml`.
4. In Render service settings:
   - keep the branch on `main`
   - enable Render's CI gate / deploy-after-checks behavior if available in your workspace
5. Wait for the first successful Render deploy.
6. Copy the live Render URL, usually `https://<service>.onrender.com`.
7. Register that URL in the repo:

```bash
bun run deploy:setup:render -- --apply --public-origin=https://<service>.onrender.com
```

8. If you want Render to become the primary canonical host instead of GitHub Pages, promote it explicitly:

```bash
bun run deploy:setup:render -- --apply --public-origin=https://<service>.onrender.com --promote-primary
```

9. Commit and push the tracked changes from step 7 or step 8.
10. Let Render redeploy the new commit.

## Verify the Live Site

Verify the current pushed SHA:

```bash
bun run deploy:verify:live -- --target=render --public-origin=https://<service>.onrender.com
```

Check the README row if you want a manual one-off update:

```bash
bun run deploy:readme:urls:update -- \
  --target=render \
  --primary-url=https://<service>.onrender.com \
  --additional-urls=canonical=https://<primary-host> \
  --evidence="Render -> live /build-info.json"
```

## Expected Behavior

- If Render is not primary, it should emit `noindex, nofollow` and canonicalize to the current primary host.
- If Render is promoted to primary, it should become indexable and GitHub Pages should switch to mirror behavior.
- `render.yaml` narrows auto-deploy triggers so Studio-only work does not redeploy the public site.
- `render.yaml` also includes the SPA rewrite to `/index.html`.

## Badge Example

Once Render is live, your badge URL is:

- `https://<service>.onrender.com/badges/openlinks.svg`

Markdown example:

```md
[![My OpenLinks](https://<service>.onrender.com/badges/openlinks.svg)](https://<service>.onrender.com/)
```

## Custom Domain Follow-Up

V1 is provider-URL first. After the provider URL is healthy, you can add a Render custom domain manually in the Render dashboard.

When the custom domain is live, rerun the setup command with the custom domain:

```bash
bun run deploy:setup:render -- --apply --public-origin=https://<your-domain> --promote-primary
```

Then commit, push, redeploy, and rerun `bun run deploy:verify:live`.
