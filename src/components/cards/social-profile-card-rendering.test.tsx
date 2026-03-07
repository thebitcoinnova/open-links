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

const githubRichLink = {
  id: "github",
  label: "GitHub",
  url: "https://github.com/pRizz",
  type: "rich",
  icon: "github",
  description: "Code, experiments, and open-source projects",
  metadata: {
    title: "pRizz - Overview",
    description:
      "An agentic engineer, making things in the AI space, Bitcoin space, and many others. - pRizz",
    sourceLabel: "github.com",
    handle: "prizz",
    image: "/generated/images/github-avatar.jpg",
    followersCount: 90,
    followersCountRaw: "90 followers",
    followingCount: 87,
    followingCountRaw: "87 following",
  },
} as const satisfies OpenLink;

const articleRichLink = {
  id: "article",
  label: "Engineering Notes",
  url: "https://notes.openlinks.dev/launch-notes",
  type: "rich",
  icon: "notion",
  description: "Shipping notes and technical writeups",
  metadata: {
    title: "Engineering Notes",
    description: "Shipping notes and technical writeups",
    image: "/generated/images/article-preview.jpg",
    sourceLabel: "notes.openlinks.dev",
  },
} as const satisfies OpenLink;

const blogRichLink = {
  id: "blog",
  label: "Engineering Notes",
  url: "https://notes.openlinks.dev/launch-notes",
  type: "rich",
  icon: "notion",
  description: "Shipping notes and technical writeups",
  metadata: {
    title: "Engineering Notes",
    description: "Shipping notes and technical writeups",
    sourceLabel: "notes.openlinks.dev",
  },
} as const satisfies OpenLink;

test("rich profile cards render avatar-first identity chrome without duplicating identical preview media", () => {
  // Arrange
  const viewModel = buildRichCardViewModel(site, instagramProfileLink);

  // Assert
  assert.equal(viewModel.showProfileHeader, true);
  assert.equal(viewModel.showMetaHandle, false);
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

test("github rich cards switch to profile layout with avatar identity and audience metrics", () => {
  // Arrange
  const viewModel = buildRichCardViewModel(site, githubRichLink);

  // Assert
  assert.equal(viewModel.showProfileHeader, true);
  assert.equal(viewModel.showMetaHandle, false);
  assert.equal(viewModel.handleDisplay, "@prizz");
  assert.equal(viewModel.previewImageUrl, undefined);
  assert.equal(viewModel.title, "pRizz");
  assert.equal(
    viewModel.description,
    "An agentic engineer, making things in the AI space, Bitcoin space, and many others. - pRizz",
  );
  assert.equal(viewModel.sourceLabel, "github.com");
  assert.equal(viewModel.socialProfile.profileImageUrl, "/generated/images/github-avatar.jpg");
  assert.deepEqual(
    viewModel.socialProfile.metrics.map((metric) => metric.displayText),
    ["90 followers", "87 following"],
  );
});

test("non-profile rich cards keep preview media and fallback metadata for preview layouts", () => {
  // Arrange
  const viewModel = buildRichCardViewModel(site, articleRichLink);

  // Assert
  assert.equal(viewModel.showProfileHeader, false);
  assert.equal(viewModel.showMetaHandle, false);
  assert.equal(viewModel.handleDisplay, undefined);
  assert.equal(viewModel.previewImageUrl, "/generated/images/article-preview.jpg");
  assert.equal(viewModel.title, "Engineering Notes");
  assert.equal(viewModel.description, "Shipping notes and technical writeups");
  assert.equal(viewModel.sourceLabel, "notes.openlinks.dev");
  assert.deepEqual(viewModel.socialProfile.metrics, []);
});

test("non-profile rich cards without preview media stay on the text-led fallback path", () => {
  // Arrange
  const viewModel = buildRichCardViewModel(site, blogRichLink);

  // Assert
  assert.equal(viewModel.showProfileHeader, false);
  assert.equal(viewModel.showMetaHandle, false);
  assert.equal(viewModel.handleDisplay, undefined);
  assert.equal(viewModel.previewImageUrl, undefined);
  assert.equal(viewModel.title, "Engineering Notes");
  assert.equal(viewModel.description, "Shipping notes and technical writeups");
  assert.equal(viewModel.sourceLabel, "notes.openlinks.dev");
  assert.equal(viewModel.showSourceLabel, true);
});
