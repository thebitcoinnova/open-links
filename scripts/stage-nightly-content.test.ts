import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";

interface ContentRefreshPathConfig {
  directoryPrefixes: string[];
  exactPaths: string[];
}

const ROOT = process.cwd();
const STAGE_SCRIPT_PATH = path.join(ROOT, "scripts/stage-nightly-content.ts");

const runCommand = (command: string, args: string[], cwd: string): string => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
  });
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(" ")} failed:\n${result.stdout}${result.stderr}`,
  );
  return result.stdout;
};

const writeFixture = (rootDir: string, repoPath: string): void => {
  const targetPath = path.join(rootDir, repoPath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${repoPath}\n`, "utf8");
};

test("nightly staging discovers every refresh-owned output in a clean repository", (t) => {
  // Arrange
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openlinks-nightly-stage-"));
  t.after(() => fs.rmSync(tempDir, { force: true, recursive: true }));

  const pathConfig = JSON.parse(
    fs.readFileSync(path.join(ROOT, "config/content-refresh-paths.json"), "utf8"),
  ) as ContentRefreshPathConfig;
  const expectedPaths = [
    ...pathConfig.exactPaths,
    ...pathConfig.directoryPrefixes.map((prefix) => `${prefix}fixture.bin`),
  ].sort();

  fs.copyFileSync(path.join(ROOT, ".gitignore"), path.join(tempDir, ".gitignore"));
  writeFixture(tempDir, "README.md");
  runCommand("git", ["init", "--quiet"], tempDir);
  runCommand("git", ["config", "user.name", "OpenLinks Test"], tempDir);
  runCommand("git", ["config", "user.email", "openlinks-test@example.invalid"], tempDir);
  runCommand("git", ["add", ".gitignore", "README.md"], tempDir);
  runCommand("git", ["commit", "--quiet", "-m", "test fixture"], tempDir);

  for (const repoPath of expectedPaths) {
    writeFixture(tempDir, repoPath);
  }

  // Act
  const stageResult = spawnSync(process.execPath, [STAGE_SCRIPT_PATH], {
    cwd: tempDir,
    encoding: "utf8",
  });
  const stagedPaths = runCommand(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
    tempDir,
  )
    .split("\n")
    .map((repoPath) => repoPath.trim())
    .filter(Boolean)
    .sort();

  // Assert
  assert.equal(
    stageResult.status,
    0,
    `nightly staging failed:\n${stageResult.stdout}${stageResult.stderr}`,
  );
  assert.deepEqual(stagedPaths, expectedPaths);
});
