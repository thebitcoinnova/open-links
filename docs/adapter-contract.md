# Adapter Contract (Conceptual)

This document describes the deployment-adapter shape OpenLinks uses today and the constraints future hosts should follow.

Important:

- This is not a runtime plugin API.
- The current repo now ships first-class target adapters for AWS, GitHub Pages, Render, and Railway.
- Future hosts should extend the same isolation boundary instead of reopening app-level rendering code.

## Purpose

OpenLinks currently supports:

- AWS
- GitHub Pages
- Render
- Railway

Future host targets (for example S3, Cloudflare Pages, Netlify) should not require rewriting application code.

The adapter concept exists to keep deployment concerns separate from content/rendering concerns.

## Current Invariants

Any future adapter should preserve these invariants:

1. Source content remains in `data/*.json`.
2. Validation/build contract remains script-based (`bun run validate:data`, `bun run build`).
3. Build output is static files in `dist/`.
4. Base-path handling remains explicit and testable.
5. CI/deploy diagnostics remain remediation-first.

## Conceptual Adapter Inputs

An adapter implementation should consume:

- repository content at a known commit,
- validated production `dist/` build output,
- deployment target configuration,
- optional base path or domain config.

## Conceptual Adapter Outputs

An adapter implementation should produce:

- a published static site endpoint,
- deployment status (`success`, `warning`, `failed`),
- deployment logs/diagnostics,
- a deterministic rollback or redeploy path.

## Minimum Capability Expectations

A candidate adapter should support:

1. Static artifact publish (`dist/`).
2. Path-aware hosting (`/` vs project path as applicable).
3. Cache invalidation strategy (or explicit no-cache guidance).
4. Failure diagnostics visible to maintainers.
5. Repeatable deployment from CI context.

## Safety Constraints

Future adapter work should avoid:

- changing core rendering logic in `src/` only to satisfy one host,
- embedding host-specific assumptions into JSON schemas,
- introducing mandatory credentials for local development.

Adapter logic should be additive and isolated to deployment layers.

## Verification Expectations for Future Adapter Work

When implementing a real adapter in a later phase, verification should include:

- `bun run validate:data` passes,
- `bun run build` passes,
- adapter publishes `dist/` successfully,
- generated URL serves expected content,
- broken-path and invalid-config failures include actionable remediation,
- rollback/redeploy behavior is documented.

## Suggested Documentation Pattern for Future Adapters

Each adapter doc should include:

1. Required credentials and where to store them.
2. Minimal setup steps.
3. CI example.
4. Troubleshooting matrix.
5. Support boundary and known limitations.

## Compatibility Notes for Adventurous Hosts

Not all static hosts treat paths, headers, and cache behavior the same way.

Before declaring an adapter stable, validate:

- nested route behavior,
- static asset paths,
- cache behavior after updates,
- redirect/rewrite defaults.

## Relationship to Existing Docs

- `docs/deployment.md` explains the current multi-target deployment operations.
- `docs/deployment-render.md` and `docs/deployment-railway.md` describe the two provider-native fork targets now implemented.
- This document describes the portability expectations that still apply when more hosts are added.
