# Feature Research

**Domain:** Developer-first social links site generator (template/fork model)
**Researched:** 2026-02-22
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these means the project feels unfinished.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Profile identity block (name, avatar, bio) | Every links hub needs clear owner identity | LOW | Core above-the-fold content. |
| Link cards with title + URL + icon | Fundamental job-to-be-done | LOW | Must support known social platforms with quality icons. |
| Mobile-first responsive design | Most traffic comes from mobile social taps | MEDIUM | Touch targets and card spacing are critical. |
| Theme support with dark/light | Users expect personalization and readability | MEDIUM | Dark default is a product decision here. |
| SEO metadata + social share tags | Creator pages should preview well in search/chat | MEDIUM | Static generation helps crawlers and social unfurling. |
| Accessibility baseline (keyboard/contrast/labels) | Public profile pages must be inclusive | MEDIUM | Should be CI-checked, not manual-only. |
| GitHub-native deployment automation | Fork/template users expect one-push deploy | MEDIUM | Actions pipeline is part of product UX, not just DevOps. |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Strict JSON schema for all content | Safer edits and better AI-agent compatibility | MEDIUM | Reduces broken deploys in forks. |
| Mixed simple/rich card rendering | Balances speed and richer previews | MEDIUM | Per-link config keeps control in user hands. |
| Build-time metadata enrichment with fallback | Rich previews without runtime risk | HIGH | Requires caching/retry/backoff strategy. |
| Theme tokens + layout template hooks | Makes deep customization feasible for forks | MEDIUM | Prevents design lock-in. |
| Multi-target deployment architecture | Future host portability | HIGH | Keep in CI abstraction, not page code. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full CMS with auth in v1 | Non-developers want no-code editing | Heavy scope expansion and infra/security burden | Keep JSON + git workflow for developer audience |
| Runtime third-party analytics scripts by default | "Need metrics" instinct | Privacy/performance regressions and legal overhead | Optional post-v1 integration docs |
| Live metadata fetching in browser | Seems "always fresh" | CORS failures, slow UX, API throttling | Build-time enrichment + cached snapshots |
| Plugin marketplace early | Appears extensible | Governance and compatibility burden too soon | Simple extension points + documented APIs |

## Feature Dependencies

```text
Schema validation
    └──requires──> JSON data contract
                       └──requires──> documentation examples

Rich cards
    └──requires──> metadata enrichment pipeline
                       └──requires──> cache/fallback model

Theme extensibility
    └──requires──> design token system
                       └──requires──> component style boundaries

Multi-target deploy
    └──requires──> CI abstraction of build/deploy steps
```

### Dependency Notes

- **Rich cards require metadata enrichment pipeline:** without this, "rich" cards degrade into hand-entered duplicates.
- **Theme extensibility requires style boundaries:** direct component style coupling blocks fork-level customization.
- **Deployment portability requires CI abstraction:** provider conditionals in app code create long-term coupling.

## MVP Definition

### Launch With (v1)

- [ ] JSON schema-validated profile and links data model — core reliability for forks
- [ ] SolidJS static profile page with sleek cards UI — core user-visible product
- [ ] Simple and rich card types, user-configurable per-link — core content flexibility
- [ ] Dark default + light mode toggle + 1-2 starter themes — core customization promise
- [ ] Known-platform icon support + fallback icon — baseline polish
- [ ] GitHub Actions validate/build/deploy to GitHub Pages — core publish flow
- [ ] Accessibility + SEO + performance checks in CI — core quality gate

### Add After Validation (v1.x)

- [ ] Build-time metadata fetch cache hardening (retry policy, stale fallback)
- [ ] Additional starter themes and layout variants
- [ ] Better docs for deployment-target adapter extension

### Future Consideration (v2+)

- [ ] CLI for CRUD on JSON backing data
- [ ] AI skill for guided CRUD workflows
- [ ] In-site editor that opens GitHub PRs
- [ ] Custom domain automation helpers
- [ ] Additional deployment targets (AWS/Railway) with maintained adapters

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| JSON schema validation pipeline | HIGH | MEDIUM | P1 |
| Static profile/cards UI | HIGH | MEDIUM | P1 |
| GitHub Pages auto deploy workflow | HIGH | MEDIUM | P1 |
| Theming and dark/light support | HIGH | MEDIUM | P1 |
| Rich card metadata enrichment | MEDIUM | HIGH | P2 |
| Deployment target adapters | MEDIUM | HIGH | P2 |
| In-site PR editor | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Linktree-like tools | Carrd-like tools | Our Approach |
|---------|---------------------|------------------|--------------|
| Hosted account model | Common | Optional account model | Explicitly excluded in v1 |
| Visual editing | Strong | Strong | Defer; use JSON + git first |
| Customizable themes | Moderate | Strong | Theme tokens + template hooks |
| Static deployment ownership | Limited (platform-hosted) | Mixed | GitHub-first user-owned hosting |
| Rich social previews | Partial | Limited | Build-time enrichment + fallback |

## Sources

- Project interview inputs (developer audience and scope)
- [SolidStart docs](https://docs.solidjs.com/solid-start)
- [GitHub Pages workflow docs](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

---
*Feature research for: developer-first social links generator*
*Researched: 2026-02-22*
