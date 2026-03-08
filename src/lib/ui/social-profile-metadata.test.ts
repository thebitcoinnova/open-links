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
    id: "project",
    label: "Project",
    url: "https://example.com/project",
    type: "rich",
    icon: "notion",
    metadata: {},
  } as const;

  // Act
  const resolved = resolveSocialProfileMetadata(link);

  // Assert
  assert.equal(resolved.platform, undefined);
  assert.equal(resolved.displayName, "Project");
  assert.equal(resolved.usesProfileLayout, false);
  assert.equal(resolved.hasDistinctPreviewImage, false);
  assert.deepEqual(resolved.metrics, []);
  assert.equal(resolved.profileImageUrl, undefined);
  assert.equal(resolved.previewImageUrl, undefined);
});

test("reuses preview images as profile avatars for newly supported avatar-first platforms", () => {
  // Arrange
  const link = {
    id: "x",
    label: "X",
    url: "https://x.com/pryszkie",
    type: "rich",
    icon: "x",
    metadata: {
      title: "@pryszkie on X",
      image: "/generated/images/x-avatar.jpg",
      sourceLabel: "x.com",
    },
  } as const;

  // Act
  const resolved = resolveSocialProfileMetadata(link);

  // Assert
  assert.equal(resolved.platform, "x");
  assert.equal(resolved.displayName, "@pryszkie on X");
  assert.equal(resolved.usesProfileLayout, true);
  assert.equal(resolved.hasDistinctPreviewImage, false);
  assert.equal(resolved.profileImageUrl, "/generated/images/x-avatar.jpg");
  assert.equal(resolved.previewImageUrl, "/generated/images/x-avatar.jpg");
  assert.deepEqual(resolved.metrics, []);
});

test("medium profile metadata cleans the feed title into a display name and treats the avatar as identity chrome", () => {
  // Arrange
  const link = {
    id: "medium",
    label: "Medium",
    url: "https://medium.com/@peterryszkiewicz",
    type: "rich",
    icon: "medium",
    metadata: {
      title: "Stories by Peter Ryszkiewicz on Medium",
      image: "/generated/images/medium-avatar.jpg",
      handle: "peterryszkiewicz",
      sourceLabel: "medium.com",
    },
  } as const;

  // Act
  const resolved = resolveSocialProfileMetadata(link);

  // Assert
  assert.equal(resolved.platform, "medium");
  assert.equal(resolved.displayName, "Peter Ryszkiewicz");
  assert.equal(resolved.handle, "peterryszkiewicz");
  assert.equal(resolved.handleDisplay, "@peterryszkiewicz");
  assert.equal(resolved.usesProfileLayout, true);
  assert.equal(resolved.hasDistinctPreviewImage, false);
  assert.equal(resolved.profileImageUrl, "/generated/images/medium-avatar.jpg");
  assert.equal(resolved.previewImageUrl, "/generated/images/medium-avatar.jpg");
});

test("substack custom-domain metadata uses the explicit handle and strips the site suffix from titles", () => {
  // Arrange
  const link = {
    id: "substack",
    label: "Substack",
    url: "https://peter.ryszkiewicz.us/",
    type: "rich",
    icon: "substack",
    metadata: {
      title: "Peter Ryszkiewicz | Substack",
      image: "/generated/images/substack-avatar.jpg",
      profileImage: "/generated/images/substack-avatar.jpg",
      handle: "peterryszkiewicz",
      sourceLabel: "peter.ryszkiewicz.us",
    },
  } as const;

  // Act
  const resolved = resolveSocialProfileMetadata(link);

  // Assert
  assert.equal(resolved.platform, "substack");
  assert.equal(resolved.displayName, "Peter Ryszkiewicz");
  assert.equal(resolved.handle, "peterryszkiewicz");
  assert.equal(resolved.handleDisplay, "@peterryszkiewicz");
  assert.equal(resolved.usesProfileLayout, true);
  assert.equal(resolved.hasDistinctPreviewImage, false);
  assert.equal(resolved.profileImageUrl, "/generated/images/substack-avatar.jpg");
  assert.equal(resolved.previewImageUrl, "/generated/images/substack-avatar.jpg");
});

test("linkedin profile metadata reuses authenticated preview media and trims the site suffix from titles", () => {
  // Arrange
  const link = {
    id: "linkedin",
    label: "LinkedIn",
    url: "https://www.linkedin.com/in/peter-ryszkiewicz/",
    type: "rich",
    icon: "linkedin",
    metadata: {
      title: "Peter Ryszkiewicz | LinkedIn",
      description: "Talented software engineer, excited to work on new and challenging problems.",
      image: "/cache/rich-authenticated/linkedin-avatar.jpg",
      sourceLabel: "linkedin.com",
    },
  } as const;

  // Act
  const resolved = resolveSocialProfileMetadata(link);

  // Assert
  assert.equal(resolved.platform, "linkedin");
  assert.equal(resolved.displayName, "Peter Ryszkiewicz");
  assert.equal(resolved.handle, "peter-ryszkiewicz");
  assert.equal(resolved.handleDisplay, "@peter-ryszkiewicz");
  assert.equal(resolved.usesProfileLayout, true);
  assert.equal(resolved.hasDistinctPreviewImage, false);
  assert.equal(resolved.profileImageUrl, "/cache/rich-authenticated/linkedin-avatar.jpg");
  assert.equal(resolved.previewImageUrl, "/cache/rich-authenticated/linkedin-avatar.jpg");
  assert.deepEqual(resolved.metrics, []);
});

test("keeps GitHub metrics in profile order while treating the avatar image as identity chrome", () => {
  // Arrange
  const link = {
    id: "github",
    label: "GitHub",
    url: "https://github.com/pRizz",
    type: "rich",
    icon: "github",
    metadata: {
      title: "pRizz - Overview",
      image: "/generated/images/github-avatar.jpg",
      followersCount: 90,
      followersCountRaw: "90 followers",
      followingCount: 87,
      followingCountRaw: "87 following",
    },
  } as const;

  // Act
  const resolved = resolveSocialProfileMetadata(link);

  // Assert
  assert.equal(resolved.platform, "github");
  assert.equal(resolved.displayName, "pRizz");
  assert.equal(resolved.usesProfileLayout, true);
  assert.equal(resolved.hasDistinctPreviewImage, false);
  assert.equal(resolved.profileImageUrl, "/generated/images/github-avatar.jpg");
  assert.deepEqual(
    resolved.metrics.map((metric) => metric.displayText),
    ["90 followers", "87 following"],
  );
});
