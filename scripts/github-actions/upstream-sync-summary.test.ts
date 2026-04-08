import { test } from "bun:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const SCRIPT_PATH = path.join(ROOT, "scripts/github-actions/upstream-sync-summary.mjs");

const runSummaryScript = (
  input:
    | { kind: "missing"; status?: string }
    | { kind: "empty"; status?: string }
    | { kind: "invalid"; status?: string; contents?: string }
    | { kind: "valid"; status?: string; payload: Record<string, unknown> },
) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "open-links-upstream-sync-summary-"));
  const resultPath = path.join(tempDir, "upstream-sync.json");
  const cleanup = () => {
    fs.rmSync(tempDir, { force: true, recursive: true });
  };

  if (input.kind === "empty") {
    fs.writeFileSync(resultPath, "", "utf8");
  } else if (input.kind === "invalid") {
    fs.writeFileSync(resultPath, input.contents ?? "{", "utf8");
  } else if (input.kind === "valid") {
    fs.writeFileSync(resultPath, `${JSON.stringify(input.payload)}\n`, "utf8");
  }

  return {
    cleanup,
    result: spawnSync("node", [SCRIPT_PATH], {
      cwd: tempDir,
      encoding: "utf8",
      env: {
        ...process.env,
        SYNC_COMMAND_STATUS: input.status ?? "1",
        UPSTREAM_SYNC_DEPLOY_DISPATCH_STATUS:
          input.kind === "valid" ? "requested" : process.env.UPSTREAM_SYNC_DEPLOY_DISPATCH_STATUS,
        UPSTREAM_SYNC_RESULT_PATH: resultPath,
      },
    }),
  };
};

test("upstream sync summary prints a fallback message when the result file is missing", () => {
  const { cleanup, result } = runSummaryScript({ kind: "missing", status: "1" });
  try {
    assert.equal(result.status, 0);
    assert.match(result.stdout, /missing result file; exit 1/u);
  } finally {
    cleanup();
  }
});

test("upstream sync summary prints a fallback message when the result file is empty", () => {
  const { cleanup, result } = runSummaryScript({ kind: "empty", status: "1" });
  try {
    assert.equal(result.status, 0);
    assert.match(result.stdout, /empty result file; exit 1/u);
  } finally {
    cleanup();
  }
});

test("upstream sync summary prints a fallback message when the result file is invalid JSON", () => {
  const { cleanup, result } = runSummaryScript({ kind: "invalid", status: "1", contents: "{" });
  try {
    assert.equal(result.status, 0);
    assert.match(result.stdout, /invalid JSON result; exit 1/u);
  } finally {
    cleanup();
  }
});

test("upstream sync summary renders the structured result when valid JSON is present", () => {
  const { cleanup, result } = runSummaryScript({
    kind: "valid",
    status: "0",
    payload: {
      status: "merged",
      message: "Synchronized origin/main with upstream/main and pushed the result.",
      branchChanged: true,
      publishRemote: "origin",
      publishBranch: "main",
      targetBranch: "main",
      baseRef: "origin/main",
      upstreamRef: "upstream/main",
      beforeSha: "1111111",
      afterSha: "2222222",
      pushStatus: "pushed",
      pushed: true,
      sharedConflicts: [],
      forkOwnedConflicts: [],
    },
  });
  try {
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Status: `merged`/u);
    assert.match(result.stdout, /Publish target: `origin\/main`/u);
    assert.match(result.stdout, /Base ref: `origin\/main`/u);
    assert.match(result.stdout, /Before SHA: `1111111`/u);
    assert.match(result.stdout, /After SHA: `2222222`/u);
    assert.match(result.stdout, /Push status: `pushed`/u);
    assert.match(result.stdout, /Pushed: `true`/u);
    assert.match(result.stdout, /Deploy handoff: `requested`/u);
  } finally {
    cleanup();
  }
});
