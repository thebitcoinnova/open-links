#!/usr/bin/env bash
set -euo pipefail

write_summary() {
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    cat >>"$GITHUB_STEP_SUMMARY"
  else
    cat
  fi
}

write_output() {
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    printf '%s=%s\n' "$1" "$2" >>"$GITHUB_OUTPUT"
  else
    printf '%s=%s\n' "$1" "$2"
  fi
}

run_check() {
  local lane="$1"
  local key="$2"
  shift 2

  local log_file=".ci-diagnostics/${lane}/${key}.log"
  echo "::group::${key}"
  "$@" 2>&1 | tee "$log_file"
  local status=${PIPESTATUS[0]}
  echo "::endgroup::"
  return "$status"
}

required_summary() {
  write_summary <<EOF
## CI Required Checks
- Event: \`${GITHUB_EVENT_NAME:-unknown}\`
- Ref: \`${GITHUB_REF:-unknown}\`
- Studio Docker guard changed-path match: \`${STUDIO_DOCKER_CHANGED:-unknown}\`
- Local parity entrypoints:
  - \`bun run ci:required\`
  - \`bun run ci:required:docker\` (conditional)
- Lane commands:
  - \`bun run ci:required:typecheck\`
  - \`bun run ci:required:build\`
  - \`bun run ci:required:quality\`
  - \`bun run ci:required:studio-integration\`
  - \`bun run ci:required:docker:api\` (conditional)
  - \`bun run ci:required:docker:web\` (conditional)
  - \`bun run ci:required:docker:worker\` (conditional)
EOF
}

run_required() {
  mkdir -p .ci-diagnostics/required

  local failures=()
  run_check "required" "typecheck" bun run ci:required:typecheck || failures+=("typecheck")
  run_check "required" "build" bun run ci:required:build || failures+=("build")
  run_check "required" "quality_check" bun run ci:required:quality || failures+=("quality:check")
  run_check "required" "studio_integration" bun run ci:required:studio-integration || failures+=("studio:test:integration")

  if [[ "${STUDIO_DOCKER_CHANGED:-false}" == "true" ]]; then
    write_summary <<EOF
### Studio Docker Guard
- Triggered by path changes.
- Running Studio Docker image builds in required lane.
EOF

    run_check "required" "studio_docker_api_build" bun run ci:required:docker:api || failures+=("studio:docker:api")
    run_check "required" "studio_docker_web_build" bun run ci:required:docker:web || failures+=("studio:docker:web")
    run_check "required" "studio_docker_worker_build" bun run ci:required:docker:worker || failures+=("studio:docker:worker")
  else
    write_summary <<EOF
### Studio Docker Guard
- Skipped by path filter (no Studio Docker/dependency file changes).
EOF
  fi

  if ((${#failures[@]} > 0)); then
    write_output "failures" "${failures[*]}"
    exit 1
  fi

  write_output "failures" "none"
}

required_failure_summary() {
  write_summary <<EOF
### ❌ Required checks failed
- Failed commands: \`${FAILED_COMMANDS:-unknown}\`
- Review log sections below and use local parity commands to reproduce.
- Suggested local parity commands:
  - \`bun run ci:required\`
  - \`bun run ci:required:docker\` (when the Studio Docker guard is triggered)
- If Docker builds failed with frozen lockfile errors, run \`bun install\` and commit updated \`bun.lock\`.
EOF
}

replay_logs() {
  local lane="${1:?lane is required}"

  echo "Replaying ${lane}-check logs (raw):"
  for file in .ci-diagnostics/"${lane}"/*.log; do
    echo "----- ${file} -----"
    cat "${file}"
  done
}

deploy_handoff_summary() {
  write_summary <<EOF
### Deploy Handoff Artifact
- Artifact name: \`openlinks-dist\`
- Producer workflow: \`CI\`
- Intended consumer: \`Deploy Pages\` workflow
EOF
}

strict_summary() {
  write_summary <<EOF
## Strict Signal Lane (Phase 5 Non-Blocking)
- Commands:
  - \`bun run build:strict\`
  - \`bun run quality:strict\`
- Policy: strict failures are warning signals in this phase.
EOF
}

run_strict() {
  mkdir -p .ci-diagnostics/strict

  local failures=()
  if ! run_check "strict" "build_strict" bun run build:strict; then
    failures+=("build:strict")
    write_summary <<EOF
### Strict Lane Follow-up
- \`build:strict\` failed, so \`quality:strict\` was skipped because build artifacts were not produced.
EOF
  else
    run_check "strict" "quality_strict" bun run quality:strict || failures+=("quality:strict")
  fi

  if ((${#failures[@]} > 0)); then
    write_output "failures" "${failures[*]}"
    exit 1
  fi

  write_output "failures" "none"
}

strict_warning_summary() {
  write_summary <<EOF
### ⚠ Strict checks reported failures (non-blocking)
- Failed strict commands: \`${FAILED_COMMANDS:-unknown}\`
- Required checks passed, so this does not block merge/deploy in Phase 5.
- Address strict diagnostics before advancing quality gates.
EOF
}

usage() {
  cat <<EOF
Usage: bash scripts/github-actions/ci.sh <command>

Commands:
  required-summary
  run-required
  required-failure-summary
  replay-logs <required|strict>
  deploy-handoff-summary
  strict-summary
  run-strict
  strict-warning-summary
EOF
}

command_name="${1:-}"
case "$command_name" in
  required-summary)
    required_summary
    ;;
  run-required)
    run_required
    ;;
  required-failure-summary)
    required_failure_summary
    ;;
  replay-logs)
    replay_logs "${2:-}"
    ;;
  deploy-handoff-summary)
    deploy_handoff_summary
    ;;
  strict-summary)
    strict_summary
    ;;
  run-strict)
    run_strict
    ;;
  strict-warning-summary)
    strict_warning_summary
    ;;
  *)
    usage
    exit 1
    ;;
esac
