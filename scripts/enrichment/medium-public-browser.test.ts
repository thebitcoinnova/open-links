import assert from "node:assert/strict";
import test from "node:test";
import {
  detectMediumPublicBrowserPlaceholderSignals,
  parseMediumPublicProfileMetrics,
} from "./medium-public-browser";

test("parses a Medium follower count from public page text", () => {
  // Arrange
  const snapshot = {
    currentUrl: "https://medium.com/@peterryszkiewicz",
    title: "Peter Ryszkiewicz - Medium",
    bodyText: "Peter Ryszkiewicz\n3.3K followers\nJustice for the Victims",
  };

  // Act
  const parsed = parseMediumPublicProfileMetrics(snapshot);

  // Assert
  assert.equal(parsed.followersCount, 3300);
  assert.equal(parsed.followersCountRaw, "3.3K followers");
  assert.deepEqual(parsed.placeholderSignals, []);
});

test("captures following only when the public page exposes it explicitly", () => {
  // Arrange
  const snapshot = {
    currentUrl: "https://medium.com/@peterryszkiewicz",
    title: "Peter Ryszkiewicz - Medium",
    metricTexts: ["3.3K followers", "127 following"],
  };

  // Act
  const parsed = parseMediumPublicProfileMetrics(snapshot);

  // Assert
  assert.equal(parsed.followersCount, 3300);
  assert.equal(parsed.followingCount, 127);
  assert.equal(parsed.followingCountRaw, "127 following");
});

test("does not truncate compact follower counts embedded inside longer text runs", () => {
  // Arrange
  const snapshot = {
    currentUrl: "https://medium.com/@peterryszkiewicz",
    title: "Peter Ryszkiewicz - Medium",
    metricTexts: ["Peter Ryszkiewicz3.3K followers"],
  };

  // Act
  const parsed = parseMediumPublicProfileMetrics(snapshot);

  // Assert
  assert.equal(parsed.followersCount, 3300);
  assert.equal(parsed.followersCountRaw, "3.3K followers");
});

test("flags Cloudflare challenge placeholders from browser text", () => {
  // Arrange
  const snapshot = {
    currentUrl: "https://medium.com/@peterryszkiewicz",
    title: "Just a moment...",
    bodyText:
      "medium.com Performing security verification This website verifies you are not a bot. Performance and Security by Cloudflare",
  };

  // Act
  const placeholderSignals = detectMediumPublicBrowserPlaceholderSignals(snapshot);
  const parsed = parseMediumPublicProfileMetrics(snapshot);

  // Assert
  assert.deepEqual(placeholderSignals, [
    "cloudflare_challenge",
    "security_verification",
    "bot_verification",
    "cloudflare_branding",
  ]);
  assert.deepEqual(parsed.placeholderSignals, placeholderSignals);
  assert.equal(parsed.followersCount, undefined);
});
