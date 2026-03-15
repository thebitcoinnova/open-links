import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";

const ROOT = process.cwd();

test("run-strict skips quality when build_strict fails", (t) => {
  // Arrange
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "open-links-ci-test-"));
  const fakeBinDir = path.join(tempDir, "bin");
  const invocationLogPath = path.join(tempDir, "bun-invocations.log");
  const fakeBunPath = path.join(fakeBinDir, "bun");
  fs.mkdirSync(fakeBinDir, { recursive: true });
  fs.writeFileSync(
    fakeBunPath,
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> ${JSON.stringify(invocationLogPath)}
if [[ "$*" == "run build:strict" ]]; then
  echo "simulated build_strict failure" >&2
  exit 1
fi
if [[ "$*" == "run quality:strict" ]]; then
  echo "quality:strict should have been skipped" >&2
  exit 99
fi
exit 0
`,
    "utf8",
  );
  fs.chmodSync(fakeBunPath, 0o755);
  t.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // Act
  const result = spawnSync(
    "bash",
    [path.join(ROOT, "scripts/github-actions/ci.sh"), "run-strict"],
    {
      cwd: tempDir,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${fakeBinDir}:${process.env.PATH ?? ""}`,
      },
    },
  );
  const combinedOutput = `${result.stdout}${result.stderr}`;
  const invocations = fs
    .readFileSync(invocationLogPath, "utf8")
    .trim()
    .split("\n")
    .filter((line) => line.length > 0);

  // Assert
  assert.equal(result.status, 1);
  assert.deepEqual(invocations, ["run build:strict"]);
  assert.match(combinedOutput, /quality:strict.*skipped/u);
  assert.match(combinedOutput, /failures=build:strict/u);
});
