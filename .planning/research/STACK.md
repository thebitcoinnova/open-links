# Stack Research

**Domain:** Developer-first static social links site generator
**Researched:** 2026-02-22
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@solidjs/start` + `solid-js` | `1.3.0` + `1.9.11` | Static-rendered Solid app and component runtime | SolidStart supports static prerendering while preserving SolidJS ergonomics for a polished UI. |
| TypeScript | `5.9.3` | Typed app + schema/tooling scripts | Strong typing is critical for maintainable JSON-driven rendering and contributor onboarding. |
| JSON Schema (Draft 2020-12) + AJV | `ajv@8.18.0`, `ajv-formats@3.0.1` | Validate profile/link metadata before build | Schema-first validation gives deterministic builds and clear contributor feedback. |
| GitHub Actions + GitHub Pages | `actions/checkout@v5`, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v4`, `actions/deploy-pages@v4` | CI validation/build/deploy | First-class for fork/template workflows and zero-maintenance static hosting. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@solidjs/meta` | `0.29.4` | SEO tags (`title`, `description`, OG tags) | Use on profile and detail routes for crawlability and social share quality. |
| `@solidjs/router` | `0.15.4` | Route handling for profile/layout variations | Use if multiple routes are needed (for example themed layouts or category views). |
| `open-graph-scraper` | `6.11.0` | Build-time rich metadata extraction | Use for optional rich card previews with cache/fallback behavior. |
| `unplugin-icons` + `@iconify-json/simple-icons` | `23.0.1` + `1.2.71` | Well-known platform icons | Use for recognizable social branding with local/static icon delivery. |
| `lightningcss` | `1.31.1` | CSS optimization + vendor handling | Use in production build for smaller, faster CSS without heavy framework lock-in. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `vitest` (`4.0.18`) | Unit and integration tests | Validate schema parsing, card rendering, and metadata fallback behavior. |
| `eslint` (`10.0.1`) | Static analysis | Enforce consistent TS/Solid patterns in template repos and forks. |
| `prettier` (`3.8.1`) | Formatting | Keeps generated docs/config edits contributor-friendly. |

## Installation

```bash
# Core
npm install @solidjs/start solid-js @solidjs/meta @solidjs/router

# Supporting
npm install ajv ajv-formats open-graph-scraper unplugin-icons @iconify-json/simple-icons lightningcss

# Dev dependencies
npm install -D typescript vitest eslint prettier @types/node
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| SolidStart static prerendering | Vite + `vite-plugin-solid` SPA | Use when you only need a single route and minimal SEO surface. |
| AJV + JSON Schema | Zod-only runtime schemas | Use when schema export/interoperability is not needed outside TS code. |
| GitHub Pages CI deploy | Netlify/Cloudflare Pages | Use when you need previews/edge features beyond GitHub-native workflow. |
| Iconify/simple-icons local assets | Remote icon CDNs | Use only if bundle size constraints require strict icon-on-demand loading strategy. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Runtime client-side metadata scraping | CORS failures, latency, privacy risk, and unstable UX | Build-time scraping with cache + fallback fields in JSON |
| Hard-coding provider-specific deploy logic in app code | Makes non-GitHub targets painful later | Deployment adapter layer in CI/config |
| Theme logic embedded directly in components | Fork customization becomes brittle and expensive | Token-based themes + layout templates |
| Unvalidated JSON writes | Broken builds and silent rendering failures | CI schema validation gate before build |

## Stack Patterns by Variant

**If shipping fastest MVP on one page:**
- Use SolidStart with a single prerendered route and minimal routing.
- Because this keeps SEO/static benefits while avoiding architecture churn later.

**If adding multiple profile/layout routes:**
- Use `@solidjs/router` route modules + shared JSON data loader.
- Because route boundaries keep theme/layout experiments isolated.

**If adding non-GitHub deployment targets:**
- Use target-specific workflow files calling shared build steps.
- Because provider differences stay in CI config rather than product code.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@solidjs/start@1.3.0` | `solid-js@1.9.11` | Same ecosystem release family; preferred pairing for SolidStart apps. |
| `vite-plugin-solid@2.11.10` | `vite@7.3.1` | For Vite-only fallback architecture; keep versions aligned. |
| `ajv@8.18.0` | `ajv-formats@3.0.1` | Standard pairing for URL/date/email format validation. |

## Sources

- [SolidStart docs](https://docs.solidjs.com/solid-start) — static prerendering and framework direction
- [SolidStart prerender guide](https://docs.solidjs.com/solid-start/building-your-application/rendering/static-site-generation-ssg) — static generation behavior
- [GitHub Pages Actions guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) — deployment workflow actions and versions
- npm registry (`npm view`) on 2026-02-22 — package versions for stack selection

---
*Stack research for: developer-first static social links generator*
*Researched: 2026-02-22*
