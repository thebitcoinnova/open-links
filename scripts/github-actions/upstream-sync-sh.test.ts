import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";

const ROOT = process.cwd();
const SCRIPT_PATH = path.join(ROOT, "scripts/github-actions/upstream-sync.sh");

const writeExecutable = (filePath: string, contents: string) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");
  fs.chmodSync(filePath, 0o755);
};

const createFakeGit = (binDir: string) => {
  writeExecutable(
    path.join(binDir, "git"),
    `#!/bin/bash
set -euo pipefail

if [[ "$1" == "rev-parse" && "\${2:-}" == "HEAD" ]]; then
  printf 'fake-head-sha\\n'
  exit 0
fi

printf 'unexpected git args: %s\\n' "$*" >&2
exit 1
`,
  );
};

const createFakeBun = (binDir: string, exitCode: 0 | 1) => {
  writeExecutable(
    path.join(binDir, "bun"),
    `#!/bin/bash
set -euo pipefail

if [[ "$1" == "run" && "\${2:-}" == "sync:upstream:main" && "\${3:-}" == "--json" ]]; then
  cat <<'JSON'
{
  "status": "${exitCode === 0 ? "up_to_date" : "conflict"}",
  "message": "${exitCode === 0 ? "Already up to date with upstream/main." : "Fork has shared-file conflicts with upstream; manual resolution required (README.md)."}",
  "beforeSha": "fake-before-sha",
  "afterSha": "${exitCode === 0 ? "fake-after-sha" : "fake-before-sha"}",
  "branchChanged": false,
  "pushStatus": "${exitCode === 0 ? "not_needed" : "not_attempted"}",
  "pushed": false,
  "targetBranch": "main",
  "upstreamRef": "upstream/main",
  "sharedConflicts": ${exitCode === 0 ? "[]" : '["README.md"]'},
  "forkOwnedConflicts": []
}
JSON
  exit ${exitCode}
fi

printf 'unexpected bun args: %s\\n' "$*" >&2
exit 1
`,
  );
};

const runWrapper = (t: test.TestContext, exitCode: 0 | 1) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "open-links-upstream-sync-sh-"));
  const binDir = path.join(tempDir, "bin");
  t.after(() => {
    fs.rmSync(tempDir, { force: true, recursive: true });
  });

  createFakeGit(binDir);
  createFakeBun(binDir, exitCode);

  return spawnSync("/bin/bash", [SCRIPT_PATH, "run-sync"], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_OUTPUT: "",
      PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
      RUNNER_TEMP: tempDir,
    },
  });
};

test("upstream sync wrapper prints structured result when sync fails", (t) => {
  const result = runWrapper(t, 1);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /before_sha=fake-before-sha/u);
  assert.match(result.stdout, /after_sha=fake-before-sha/u);
  assert.match(result.stdout, /command_status=1/u);
  assert.match(result.stdout, /result_path=/u);
  assert.match(result.stdout, /push_status=not_attempted/u);
  assert.match(result.stdout, /pushed=false/u);
  assert.match(result.stderr, /Upstream sync failed; structured result follows:/u);
  assert.match(result.stderr, /"status": "conflict"/u);
  assert.match(result.stderr, /"sharedConflicts": \["README\.md"\]/u);
});

test("upstream sync wrapper keeps successful runs quiet", (t) => {
  const result = runWrapper(t, 0);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /command_status=0/u);
  assert.match(result.stdout, /before_sha=fake-before-sha/u);
  assert.match(result.stdout, /after_sha=fake-after-sha/u);
  assert.match(result.stdout, /push_status=not_needed/u);
  assert.match(result.stdout, /pushed=false/u);
  assert.doesNotMatch(result.stderr, /structured result follows/u);
  assert.doesNotMatch(result.stderr, /"status": "up_to_date"/u);
});
