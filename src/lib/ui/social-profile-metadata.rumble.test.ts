import assert from "node:assert/strict";
import test from "node:test";
import { resolveSocialProfileMetadata } from "./social-profile-metadata";

test("uses Rumble avatar-first layout while preserving a distinct banner preview image", () => {
  // Arrange
  const link = {
    id: "rumble",
    label: "Rumble",
    url: "https://rumble.com/c/InTheLitterBox",
    type: "rich",
    metadata: {
      title: "In The Litter Box w/ Jewels & Catturd",
      description:
        'Browse the most recent videos from channel "In The Litter Box w/ Jewels & Catturd" uploaded to Rumble.com',
      profileDescription: "In the Litter Box with Jewels & Catturd .. A Talk Show.",
      image: "/cache/content-images/rumble-banner.jpg",
      profileImage: "/cache/content-images/rumble-avatar.jpg",
      followersCount: 112000,
      followersCountRaw: "112K Followers",
      sourceLabel: "rumble.com",
    },
  } as const;

  // Act
  const resolved = resolveSocialProfileMetadata(link);

  // Assert
  assert.equal(resolved.platform, "rumble");
  assert.equal(resolved.displayName, "In The Litter Box w/ Jewels & Catturd");
  assert.equal(resolved.handle, "inthelitterbox");
  assert.equal(resolved.handleDisplay, "@inthelitterbox");
  assert.equal(
    resolved.profileDescription,
    "In the Litter Box with Jewels & Catturd .. A Talk Show.",
  );
  assert.equal(resolved.usesProfileLayout, true);
  assert.equal(resolved.hasDistinctPreviewImage, true);
  assert.equal(resolved.profileImageUrl, "/cache/content-images/rumble-avatar.jpg");
  assert.equal(resolved.previewImageUrl, "/cache/content-images/rumble-banner.jpg");
  assert.deepEqual(resolved.metrics, [
    {
      kind: "followers",
      label: "Followers",
      count: 112000,
      rawText: "112K Followers",
      parsedCountCompactText: "112K",
      displayLabel: "Followers",
      displayText: "112K Followers",
    },
  ]);
});
