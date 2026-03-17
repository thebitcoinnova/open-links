import assert from "node:assert/strict";
import test from "node:test";
import { resolveStableBuildTimestamp } from "./build-timestamp";

test("resolveStableBuildTimestamp prefers an explicit value", () => {
  // Arrange
  const explicitValue = "2026-03-16T12:34:56.000Z";

  // Act
  const timestamp = resolveStableBuildTimestamp({
    explicitValue,
    fallbackNow: () => "2026-03-16T00:00:00.000Z",
    loadGitCommitTimestamp: () => "2026-03-15T00:00:00.000Z",
  });

  // Assert
  assert.equal(timestamp, explicitValue);
});

test("resolveStableBuildTimestamp falls back to the git commit timestamp", () => {
  // Arrange
  const gitCommitTimestamp = "2026-03-15T00:00:00.000Z";

  // Act
  const timestamp = resolveStableBuildTimestamp({
    fallbackNow: () => "2026-03-16T00:00:00.000Z",
    loadGitCommitTimestamp: () => gitCommitTimestamp,
  });

  // Assert
  assert.equal(timestamp, gitCommitTimestamp);
});

test("resolveStableBuildTimestamp uses the fallback clock when git metadata is unavailable", () => {
  // Arrange
  const fallbackNow = "2026-03-16T00:00:00.000Z";

  // Act
  const timestamp = resolveStableBuildTimestamp({
    fallbackNow: () => fallbackNow,
    loadGitCommitTimestamp: () => undefined,
  });

  // Assert
  assert.equal(timestamp, fallbackNow);
});
