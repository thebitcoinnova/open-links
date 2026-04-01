import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";

const ROOT = process.cwd();
const SCRIPT_PATH = path.join(ROOT, "scripts/github-actions/upstream-sync-summary.mjs");

const runSummaryScript = (
  t: test.TestContext,
  input:
    | { kind: "missing"; status?: string }
    | { kind: "empty"; status?: string }
    | { kind: "invalid"; status?: string; contents?: string }
    | { kind: "valid"; status?: string; payload: Record<string, unknown> },
) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "open-links-upstream-sync-summary-"));
  const resultPath = path.join(tempDir, "upstream-sync.json");
  t.after(() => {
    fs.rmSync(tempDir, { force: true, recursive: true });
  });

  if (input.kind === "empty") {
    fs.writeFileSync(resultPath, "", "utf8");
  } else if (input.kind === "invalid") {
    fs.writeFileSync(resultPath, input.contents ?? "{", "utf8");
  } else if (input.kind === "valid") {
    fs.writeFileSync(resultPath, `${JSON.stringify(input.payload)}\n`, "utf8");
  }

  return spawnSync("node", [SCRIPT_PATH], {
    cwd: tempDir,
    encoding: "utf8",
    env: {
      ...process.env,
      SYNC_COMMAND_STATUS: input.status ?? "1",
      UPSTREAM_SYNC_RESULT_PATH: resultPath,
    },
  });
};

test("upstream sync summary prints a fallback message when the result file is missing", (t) => {
  const result = runSummaryScript(t, { kind: "missing", status: "1" });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /missing result file; exit 1/u);
});

test("upstream sync summary prints a fallback message when the result file is empty", (t) => {
  const result = runSummaryScript(t, { kind: "empty", status: "1" });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /empty result file; exit 1/u);
});

test("upstream sync summary prints a fallback message when the result file is invalid JSON", (t) => {
  const result = runSummaryScript(t, { kind: "invalid", status: "1", contents: "{" });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /invalid JSON result; exit 1/u);
});

test("upstream sync summary renders the structured result when valid JSON is present", (t) => {
  const result = runSummaryScript(t, {
    kind: "valid",
    status: "0",
    payload: {
      status: "up_to_date",
      message: "Already up to date with upstream/main.",
      branchChanged: false,
      targetBranch: "main",
      upstreamRef: "upstream/main",
      sharedConflicts: [],
      forkOwnedConflicts: [],
    },
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Status: `up_to_date`/u);
  assert.match(result.stdout, /Message: Already up to date with upstream\/main\./u);
  assert.match(result.stdout, /Branch changed: `false`/u);
});
