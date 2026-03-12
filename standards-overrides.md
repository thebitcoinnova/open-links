<!-- coding-and-architecture-requirements:begin -->
<!-- source-repository: https://github.com/bright-builds-llc/coding-and-architecture-requirements -->
<!-- version-pin: main -->
<!-- canonical-entrypoint: https://github.com/bright-builds-llc/coding-and-architecture-requirements/blob/main/standards/index.md -->
<!-- audit-manifest: coding-and-architecture-requirements.audit.md -->
<!-- coding-and-architecture-requirements:end -->

# Standards Overrides

Use this file to record deliberate deviations from the canonical coding and architecture standards.

## Active Overrides

| Standard | Local decision | Rationale | Owner | Review date |
| --- | --- | --- | --- | --- |
| `AGENTS.md should stay a thin local adoption layer` | `OpenLinks keeps repo-specific operational policy in AGENTS.md alongside the adoption metadata.` | `Rich-enrichment blockers, Studio delivery tracking, and task-hygiene rules are safety-critical and need one explicit local home.` | `OpenLinks maintainers` | `2026-06-12` |

## Notes

- Prefer narrow, explicit exceptions over broad "this repo is different" statements.
- Revisit overrides periodically instead of letting them become permanent by accident.
- If an override becomes common across many repos, move it upstream into the canonical standards repo.
