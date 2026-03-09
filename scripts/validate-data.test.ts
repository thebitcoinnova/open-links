import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import {
  pathTouchesHookRichArtifactInputs,
  resolveHookRichArtifactCheckDecision,
} from "./validate-data";

const ROOT = process.cwd();

const writeChangedPathsFile = (relativePath: string, entries: string[]): string => {
  const absolutePath = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${entries.join("\n")}\n`, "utf8");
  return relativePath;
};

test("hook mode skips generated rich-artifact checks for unrelated staged script paths", (t) => {
  // Arrange
  const changedPathsFile = writeChangedPathsFile("tmp/tests/hook-skip-paths.txt", [
    "scripts/sync-profile-avatar.ts",
  ]);
  t.after(() => {
    fs.rmSync(path.join(ROOT, changedPathsFile), { force: true });
  });

  // Act
  const decision = resolveHookRichArtifactCheckDecision({
    mode: "hook",
    changedPathsFile,
  });

  // Assert
  assert.equal(decision.shouldRun, false);
  assert.equal(
    decision.humanNote,
    "Hook mode skipped generated rich-artifact checks because staged paths did not touch rich metadata/image inputs.",
  );
});

test("hook mode enforces generated rich-artifact checks when data links change", (t) => {
  // Arrange
  const changedPathsFile = writeChangedPathsFile("tmp/tests/hook-links-paths.txt", [
    "data/links.json",
  ]);
  t.after(() => {
    fs.rmSync(path.join(ROOT, changedPathsFile), { force: true });
  });

  // Act
  const decision = resolveHookRichArtifactCheckDecision({
    mode: "hook",
    changedPathsFile,
  });

  // Assert
  assert.equal(decision.shouldRun, true);
  assert.equal(decision.humanNote, undefined);
});

test("hook mode enforces generated rich-artifact checks when content-image sync inputs change", (t) => {
  // Arrange
  const changedPathsFile = writeChangedPathsFile("tmp/tests/hook-images-paths.txt", [
    "scripts/sync-content-images.ts",
  ]);
  t.after(() => {
    fs.rmSync(path.join(ROOT, changedPathsFile), { force: true });
  });

  // Act
  const decision = resolveHookRichArtifactCheckDecision({
    mode: "hook",
    changedPathsFile,
  });

  // Assert
  assert.equal(decision.shouldRun, true);
  assert.equal(decision.humanNote, undefined);
});

test("hook mode falls back to full validation when no changed-paths file is provided", () => {
  // Arrange
  const input = {
    mode: "hook" as const,
  };

  // Act
  const decision = resolveHookRichArtifactCheckDecision(input);

  // Assert
  assert.equal(decision.shouldRun, true);
  assert.match(decision.humanNote ?? "", /fell back to full validation/u);
});

test("rich-artifact trigger matcher covers exact and prefix-based hook paths", () => {
  // Arrange
  const exactMatch = "schema/site.schema.json";
  const prefixMatch = "scripts/enrichment/public-cache.ts";
  const nonMatch = "scripts/sync-profile-avatar.ts";

  // Act
  const exactTriggered = pathTouchesHookRichArtifactInputs(exactMatch);
  const prefixTriggered = pathTouchesHookRichArtifactInputs(prefixMatch);
  const unrelatedTriggered = pathTouchesHookRichArtifactInputs(nonMatch);

  // Assert
  assert.equal(exactTriggered, true);
  assert.equal(prefixTriggered, true);
  assert.equal(unrelatedTriggered, false);
});
