# AI-Guided Customization Wizard

This guide is for developers who want an AI agent to help customize their OpenLinks fork safely and quickly.

Use it as a step-by-step checklist. Every step includes an opt-out path so you can stop automation and edit manually.

This is the recommended repo-native CRUD path when you want an AI agent to update your OpenLinks data. If you want browser-based CRUD instead, prefer `docs/studio-self-serve.md`. Direct file editing remains the lower-level fallback, not the default workflow.

For OpenClaw automation-first execution, use:

- `docs/openclaw-bootstrap.md` for first-time setup,
- `docs/openclaw-update-crud.md` for day-2 update/CRUD sessions.

## When to Use This

Use this wizard when you want to:

- bootstrap a personalized site quickly,
- make repeatable content updates,
- keep changes reviewable through normal git commits.

If you already know you want deterministic day-2 maintenance in an existing repo, prefer `docs/openclaw-update-crud.md`. If you want browser-based CRUD instead of repo-local editing, prefer `docs/studio-self-serve.md`.

Do not use this as a replacement for understanding your repository. Keep final review human-owned.

## Relationship to OpenClaw Update/CRUD

Use the right tool for the job:

1. This wizard (`docs/ai-guided-customization.md`) is conversational and checkpoint-heavy.
2. `docs/openclaw-update-crud.md` is an operational day-2 contract with startup mode selection (`guided`, `balanced`, `autopilot`) and deterministic repo-resolution behavior.

If your goal is repeatable maintenance on an existing fork/local clone, prefer `docs/openclaw-update-crud.md`.

If your goal is adding a brand-new authenticated rich extractor, use:

- `docs/create-new-rich-content-extractor.md`
- `skills/create-new-rich-content-extractor/SKILL.md`

If your goal is adding or updating rich links while keeping image assets committed in git, also use:

- `skills/cache-rich-link-assets/SKILL.md`

If your goal is helping other websites, apps, repos, docs, or service profiles discover your deployed OpenLinks fork, also use:

- `skills/openlinks-fork-identity-presence/SKILL.md`

## OpenClaw Bootstrap Contract (Automation-First)

If you are running OpenClaw bootstrap flow in this repository, use `docs/openclaw-bootstrap.md` and apply these rules:

1. Push directly to `main` after checks pass.
2. Do not pause for user confirmation mid-run, except:
   - one route-confirmation when existing setup is detected (bootstrap vs day-2 update),
   - one identity confirmation when confidence is low.
3. Treat fork prefilled identity (for example Peter Ryszkiewicz) as starter data, not user truth.
4. Resolve identity from fork owner GitHub profile and explicit user-provided identity first.
5. If identity confidence is low, ask one identity confirmation question before writing identity fields.
6. Skip low-confidence social inferences and report them under `Not Applied`.
7. Do not infer or add payment links or crypto addresses unless explicitly requested by the user.
8. Verify CI + Deploy Production for the pushed SHA and collect deployment URLs (`aws` plus `github-pages` when AWS is enabled).
9. Report deployment URLs as a structured table (`target`, `status`, `primary_url`, `additional_urls`, `evidence`).
10. Update the `README.md` `OPENCLAW_DEPLOY_URLS` marker block only when normalized URL/status values changed.

If a blocker occurs (auth, permissions, failing checks after retries), stop and return a terminal remediation summary instead of asking interactive questions.

For day-2 update sessions with selectable interaction levels, use `docs/openclaw-update-crud.md`.

## Inputs You Should Prepare

Before running the wizard with an AI agent, prepare:

- your profile details,
- your desired links (simple and rich) or a Linktree URL,
- theme/mode preferences,
- deployment target (default upstream target: AWS canonical site plus GitHub Pages mirror).

## Recommended Agent Prompt

Use this starter prompt with your AI coding agent:

```text
Follow docs/ai-guided-customization.md as a strict wizard.
At each step, present options and let me choose.
Always offer an opt-out to manual edits.
Apply changes in small commits with clear messages.
Validate using bun run validate:data and bun run build before finalizing.
```

OpenClaw-specific starter prompt:

```text
Follow https://raw.githubusercontent.com/pRizz/open-links/main/docs/openclaw-update-crud.md exactly for this repository. Execute Required Startup Handshake (including conditional customization-audit selectors), Defaults, Customization Audit Path (Optional), Repository Resolution, Dirty Local Repository Handling, Interaction Modes, Identity and Discovery Policy, Update/CRUD Execution Sequence, Final Output Contract, and Required reason codes exactly as written. When customization_path=customization-audit, use https://raw.githubusercontent.com/pRizz/open-links/main/docs/customization-catalog.md as the checklist source.
```

## Wizard Flow

### Step 1: Choose update scope

Ask the user:

- Do you want a full data-driven customization audit across all catalog categories?
- Or only a focused subset?

Options:

1. Full data-driven customization audit (recommended for day-2 maintenance)
2. Standard full setup (identity + links + theme + deploy review)
3. Content only
4. Theme/layout only
5. Deployment docs and settings only

Reference:

- `docs/customization-catalog.md` (canonical category list for full/focused audits)

Opt-out:

