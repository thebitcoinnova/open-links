import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";

const ROOT = process.cwd();
const WORKFLOW_PATH = path.join(ROOT, ".github/workflows/nightly-follower-history.yml");

const requireLine = (workflowSource: string, needle: string) => {
  const index = workflowSource.indexOf(needle);
  assert.notEqual(index, -1, `Expected workflow to contain '${needle}'.`);
  return index;
};

test("nightly follower history runs under production and commits before building or pushing", () => {
  const workflowSource = fs.readFileSync(WORKFLOW_PATH, "utf8");

  assert.match(
    workflowSource,
    /sync-and-deploy:\n\s+name: Sync Follower History and Deploy\n\s+runs-on: ubuntu-latest\n\s+environment:\n\s+name: production/u,
  );

  const commitIndex = requireLine(workflowSource, "- name: Commit follower-history artifacts");
  const buildIndex = requireLine(workflowSource, "- name: Build deploy artifacts");
  const pushIndex = requireLine(workflowSource, "- name: Push follower-history artifacts");
  const awsCredentialsIndex = requireLine(workflowSource, "- name: Configure AWS credentials");
  const verifyIndex = requireLine(workflowSource, "- name: Verify enabled deployment targets");

  assert.ok(commitIndex < buildIndex, "Expected commit step to run before build.");
  assert.ok(buildIndex < pushIndex, "Expected build step to run before push.");
  assert.ok(pushIndex < awsCredentialsIndex, "Expected push step to run before AWS deploy.");
  assert.ok(pushIndex < verifyIndex, "Expected push step to run before deploy verification.");

  assert.match(
    workflowSource,
    /- name: Build deploy artifacts\n\s+if: steps\.commit\.outputs\.commit_result == 'committed'\n\s+run: bun run deploy:build/u,
  );
  assert.match(
    workflowSource,
    /- name: Push follower-history artifacts\n\s+if: steps\.commit\.outputs\.commit_result == 'committed'/u,
  );
  assert.match(
    workflowSource,
    /- name: Verify enabled deployment targets\n\s+if: steps\.push\.outputs\.push_result == 'pushed' && steps\.aws_opt_in\.outputs\.enabled == 'true'\n\s+run: bun run deploy:verify/u,
  );
});
