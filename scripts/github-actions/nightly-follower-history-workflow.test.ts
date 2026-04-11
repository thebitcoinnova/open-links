import { test } from "bun:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const WORKFLOW_PATH = path.join(ROOT, ".github/workflows/nightly-follower-history.yml");

const extractJobBlock = (workflowSource: string, jobId: string) => {
  const lines = workflowSource.split(/\r?\n/u);
  const startIndex = lines.findIndex((line) => line === `  ${jobId}:`);

  assert.notEqual(startIndex, -1, `Expected to find workflow job '${jobId}'.`);

  const collectedLines = [lines[startIndex] ?? ""];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (/^ {2}[a-z0-9_-]+:/i.test(line)) {
      break;
    }
    collectedLines.push(line);
  }

  return collectedLines.join("\n");
};

test("nightly follower history AWS deploy runs under the production environment", () => {
  // Arrange
  const workflowSource = fs.readFileSync(WORKFLOW_PATH, "utf8");

  // Act
  const jobBlock = extractJobBlock(workflowSource, "sync-and-deploy");

  // Assert
  assert.match(jobBlock, /AWS_DEPLOY_ROLE_ARN/u);
  assert.match(jobBlock, /runs-on: ubuntu-latest\s+environment:\s+name: production\s+steps:/u);
});
