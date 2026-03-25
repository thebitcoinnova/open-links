import assert from "node:assert/strict";
import test from "node:test";
import {
  detectXPublicBrowserPlaceholderSignals,
  parseXPublicProfileMetrics,
} from "./x-public-browser";

test("parses X follower and following counts from public profile text", () => {
  // Arrange
  const snapshot = {
    currentUrl: "https://x.com/pryszkie",
    title: "Peter (Justice For The Victims) Ryszkiewicz (@pryszkie) / X",
    bodyText:
      "Peter (Justice For The Victims) Ryszkiewicz @pryszkie Joined September 2017 643 Following 1,350 Followers Posts Replies Highlights Media",
  };

  // Act
  const parsed = parseXPublicProfileMetrics(snapshot);

  // Assert
  assert.equal(parsed.followersCount, 1350);
  assert.equal(parsed.followersCountRaw, "1,350 Followers");
  assert.equal(parsed.followingCount, 643);
  assert.equal(parsed.followingCountRaw, "643 Following");
  assert.deepEqual(parsed.placeholderSignals, []);
});

test("preserves compact X audience text from focused metric nodes", () => {
  // Arrange
  const snapshot = {
    currentUrl: "https://x.com/example",
    title: "Example (@example) / X",
    metricTexts: ["980 Following", "1.2K Followers"],
  };

  // Act
  const parsed = parseXPublicProfileMetrics(snapshot);

  // Assert
  assert.equal(parsed.followersCount, 1200);
  assert.equal(parsed.followersCountRaw, "1.2K Followers");
  assert.equal(parsed.followingCount, 980);
  assert.equal(parsed.followingCountRaw, "980 Following");
});

test("supports mixed-case X labels while preserving raw text", () => {
  // Arrange
  const snapshot = {
    currentUrl: "https://x.com/example",
    title: "Example (@example) / X",
    bodyText: "Joined January 2020 42 following 2.5K followers",
  };

  // Act
  const parsed = parseXPublicProfileMetrics(snapshot);

  // Assert
  assert.equal(parsed.followersCount, 2500);
  assert.equal(parsed.followersCountRaw, "2.5K followers");
  assert.equal(parsed.followingCount, 42);
  assert.equal(parsed.followingCountRaw, "42 following");
});

test("flags redirected login flows as placeholder states", () => {
  // Arrange
  const snapshot = {
    currentUrl: "https://x.com/i/flow/login?redirect_after_login=%2Fpryszkie",
    title: "Log in to X / X",
    bodyText: "Log in to X Sign in to continue to X.",
  };

  // Act
  const placeholderSignals = detectXPublicBrowserPlaceholderSignals(snapshot);
  const parsed = parseXPublicProfileMetrics(snapshot);

  // Assert
  assert.deepEqual(placeholderSignals, ["login_redirect"]);
  assert.deepEqual(parsed.placeholderSignals, placeholderSignals);
  assert.equal(parsed.followersCount, undefined);
  assert.equal(parsed.followingCount, undefined);
});

test("returns partial X metrics when only one audience count is visible", () => {
  // Arrange
  const snapshot = {
    currentUrl: "https://x.com/example",
    title: "Example (@example) / X",
    metricTexts: ["2,001 Followers"],
  };

  // Act
  const parsed = parseXPublicProfileMetrics(snapshot);

  // Assert
  assert.equal(parsed.followersCount, 2001);
  assert.equal(parsed.followersCountRaw, "2,001 Followers");
  assert.equal(parsed.followingCount, undefined);
  assert.equal(parsed.followingCountRaw, undefined);
});

test("parses X community member counts from rendered page text", () => {
  // Arrange
  const snapshot = {
    currentUrl: "https://x.com/i/communities/1871996451812769951",
    title: "PARANOID BITCOIN ANARCHISTS Community / X",
    bodyText:
      "PARANOID BITCOIN ANARCHISTS Hold your keys | Run a Node Paranoid 785 Member Join Top Latest Media About Community",
  };

  // Act
  const parsed = parseXPublicProfileMetrics(snapshot);

  // Assert
  assert.equal(parsed.membersCount, 785);
  assert.equal(parsed.membersCountRaw, "785 Member");
  assert.equal(parsed.followersCount, undefined);
  assert.equal(parsed.followingCount, undefined);
  assert.deepEqual(parsed.placeholderSignals, []);
});
