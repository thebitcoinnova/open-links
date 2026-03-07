import assert from "node:assert/strict";
import test from "node:test";
import type { OpenLink, SiteData } from "../../lib/content/load-content";
import {
  buildRichCardViewModel,
  resolveLinkCardDescription,
  resolveLinkSourcePresentation,
} from "../../lib/ui/rich-card-policy";
import { resolveSocialProfileMetadata } from "../../lib/ui/social-profile-metadata";

const site = {
  title: "OpenLinks",
  description: "Profile links",
  theme: {
    active: "openlinks",
    available: ["openlinks"],
  },
  ui: {
    richCards: {
      renderMode: "auto",
      sourceLabelDefault: "show",
      imageTreatment: "cover",
      mobile: {
        imageLayout: "inline",
      },
    },
  },
} as const satisfies SiteData;

const instagramProfileLink = {
  id: "instagram",
  label: "Instagram",
  url: "https://www.instagram.com/peterryszkiewicz/",
  type: "rich",
  icon: "instagram",
  description: "Photos and stories",
  metadata: {
    title:
      "Peter Justice For The Victims Ryszkiewicz (@peterryszkiewicz) • Instagram photos and videos",
    description:
      "86 Followers, 169 Following, 36 Posts - See Instagram photos and videos from Peter Justice For The Victims Ryszkiewicz (@peterryszkiewicz)",
    sourceLabel: "instagram.com",
    handle: "peterryszkiewicz",
    profileImage: "/generated/images/avatar.jpg",
    image: "/generated/images/avatar.jpg",
    followersCount: 86,
    followersCountRaw: "86 Followers",
    followingCount: 169,
    followingCountRaw: "169 Following",
  },
} as const satisfies OpenLink;

test("rich profile cards render avatar-first identity chrome without duplicating identical preview media", () => {
  // Arrange
  const viewModel = buildRichCardViewModel(site, instagramProfileLink);

  // Assert
  assert.equal(viewModel.showProfileHeader, true);
  assert.equal(viewModel.previewImageUrl, undefined);
  assert.equal(viewModel.title, "Peter Justice For The Victims Ryszkiewicz");
  assert.equal(viewModel.description, "Photos and stories");
  assert.equal(viewModel.showSourceLabel, true);
  assert.deepEqual(
    viewModel.socialProfile.metrics.map((metric) => metric.displayText),
    ["86 Followers", "169 Following"],
  );
});

test("shared presentation data stays ready for simple-card profile rendering", () => {
  // Act
  const socialProfile = resolveSocialProfileMetadata(instagramProfileLink);
  const sourcePresentation = resolveLinkSourcePresentation(site, instagramProfileLink);
  const description = resolveLinkCardDescription(instagramProfileLink, socialProfile);

  // Assert
  assert.equal(socialProfile.usesProfileLayout, true);
  assert.equal(socialProfile.displayName, "Peter Justice For The Victims Ryszkiewicz");
  assert.equal(socialProfile.profileImageUrl, "/generated/images/avatar.jpg");
  assert.deepEqual(
    socialProfile.metrics.map((metric) => metric.displayText),
    ["86 Followers", "169 Following"],
  );
  assert.equal(sourcePresentation.sourceLabel, "instagram.com");
  assert.equal(sourcePresentation.showSourceLabel, true);
  assert.equal(description, "Photos and stories");
});
