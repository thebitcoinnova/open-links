import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";

interface PackageManifest {
  scripts: Record<string, string>;
}

const ROOT = process.cwd();
const readRepoFile = (repoPath: string): string =>
  fs.readFileSync(path.join(ROOT, repoPath), "utf8");
const packageManifest = JSON.parse(readRepoFile("package.json")) as PackageManifest;
const refreshLeafPattern =
  /(public:clean|avatar:sync|enrich:rich|images:sync|social:preview:generate|badge:site|content:refresh)/u;

test("build and dev commands consume committed content without implicit refresh hooks", () => {
  // Arrange
  const scripts = packageManifest.scripts;

  // Act / Assert
  assert.equal(scripts.prebuild, undefined);
  assert.equal(scripts.predev, undefined);
  assert.equal(scripts.dev, "vite");
  assert.doesNotMatch(scripts.build ?? "", refreshLeafPattern);
  assert.doesNotMatch(scripts["build:strict"] ?? "", refreshLeafPattern);
  assert.match(scripts.build ?? "", /validate:data/u);
  assert.match(scripts["build:strict"] ?? "", /validate:data:strict/u);
});

test("explicit refresh commands retain all refresh phases", () => {
  // Arrange
  const scripts = packageManifest.scripts;
  const planSource = readRepoFile("scripts/content-refresh/plan.ts");
  const gitignoreSource = readRepoFile(".gitignore");

  // Act / Assert
  assert.equal(scripts["content:refresh"], "bun scripts/refresh-content.ts");
  assert.match(scripts["content:refresh:strict"] ?? "", /--validation=strict/u);
  assert.match(scripts["content:refresh:write-cache"] ?? "", /--public-cache=stable/u);
  assert.match(gitignoreSource, /^\.ci-diagnostics\/$/mu);
  for (const command of [
    "public:clean",
    "avatar:sync",
    "enrich:rich:strict",
    "images:sync",
    "social:preview:generate",
    "badge:site",
    "validate:data",
  ]) {
    assert.equal(
      planSource.includes(command),
      true,
      `Expected refresh plan to include ${command}.`,
    );
  }
});

test("pre-commit required parity uses non-mutating hook variants", () => {
  // Arrange
  const hookSource = readRepoFile("scripts/hooks/pre-commit.sh");

  // Act / Assert
  assert.match(hookSource, /run_check "build" bun run ci:required:hook:build/u);
  assert.match(hookSource, /run_check "quality_check" bun run ci:required:hook:quality/u);
  assert.doesNotMatch(hookSource, /run_check "build" bun run ci:required:build/u);
  assert.doesNotMatch(hookSource, /run_check "quality_check" bun run ci:required:quality/u);
});

test("required and strict CI retain validation, build, smoke, and quality coverage", () => {
  // Arrange
  const scripts = packageManifest.scripts;

  // Act / Assert
  assert.equal(
    scripts["ci:required:build"],
    "bun run build && bun test scripts/lib/build-runtime-assets.test.ts",
  );
  assert.equal(scripts["ci:required:hook:build"], scripts["ci:required:build"]);
  assert.equal(scripts["ci:strict"], "bun run build:strict && bun run quality:strict:ci");
  assert.match(scripts["ci:required"] ?? "", /ci:required:build/u);
  assert.match(scripts["ci:required"] ?? "", /ci:required:quality/u);
});

test("deployment and screenshot workflows build committed content only", () => {
  // Arrange
  const deployBuildSource = readRepoFile("scripts/deploy/build.ts");
  const providerBuildSource = readRepoFile("scripts/deploy/build-provider.ts");
  const productionWorkflow = readRepoFile(".github/workflows/deploy-production.yml");
  const screenshotWorkflow = readRepoFile(".github/workflows/readme-screenshot-sync.yml");

  // Act / Assert
  assert.doesNotMatch(deployBuildSource, refreshLeafPattern);
  assert.match(deployBuildSource, /--skip-content-sync is retained as a deprecated no-op/u);
  assert.match(productionWorkflow, /run: bun run deploy:build/u);
  assert.match(providerBuildSource, /scripts\/deploy\/build\.ts/u);
  assert.match(screenshotWorkflow, /run: bun run build/u);
  assert.doesNotMatch(productionWorkflow, refreshLeafPattern);
  assert.doesNotMatch(screenshotWorkflow, refreshLeafPattern);
});
