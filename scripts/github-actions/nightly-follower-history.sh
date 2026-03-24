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

commit_and_push() {
  git config user.name "github-actions[bot]"
  git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

  git add data/cache/rich-public-cache.json
  git add public/history/followers/index.json
  if compgen -G "public/history/followers/*.csv" >/dev/null; then
    git add public/history/followers/*.csv
  fi

  if git diff --cached --quiet; then
    write_output "push_result" "no_changes"
    exit 0
  fi

  git commit -m "data(followers): refresh nightly history"
  git push origin HEAD:main
  write_output "push_result" "pushed"
}

usage() {
  cat <<EOF
Usage: bash scripts/github-actions/nightly-follower-history.sh <command>

Commands:
  append-history
  commit-and-push
EOF
}

command_name="${1:-}"
case "$command_name" in
  append-history)
    append_history
    ;;
  commit-and-push)
    commit_and_push
    ;;
  *)
    usage
    exit 1
    ;;
esac
