#!/usr/bin/env bash
set -euo pipefail

write_output() {
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    printf '%s=%s\n' "$1" "$2" >>"$GITHUB_OUTPUT"
  else
    printf '%s=%s\n' "$1" "$2"
  fi
}

read_result_field() {
  local result_path="$1"
  local field_name="$2"

  if [[ ! -s "$result_path" ]]; then
    return 0
  fi

  node -e '
    const fs = require("node:fs");
    const [filePath, fieldName] = process.argv.slice(1);

    try {
      const value = JSON.parse(fs.readFileSync(filePath, "utf8"))[fieldName];
      if (value !== undefined) {
        process.stdout.write(String(value));
      }
    } catch {}
  ' "$result_path" "$field_name"
}

configure_upstream_remote() {
  local upstream_url="${UPSTREAM_REPOSITORY_URL:-https://github.com/pRizz/open-links.git}"

  if git remote get-url upstream >/dev/null 2>&1; then
    git remote set-url upstream "$upstream_url"
  else
    git remote add upstream "$upstream_url"
  fi
}

configure_git_identity() {
  git config user.name "github-actions[bot]"
  git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
}

dispatch_deploy() {
  local repository="${DEPLOY_WORKFLOW_REPOSITORY:?missing DEPLOY_WORKFLOW_REPOSITORY}"
  local ref="${DEPLOY_WORKFLOW_REF:?missing DEPLOY_WORKFLOW_REF}"
  local token="${DEPLOY_WORKFLOW_TOKEN:?missing DEPLOY_WORKFLOW_TOKEN}"
  local workflow_file="${DEPLOY_WORKFLOW_FILE:-deploy-production.yml}"

  curl \
    --fail \
    --silent \
    --show-error \
    -X POST \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer ${token}" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/${repository}/actions/workflows/${workflow_file}/dispatches" \
    -d "{\"ref\":\"${ref}\"}"
}

run_sync() {
  local temp_root="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
  mkdir -p "$temp_root"
  local result_path
  result_path="$(mktemp "${temp_root%/}/openlinks-upstream-sync-XXXXXX.json")"

  set +e
  bun run sync:upstream:main --json > "$result_path"
  local command_status=$?
  set -e

  write_output "command_status" "$command_status"
  write_output "result_path" "$result_path"
  write_output "before_sha" "$(read_result_field "$result_path" "beforeSha")"
  write_output "after_sha" "$(read_result_field "$result_path" "afterSha")"
  write_output "push_status" "$(read_result_field "$result_path" "pushStatus")"
  write_output "pushed" "$(read_result_field "$result_path" "pushed")"

  return 0
}

usage() {
  cat <<EOF
Usage: bash scripts/github-actions/upstream-sync.sh <command>

Commands:
  configure-upstream-remote
  configure-git-identity
  dispatch-deploy
  run-sync
EOF
}

command_name="${1:-}"
case "$command_name" in
  configure-upstream-remote)
    configure_upstream_remote
    ;;
  configure-git-identity)
    configure_git_identity
    ;;
  dispatch-deploy)
    dispatch_deploy
    ;;
  run-sync)
    run_sync
    ;;
  *)
    usage
    exit 1
    ;;
esac
