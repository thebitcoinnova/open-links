#!/usr/bin/env bash
set -euo pipefail

write_output() {
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    printf '%s=%s\n' "$1" "$2" >>"$GITHUB_OUTPUT"
  else
    printf '%s=%s\n' "$1" "$2"
  fi
}

append_history() {
  mkdir -p .ci-diagnostics
  bun scripts/sync-follower-history.ts \
    --public-rich-sync-summary .ci-diagnostics/public-rich-sync-summary.json \
    --summary-json .ci-diagnostics/nightly-follower-history-summary.json
}

configure_git_identity() {
  git config user.name "github-actions[bot]"
  git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
}

stage_history_artifacts() {
  git add data/cache/rich-public-cache.json
  git add public/history/followers/index.json
  if compgen -G "public/history/followers/*.csv" >/dev/null; then
    git add public/history/followers/*.csv
  fi
}

resolve_aws_opt_in() {
  if [[ "${OPENLINKS_ENABLE_AWS_DEPLOY:-}" == "true" && -n "${AWS_DEPLOY_ROLE_ARN:-}" ]]; then
    write_output "enabled" "true"
  else
    write_output "enabled" "false"
  fi
}

commit_history() {
  configure_git_identity
  stage_history_artifacts

  if git diff --cached --quiet; then
    write_output "commit_result" "no_changes"
    write_output "commit_sha" "$(git rev-parse HEAD)"
    return 0
  fi

  git commit -m "data(followers): refresh nightly history"
  write_output "commit_result" "committed"
  write_output "commit_sha" "$(git rev-parse HEAD)"
}

push_history() {
  local target_branch="${NIGHTLY_FOLLOWER_HISTORY_PUSH_BRANCH:-main}"

  set +e
  git push origin "HEAD:${target_branch}"
  local push_exit_code=$?
  set -e

  if [[ "$push_exit_code" -eq 0 ]]; then
    write_output "push_result" "pushed"
    return 0
  fi

  write_output "push_result" "failed"
  return "$push_exit_code"
}

usage() {
  cat <<EOF
Usage: bash scripts/github-actions/nightly-follower-history.sh <command>

Commands:
  append-history
  commit-history
  push-history
  resolve-aws-opt-in
EOF
}

command_name="${1:-}"
case "$command_name" in
  append-history)
    append_history
    ;;
  commit-history)
    commit_history
    ;;
  push-history)
    push_history
    ;;
  resolve-aws-opt-in)
    resolve_aws_opt_in
    ;;
  *)
    usage
    exit 1
    ;;
esac
