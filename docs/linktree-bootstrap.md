# Linktree Bootstrap Extractor

Use this when a user already has a Linktree and you want a fast, reviewable bootstrap source for profile fields plus ordered link candidates.

The extractor is discovery-only. It emits normalized JSON and does not write `data/*.json` by itself.

## CLI

```bash
bun run bootstrap:linktree -- --url https://linktr.ee/<handle>
```

Optional flags:

- `--timeout-ms <ms>`
- `--retries <n>`

## Output Contract

The command prints one JSON object with:

- `kind`, `sourceUrl`, `fetchedUrl`
- `profile.name`, `profile.bio`, `profile.avatar`
- `profile.socialLinks[]`
- `links[]`
- `snapshot`
- `warnings[]`

Behavioral rules:

- `profile.avatar` prefers the rendered Linktree profile image URL when present.
- `profile.socialLinks[]` comes from Linktree's social icon strip, not the main content links.
- `links[]` comes from Linktree's ordered content-link payload.
- Internal/self Linktree URLs are skipped.
- Duplicate URLs are deduped within each collection.
- If Linktree structured payload is missing, the extractor falls back to generic HTML/meta parsing.

## Recommended Use

- OpenClaw bootstrap/update flows: treat a user-provided Linktree URL as a valid bootstrap seed before asking them to enumerate links manually.
- Manual repo workflows: run the extractor, review the JSON, then map the fields into `data/profile.json` and `data/links.json`.

## Related Docs

- `docs/openclaw-bootstrap.md`
- `docs/openclaw-update-crud.md`
- `docs/ai-guided-customization.md`
- `docs/quickstart.md`
