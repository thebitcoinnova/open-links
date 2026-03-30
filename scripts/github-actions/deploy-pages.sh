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

resolve_aws_opt_in() {
  if [[ "${OPENLINKS_ENABLE_AWS_DEPLOY:-}" == "true" ]]; then
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
