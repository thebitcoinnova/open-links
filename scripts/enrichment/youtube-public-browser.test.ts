import assert from "node:assert/strict";
import test from "node:test";
import {
  detectYoutubePublicBrowserPlaceholderSignals,
  parseYoutubePublicProfileMetrics,
} from "./youtube-public-browser";

test("parses YouTube subscriber counts from public channel text", () => {
  // Arrange
  const snapshot = {
    currentUrl: "https://www.youtube.com/@example/about",
    title: "Example - YouTube",
    metricTexts: ["9.2K subscribers"],
  };

  // Act
  const parsed = parseYoutubePublicProfileMetrics(snapshot);

  // Assert
  assert.equal(parsed.subscribersCount, 9200);
  assert.equal(parsed.subscribersCountRaw, "9.2K subscribers");
  assert.deepEqual(parsed.placeholderSignals, []);
});

test("flags unavailable YouTube channel pages", () => {
  // Arrange
  const snapshot = {
    currentUrl: "https://www.youtube.com/@missing/about",
    title: "404 Not Found - YouTube",
    bodyText: "This channel does not exist.",
  };

  // Act
  const placeholderSignals = detectYoutubePublicBrowserPlaceholderSignals(snapshot);
  const parsed = parseYoutubePublicProfileMetrics(snapshot);

  // Assert
  assert.deepEqual(placeholderSignals, ["unavailable_page"]);
  assert.deepEqual(parsed.placeholderSignals, placeholderSignals);
  assert.equal(parsed.subscribersCount, undefined);
});
