<!-- coding-and-architecture-requirements:begin -->
<!-- source-repository: https://github.com/bright-builds-llc/coding-and-architecture-requirements -->
<!-- version-pin: main -->
<!-- canonical-entrypoint: https://github.com/bright-builds-llc/coding-and-architecture-requirements/blob/main/standards/index.md -->
<!-- audit-manifest: coding-and-architecture-requirements.audit.md -->
<!-- coding-and-architecture-requirements:end -->

# Pull Request Template

## Summary

Describe the behavior change and why it is needed.

## Standards Impact

- [ ] Business logic still follows the intended functional core / imperative shell shape.
- [ ] New or changed pure/business logic has unit tests.
- [ ] Unit tests remain focused on one concern and use clear Arrange / Act / Assert structure.
- [ ] Any repo-specific exception has been recorded in `standards-overrides.md`.

## Verification

- [ ] `bun run biome:check`
- [ ] `bun run studio:lint`
- [ ] `bun run typecheck`
- [ ] `bun run studio:typecheck`
- [ ] `bun run --filter @openlinks/studio-api test`
- [ ] `bun run studio:test:integration`
- [ ] Additional changed-path validation is described below

## Risks

Document any residual risk, rollout concern, or follow-up work.
