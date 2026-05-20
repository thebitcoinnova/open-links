#!/usr/bin/env bash
set -euo pipefail

write_output() {
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    printf '%s=%s\n' "$1" "$2" >>"$GITHUB_OUTPUT"
  else
    printf '%s=%s\n' "$1" "$2"
  fi
}

write_summary() {
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    cat >>"$GITHUB_STEP_SUMMARY"
  else
    cat
  fi
}

resolve_build_timestamp() {
  write_output "value" "$(git show -s --format=%cI "$GITHUB_SHA")"
}

validate_env() {
  if [ "${PAGES_BASE_MODE:-}" != "root" ]; then
    echo "::error::PAGES_BASE_MODE must be 'root' for README screenshot workflow."
    exit 1
  fi
  if [ -n "${BASE_PATH:-}" ]; then
    echo "::error::BASE_PATH must be empty for README screenshot workflow."
    exit 1
  fi
  if [ -n "${REPO_NAME_OVERRIDE:-}" ]; then
    echo "::error::REPO_NAME_OVERRIDE must be empty for README screenshot workflow."
    exit 1
  fi
}

stage_readme_screenshot_files() {
  git add \
    README.md \
    docs/assets/openlinks-preview.png \
    docs/assets/openlinks-preview-tablet.png \
    docs/assets/openlinks-preview-mobile.png
}

start_preview() {
  bun run preview --host 127.0.0.1 --port 4173 --strictPort >/tmp/openlinks-preview.log 2>&1 &
  write_output "pid" "$!"
}

wait_preview() {
  local preview_url="${PREVIEW_URL:-http://127.0.0.1:4173/}"

  for _ in {1..60}; do
    if curl --silent --show-error --fail "$preview_url" >/dev/null; then
      exit 0
    fi
    sleep 1
  done

  echo "::error::Preview server did not become ready within 60 seconds."
  echo "::group::Preview log"
  cat /tmp/openlinks-preview.log
  echo "::endgroup::"
  exit 1
}

resolve_capture_url() {
  local script_src
  script_src="$(sed -n 's|.*<script type=\"module\" crossorigin src=\"\([^\"]*\)\".*|\1|p' dist/index.html | head -n 1)"
  if [ -z "$script_src" ]; then
    echo "::error::Unable to resolve script src from dist/index.html."
    sed -n '1,120p' dist/index.html
    exit 1
  fi

  local capture_path="/"
  if [[ "$script_src" == */assets/* ]]; then
    local maybe_prefix="${script_src%%/assets/*}"
    if [ -n "$maybe_prefix" ] && [ "$maybe_prefix" != "$script_src" ]; then
      capture_path="${maybe_prefix}/"
    fi
  fi

  local capture_url="http://127.0.0.1:4173${capture_path}"
  local asset_url="http://127.0.0.1:4173${script_src}"
  echo "Resolved capture_url=${capture_url}" >&2
  echo "Resolved asset_url=${asset_url}" >&2

  local ready="false"
  for _ in {1..60}; do
    if curl --silent --show-error --fail "$capture_url" >/dev/null &&
      curl --silent --show-error --fail "$asset_url" >/dev/null; then
      ready="true"
      break
    fi
    sleep 1
  done

  if [ "$ready" != "true" ]; then
    echo "::error::Preview did not become ready with matching HTML and asset URLs."
    echo "::group::dist/index.html"
    sed -n '1,160p' dist/index.html
    echo "::endgroup::"
    echo "::group::Preview log"
    cat /tmp/openlinks-preview.log
    echo "::endgroup::"
    echo "::group::Root HTML (first 120 lines)"
    curl --silent "http://127.0.0.1:4173/" | sed -n '1,120p'
    echo "::endgroup::"
    echo "::group::Capture URL HTML (first 120 lines)"
    curl --silent "$capture_url" | sed -n '1,120p'
    echo "::endgroup::"
    exit 1
  fi

  printf '%s\n' "$capture_url"
}

capture_viewport_screenshot() {
  local label="$1"
  local viewport_size="$2"
  local output_path="$3"
  local minimum_bytes="$4"
  local capture_url="$5"

  npx --yes playwright@1.52.0 screenshot \
    --viewport-size="$viewport_size" \
    --timeout=120000 \
    --wait-for-selector=".profile-header" \
    --wait-for-timeout=1200 \
    "$capture_url" \
    "$output_path"

  local bytes
  bytes="$(wc -c <"$output_path")"
  if [ "$bytes" -lt "$minimum_bytes" ]; then
    echo "::error::Captured ${label} screenshot is unexpectedly small (${bytes} bytes)."
    exit 1
  fi

  echo "Captured ${label} screenshot (${viewport_size}) at ${output_path}."
}

capture_screenshot() {
  mkdir -p docs/assets

  local capture_url
  capture_url="$(resolve_capture_url)"

  capture_viewport_screenshot "desktop" "1280,720" "docs/assets/openlinks-preview.png" "20000" "$capture_url"
  capture_viewport_screenshot "tablet" "768,1024" "docs/assets/openlinks-preview-tablet.png" "20000" "$capture_url"
  capture_viewport_screenshot "mobile" "390,844" "docs/assets/openlinks-preview-mobile.png" "15000" "$capture_url"
}

stop_preview() {
  local pid="${PREVIEW_PID:-${1:-}}"
  if [ -n "$pid" ]; then
    kill "$pid" 2>/dev/null || true
  fi
}

publish_changes() {
  git config user.name "github-actions[bot]"
  git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

  stage_readme_screenshot_files

  if git diff --cached --quiet; then
    write_output "push_result" "no_changes"
    exit 0
  fi

  git commit -m "docs(readme): refresh OpenLinks screenshot"

  if git push origin HEAD:main; then
    write_output "push_result" "pushed"
    exit 0
  fi

  write_output "push_result" "blocked"
}

publish_summary() {
  write_summary <<EOF
## README Screenshot Sync
- Result: \`${PUSH_RESULT:-unknown}\`
- Files in scope:
  - \`README.md\`
  - \`docs/assets/openlinks-preview.png\`
  - \`docs/assets/openlinks-preview-tablet.png\`
  - \`docs/assets/openlinks-preview-mobile.png\`
EOF
}

check_changes() {
  stage_readme_screenshot_files
  if git diff --cached --quiet; then
    write_output "has_changes" "false"
  else
    write_output "has_changes" "true"
  fi
}

usage() {
  cat <<EOF
Usage: bash scripts/github-actions/readme-screenshot-sync.sh <command>

Commands:
  resolve-build-timestamp
  validate-env
  start-preview
  wait-preview
  capture-screenshot
  stop-preview [pid]
  publish-changes
  publish-summary
  check-changes
EOF
}

command_name="${1:-}"
case "$command_name" in
  resolve-build-timestamp)
    resolve_build_timestamp
    ;;
  validate-env)
    validate_env
    ;;
  start-preview)
    start_preview
    ;;
  wait-preview)
    wait_preview
    ;;
  capture-screenshot)
    capture_screenshot
    ;;
  stop-preview)
    stop_preview "${2:-}"
    ;;
  publish-changes)
    publish_changes
    ;;
  publish-summary)
    publish_summary
    ;;
  check-changes)
    check_changes
    ;;
  *)
    usage
    exit 1
    ;;
esac