- Skip AI flow and edit directly using `docs/quickstart.md`.

### Step 2: Profile identity pass

Target file:

- `data/profile.json`

Agent should:

1. Ask for name, headline, bio, avatar URL.
2. Ask optional fields (location, pronouns, status, contact).
3. Preserve unknown extensions under `profile.custom`.

Validation checkpoint:

```bash
bun run validate:data
```

Opt-out:

- User edits `data/profile.json` manually and asks the agent to continue at Step 3.

Reference:

- `docs/data-model.md` (`profile.json` section)

### Step 3: Links pass (simple + rich)

Target file:

- `data/links.json`

Agent should:

1. Ask whether the user wants to provide a Linktree URL or enumerate links manually.
2. If the user has a Linktree URL, run `bun run bootstrap:linktree -- --url <linktree-url>` first and review the extracted profile/social/content link candidates with them before editing `data/links.json`.
3. Gather remaining links and classify each as `simple` or `rich`.
4. Capture grouping preference:
   - grouped sections, or
   - flat list.
5. Capture order preference:
   - explicit `order` array, or
   - per-link numeric `order`.
6. For rich links, ask whether metadata is:
   - fully manual,
   - enrichment-assisted,
   - enrichment-disabled.
7. When a rich link uses remote image URLs, refresh the committed image cache in the same change batch:

```bash
bun run images:sync
```

Validation checkpoint:

```bash
bun run validate:data
```

If the rich-link image cache changed, include:

- `data/cache/content-images.json`
- `public/cache/content-images/*`

Opt-out:

- User edits only links while the agent pauses.

Reference:

- `docs/data-model.md` (`links.json`, grouping, ordering, rich metadata)

### Step 4: Site behavior pass

Target file:

- `data/site.json`

Agent should capture:

- theme (`theme.active`, `theme.available`)
- composition mode (`balanced`, `identity-first`, `links-first`, `links-only`)
- grouping style (`subtle`, `none`, `bands`)
- mode policy (`dark-toggle`, `static-dark`, `static-light`)
- link target behavior (`new-tab-external`, `same-tab`, `new-tab-all`)
- profile richness (`minimal`, `standard`, `rich`)
- layout density (`compact`, `medium`, `spacious`)
- desktop columns (`one`, `two`)
- typography scale (`fixed`, `compact`, `expressive`)
- target size (`comfortable`, `compact`, `large`)
- typography overrides (`ui.typography.global`, `ui.typography.themes`)
- brand icon policy (`ui.brandIcons.colorMode`, `contrastMode`, `minContrastRatio`, `sizeMode`, `iconOverrides`)
- rich-card policy (`ui.richCards.renderMode`, `sourceLabelDefault`, `imageTreatment`, legacy `mobile.imageLayout`, `enrichment.*`)
- quality policy (`quality.reportPath`, `summaryPath`, `blockingDomains`, `seo.*`, `accessibility.*`, `performance.*`)

Validation checkpoint:

```bash
bun run validate:data
```

Opt-out:

- User sets `site.json` manually and resumes wizard.

References:

- `docs/data-model.md` (`site.json` section)
- `docs/customization-catalog.md` (`site-core-theme`, `site-ui-*`, `site-quality` categories)
- `docs/theming-and-layouts.md`

### Step 5: Build and quality verification

Agent should run:

```bash
bun run build
bun run quality:check
```

If strict verification requested:

```bash
bun run build:strict
bun run quality:strict
```

Agent should summarize failures as:

- issue,
- likely cause,
- exact remediation step.

Opt-out:

- User runs checks manually and shares output.

### Step 6: Deployment readiness review

Agent should confirm:

- GitHub Pages source is GitHub Actions.
- CI workflow is passing.
- Deploy workflow has a successful run on `main`.

References:

- `docs/quickstart.md`
- `docs/deployment.md`

Opt-out:

- User handles deployment manually and asks the agent only for docs updates.

## Interaction Rules for Agents

If you are the AI agent running this wizard:

1. Never overwrite unrelated files.
2. Ask before broad refactors.
3. Keep commits small and descriptive.
4. Prefer schema-valid edits over speculative extras.
5. Preserve existing `custom` extension fields unless user asks to remove them.
6. If unsure, stop and ask clarifying questions.

## Suggested Commit Sequence

Recommended commit split:

1. `docs/content`: profile and links edits
2. `docs/theme`: site theme/layout policy edits
3. `docs/verify`: validation/build/quality remediation

This makes review and rollback easier.

## Manual Escape Hatch

You can leave the wizard at any point and continue manually:

1. Follow `docs/quickstart.md`.
2. Use `docs/data-model.md` for field-level references.
3. Validate with `bun run validate:data`.
4. Build with `bun run build`.

## Related Docs

- `README.md`
- `docs/quickstart.md`
- `docs/openclaw-bootstrap.md`
- `docs/openclaw-update-crud.md`
- `AGENTS.md`
- `docs/customization-catalog.md`
- `docs/data-model.md`
- `docs/theming-and-layouts.md`
- `docs/deployment.md`
- `docs/create-new-rich-content-extractor.md`
- `skills/create-new-rich-content-extractor/SKILL.md`
