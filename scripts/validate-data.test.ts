import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import {
  followerHistoryArtifactIssues,
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
    "scripts/quality/perf.ts",
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
  const exactMatch = "data/cache/content-images.json";
  const prefixMatch = "public/cache/content-images/example.jpg";
  const legacyPath = "data/generated/content-images.json";
  const avatarTrigger = "scripts/sync-profile-avatar.ts";
  const policyTrigger = "data/policy/remote-cache-policy.json";
  const nonMatch = "scripts/quality/perf.ts";

  // Act
  const exactTriggered = pathTouchesHookRichArtifactInputs(exactMatch);
  const prefixTriggered = pathTouchesHookRichArtifactInputs(prefixMatch);
  const legacyTriggered = pathTouchesHookRichArtifactInputs(legacyPath);
  const avatarTriggered = pathTouchesHookRichArtifactInputs(avatarTrigger);
  const policyTriggered = pathTouchesHookRichArtifactInputs(policyTrigger);
  const unrelatedTriggered = pathTouchesHookRichArtifactInputs(nonMatch);

  // Assert
  assert.equal(exactTriggered, true);
  assert.equal(prefixTriggered, true);
  assert.equal(legacyTriggered, false);
  assert.equal(avatarTriggered, true);
  assert.equal(policyTriggered, true);
  assert.equal(unrelatedTriggered, false);
});

test("follower-history validation accepts matching index and CSV artifacts", (t) => {
  const historyRepoRoot = "public/history/test-follower-history";
  const indexPath = `${historyRepoRoot}/index.json`;
  const csvPath = `${historyRepoRoot}/github.csv`;
  const absoluteDir = path.join(ROOT, historyRepoRoot);
  fs.mkdirSync(absoluteDir, { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, csvPath),
    `${[
      "observedAt,linkId,platform,handle,canonicalUrl,audienceKind,audienceCount,audienceCountRaw,source",
      "2026-03-10T07:00:00.000Z,github,github,prizz,https://github.com/pRizz,followers,90,90 followers,public-cache",
    ].join("\n")}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(ROOT, indexPath),
    `${JSON.stringify(
      {
        version: 1,
        updatedAt: "2026-03-10T07:00:00.000Z",
        entries: [
          {
            linkId: "github",
            label: "GitHub",
            platform: "github",
            handle: "prizz",
            canonicalUrl: "https://github.com/pRizz",
            audienceKind: "followers",
            csvPath: "history/test-follower-history/github.csv",
            latestAudienceCount: 90,
            latestAudienceCountRaw: "90 followers",
            latestObservedAt: "2026-03-10T07:00:00.000Z",
          },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  t.after(() => {
    fs.rmSync(absoluteDir, { recursive: true, force: true });
  });

  const issues = followerHistoryArtifactIssues({
    historyRepoRoot,
    indexPath,
    publicRoot: "history/test-follower-history",
  });

  assert.deepEqual(issues, []);
});

test("follower-history validation reports index drift against the latest CSV row", (t) => {
  const historyRepoRoot = "public/history/test-follower-history-drift";
  const indexPath = `${historyRepoRoot}/index.json`;
  const csvPath = `${historyRepoRoot}/x.csv`;
  const absoluteDir = path.join(ROOT, historyRepoRoot);
  fs.mkdirSync(absoluteDir, { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, csvPath),
    `${[
      "observedAt,linkId,platform,handle,canonicalUrl,audienceKind,audienceCount,audienceCountRaw,source",
      '"2026-03-10T07:00:00.000Z",x,x,pryszkie,https://x.com/pryszkie,followers,1351,"1,351 Followers",public-cache',
    ].join("\n")}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(ROOT, indexPath),
    `${JSON.stringify(
      {
        version: 1,
        updatedAt: "2026-03-10T07:00:00.000Z",
        entries: [
          {
            linkId: "x",
            label: "X",
            platform: "x",
            handle: "pryszkie",
            canonicalUrl: "https://x.com/pryszkie",
            audienceKind: "followers",
            csvPath: "history/test-follower-history-drift/x.csv",
            latestAudienceCount: 1300,
            latestAudienceCountRaw: "1,300 Followers",
            latestObservedAt: "2026-03-10T07:00:00.000Z",
          },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  t.after(() => {
    fs.rmSync(absoluteDir, { recursive: true, force: true });
  });

  const issues = followerHistoryArtifactIssues({
    historyRepoRoot,
    indexPath,
    publicRoot: "history/test-follower-history-drift",
  });

  assert.equal(issues.length, 1);
  assert.match(issues[0]?.message ?? "", /does not match the latest row/u);
});
