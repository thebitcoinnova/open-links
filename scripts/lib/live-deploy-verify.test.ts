import assert from "node:assert/strict";
import test from "node:test";
import { getCanonicalUrl, getRobotsMetaContent } from "./effective-deployment-config";
import {
  assertLiveTargetSnapshot,
  buildLiveTargetExpectation,
  normalizePublicBaseUrl,
} from "./live-deploy-verify";

test("buildLiveTargetExpectation supports explicit provider origins for the active fork topology", () => {
  // Arrange / Act
  const expectation = buildLiveTargetExpectation("render", {
    expectedCommitSha: "0123456789abcdef0123456789abcdef01234567",
    publicOrigin: "https://open-links.onrender.com",
  });

  // Assert
  assert.deepEqual(expectation, {
    buildInfoUrl: "https://open-links.onrender.com/build-info.json",
    expectedCanonicalUrl: getCanonicalUrl("/"),
    expectedCommitSha: "0123456789abcdef0123456789abcdef01234567",
    expectedRobotsMeta: getRobotsMetaContent("render"),
    publicUrl: "https://open-links.onrender.com/",
    target: "render",
  });
  assert.equal(
    normalizePublicBaseUrl("https://someone.github.io/open-links-fork/"),
    "https://someone.github.io/open-links-fork",
  );
});

test("buildLiveTargetExpectation supports explicit provider origins with an upstream canonical override", () => {
  // Arrange / Act
  const expectation = buildLiveTargetExpectation("render", {
    expectedCommitSha: "0123456789abcdef0123456789abcdef01234567",
    primaryCanonicalOrigin: "https://openlinks.us",
    publicOrigin: "https://open-links.onrender.com",
  });

  // Assert
  assert.deepEqual(expectation, {
    buildInfoUrl: "https://open-links.onrender.com/build-info.json",
    expectedCanonicalUrl: "https://openlinks.us/",
    expectedCommitSha: "0123456789abcdef0123456789abcdef01234567",
    expectedRobotsMeta: "noindex, nofollow",
    publicUrl: "https://open-links.onrender.com/",
    target: "render",
  });
});

test("buildLiveTargetExpectation supports fork-primary pages expectations", () => {
  // Arrange / Act
  const expectation = buildLiveTargetExpectation("github-pages", {
    expectedCommitSha: "0123456789abcdef0123456789abcdef01234567",
    primaryCanonicalOrigin: "https://someone.github.io/open-links-fork",
    publicOrigin: "https://someone.github.io/open-links-fork",
  });

  // Assert
  assert.deepEqual(expectation, {
    buildInfoUrl: "https://someone.github.io/open-links-fork/build-info.json",
    expectedCanonicalUrl: "https://someone.github.io/open-links-fork/",
    expectedCommitSha: "0123456789abcdef0123456789abcdef01234567",
    expectedRobotsMeta: "index, follow",
    publicUrl: "https://someone.github.io/open-links-fork/",
    target: "github-pages",
  });
});

test("assertLiveTargetSnapshot accepts matching canonical, robots, and build-info", () => {
  // Arrange
  const expectation = buildLiveTargetExpectation("railway", {
    expectedCommitSha: "0123456789abcdef0123456789abcdef01234567",
    publicOrigin: "https://open-links.up.railway.app",
  });

  // Act / Assert
  assert.doesNotThrow(() =>
    assertLiveTargetSnapshot(expectation, {
      buildInfo: {
        builtAtIso: "2026-03-26T11:20:00.000Z",
        commitSha: "0123456789abcdef0123456789abcdef01234567",
        commitShortSha: "0123456",
        commitUrl:
          "https://github.com/someone/open-links-fork/commit/0123456789abcdef0123456789abcdef01234567",
      },
      html: [
        "<!doctype html>",
        `<link rel="canonical" href="${getCanonicalUrl("/")}">`,
        `<meta name="robots" content="${getRobotsMetaContent("railway")}">`,
      ].join(""),
    }),
  );
});

test("assertLiveTargetSnapshot rejects commit drift and robots mismatches", () => {
  // Arrange
  const expectation = buildLiveTargetExpectation("github-pages", {
    expectedCommitSha: "0123456789abcdef0123456789abcdef01234567",
  });
  const mismatchedRobots =
    getRobotsMetaContent("github-pages") === "index, follow"
      ? "noindex, nofollow"
      : "index, follow";

  // Act / Assert
  assert.throws(
    () =>
      assertLiveTargetSnapshot(expectation, {
        buildInfo: {
          builtAtIso: "2026-03-26T11:20:00.000Z",
          commitSha: "different",
          commitShortSha: "differe",
          commitUrl: "",
        },
        html: [
          "<!doctype html>",
          `<link rel="canonical" href="${getCanonicalUrl("/")}">`,
          `<meta name="robots" content="${mismatchedRobots}">`,
        ].join(""),
      }),
    new RegExp(`robots '${expectation.expectedRobotsMeta}'|commit`, "u"),
  );
});
