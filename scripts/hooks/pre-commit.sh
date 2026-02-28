#!/usr/bin/env sh
set -eu

echo "pre-commit: running staged biome auto-fix"
if ! bunx @biomejs/biome check --staged --write --files-ignore-unknown=true --no-errors-on-unmatched; then
  echo "pre-commit: biome staged auto-fix/check failed."
  echo "Action: run 'bunx @biomejs/biome check --staged --write' and restage files."
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
  pattern="$1"
  if printf "%s\n" "$staged_files" | rg -q "$pattern"; then
    return 0
  fi
  return 1
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
