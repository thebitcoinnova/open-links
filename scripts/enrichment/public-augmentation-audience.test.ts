import assert from "node:assert/strict";
import test from "node:test";
import { mergeReferralWithManualOverrides } from "../../src/lib/content/referral-fields";
import {
  extractYoutubeProfileImageUrl,
  extractYoutubeSubscriberCountRaw,
  parseInstagramProfileMetadata,
  parseYoutubeProfileMetadata,
  resolvePublicAugmentationTarget,
  resolvePublicReferralAugmentation,
} from "./public-augmentation";

test("parses Instagram follower and following counts from the profile description", () => {
  // Arrange
  const description =
    "86 Followers, 169 Following, 36 Posts - See Instagram photos and videos from Example (@example)";

  // Act
  const parsed = parseInstagramProfileMetadata(description);

  // Assert
  assert.deepEqual(parsed, {
    followersCount: 86,
    followersCountRaw: "86 Followers",
    followingCount: 169,
    followingCountRaw: "169 Following",
  });
});

test("parses Instagram public profile HTML into profile metadata counts", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://www.instagram.com/example/",
    icon: "instagram",
    metadataHandle: "example",
  });
  const html = `
    <html>
      <head>
        <meta property="og:title" content="Example (@example) • Instagram photos and videos" />
        <meta property="og:description" content="104 Followers, 211 Following, 12 Posts - See Instagram photos and videos from Example (@example)" />
        <meta property="og:image" content="https://scontent.cdninstagram.com/avatar.jpg" />
      </head>
    </html>
  `;

  // Act
  const parsed = target?.parse(html);

  // Assert
  assert.equal(target?.id, "instagram-public-profile");
  assert.equal(parsed?.completeness, "full");
  assert.equal(parsed?.metadata.followersCount, 104);
  assert.equal(parsed?.metadata.followersCountRaw, "104 Followers");
  assert.equal(parsed?.metadata.followingCount, 211);
  assert.equal(parsed?.metadata.followingCountRaw, "211 Following");
});

test("preserves raw Instagram count text when compact notation is used", () => {
  // Arrange
  const description =
    "1.2K Followers, 980 Following, 36 Posts - See Instagram photos and videos from Example (@example)";

  // Act
  const parsed = parseInstagramProfileMetadata(description);

  // Assert
  assert.equal(parsed.followersCount, 1200);
  assert.equal(parsed.followersCountRaw, "1.2K Followers");
  assert.equal(parsed.followingCount, 980);
  assert.equal(parsed.followingCountRaw, "980 Following");
});

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

test("extracts YouTube subscriber text from the current about-page channel view model", () => {
  // Arrange
  const html =
    '"aboutChannelViewModel":{"description":"Podcast clips","subscriberCountText":"131 subscribers","viewCountText":"24,399 views","canonicalChannelUrl":"http://www.youtube.com/@Livewiththehive","channelId":"UC9N1jIBZAC-20yYEpkeIbFA"}';

  // Act
  const subscriberText = extractYoutubeSubscriberCountRaw(html);
  const parsed = parseYoutubeProfileMetadata(html);

  // Assert
  assert.equal(subscriberText, "131 subscribers");
  assert.deepEqual(parsed, {
    subscribersCount: 131,
    subscribersCountRaw: "131 subscribers",
  });
});

test("parses YouTube about-page enrichment metadata with subscriber counts", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://youtube.com/@livewiththehive?si=tQizrqZ7AVqSBimH&sub_confirmation=1",
    icon: "youtube",
  });
  const html = `
    <html>
      <head>
        <title>Live with the Hive - YouTube</title>
        <meta property="og:title" content="Live with the Hive" />
        <meta property="og:description" content="Hive Minded podcast clips and updates." />
        <meta property="og:image" content="https://i.ytimg.com/vi/example/hqdefault.jpg" />
        <link itemprop="thumbnailUrl" href="https://yt3.googleusercontent.com/live-with-the-hive=s900-c-k-c0x00ffffff-no-rj" />
      </head>
      <body>
        "aboutChannelViewModel":{"description":"Podcast clips","subscriberCountText":"131 subscribers","viewCountText":"24,399 views","canonicalChannelUrl":"http://www.youtube.com/@Livewiththehive","channelId":"UC9N1jIBZAC-20yYEpkeIbFA"}
      </body>
    </html>
  `;

  // Act
  const parsed = target?.parse(html);

  // Assert
  assert.equal(target?.id, "youtube-public-profile");
  assert.equal(target?.sourceUrl, "https://www.youtube.com/@livewiththehive/about");
  assert.equal(parsed?.completeness, "full");
  assert.equal(parsed?.metadata.title, "Live with the Hive");
  assert.equal(parsed?.metadata.description, "Hive Minded podcast clips and updates.");
  assert.equal(parsed?.metadata.image, "https://i.ytimg.com/vi/example/hqdefault.jpg");
  assert.equal(
    parsed?.metadata.profileImage,
    "https://yt3.googleusercontent.com/live-with-the-hive=s900-c-k-c0x00ffffff-no-rj",
  );
  assert.equal(parsed?.metadata.subscribersCount, 131);
  assert.equal(parsed?.metadata.subscribersCountRaw, "131 subscribers");
  assert.equal(parsed?.metadata.sourceLabel, "youtube.com");
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
