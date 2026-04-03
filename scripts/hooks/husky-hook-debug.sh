#!/usr/bin/env sh

husky_hook_debug_sanitize() {
  printf '%s' "$1" | tr '\n\t' '  '
}

husky_hook_debug_log() {
  if [ -z "${HUSKY_HOOK_DEBUG_LOG_PATH:-}" ]; then
    return 0
  fi

  timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date)"
  current_cwd="$(pwd 2>/dev/null || printf 'unknown')"
  current_shell="${SHELL:-unknown}"
  hooks_path="$(git config --get core.hooksPath 2>/dev/null || printf 'unset')"
  current_ppid="${PPID:-$(ps -o ppid= -p "$$" 2>/dev/null | tr -d ' ')}"

  {
    printf 'ts=%s' "$(husky_hook_debug_sanitize "$timestamp")"
    printf '\thook=%s' "$(husky_hook_debug_sanitize "${HUSKY_HOOK_DEBUG_HOOK_NAME:-unknown}")"
    printf '\tevent=%s' "$(husky_hook_debug_sanitize "$1")"
    printf '\tstatus=%s' "$(husky_hook_debug_sanitize "$2")"
    printf '\tpid=%s' "$$"
    printf '\tppid=%s' "$(husky_hook_debug_sanitize "$current_ppid")"
    printf '\tcwd=%s' "$(husky_hook_debug_sanitize "$current_cwd")"
    printf '\tshell=%s' "$(husky_hook_debug_sanitize "$current_shell")"
    printf '\thooks_path=%s' "$(husky_hook_debug_sanitize "$hooks_path")"
    printf '\tscript=%s' "$(husky_hook_debug_sanitize "${HUSKY_HOOK_DEBUG_SCRIPT_PATH:-unknown}")"

    if [ -n "${HUSKY_HOOK_DEBUG_SIGNAL:-}" ]; then
      printf '\tsignal=%s' "$(husky_hook_debug_sanitize "$HUSKY_HOOK_DEBUG_SIGNAL")"
    fi

    if [ -n "${HUSKY_HOOK_DEBUG_ARGS:-}" ]; then
      printf '\targs=%s' "$(husky_hook_debug_sanitize "$HUSKY_HOOK_DEBUG_ARGS")"
    fi

    printf '\n'
  } >>"$HUSKY_HOOK_DEBUG_LOG_PATH" 2>/dev/null || :
}

husky_hook_debug_on_exit() {
  husky_hook_debug_log "exit" "$?"
}

husky_hook_debug_on_signal() {
  HUSKY_HOOK_DEBUG_SIGNAL="$1"
  husky_hook_debug_log "signal" "$2"
  trap - EXIT
  exit "$3"
}

husky_hook_debug_init() {
  HUSKY_HOOK_DEBUG_HOOK_NAME="$1"
  shift

  HUSKY_HOOK_DEBUG_SCRIPT_PATH="$0"
  HUSKY_HOOK_DEBUG_ARGS="$*"

  repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
  HUSKY_HOOK_DEBUG_LOG_DIR="$repo_root/.cache/husky"
  HUSKY_HOOK_DEBUG_LOG_PATH="$HUSKY_HOOK_DEBUG_LOG_DIR/hooks.log"

  mkdir -p "$HUSKY_HOOK_DEBUG_LOG_DIR" 2>/dev/null || :

  husky_hook_debug_log "start" "0"

  trap 'husky_hook_debug_on_exit' EXIT
  trap 'husky_hook_debug_on_signal INT 130' INT
  trap 'husky_hook_debug_on_signal TERM 143' TERM
}
