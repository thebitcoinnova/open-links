import assert from "node:assert/strict";
import test from "node:test";
import {
  augmentSupportedSocialProfileMetadata,
  parseGithubProfileMetadata,
  reconcileSupportedProfileDescriptionMetadata,
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
    image: "/cache/content-images/x-avatar.jpg",
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
  assert.equal(augmented.image, "/cache/content-images/x-avatar.jpg");
  assert.equal(augmented.profileImage, "/cache/content-images/x-avatar.jpg");
});

test("keeps excluded platforms from backfilling preview media into profile images", () => {
  // Arrange
  const metadata = {
    title: "Peter Ryszkiewicz | Substack",
    image: "/cache/content-images/substack-preview.jpg",
  };

  // Act
  const augmented = augmentSupportedSocialProfileMetadata({
    html: "<html></html>",
    metadata,
    supportedProfile: {
      platform: "substack",
      handle: "peterryszkiewicz",
      expectedFields: ["profileImage", "subscribersCount"],
    },
  });

  // Assert
  assert.equal(augmented.image, "/cache/content-images/substack-preview.jpg");
  assert.equal(augmented.profileImage, undefined);
});

test("reconciles LinkedIn public and authenticated descriptions into separate fields", () => {
  // Arrange
  const metadata = {
    title: "Peter Ryszkiewicz | LinkedIn",
    description: "Talented software engineer, excited to work on new and challenging problems.",
    image: "/cache/rich-authenticated/linkedin-avatar.jpg",
  };

  // Act
  const reconciled = reconcileSupportedProfileDescriptionMetadata({
    supportedProfile: {
      platform: "linkedin",
      handle: "peter-ryszkiewicz",
      expectedFields: ["profileImage"],
    },
    metadata,
    publicMetadata: {
      description:
        "Talented software engineer, excited to work on new and challenging problems. · Experience: Venmo · Education: Illinois Institute of Technology · Location: Chicago · 190 connections on LinkedIn. View Peter Ryszkiewicz’s profile on LinkedIn, a professional community of 1 billion members.",
    },
  });

  // Assert
  assert.equal(
    reconciled.description,
    "Talented software engineer, excited to work on new and challenging problems. · Experience: Venmo · Education: Illinois Institute of Technology · Location: Chicago · 190 connections on LinkedIn. View Peter Ryszkiewicz’s profile on LinkedIn, a professional community of 1 billion members.",
  );
  assert.equal(
    reconciled.profileDescription,
    "Talented software engineer, excited to work on new and challenging problems.",
  );
});

test("keeps single-surface profile descriptions unchanged for non-LinkedIn platforms", () => {
  // Arrange
  const metadata = {
    title: "pRizz - Overview",
    description:
      "An agentic engineer, making things in the AI space, Bitcoin space, and many others. - pRizz",
  };

  // Act
  const reconciled = reconcileSupportedProfileDescriptionMetadata({
    supportedProfile: {
      platform: "github",
      handle: "prizz",
      expectedFields: ["profileImage", "followersCount", "followingCount"],
    },
    metadata,
    publicMetadata: {
      description:
        "An agentic engineer, making things in the AI space, Bitcoin space, and many others. - pRizz",
    },
  });

  // Assert
  assert.deepEqual(reconciled, metadata);
});
