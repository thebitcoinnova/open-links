# OpenLinks

OpenLinks is a personal, free, open source, version-controlled static website generator for social links.

## What You Get

- SolidJS static site scaffold.
- JSON-backed profile + links content model.
- Schema + policy validation before build.
- Starter examples for minimal and grouped link layouts.

## Fork or Template This Repo

Use one of these options:

1. **Fork** the repository if you want to track upstream changes directly.
2. **Use as template** if you want a clean standalone repo.

After creating your repo copy:

```bash
git clone <your-repo-url>
cd open-links
npm install
```

## Configure Your Data

Edit the split data files in `data/`:

- `data/profile.json`: identity, bio, profile metadata.
- `data/links.json`: links array, optional groups, explicit order.
- `data/site.json`: site-level metadata and active theme.

You can also start from examples in `data/examples/`.

## Local Validation and Build

Run validation before building:

```bash
npm run validate:data
npm run build
```

Useful validation commands:

```bash
npm run validate:data:strict
npm run validate:data:json
```

## Validation Modes and Data Contract Rules

### Standard vs strict mode

- `npm run validate:data`: fails on errors, allows warnings.
- `npm run validate:data:strict`: fails on errors and warnings.

### URL policy

Link URLs must use one of these schemes:

- `http`
- `https`
- `mailto`
- `tel`

### Extension model

- Top-level unknown keys are allowed but reported as warnings.
- Use `custom` objects for extension metadata:
  - top-level `custom` in `profile`, `links`, and `site`
  - per-link `custom` in each link object
- Custom keys must not collide with reserved core keys. Conflicts fail validation.
- Extension compatibility is best-effort, not guaranteed as a stable API contract.

## First Publish Checklist

- [ ] Updated `data/profile.json`, `data/links.json`, and `data/site.json` with your content.
- [ ] Ran `npm run validate:data` and resolved all errors.
- [ ] Ran `npm run build` successfully.
- [ ] Committed and pushed your changes.
- [ ] Confirmed repository Pages/deploy workflow settings (added in Phase 4).

## Troubleshooting Validation

- If validation reports schema errors, check the exact JSON path in the message and update that field.
- If validation reports custom-key conflicts, rename keys under `custom` so they do not match reserved core fields.
- If validation reports URL scheme errors, use one of `http`, `https`, `mailto`, or `tel`.
- If strict mode fails on warnings, either resolve warnings or use standard mode during local iteration.

## Example Data Presets

- `data/examples/minimal/`: fastest starter with three links.
- `data/examples/grouped/`: grouped links plus explicit ordering.
- `data/examples/invalid/`: fixtures that intentionally fail validation for testing.

## Development Scripts

- `npm run dev` - start local dev server.
- `npm run build` - production build (runs validation first).
- `npm run preview` - preview production build.
- `npm run typecheck` - TypeScript checks.

## License

MIT (see `LICENSE`).
