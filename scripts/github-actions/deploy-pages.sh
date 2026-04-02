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

resolve_context() {
  if [[ "${GITHUB_EVENT_NAME}" == "workflow_run" ]]; then
    {
      echo "checkout_ref=${GITHUB_WORKFLOW_RUN_HEAD_SHA:?missing GITHUB_WORKFLOW_RUN_HEAD_SHA}"
      echo "ci_run_id=${GITHUB_WORKFLOW_RUN_ID:?missing GITHUB_WORKFLOW_RUN_ID}"
      echo "artifact_source=ci"
    } >>"$GITHUB_OUTPUT"
  else
    {
      echo "checkout_ref=${GITHUB_SHA:?missing GITHUB_SHA}"
      echo "ci_run_id="
      echo "artifact_source=manual-build"
    } >>"$GITHUB_OUTPUT"
  fi
}

resolve_targets() {
  local outputs
  outputs="$(node --input-type=module <<'EOF'
import fs from "node:fs";

const defaultsConfig = JSON.parse(fs.readFileSync("config/deployment.defaults.json", "utf8"));
const overlayConfig = fs.existsSync("config/deployment.json")
  ? JSON.parse(fs.readFileSync("config/deployment.json", "utf8"))
  : null;
const mergedConfig = overlayConfig
  ? {
      ...defaultsConfig,
      ...overlayConfig,
      targets: {
        ...(defaultsConfig.targets ?? {}),
        ...(overlayConfig.targets ?? {}),
        aws: {
          ...(defaultsConfig.targets?.aws ?? {}),
          ...(overlayConfig.targets?.aws ?? {}),
        },
        "github-pages": {
          ...(defaultsConfig.targets?.["github-pages"] ?? {}),
          ...(overlayConfig.targets?.["github-pages"] ?? {}),
        },
        render: {
          ...(defaultsConfig.targets?.render ?? {}),
          ...(overlayConfig.targets?.render ?? {}),
        },
        railway: {
          ...(defaultsConfig.targets?.railway ?? {}),
          ...(overlayConfig.targets?.railway ?? {}),
        },
      },
    }
  : defaultsConfig;
const enabledTargets = new Set(
  Array.isArray(mergedConfig.enabledTargets) ? mergedConfig.enabledTargets : [],
);
const primaryTarget =
  typeof mergedConfig.primaryTarget === "string" ? mergedConfig.primaryTarget : "github-pages";

console.log(`aws_target_enabled=${enabledTargets.has("aws")}`);
console.log(`github_pages_enabled=${enabledTargets.has("github-pages")}`);
console.log(`render_enabled=${enabledTargets.has("render")}`);
console.log(`railway_enabled=${enabledTargets.has("railway")}`);
console.log(`primary_target=${primaryTarget}`);
EOF
)"

  while IFS= read -r line; do
    if [[ -n "${line}" ]]; then
      write_output "${line%%=*}" "${line#*=}"
    fi
  done <<<"${outputs}"
}

resolve_aws_opt_in() {
  if [[ "${AWS_TARGET_ENABLED:-false}" == "true" && "${OPENLINKS_ENABLE_AWS_DEPLOY:-}" == "true" ]]; then
    echo "enabled=true" >>"$GITHUB_OUTPUT"
  else
    echo "enabled=false" >>"$GITHUB_OUTPUT"
  fi
}

publish_context_summary() {
  write_summary <<EOF
## Deploy Context
- Ref: \`${CHECKOUT_REF:-unknown}\`
- Artifact source: \`${ARTIFACT_SOURCE:-unknown}\`
- Primary target: \`${PRIMARY_TARGET:-unknown}\`
- AWS target enabled: \`${AWS_TARGET_ENABLED:-unknown}\`
- GitHub Pages enabled: \`${GITHUB_PAGES_ENABLED:-unknown}\`
- AWS enabled: \`${AWS_ENABLED:-unknown}\`
EOF
}

publish_pages_noop_summary() {
  write_summary <<EOF
## GitHub Pages Mirror
- Result: \`skipped\`
- Reason: live deploy manifest already matches the built Pages artifact.
EOF
}

usage() {
  cat <<EOF
Usage: bash scripts/github-actions/deploy-pages.sh <command>

Commands:
  resolve-context
  resolve-targets
  resolve-aws-opt-in
  publish-context-summary
  publish-pages-noop-summary
EOF
}

command_name="${1:-}"
case "$command_name" in
  resolve-context)
    resolve_context
    ;;
  resolve-targets)
    resolve_targets
    ;;
  resolve-aws-opt-in)
    resolve_aws_opt_in
    ;;
  publish-context-summary)
    publish_context_summary
    ;;
  publish-pages-noop-summary)
    publish_pages_noop_summary
    ;;
  *)
    usage
    exit 1
    ;;
esac
