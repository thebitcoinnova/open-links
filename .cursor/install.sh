#!/usr/bin/env bash
set -euo pipefail

BUN_VERSION="$(node -p "const maybePackageManager = require('./package.json').packageManager ?? ''; maybePackageManager.startsWith('bun@') ? maybePackageManager.slice(4) : ''")"

if [[ -z "${BUN_VERSION}" ]]; then
  echo "Expected package.json packageManager to be bun@<version>." >&2
  exit 1
fi

if ! command -v bun >/dev/null 2>&1 || [[ "$(bun --version)" != "${BUN_VERSION}" ]]; then
  curl -fsSL https://bun.sh/install | bash -s -- "bun-v${BUN_VERSION}"
fi

export BUN_INSTALL="/home/ubuntu/.bun"
export PATH="${BUN_INSTALL}/bin:${PATH}"

bun --version
bun install --frozen-lockfile || bun install
