import assert from "node:assert/strict";
import test from "node:test";
import {
  augmentSupportedSocialProfileMetadata,
  parseGithubProfileMetadata,
} from "./supported-social-profile-metadata";

test("parses GitHub follower and following counts with raw text preserved", () => {
  // Arrange
  const html = `
    <a href="/pRizz?tab=followers">
      <span class="text-bold color-fg-default">90</span>
      followers
    </a>
    <a href="/pRizz?tab=following">
      <span class="text-bold color-fg-default">87</span>
      following
    </a>
  `;

  // Act
  const parsed = parseGithubProfileMetadata(html);

  // Assert
  assert.deepEqual(parsed, {
    followersCount: 90,
    followersCountRaw: "90 followers",
    followingCount: 87,
    followingCountRaw: "87 following",
  });
});

test("augments supported profile metadata by backfilling profile image for avatar-first platforms", () => {
  // Arrange
  const metadata = {
    title: "pryszkie on X",
    image: "/generated/images/x-avatar.jpg",
  };

  // Act
  const augmented = augmentSupportedSocialProfileMetadata({
    html: "<html></html>",
    metadata,
    supportedProfile: {
      platform: "x",
      handle: "pryszkie",
      expectedFields: ["profileImage"],
    },
  });

  // Assert
  assert.equal(augmented.image, "/generated/images/x-avatar.jpg");
  assert.equal(augmented.profileImage, "/generated/images/x-avatar.jpg");
});
