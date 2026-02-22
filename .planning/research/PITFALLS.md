# Pitfalls Research

**Domain:** Developer-first static links generator with rich preview support
**Researched:** 2026-02-22
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Rich Metadata Fetches Break the Build

**What goes wrong:**
External URLs time out, block requests, or return malformed tags, causing build failures or inconsistent card previews.

**Why it happens:**
Teams treat rich metadata as mandatory and tightly couple network fetch success to static build completion.

**How to avoid:**
Make metadata enrichment optional with strict timeout limits, retries, and fallback to user-provided metadata.

**Warning signs:**
Increasing CI flake rate, repeated timeout errors, or cards disappearing between builds.

**Phase to address:**
Phase 3 (rich cards + enrichment pipeline).

---

### Pitfall 2: Schema Drift Across Forks

**What goes wrong:**
Forks add custom fields without versioning or migration guidance, then future template updates break their builds.

**Why it happens:**
No schema versioning discipline, weak docs, and no compatibility policy.

**How to avoid:**
Version schema files, publish migration notes, and keep extension points explicit (`custom` object namespaces).

**Warning signs:**
Frequent PR comments about "template update broke my data" and ad-hoc local patching.

**Phase to address:**
Phase 1 (data contract and validation foundation).

---

### Pitfall 3: Theme Extensibility Looks Flexible but Isn’t

**What goes wrong:**
Fork owners can tweak colors but cannot change layouts or card composition without invasive rewrites.

**Why it happens:**
Theme choices are implemented as shallow CSS switches instead of component/layout extension points.

**How to avoid:**
Define tokenized themes and explicit layout templates; keep card renderers style-agnostic.

**Warning signs:**
Theme PRs require editing core components, or forks duplicate large UI files.

**Phase to address:**
Phase 2 (UI/theming architecture).

---

### Pitfall 4: Accessibility and SEO Regress Under Visual Polish

**What goes wrong:**
Beautiful cards ship with poor contrast, missing semantics, weak focus states, and incomplete meta tags.

**Why it happens:**
Polish is validated visually, not through accessibility/SEO checks.

**How to avoid:**
Add automated accessibility and SEO checks in CI plus manual keyboard/screen-reader smoke tests.

**Warning signs:**
Lighthouse accessibility drops, keyboard traps, or pages with duplicate/missing titles/descriptions.

**Phase to address:**
Phase 4 (quality hardening before broad release).

---

### Pitfall 5: GitHub Pages Path/Domain Misconfiguration

**What goes wrong:**
Site works locally but breaks in production due to incorrect base path, branch/artifact settings, or CNAME handling.

**Why it happens:**
Deployment assumptions are hard-coded and not validated against actual Pages config.

**How to avoid:**
Centralize base URL config, test deploy workflow in CI, and document custom-domain steps for v2.

**Warning signs:**
404 assets on deployed site, broken theme assets, or intermittent deploy rollbacks.

**Phase to address:**
Phase 5 (deployment hardening + docs).

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skipping schema validation in local dev | Faster iteration | CI-only failures and poor contributor UX | Never; keep fast local validate command |
| Embedding all styles in components | Quicker initial UI build | Hard-to-extend theming and fork divergence | Acceptable only for throwaway prototypes |
| Storing fetched metadata without TTL policy | Simpler implementation | Stale previews and confusing drift | Acceptable only with explicit manual refresh command |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GitHub Pages | Wrong base path for project pages | Derive base path from repo config/environment |
| OG metadata fetch | Unlimited request concurrency | Apply rate limits, retries, and per-domain timeout |
| Icon imports | Importing whole icon sets | Tree-shake or include only referenced icons |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Shipping large icon bundles | Slow initial page load | Import only needed icons, verify bundle size in CI | Typically visible above 100+ icons |
| Large rich preview images unoptimized | High LCP and bandwidth usage | Use constrained image dimensions and lazy loading | Common on mobile networks |
| Excessive client-side interactivity | Increased JS and reduced responsiveness | Keep runtime JS minimal; prefer static render | Shows early on low-end devices |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Rendering unsanitized HTML from metadata | XSS on public profile pages | Sanitize or strip untrusted HTML fields |
| Allowing non-http(s) URL schemes | Link-based injection and abuse | Enforce URL scheme validation in schema |
| Putting deploy secrets in repo | Credential leakage | Use GitHub Actions secrets/environment protections |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Over-animated cards | Distracting and motion-sensitive discomfort | Use restrained motion with reduced-motion support |
| Poor dark/light contrast tuning | Readability and accessibility issues | Tokenize contrast pairs and run automated checks |
| Inconsistent card hierarchy | Users miss primary links | Enforce layout rhythm and semantic heading structure |

## "Looks Done But Isn't" Checklist

- [ ] **Schema validation:** Often missing actionable error messages — verify errors include field paths and fix hints.
- [ ] **Rich cards:** Often missing fallback states — verify preview still renders when metadata fetch fails.
- [ ] **Theming:** Often missing non-default mode QA — verify both dark and light at mobile and desktop breakpoints.
- [ ] **Deployment:** Often missing production-path checks — verify deployed assets load under GitHub Pages base path.
- [ ] **Accessibility:** Often missing keyboard audit — verify full navigation without mouse.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Metadata fetch instability | MEDIUM | Disable enrichment gate, serve cached/manual metadata, patch retry policy |
| Schema drift in forks | HIGH | Add migration docs/scripts, introduce compatibility mode, publish change advisory |
| Broken Pages deploy path | LOW | Fix base path config, rerun workflow, add regression check in CI |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Metadata fetch build failures | Phase 3 | CI passes with network failure simulation and fallback cards rendered |
| Schema drift across forks | Phase 1 | Versioned schema + migration doc present; invalid forks fail with clear diagnostics |
| Theme extensibility gaps | Phase 2 | New theme can be added without editing core card logic |
| A11y/SEO regressions | Phase 4 | Quality gates pass (Lighthouse/a11y checks + manual smoke) |
| Pages config breakage | Phase 5 | Deployed preview verifies base path and assets resolve |

## Sources

- [SolidStart docs](https://docs.solidjs.com/solid-start)
- [GitHub Pages workflow docs](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- Prior art and common failure modes from static-site and CI/CD ecosystems

---
*Pitfalls research for: developer-first static links generator*
*Researched: 2026-02-22*
