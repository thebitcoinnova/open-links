import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeMetadataWithManualSocialProfileOverrides,
  normalizeSupportedSocialProfileMetadata,
  resolveMissingSupportedSocialProfileFields,
  resolveSupportedSocialProfile,
} from "./social-profile-fields";

test("manual social profile fields override generated values without changing generic merge semantics", () => {
  // Arrange
  const manual = {
    title: "Manual title",
    profileDescription: "Manual profile description",
    profileImage: "https://example.com/manual-avatar.jpg",
    followersCount: 12,
    followersCountRaw: "12 followers",
  };
  const generated = {
    title: "Generated title",
    profileDescription: "Generated profile description",
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
    profileDescription: "Manual profile description",
    image: "https://example.com/generated-preview.jpg",
    profileImage: "https://example.com/manual-avatar.jpg",
    followersCount: 12,
    followersCountRaw: "12 followers",
    followingCount: 8,
  });
});

test("profile description stays additive when only generated metadata provides it", () => {
  // Arrange
  const manual = {
    title: "Manual title",
  };
  const generated = {
    title: "Generated title",
    profileDescription: "Generated profile description",
    image: "https://example.com/generated-preview.jpg",
  };

  // Act
  const merged = mergeMetadataWithManualSocialProfileOverrides(manual, generated);

  // Assert
  assert.deepEqual(merged, {
    title: "Generated title",
    profileDescription: "Generated profile description",
    image: "https://example.com/generated-preview.jpg",
  });
});

