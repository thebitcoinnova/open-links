import assert from "node:assert/strict";
import test from "node:test";
import {
  detectPrimalPublicBrowserPlaceholderSignals,
  parsePrimalPublicProfileMetrics,
} from "./primal-public-browser";

test("parses Primal follower and following counts from logged-out profile text", () => {
  // Arrange
  const snapshot = {
    currentUrl: "https://primal.net/peterryszkiewicz",
    title: "Peter No Taxation Without Representation Ryszkiewicz - Nostr Profile",
    bodyText:
      "follow Peter No Taxation Without Representation Ryszkiewicz Primal OG 2026 90 following 15 followers Joined Nostr on Jun 27, 2025",
  };

  // Act
  const parsed = parsePrimalPublicProfileMetrics(snapshot);

  // Assert
  assert.equal(parsed.followersCount, 15);
  assert.equal(parsed.followersCountRaw, "15 followers");
  assert.equal(parsed.followingCount, 90);
  assert.equal(parsed.followingCountRaw, "90 following");
  assert.deepEqual(parsed.placeholderSignals, []);
});

test("accepts noisy Primal page text when audience counts are still present", () => {
  // Arrange
  const snapshot = {
    currentUrl: "https://primal.net/peterryszkiewicz",
    title: "Peter No Taxation Without Representation Ryszkiewicz - Nostr Profile",
    bodyText:
      "NOTE PREVIEW Post Cancel follow Peter No Taxation Without Representation Ryszkiewicz Primal OG 2026 90 following 15 followers Joined Nostr on Jun 27, 2025 Agentic engineer",
  };

  // Act
  const parsed = parsePrimalPublicProfileMetrics(snapshot);

  // Assert
  assert.equal(parsed.followersCount, 15);
  assert.equal(parsed.followingCount, 90);
});

test("flags missing-profile style Primal pages", () => {
  // Arrange
  const snapshot = {
    currentUrl: "https://primal.net/missing-user",
    title: "Page not found",
    bodyText: "Profile not found",
  };

  // Act
  const placeholderSignals = detectPrimalPublicBrowserPlaceholderSignals(snapshot);
  const parsed = parsePrimalPublicProfileMetrics(snapshot);

  // Assert
  assert.deepEqual(placeholderSignals, ["profile_missing"]);
  assert.deepEqual(parsed.placeholderSignals, placeholderSignals);
  assert.equal(parsed.followersCount, undefined);
  assert.equal(parsed.followingCount, undefined);
});
