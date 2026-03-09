#!/usr/bin/env bash
set -euo pipefail

readonly CI_REQUIRED_REGEX='^(src/|scripts/|data/|schema/|packages/|vite\.config\.ts$|tsconfig\.json$|package\.json$|bun\.lock$|docker-compose\.studio\.yml$)'
readonly STUDIO_DOCKER_REGEX='^(bun\.lock$|package\.json$|packages/.*/package\.json$|packages/studio-api/Dockerfile$|packages/studio-web/Dockerfile$|packages/studio-worker/Dockerfile$|docker-compose\.studio\.yml$)'
readonly CI_RELEVANT_PATHS=(
  src
  scripts
  data
  schema
  packages
  package.json
  bun.lock
  vite.config.ts
  tsconfig.json
  docker-compose.studio.yml
)

print_path_list() {
  local paths="$1"
  while IFS= read -r path; do
    [ -z "$path" ] && continue
    echo "  - $path"
  done <<< "$paths"
}

echo "pre-commit: running staged biome auto-fix"
if ! bun run biome:staged:fix; then
  echo "pre-commit: biome staged auto-fix/check failed."
  echo "Action: run 'bun run biome:staged:fix' and restage files."
  exit 1
fi

git update-index --again

staged_files="$(git diff --cached --name-only --diff-filter=ACMR)"
if [ -z "$staged_files" ]; then
  echo "pre-commit: no staged files after auto-fix; skipping targeted checks."
  exit 0
fi

echo "pre-commit: running lockfile sync guard"
if ! bun scripts/hooks/check-lockfile-sync.ts; then
  echo "pre-commit: lockfile sync guard failed."
  echo "Action: update lockfile with 'bun install', stage bun.lock, and retry commit."
  exit 1
fi

matches_paths() {
  local pattern="$1"
  if printf "%s\n" "$staged_files" | rg -q "$pattern"; then
    return 0
  fi
  return 1
}

collect_new_paths() {
  local before="$1"
  local after="$2"
  local maybe_path
  local new_paths=()

  while IFS= read -r maybe_path; do
    [ -z "$maybe_path" ] && continue

    if [ -z "$before" ] || ! printf "%s\n" "$before" | rg -Fxq "$maybe_path"; then
      new_paths+=("$maybe_path")
    fi
  done <<< "$after"

  if ((${#new_paths[@]} > 0)); then
    printf "%s\n" "${new_paths[@]}"
  fi
}

run_check() {
  local key="$1"
  shift

  echo "pre-commit: ::group::${key}"
  if "$@"; then
    echo "pre-commit: ::endgroup::"
    return 0
  fi

  local status=$?
  echo "pre-commit: ::endgroup::"
  return "$status"
}

run_required_ci_parity() {
  local failures=()
  local failure

  run_check "typecheck" bun run ci:required:typecheck || failures+=("typecheck")
  run_check "build" bun run ci:required:hook:build || failures+=("build")
  run_check "quality_check" bun run ci:required:hook:quality || failures+=("quality:check")
  run_check "studio_integration" bun run ci:required:studio-integration || failures+=("studio:test:integration")

  if matches_paths "$STUDIO_DOCKER_REGEX"; then
    echo "pre-commit: Studio Docker guard matched staged paths; running local Docker parity."
    run_check "studio_docker_api_build" bun run ci:required:docker:api || failures+=("studio:docker:api")
    run_check "studio_docker_web_build" bun run ci:required:docker:web || failures+=("studio:docker:web")
    run_check "studio_docker_worker_build" bun run ci:required:docker:worker || failures+=("studio:docker:worker")
  else
    echo "pre-commit: Studio Docker guard skipped (no staged Docker/dependency paths)."
  fi

  if ((${#failures[@]} > 0)); then
    echo "pre-commit: required CI parity failed."
    echo "Failed checks:"
    for failure in "${failures[@]}"; do
      echo "  - $failure"
    done
    echo "Action: run 'bun run ci:required' locally, and run 'bun run ci:required:docker' when the Studio Docker guard is triggered."
    return 1
  fi

  return 0
}

if matches_paths '^(data/|schema/|scripts/)'; then
  echo "pre-commit: running data validation (staged paths touched data/schema/scripts)"
  if ! bun run validate:data; then
    echo "pre-commit: bun run validate:data failed."
    echo "Action: fix validation errors, then restage and commit again."
    exit 1
  fi
else
  echo "pre-commit: skipping validate:data (no staged data/schema/scripts paths)"
fi

if matches_paths '^(src/|scripts/|data/|schema/|vite\.config\.ts$|tsconfig\.json$|package\.json$|bun\.lock$)'; then
  echo "pre-commit: running typecheck (staged paths touched TS/config inputs)"
  if ! bun run typecheck; then
    echo "pre-commit: bun run typecheck failed."
    echo "Action: fix TypeScript/config errors, then restage and commit again."
    exit 1
  fi
else
  echo "pre-commit: skipping typecheck (no staged TS/config inputs)"
fi

if matches_paths '^(scripts/)'; then
  echo "pre-commit: running embedded-code guardrails (staged paths touched scripts)"
  if ! bun run quality:embedded-code; then
    echo "pre-commit: bun run quality:embedded-code failed."
    echo "Action: move inline embedded code/template payloads to approved files and retry."
    exit 1
  fi
else
  echo "pre-commit: skipping quality:embedded-code (no staged scripts paths)"
fi

if matches_paths '^(packages/|docs/studio-self-serve\.md$)'; then
  echo "pre-commit: running studio checks (staged paths touched Studio)"
  if ! bun run studio:check; then
    echo "pre-commit: bun run studio:check failed."
    echo "Action: fix Studio type/lint/format issues, then restage and commit again."
    exit 1
  fi
else
  echo "pre-commit: skipping studio:check (no staged Studio paths)"
fi

if matches_paths "$CI_REQUIRED_REGEX"; then
  echo "pre-commit: running required CI parity (staged paths touched required-lane inputs)"

  relevant_unstaged_tracked="$(git diff --name-only -- "${CI_RELEVANT_PATHS[@]}")"
  if [ -n "$relevant_unstaged_tracked" ]; then
    echo "pre-commit: refusing required CI parity because unstaged tracked CI-relevant files are present."
    echo "Files:"
    print_path_list "$relevant_unstaged_tracked"
    echo "Action: stage or stash those tracked files before committing, or bypass deliberately with 'git commit --no-verify'."
    exit 1
  fi

  pre_parity_unstaged_tracked="$(git diff --name-only)"
  parity_failed=0

  if ! run_required_ci_parity; then
    parity_failed=1
  fi

  post_parity_unstaged_tracked="$(git diff --name-only)"
  new_unstaged_tracked="$(collect_new_paths "$pre_parity_unstaged_tracked" "$post_parity_unstaged_tracked")"

  if [ -n "$new_unstaged_tracked" ]; then
    echo "pre-commit: non-mutating required CI parity unexpectedly changed tracked files that are not staged."
    echo "Files:"
    print_path_list "$new_unstaged_tracked"
    echo "Action: investigate the command that mutated tracked files; pre-commit parity should be read-only for tracked outputs now."
    parity_failed=1
  fi

  if [ "$parity_failed" -ne 0 ]; then
    exit 1
  fi
else
  echo "pre-commit: skipping required CI parity (no staged required-lane inputs)"
fi
