import assert from "node:assert/strict";
import test from "node:test";
import { classifyNightlyArtifactPaths } from "./content-refresh/nightly-artifacts";
import { isContentRefreshPath } from "./content-refresh/paths";
import {
  buildContentRefreshPlan,
  defaultContentRefreshOptions,
  parseContentRefreshOptions,
} from "./content-refresh/plan";
import type { ContentRefreshDependencies } from "./content-refresh/runner";
import { runContentRefresh } from "./content-refresh/runner";
import type { CommandResult } from "./lib/command";

const passedCommandResult = (): CommandResult => ({
  args: [],
  command: "bun",
  status: 0,
  stderr: "",
  stdout: "",
});

const createDependencies = (
  overrides: Partial<ContentRefreshDependencies> = {},
): ContentRefreshDependencies => {
  let timestamp = Date.parse("2026-08-01T12:00:00.000Z");
  return {
    assertSummaryPathIsIgnored: () => {},
    captureChangedState: () => new Map(),
    log: () => {},
    now: () => {
      const current = new Date(timestamp);
      timestamp += 10;
      return current;
    },
    runPhase: passedCommandResult,
    writeSummary: () => {},
    ...overrides,
  };
};

test("content refresh planner preserves the required phase order", () => {
  // Arrange
  const options = defaultContentRefreshOptions();

  // Act
  const plan = buildContentRefreshPlan(options);

  // Assert
  assert.deepEqual(
    plan.map((phase) => phase.id),
    [
      "public-cleanup",
      "avatar-sync",
      "rich-enrichment",
      "content-image-sync",
      "social-preview",
      "site-badge",
      "data-validation",
    ],
  );
  assert.deepEqual(plan[2]?.args, ["run", "enrich:rich:strict"]);
  assert.deepEqual(plan[6]?.args, ["run", "validate:data"]);
});

test("content refresh modes select stable cache persistence and strict validation", () => {
  // Arrange
  const options = parseContentRefreshOptions([
    "--write-public-cache",
    "--strict",
    "--summary-json=.cache/custom-summary.json",
  ]);

  // Act
  const plan = buildContentRefreshPlan(options);

  // Assert
  assert.equal(options.publicCacheMode, "stable");
  assert.equal(options.validationMode, "strict");
  assert.equal(options.summaryJsonPath, ".cache/custom-summary.json");
  assert.deepEqual(plan[2]?.args, ["run", "enrich:rich:strict:write-cache"]);
  assert.deepEqual(plan[6]?.args, ["run", "validate:data:strict"]);
});

test("content refresh stops after the first failed phase and writes a failed summary", () => {
  // Arrange
  const invokedPhaseIds: string[] = [];
  let writtenStatus = "";
  const dependencies = createDependencies({
    runPhase: (phase) => {
      invokedPhaseIds.push(phase.id);
      return { ...passedCommandResult(), status: phase.id === "rich-enrichment" ? 7 : 0 };
    },
    writeSummary: (_summaryPath, summary) => {
      writtenStatus = summary.status;
    },
  });

  // Act
  const summary = runContentRefresh(defaultContentRefreshOptions(), dependencies);

  // Assert
  assert.equal(summary.status, "failed");
  assert.equal(summary.status === "failed" ? summary.failedPhase : undefined, "rich-enrichment");
  assert.deepEqual(invokedPhaseIds, ["public-cleanup", "avatar-sync", "rich-enrichment"]);
  assert.equal(writtenStatus, "failed");
});

test("content refresh reports allow-listed output changes without staging them", () => {
  // Arrange
  const changedStateSnapshots = [
    new Map([["README.md", "before"]]),
    new Map([
      ["README.md", "before"],
      ["data/generated/rich-metadata.json", "generated"],
      ["public/generated/seo/social-preview.png", "preview"],
    ]),
  ];
  const dependencies = createDependencies({
    captureChangedState: () => changedStateSnapshots.shift() ?? new Map(),
  });

  // Act
  const summary = runContentRefresh(defaultContentRefreshOptions(), dependencies);

  // Assert
  assert.equal(summary.status, "passed");
  assert.deepEqual(summary.changedPaths, [
    "data/generated/rich-metadata.json",
    "public/generated/seo/social-preview.png",
  ]);
  assert.deepEqual(summary.unexpectedPaths, []);
});

test("content refresh rejects newly changed paths outside its ownership manifest", () => {
  // Arrange
  const changedStateSnapshots = [new Map(), new Map([["data/links.json", "changed"]])];
  const dependencies = createDependencies({
    captureChangedState: () => changedStateSnapshots.shift() ?? new Map(),
  });

  // Act
  const summary = runContentRefresh(defaultContentRefreshOptions(), dependencies);

  // Assert
  assert.equal(summary.status, "failed");
  assert.deepEqual(summary.unexpectedPaths, ["data/links.json"]);
  assert.match(summary.status === "failed" ? summary.failure : "", /outside its ownership/u);
});

test("content refresh detects modifications to an already-dirty unexpected path", () => {
  // Arrange
  const changedStateSnapshots = [
    new Map([["data/links.json", "before"]]),
    new Map([["data/links.json", "after"]]),
  ];
  const dependencies = createDependencies({
    captureChangedState: () => changedStateSnapshots.shift() ?? new Map(),
  });

  // Act
  const summary = runContentRefresh(defaultContentRefreshOptions(), dependencies);

  // Assert
  assert.equal(summary.status, "failed");
  assert.deepEqual(summary.unexpectedPaths, ["data/links.json"]);
});

test("nightly artifact classification allows refresh outputs and follower history only", () => {
  // Arrange
  const changedPaths = [
    "data/cache/rich-public-cache.json",
    "public/history/followers/index.json",
    "public/history/followers/github.csv",
    "data/profile.json",
  ];

  // Act
  const classification = classifyNightlyArtifactPaths(changedPaths);

  // Assert
  assert.deepEqual(classification.allowedPaths, [
    "data/cache/rich-public-cache.json",
    "public/history/followers/github.csv",
    "public/history/followers/index.json",
  ]);
  assert.deepEqual(classification.unexpectedPaths, ["data/profile.json"]);
});

test("content refresh ownership excludes source, runtime, diagnostics, authenticated, and history paths", () => {
  // Arrange
  const excludedPaths = [
    "data/links.json",
    "data/cache/rich-public-cache.runtime.json",
    "data/cache/rich-authenticated-cache.json",
    ".ci-diagnostics/content-refresh-summary.json",
    "public/history/followers/index.json",
  ];

  // Act / Assert
  for (const repoPath of excludedPaths) {
    assert.equal(isContentRefreshPath(repoPath), false, `Expected ${repoPath} to stay excluded.`);
  }
});
