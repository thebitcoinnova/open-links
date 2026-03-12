<!-- coding-and-architecture-requirements:begin -->
<!-- source-repository: https://github.com/bright-builds-llc/coding-and-architecture-requirements -->
<!-- version-pin: main -->
<!-- canonical-entrypoint: https://github.com/bright-builds-llc/coding-and-architecture-requirements/blob/main/standards/index.md -->
<!-- audit-manifest: coding-and-architecture-requirements.audit.md -->
<!-- coding-and-architecture-requirements:end -->

# CONTRIBUTING.md

Use this file as the starting point for contributing to OpenLinks.

## Default Contribution Expectations

- Follow [AGENTS.md](AGENTS.md).
- Use the pinned Bright Builds standards repository as the canonical standards source.
- Prefer simple, root-cause fixes over broad rewrites.
- Record deliberate local deviations in [standards-overrides.md](standards-overrides.md).

## Code Expectations

- Keep business logic in a functional core when practical.
- Prefer early returns and shallow control flow.
- Split oversized functions and files into sensible units.
- Parse boundary input into domain types when that removes repeated validation.
- Apply any relevant language-specific guidance from the pinned canonical standards.

## Verification Expectations

Run the repo-required verification commands before opening a pull request:

- `bun run biome:check`
- `bun run studio:lint`
- `bun run typecheck`
- `bun run studio:typecheck`
- `bun run --filter @openlinks/studio-api test`
- `bun run studio:test:integration`

Run `bun run build` when your change affects the public site bundle, build pipeline, or any path whose behavior is validated through the production build.

## Pull Request Expectations

- Explain the behavior change, not just the code movement.
- Call out any new exceptions to the standards.
- Include verification evidence for the changed paths.
- Note any residual risks or follow-up work.
