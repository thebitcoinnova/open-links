import assert from "node:assert/strict";
import test from "node:test";
import {
  assertLiveTargetSnapshot,
  buildLiveTargetExpectation,
  normalizePublicBaseUrl,
} from "./live-deploy-verify";

test("buildLiveTargetExpectation supports explicit provider origins", () => {
  // Arrange / Act
  const expectation = buildLiveTargetExpectation("render", {
    expectedCommitSha: "0123456789abcdef0123456789abcdef01234567",
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
  assert.equal(
    normalizePublicBaseUrl("https://someone.github.io/open-links-fork/"),
    "https://someone.github.io/open-links-fork",
  );
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
        '<link rel="canonical" href="https://openlinks.us/">',
        '<meta name="robots" content="noindex, nofollow">',
      ].join(""),
    }),
  );
});

test("assertLiveTargetSnapshot rejects commit drift and robots mismatches", () => {
  // Arrange
  const expectation = buildLiveTargetExpectation("github-pages", {
    expectedCommitSha: "0123456789abcdef0123456789abcdef01234567",
  });

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
          '<link rel="canonical" href="https://openlinks.us/">',
          '<meta name="robots" content="index, follow">',
        ].join(""),
      }),
    /robots 'noindex, nofollow'|commit/u,
  );
});
