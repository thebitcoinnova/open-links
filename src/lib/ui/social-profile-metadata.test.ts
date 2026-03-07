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
  assert.equal(resolved.handle, "peterryszkiewicz");
  assert.equal(resolved.handleDisplay, "@peterryszkiewicz");
  assert.equal(resolved.previewImageUrl, "/generated/images/preview.jpg");
  assert.equal(resolved.profileImageUrl, "/generated/images/avatar.jpg");
  assert.deepEqual(resolved.metrics, [
    {
      kind: "followers",
      label: "Followers",
      count: 86,
      rawText: "86 Followers",
    },
    {
      kind: "following",
      label: "Following",
      count: undefined,
      rawText: "169 Following",
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
  assert.deepEqual(resolved.metrics, []);
  assert.equal(resolved.profileImageUrl, undefined);
  assert.equal(resolved.previewImageUrl, undefined);
});
