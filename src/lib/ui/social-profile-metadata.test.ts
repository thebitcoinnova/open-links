import assert from "node:assert/strict";
import test from "node:test";
import { resolveSocialProfileMetadata } from "./social-profile-metadata";

test("resolves handle, localized images, and ordered metrics for a social profile link", () => {
  // Arrange
  const link = {
    id: "instagram",
    label: "Instagram",
    url: "https://www.instagram.com/peterryszkiewicz/",
    type: "rich",
    icon: "instagram",
    metadata: {
      title:
        "Peter Justice For The Victims Ryszkiewicz (@peterryszkiewicz) • Instagram photos and videos",
      image: "/generated/images/preview.jpg",
      profileImage: "/generated/images/avatar.jpg",
      followersCount: 86,
      followersCountRaw: "86 Followers",
      followingCountRaw: "169 Following",
    },
  } as const;

  // Act
  const resolved = resolveSocialProfileMetadata(link);

  // Assert
  assert.equal(resolved.platform, "instagram");
  assert.equal(resolved.displayName, "Peter Justice For The Victims Ryszkiewicz");
  assert.equal(resolved.handle, "peterryszkiewicz");
  assert.equal(resolved.handleDisplay, "@peterryszkiewicz");
  assert.equal(resolved.usesProfileLayout, true);
  assert.equal(resolved.hasDistinctPreviewImage, true);
  assert.equal(resolved.previewImageUrl, "/generated/images/preview.jpg");
  assert.equal(resolved.profileImageUrl, "/generated/images/avatar.jpg");
  assert.deepEqual(resolved.metrics, [
    {
      kind: "followers",
      label: "Followers",
      count: 86,
      rawText: "86 Followers",
      parsedCountCompactText: "86",
      displayLabel: "Followers",
      displayText: "86 Followers",
    },
    {
      kind: "following",
      label: "Following",
      count: undefined,
      rawText: "169 Following",
      parsedCountCompactText: undefined,
      displayLabel: "Following",
      displayText: "169 Following",
    },
  ]);
});

test("formats parsed metrics compactly while preserving raw-label casing when available", () => {
  // Arrange
  const link = {
    id: "youtube",
    label: "YouTube",
    url: "https://www.youtube.com/@peterryszkiewicz4354",
    type: "rich",
    icon: "youtube",
    metadata: {
      title: "Peter NoTaxationWithoutRepresentation Ryszkiewicz - YouTube",
      image: "/generated/images/channel-banner.jpg",
      profileImage: "/generated/images/channel-avatar.jpg",
      subscribersCount: 1200,
      subscribersCountRaw: "1.2K subscribers",
    },
  } as const;

  // Act
  const resolved = resolveSocialProfileMetadata(link);

  // Assert
  assert.equal(resolved.platform, "youtube");
  assert.equal(resolved.displayName, "Peter NoTaxationWithoutRepresentation Ryszkiewicz");
  assert.equal(resolved.hasDistinctPreviewImage, true);
  assert.deepEqual(resolved.metrics, [
    {
      kind: "subscribers",
      label: "Subscribers",
      count: 1200,
      rawText: "1.2K subscribers",
      parsedCountCompactText: "1.2K",
      displayLabel: "subscribers",
      displayText: "1.2K subscribers",
    },
  ]);
});

test("returns an empty metric list when no audience fields are present", () => {
  // Arrange
  const link = {
    id: "github",
    label: "GitHub",
    url: "https://github.com/pRizz",
    type: "rich",
    icon: "github",
    metadata: {},
  } as const;

  // Act
  const resolved = resolveSocialProfileMetadata(link);

  // Assert
  assert.equal(resolved.platform, "github");
  assert.equal(resolved.displayName, "GitHub");
  assert.equal(resolved.usesProfileLayout, false);
  assert.equal(resolved.hasDistinctPreviewImage, false);
  assert.deepEqual(resolved.metrics, []);
  assert.equal(resolved.profileImageUrl, undefined);
  assert.equal(resolved.previewImageUrl, undefined);
});
