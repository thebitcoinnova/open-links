import { test } from "bun:test";
import assert from "node:assert/strict";
import { buildGitHubCommitUrl, resolveBuildInfo } from "./build-info";

test("resolveBuildInfo uses git metadata when available", () => {
  // Arrange
  const commitSha = "0123456789abcdef0123456789abcdef01234567";
  const commitShortSha = "0123456";

  // Act
  const buildInfo = resolveBuildInfo({
    buildTimestamp: "2026-03-25T14:05:00.000Z",
    loadGitCommitSha: () => commitSha,
    loadGitCommitShortSha: () => commitShortSha,
    repositorySlug: "pRizz/open-links",
  });

  // Assert
  assert.deepEqual(buildInfo, {
    builtAtIso: "2026-03-25T14:05:00.000Z",
    commitSha,
    commitShortSha,
    commitUrl:
      "https://github.com/pRizz/open-links/commit/0123456789abcdef0123456789abcdef01234567",
  });
});

test("resolveBuildInfo omits commit metadata when git metadata is unavailable", () => {
  // Arrange
  const fallbackNow = "2026-03-25T14:05:00.000Z";

  // Act
  const buildInfo = resolveBuildInfo({
    fallbackNow: () => fallbackNow,
    loadGitCommitSha: () => undefined,
    loadGitCommitShortSha: () => undefined,
    repositorySlug: "pRizz/open-links",
  });

  // Assert
  assert.deepEqual(buildInfo, {
    builtAtIso: fallbackNow,
    commitSha: "",
    commitShortSha: "",
    commitUrl: "",
  });
});

test("resolveBuildInfo prefers an explicit timestamp override", () => {
  // Arrange
  const explicitBuildTimestamp = "2026-03-25T20:10:11.000Z";

  // Act
  const buildInfo = resolveBuildInfo({
    buildTimestamp: explicitBuildTimestamp,
    fallbackNow: () => "2026-03-25T00:00:00.000Z",
    loadGitCommitSha: () => "0123456789abcdef0123456789abcdef01234567",
    loadGitCommitShortSha: () => undefined,
    repositorySlug: "pRizz/open-links",
  });

  // Assert
  assert.equal(buildInfo.builtAtIso, explicitBuildTimestamp);
});

test("buildGitHubCommitUrl builds a commit url from repository slug and sha", () => {
  // Arrange / Act
  const commitUrl = buildGitHubCommitUrl(
    "https://github.com/pRizz/open-links.git",
    "0123456789abcdef0123456789abcdef01234567",
  );

  // Assert
  assert.equal(
    commitUrl,
    "https://github.com/pRizz/open-links/commit/0123456789abcdef0123456789abcdef01234567",
  );
});