test("supported social profile detection supports the expanded platform set but stays conservative for non-profile URLs", () => {
  // Arrange
  const instagramProfileUrl = "https://www.instagram.com/peterryszkiewicz/";
  const githubProfileUrl = "https://github.com/pRizz";
  const linkedinProfileUrl = "https://www.linkedin.com/in/peter-ryszkiewicz/";
  const mediumProfileUrl = "https://medium.com/@peterryszkiewicz";
  const clubOrangeProfileUrl = "https://app.cluborange.org/pryszkie";
  const primalProfileUrl = "https://primal.net/peterryszkiewicz";
  const substackProfileUrl = "https://peterryszkiewicz.substack.com/";
  const substackCustomDomainUrl = "https://peter.ryszkiewicz.us/";
  const xProfileUrl = "https://x.com/pryszkie";
  const facebookProfileUrl = "https://www.facebook.com/peter.ryszkiewicz";
  const facebookPeopleProfileUrl =
    "https://www.facebook.com/people/Bright-Builds-LLC/61588043858384/";
  const linkedinFeedUrl = "https://www.linkedin.com/feed/";
  const youtubeVideoUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

  // Act
  const instagramProfile = resolveSupportedSocialProfile({ url: instagramProfileUrl });
  const githubProfile = resolveSupportedSocialProfile({ url: githubProfileUrl });
  const linkedinProfile = resolveSupportedSocialProfile({ url: linkedinProfileUrl });
  const mediumProfile = resolveSupportedSocialProfile({ url: mediumProfileUrl });
  const clubOrangeProfile = resolveSupportedSocialProfile({ url: clubOrangeProfileUrl });
  const primalProfile = resolveSupportedSocialProfile({ url: primalProfileUrl });
  const substackProfile = resolveSupportedSocialProfile({ url: substackProfileUrl });
  const substackCustomDomainProfile = resolveSupportedSocialProfile({
    url: substackCustomDomainUrl,
    icon: "substack",
    metadataHandle: "@peterryszkiewicz",
  });
  const xProfile = resolveSupportedSocialProfile({ url: xProfileUrl });
  const facebookProfile = resolveSupportedSocialProfile({ url: facebookProfileUrl });
  const facebookPeopleProfile = resolveSupportedSocialProfile({ url: facebookPeopleProfileUrl });
  const unsupportedLinkedinPage = resolveSupportedSocialProfile({ url: linkedinFeedUrl });
  const unsupportedProfile = resolveSupportedSocialProfile({ url: youtubeVideoUrl });

  // Assert
  assert.deepEqual(instagramProfile, {
    platform: "instagram",
    handle: "peterryszkiewicz",
    expectedFields: ["profileImage", "followersCount", "followingCount"],
  });
  assert.deepEqual(githubProfile, {
    platform: "github",
    handle: "prizz",
    expectedFields: ["profileImage", "followersCount", "followingCount"],
  });
  assert.deepEqual(linkedinProfile, {
    platform: "linkedin",
    handle: "peter-ryszkiewicz",
    expectedFields: ["profileImage"],
  });
  assert.deepEqual(mediumProfile, {
    platform: "medium",
    handle: "peterryszkiewicz",
    expectedFields: ["profileImage"],
  });
  assert.deepEqual(clubOrangeProfile, {
    platform: "cluborange",
    handle: "pryszkie",
    expectedFields: ["profileImage"],
  });
  assert.deepEqual(primalProfile, {
    platform: "primal",
    handle: "peterryszkiewicz",
    expectedFields: ["profileImage"],
  });
  assert.deepEqual(substackProfile, {
    platform: "substack",
    handle: "peterryszkiewicz",
    expectedFields: ["profileImage", "subscribersCount"],
  });
  assert.deepEqual(substackCustomDomainProfile, {
    platform: "substack",
    handle: "peterryszkiewicz",
    expectedFields: ["profileImage", "subscribersCount"],
  });
  assert.deepEqual(xProfile, {
    platform: "x",
    handle: "pryszkie",
    expectedFields: ["profileImage"],
  });
  assert.deepEqual(facebookProfile, {
    platform: "facebook",
    handle: "peter.ryszkiewicz",
    expectedFields: ["profileImage"],
  });
  assert.deepEqual(facebookPeopleProfile, {
    platform: "facebook",
    handle: "bright-builds-llc",
    expectedFields: ["profileImage"],
  });
  assert.equal(unsupportedLinkedinPage, null);
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

test("substack subscriber raw text satisfies supported-profile warning checks", () => {
  // Arrange
  const supportedProfile = resolveSupportedSocialProfile({
    url: "https://peter.ryszkiewicz.us/",
    icon: "substack",
    metadataHandle: "@peterryszkiewicz",
  });
  assert.ok(supportedProfile);

  // Act
  const missingFields = resolveMissingSupportedSocialProfileFields(
    {
      profileImage: "https://example.com/substack-avatar.jpg",
      subscribersCountRaw: "10 subscribers",
    },
    supportedProfile,
  );

  // Assert
  assert.deepEqual(missingFields, []);
});

test("supported profile normalization backfills profile image from preview image", () => {
  // Arrange
  const githubProfile = resolveSupportedSocialProfile({
    url: "https://github.com/pRizz",
  });
  assert.ok(githubProfile);

  // Act
  const normalized = normalizeSupportedSocialProfileMetadata(
    {
      image: "https://avatars.githubusercontent.com/u/3519085?v=4?s=400",
      followersCount: 90,
      followersCountRaw: "90 followers",
    },
    githubProfile,
  );
  const missingFields = resolveMissingSupportedSocialProfileFields(normalized, githubProfile);

  // Assert
  assert.deepEqual(normalized, {
    image: "https://avatars.githubusercontent.com/u/3519085?v=4?s=400",
    profileImage: "https://avatars.githubusercontent.com/u/3519085?v=4?s=400",
    followersCount: 90,
    followersCountRaw: "90 followers",
  });
  assert.deepEqual(missingFields, ["followingCount"]);
});

test("avatar-only supported platforms accept normalized preview images without audience counts", () => {
  // Arrange
  const xProfile = resolveSupportedSocialProfile({
    url: "https://x.com/pryszkie",
  });
  assert.ok(xProfile);
  const clubOrangeProfile = resolveSupportedSocialProfile({
    url: "https://app.cluborange.org/pryszkie",
  });
  assert.ok(clubOrangeProfile);

  // Act
  const normalizedX = normalizeSupportedSocialProfileMetadata(
    {
      image: "cache/rich-authenticated/example-avatar.jpg",
    },
    xProfile,
  );
  const normalizedClubOrange = normalizeSupportedSocialProfileMetadata(
    {
      image: "https://orange-pill-app-dev.s3.amazonaws.com/avatars/example.jpg",
    },
    clubOrangeProfile,
  );
  const missingXFields = resolveMissingSupportedSocialProfileFields(normalizedX, xProfile);
  const missingClubOrangeFields = resolveMissingSupportedSocialProfileFields(
    normalizedClubOrange,
    clubOrangeProfile,
  );

  // Assert
  assert.deepEqual(normalizedX, {
    image: "cache/rich-authenticated/example-avatar.jpg",
    profileImage: "cache/rich-authenticated/example-avatar.jpg",
  });
  assert.deepEqual(normalizedClubOrange, {
    image: "https://orange-pill-app-dev.s3.amazonaws.com/avatars/example.jpg",
    profileImage: "https://orange-pill-app-dev.s3.amazonaws.com/avatars/example.jpg",
  });
  assert.deepEqual(missingXFields, []);
  assert.deepEqual(missingClubOrangeFields, []);
});

test("medium profile normalization backfills the feed image as the profile avatar", () => {
  // Arrange
  const mediumProfile = resolveSupportedSocialProfile({
    url: "https://medium.com/@peterryszkiewicz",
  });
  assert.ok(mediumProfile);

  // Act
  const normalized = normalizeSupportedSocialProfileMetadata(
    {
      image: "https://cdn-images-1.medium.com/fit/c/150/150/example.jpg",
    },
    mediumProfile,
  );
  const missingFields = resolveMissingSupportedSocialProfileFields(normalized, mediumProfile);

  // Assert
  assert.deepEqual(normalized, {
    image: "https://cdn-images-1.medium.com/fit/c/150/150/example.jpg",
    profileImage: "https://cdn-images-1.medium.com/fit/c/150/150/example.jpg",
  });
  assert.deepEqual(missingFields, []);
});

test("substack profile normalization does not treat preview images as profile avatars", () => {
  // Arrange
  const substackProfile = resolveSupportedSocialProfile({
    url: "https://peter.ryszkiewicz.us/",
    icon: "substack",
    metadataHandle: "@peterryszkiewicz",
  });
  assert.ok(substackProfile);

  // Act
  const normalized = normalizeSupportedSocialProfileMetadata(
    {
      image: "https://substackcdn.com/image/fetch/subscribe-card.jpg",
    },
    substackProfile,
  );
  const missingFields = resolveMissingSupportedSocialProfileFields(normalized, substackProfile);

  // Assert
  assert.deepEqual(normalized, {
    image: "https://substackcdn.com/image/fetch/subscribe-card.jpg",
  });
  assert.deepEqual(missingFields, ["profileImage", "subscribersCount"]);
});

test("linkedin profile normalization backfills profile image from authenticated preview media", () => {
  // Arrange
  const linkedinProfile = resolveSupportedSocialProfile({
    url: "https://www.linkedin.com/in/peter-ryszkiewicz/",
  });
  assert.ok(linkedinProfile);

  // Act
  const normalized = normalizeSupportedSocialProfileMetadata(
    {
      image: "cache/rich-authenticated/linkedin-avatar.jpg",
    },
    linkedinProfile,
  );
  const missingFields = resolveMissingSupportedSocialProfileFields(normalized, linkedinProfile);

  // Assert
  assert.deepEqual(normalized, {
    image: "cache/rich-authenticated/linkedin-avatar.jpg",
    profileImage: "cache/rich-authenticated/linkedin-avatar.jpg",
  });
  assert.deepEqual(missingFields, []);
});
