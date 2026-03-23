#!/usr/bin/env bash
set -euo pipefail

export BUN_INSTALL="/home/ubuntu/.bun"
export PATH="${BUN_INSTALL}/bin:${PATH}"

if command -v bun >/dev/null 2>&1; then
  bun --version
  echo "OpenLinks remote shell ready."
  echo "Suggested next commands:"
  echo "  bun run validate:data"
  echo "  bun run typecheck"
  echo "  bun run dev"
fi
