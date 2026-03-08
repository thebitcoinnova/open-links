import assert from "node:assert/strict";
import test from "node:test";
import {
  detectPublicAudiencePlaceholderSignals,
  parsePublicAudienceMetrics,
} from "./public-audience-browser";

test("parses plain audience counts from a browser snapshot", () => {
  // Arrange
  const snapshot = {
    currentUrl: "https://example.com/profile",
    title: "Profile",
    bodyText: "Example Person Joined January 2024 90 following 15 followers",
  };

  // Act
  const parsed = parsePublicAudienceMetrics({ snapshot });

  // Assert
  assert.equal(parsed.followersCount, 15);
  assert.equal(parsed.followersCountRaw, "15 followers");
  assert.equal(parsed.followingCount, 90);
  assert.equal(parsed.followingCountRaw, "90 following");
  assert.deepEqual(parsed.placeholderSignals, []);
});

test("parses compact counts and preserves raw casing", () => {
  // Arrange
  const snapshot = {
    currentUrl: "https://example.com/profile",
    title: "Profile",
    metricTexts: ["980 Following", "1.2K Followers"],
  };

  // Act
  const parsed = parsePublicAudienceMetrics({ snapshot });

  // Assert
  assert.equal(parsed.followersCount, 1200);
  assert.equal(parsed.followersCountRaw, "1.2K Followers");
  assert.equal(parsed.followingCount, 980);
  assert.equal(parsed.followingCountRaw, "980 Following");
});

test("returns partial audience metrics when only one count is visible", () => {
  // Arrange
  const snapshot = {
    currentUrl: "https://example.com/profile",
    title: "Profile",
    metricTexts: ["2,001 Followers"],
  };

  // Act
  const parsed = parsePublicAudienceMetrics({ snapshot });

  // Assert
  assert.equal(parsed.followersCount, 2001);
  assert.equal(parsed.followersCountRaw, "2,001 Followers");
  assert.equal(parsed.followingCount, undefined);
  assert.equal(parsed.followingCountRaw, undefined);
});

test("handles noisy text that contains audience counts inline", () => {
  // Arrange
  const snapshot = {
    currentUrl: "https://example.com/profile",
    title: "Profile",
    bodyText:
      "Don’t miss what’s happening Example Person 643 Following 1,351 Followers Posts Replies Media",
  };

  // Act
  const parsed = parsePublicAudienceMetrics({ snapshot });

  // Assert
  assert.equal(parsed.followersCount, 1351);
  assert.equal(parsed.followersCountRaw, "1,351 Followers");
  assert.equal(parsed.followingCount, 643);
  assert.equal(parsed.followingCountRaw, "643 Following");
});

test("detects placeholder signals with current-url-sensitive rules", () => {
  // Arrange
  const snapshot = {
    currentUrl: "https://example.com/i/flow/login",
    title: "Log in",
    bodyText: "Sign in to continue.",
  };
  const checks = [
    { label: "login_redirect", pattern: /\/i\/flow\/login\b/i, field: "currentUrl" as const },
    { label: "transient_error", pattern: /something went wrong/i },
  ];

  // Act
  const placeholderSignals = detectPublicAudiencePlaceholderSignals(snapshot, checks);
  const parsed = parsePublicAudienceMetrics({
    snapshot,
    placeholderChecks: checks,
  });

  // Assert
  assert.deepEqual(placeholderSignals, ["login_redirect"]);
  assert.deepEqual(parsed.placeholderSignals, placeholderSignals);
});
