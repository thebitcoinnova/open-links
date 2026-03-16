#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: bash scripts/ci/archive-pages-artifact.sh <input-dir> <output-tar>" >&2
  exit 1
fi

input_dir="$1"
output_tar="$2"

if tar --help 2>&1 | grep -q -- "--hard-dereference"; then
  tar \
    --dereference \
    --hard-dereference \
    --directory "$input_dir" \
    -cvf "$output_tar" \
    --exclude=.git \
    --exclude=.github \
    .
  exit 0
fi

tar \
  --dereference \
  --directory "$input_dir" \
  -cvf "$output_tar" \
  .
