# Adapter Contract (Conceptual)

This document describes the expected shape of future deployment adapters for OpenLinks.

Important:

- This is documentation-only guidance for v1.
- It is not a runtime plugin API.
- It does not introduce new production code behavior.

## Purpose

OpenLinks is currently GitHub Pages-first. Future host targets (for example S3, Railway static hosting, Cloudflare Pages, Netlify) should not require rewriting application code.

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

If/when adapters are implemented, each adapter doc should include:

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

- `docs/deployment.md` explains current GitHub Pages-first operations.
- This document describes portability expectations for future host adapters.

## Non-Goals in v1

This document does not provide:

- host-specific IaC templates,
- end-to-end scripts for non-GitHub deploy,
- runtime adapter registration APIs.

Those belong to future implementation phases.
