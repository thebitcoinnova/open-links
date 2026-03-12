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

validate_config() {
  local mode="${DISPATCH_BASE_MODE:-project}"
  local maybe_base_path="${DISPATCH_BASE_PATH:-}"

  if [[ "$mode" != "project" && "$mode" != "root" && "$mode" != "auto" ]]; then
    echo "::error::Invalid base_mode '$mode'. Use one of: project, root, auto."
    exit 1
  fi

  if [[ -n "$maybe_base_path" ]]; then
    if [[ "$maybe_base_path" != /* ]]; then
      echo "::error::base_path must start with '/'. Example: /open-links/"
      exit 1
    fi
    if [[ "$maybe_base_path" != */ ]]; then
      echo "::error::base_path must end with '/'. Example: /open-links/"
      exit 1
    fi
  fi
}

resolve_artifact_strategy() {
  local strategy_reason
  if [ -d dist ] && [ -n "$(find dist -mindepth 1 -print -quit)" ]; then
    write_output "reuse" "true"
    write_output "reason" "ci-artifact-reuse"
    strategy_reason="ci-artifact-reuse"
  else
    write_output "reuse" "false"
    write_output "reason" "rebuild-fallback"
    strategy_reason="rebuild-fallback"
  fi

  write_summary <<EOF
## Pages Deploy Artifact Strategy
- Strategy: \`${strategy_reason}\`
- CI artifact reuse preferred; rebuild used only when artifact is unavailable.
EOF
}

capture_context() {
  mkdir -p .deploy-diagnostics
  {
    echo "event_name=${GITHUB_EVENT_NAME:-}"
    echo "ref=${GITHUB_REF:-}"
    echo "head_branch=${HEAD_BRANCH:-}"
    echo "artifact_strategy=${ARTIFACT_STRATEGY_REASON:-}"
    echo "base_mode=${DISPATCH_BASE_MODE:-project}"
    echo "base_path=${DISPATCH_BASE_PATH:-}"
    echo "repo_override=${DISPATCH_REPO_OVERRIDE:-}"
  } >.deploy-diagnostics/context.txt
}

verify_artifact() {
  if [ ! -d dist ] || [ -z "$(find dist -mindepth 1 -print -quit)" ]; then
    echo "::error::No deployable dist artifact found."
    echo "::error::Remediation: ensure CI uploaded 'openlinks-dist' or rerun manual deploy to trigger rebuild fallback."
    exit 1
  fi
}

failure_summary() {
  write_summary <<EOF
### ❌ GitHub Pages deployment failed
- Verify repository Pages settings use **GitHub Actions** as source.
- Confirm CI workflow succeeded on \`main\` and produced artifact \`openlinks-dist\`.
- If dispatching manually, ensure \`base_path\` starts and ends with \`/\` when provided.
- Download \`deploy-pages-diagnostics\` artifact for deployment context details.
EOF
}

usage() {
  cat <<EOF
Usage: bash scripts/github-actions/deploy-pages.sh <command>

Commands:
  validate-config
  resolve-artifact-strategy
  capture-context
  verify-artifact
  failure-summary
EOF
}

command_name="${1:-}"
case "$command_name" in
  validate-config)
    validate_config
    ;;
  resolve-artifact-strategy)
    resolve_artifact_strategy
    ;;
  capture-context)
    capture_context
    ;;
  verify-artifact)
    verify_artifact
    ;;
  failure-summary)
    failure_summary
    ;;
  *)
    usage
    exit 1
    ;;
esac
