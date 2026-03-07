import assert from "node:assert/strict";
import test from "node:test";
import {
  extractYoutubeProfileImageUrl,
  extractYoutubeSubscriberCountRaw,
  parseYoutubeProfileMetadata,
} from "./youtube-auth-browser";

test("extracts YouTube subscriber text from the page header metadata rows", () => {
  // Arrange
  const html =
    '"metadataRows":[{"metadataParts":[{"text":{"content":"@example"}}]},{"metadataParts":[{"text":{"content":"1.2K subscribers"},"accessibilityLabel":"1.2K subscribers"},{"text":{"content":"4 videos"}}]}],"delimiter":"•"';

  // Act
  const subscriberText = extractYoutubeSubscriberCountRaw(html);
  const parsed = parseYoutubeProfileMetadata(html);

  // Assert
  assert.equal(subscriberText, "1.2K subscribers");
  assert.deepEqual(parsed, {
    subscribersCount: 1200,
    subscribersCountRaw: "1.2K subscribers",
  });
});

test("prefers the explicit YouTube thumbnailUrl profile image surface", () => {
  // Arrange
  const html = [
    '<link itemprop="thumbnailUrl" href="https://yt3.googleusercontent.com/example=s900-c-k-c0x00ffffff-no-rj">',
    '"channelMetadataRenderer":{"avatar":{"thumbnails":[{"url":"https://yt3.googleusercontent.com/fallback=s900-c-k-c0x00ffffff-no-rj"}]}}',
  ].join("");

  // Act
  const profileImageUrl = extractYoutubeProfileImageUrl(html);

  // Assert
  assert.equal(
    profileImageUrl,
    "https://yt3.googleusercontent.com/example=s900-c-k-c0x00ffffff-no-rj",
  );
});
