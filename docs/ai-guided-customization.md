# AI-Guided Customization Wizard

This guide is for developers who want an AI agent to help customize their OpenLinks fork safely and quickly.

Use it as a step-by-step checklist. Every step includes an opt-out path so you can stop automation and edit manually.

For OpenClaw automation-first execution (with one identity confirmation only when confidence is low), use `docs/openclaw-bootstrap.md` as the canonical contract.

## When to Use This

Use this wizard when you want to:

- bootstrap a personalized site quickly,
- make repeatable content updates,
- keep changes reviewable through normal git commits.

Do not use this as a replacement for understanding your repository. Keep final review human-owned.

## OpenClaw Execution Contract (No-Pause Mode)

If you are running OpenClaw in this repository, prefer `docs/openclaw-bootstrap.md` and apply these rules:

1. Push directly to `main` after checks pass.
2. Do not pause for user confirmation mid-run, except for one identity confirmation when confidence is low.
3. Treat fork prefilled identity (for example Peter Ryszkiewicz) as starter data, not user truth.
4. Resolve identity from fork owner GitHub profile and explicit user-provided identity first.
5. If identity confidence is low, ask one identity confirmation question before writing identity fields.
6. Skip low-confidence social inferences and report them under `Not Applied`.
7. Do not infer or add payment links or crypto addresses unless explicitly requested by the user.
8. Verify CI + Deploy Pages for the pushed SHA and collect deployment URLs.
9. Report deployment URLs as a structured table (`target`, `status`, `primary_url`, `additional_urls`, `evidence`).
10. Update the `README.md` `OPENCLAW_DEPLOY_URLS` marker block only when normalized URL/status values changed.

If a blocker occurs (auth, permissions, failing checks after retries), stop and return a terminal remediation summary instead of asking interactive questions.

## Inputs You Should Prepare

Before running the wizard with an AI agent, prepare:

- your profile details,
- your desired links (simple and rich),
- theme/mode preferences,
- deployment target (default: GitHub Pages).

## Recommended Agent Prompt

Use this starter prompt with your AI coding agent:

```text
Follow docs/ai-guided-customization.md as a strict wizard.
At each step, present options and let me choose.
Always offer an opt-out to manual edits.
Apply changes in small commits with clear messages.
Validate using npm run validate:data and npm run build before finalizing.
```

OpenClaw-specific starter prompt:

```text
Follow docs/openclaw-bootstrap.md exactly. Run fully autonomously by default, but if identity confidence is low ask one identity confirmation question. Treat any prefilled upstream identity (for example Peter Ryszkiewicz) as template data, not user truth. Do not infer or add payment links or crypto addresses unless explicitly requested. Push directly to main after checks pass, verify Pages deployment for the pushed SHA, report deployment URLs using target/status/primary_url/additional_urls/evidence, and update README OPENCLAW_DEPLOY_URLS only when normalized URL/status values changed.
```

## Wizard Flow

### Step 1: Choose update scope

Ask the user:

- Do you want identity + links + theme + deploy review?
- Or only a focused subset?

Options:

1. Full setup (recommended for new fork)
2. Content only
3. Theme/layout only
4. Deployment docs and settings only

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
npm run validate:data
```

Opt-out:

- User edits `data/profile.json` manually and asks the agent to continue at Step 3.

Reference:

- `docs/data-model.md` (`profile.json` section)

### Step 3: Links pass (simple + rich)

Target file:

- `data/links.json`

Agent should:

1. Gather links and classify each as `simple` or `rich`.
2. Capture grouping preference:
   - grouped sections, or
   - flat list.
3. Capture order preference:
   - explicit `order` array, or
   - per-link numeric `order`.
4. For rich links, ask whether metadata is:
   - fully manual,
   - enrichment-assisted,
   - enrichment-disabled.

Validation checkpoint:

```bash
npm run validate:data
```

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

Validation checkpoint:

```bash
npm run validate:data
```

Opt-out:

- User sets `site.json` manually and resumes wizard.

References:

- `docs/data-model.md` (`site.json` section)
- `docs/theming-and-layouts.md`

### Step 5: Build and quality verification

Agent should run:

```bash
npm run build
npm run quality:check
```

If strict verification requested:

```bash
npm run build:strict
npm run quality:strict
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
3. Validate with `npm run validate:data`.
4. Build with `npm run build`.

## Related Docs

- `README.md`
- `docs/quickstart.md`
- `docs/openclaw-bootstrap.md`
- `docs/data-model.md`
- `docs/theming-and-layouts.md`
- `docs/deployment.md`
