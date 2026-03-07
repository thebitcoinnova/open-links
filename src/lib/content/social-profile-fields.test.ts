import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeMetadataWithManualSocialProfileOverrides,
  resolveMissingSupportedSocialProfileFields,
  resolveSupportedSocialProfile,
} from "./social-profile-fields";

test("manual social profile fields override generated values without changing generic merge semantics", () => {
  // Arrange
  const manual = {
    title: "Manual title",
    profileImage: "https://example.com/manual-avatar.jpg",
    followersCount: 12,
    followersCountRaw: "12 followers",
  };
  const generated = {
    title: "Generated title",
    image: "https://example.com/generated-preview.jpg",
    profileImage: "https://example.com/generated-avatar.jpg",
    followersCount: 24,
    followersCountRaw: "24 followers",
    followingCount: 8,
  };

  // Act
  const merged = mergeMetadataWithManualSocialProfileOverrides(manual, generated);

  // Assert
  assert.deepEqual(merged, {
    title: "Generated title",
    image: "https://example.com/generated-preview.jpg",
    profileImage: "https://example.com/manual-avatar.jpg",
    followersCount: 12,
    followersCountRaw: "12 followers",
    followingCount: 8,
  });
});

test("supported social profile detection stays conservative for profile URLs only", () => {
  // Arrange
  const instagramProfileUrl = "https://www.instagram.com/peterryszkiewicz/";
  const youtubeVideoUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

  // Act
  const supportedProfile = resolveSupportedSocialProfile({ url: instagramProfileUrl });
  const unsupportedProfile = resolveSupportedSocialProfile({ url: youtubeVideoUrl });

  // Assert
  assert.deepEqual(supportedProfile, {
    platform: "instagram",
    handle: "peterryszkiewicz",
    expectedFields: ["profileImage", "followersCount", "followingCount"],
  });
  assert.equal(unsupportedProfile, null);
});

test("raw audience text satisfies supported-profile warning checks when numeric parsing is unavailable", () => {
  // Arrange
  const supportedProfile = resolveSupportedSocialProfile({
    url: "https://www.youtube.com/@peterryszkiewicz4354",
  });
  assert.ok(supportedProfile);

  // Act
  const missingWithRawSubscriberText = resolveMissingSupportedSocialProfileFields(
    {
      profileImage: "https://example.com/avatar.jpg",
      subscribersCountRaw: "1.2K subscribers",
    },
    supportedProfile,
  );
  const missingWithoutAvatar = resolveMissingSupportedSocialProfileFields(
    {
      subscribersCountRaw: "1.2K subscribers",
    },
    supportedProfile,
  );

  // Assert
  assert.deepEqual(missingWithRawSubscriberText, []);
  assert.deepEqual(missingWithoutAvatar, ["profileImage"]);
});
