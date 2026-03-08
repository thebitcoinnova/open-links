import assert from "node:assert/strict";
import test from "node:test";
import type { OpenLink, SiteData } from "../../lib/content/load-content";
import {
  buildNonPaymentCardViewModel,
  buildRichCardViewModel,
  buildSimpleCardViewModel,
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

const linkedinRichLink = {
  id: "linkedin",
  label: "LinkedIn",
  url: "https://www.linkedin.com/in/peter-ryszkiewicz/",
  type: "rich",
  icon: "linkedin",
  description: "Professional profile and recent work",
  metadata: {
    title: "Peter Ryszkiewicz | LinkedIn",
    description: "Talented software engineer, excited to work on new and challenging problems.",
    sourceLabel: "linkedin.com",
    image: "/cache/rich-authenticated/linkedin-avatar.jpg",
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

const instagramSimpleLink = {
  ...instagramProfileLink,
  id: "instagram-simple",
  type: "simple",
} as const satisfies OpenLink;

const workSimpleLink = {
  id: "work",
  label: "OpenLinks",
  url: "https://openlinks.dev",
  type: "simple",
  icon: "globe",
  description: "Open source links site",
  metadata: {
    title: "OpenLinks project site",
    description: "Open source links site",
    sourceLabel: "openlinks.dev",
  },
} as const satisfies OpenLink;

test("rich profile cards resolve avatar leads, header metrics, and footer source context", () => {
  // Arrange
  const viewModel = buildRichCardViewModel(site, instagramProfileLink);

  // Assert
  assert.equal(viewModel.leadKind, "avatar");
  assert.equal(viewModel.leadImageUrl, "/generated/images/avatar.jpg");
  assert.equal(viewModel.title, "Peter Justice For The Victims Ryszkiewicz");
  assert.equal(
    viewModel.description,
    "86 Followers, 169 Following, 36 Posts - See Instagram photos and videos from Peter Justice For The Victims Ryszkiewicz (@peterryszkiewicz)",
  );
  assert.deepEqual(
    viewModel.headerMetaItems.map((item) => `${item.kind}:${item.text}`),
    ["handle:@peterryszkiewicz", "metric:86 Followers", "metric:169 Following"],
  );
  assert.equal(viewModel.footerSourceLabel, "instagram.com");
  assert.equal(viewModel.showFooterIcon, true);
  assert.deepEqual(
    viewModel.socialProfile.metrics.map((metric) => metric.displayText),
    ["86 Followers", "169 Following"],
  );
});

test("shared presentation data stays ready for simple-card profile rendering", () => {
  // Act
  const socialProfile = resolveSocialProfileMetadata(instagramProfileLink);
  const sourcePresentation = resolveLinkSourcePresentation(site, instagramProfileLink);
  const description = resolveLinkCardDescription(site, instagramProfileLink);

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
  assert.equal(
    description,
    "86 Followers, 169 Following, 36 Posts - See Instagram photos and videos from Peter Justice For The Victims Ryszkiewicz (@peterryszkiewicz)",
  );
});

test("github rich cards keep avatar identity and audience metrics in the shared layout model", () => {
  // Arrange
  const viewModel = buildRichCardViewModel(site, githubRichLink);

  // Assert
  assert.equal(viewModel.leadKind, "avatar");
  assert.equal(viewModel.leadImageUrl, "/generated/images/github-avatar.jpg");
  assert.equal(viewModel.title, "pRizz");
  assert.equal(
    viewModel.description,
    "An agentic engineer, making things in the AI space, Bitcoin space, and many others. - pRizz",
  );
  assert.deepEqual(
    viewModel.headerMetaItems.map((item) => `${item.kind}:${item.text}`),
    ["handle:@prizz", "metric:90 followers", "metric:87 following"],
  );
  assert.equal(viewModel.footerSourceLabel, "github.com");
  assert.deepEqual(
    viewModel.socialProfile.metrics.map((metric) => metric.displayText),
    ["90 followers", "87 following"],
  );
});

test("linkedin rich cards use avatar leads from authenticated metadata without duplicate preview media", () => {
  // Arrange
  const viewModel = buildRichCardViewModel(site, linkedinRichLink);

  // Assert
  assert.equal(viewModel.leadKind, "avatar");
  assert.equal(viewModel.leadImageUrl, "/cache/rich-authenticated/linkedin-avatar.jpg");
  assert.equal(viewModel.title, "Peter Ryszkiewicz");
  assert.equal(
    viewModel.description,
    "Talented software engineer, excited to work on new and challenging problems.",
  );
  assert.deepEqual(viewModel.headerMetaItems, [{ kind: "handle", text: "@peter-ryszkiewicz" }]);
  assert.equal(viewModel.footerSourceLabel, "linkedin.com");
  assert.deepEqual(viewModel.socialProfile.metrics, []);
});

test("non-profile rich cards keep preview leads with compact header and footer source rows", () => {
  // Arrange
  const viewModel = buildRichCardViewModel(site, articleRichLink);

  // Assert
  assert.equal(viewModel.leadKind, "preview");
  assert.equal(viewModel.leadImageUrl, "/generated/images/article-preview.jpg");
  assert.equal(viewModel.title, "Engineering Notes");
  assert.equal(viewModel.description, "Shipping notes and technical writeups");
  assert.deepEqual(viewModel.headerMetaItems, [{ kind: "source", text: "notes.openlinks.dev" }]);
  assert.equal(viewModel.footerSourceLabel, "notes.openlinks.dev");
  assert.equal(viewModel.showFooterIcon, true);
  assert.deepEqual(viewModel.socialProfile.metrics, []);
});

test("non-profile rich cards without preview media fall back to icon-led shared layout", () => {
  // Arrange
  const viewModel = buildRichCardViewModel(site, blogRichLink);

  // Assert
  assert.equal(viewModel.leadKind, "icon");
  assert.equal(viewModel.leadImageUrl, undefined);
  assert.equal(viewModel.title, "Engineering Notes");
  assert.equal(viewModel.description, "Shipping notes and technical writeups");
  assert.deepEqual(viewModel.headerMetaItems, [{ kind: "source", text: "notes.openlinks.dev" }]);
  assert.equal(viewModel.footerSourceLabel, "notes.openlinks.dev");
  assert.equal(viewModel.showFooterIcon, false);
});

test("simple profile cards reuse avatar leads and footer source rows in the shared layout", () => {
  // Arrange
  const viewModel = buildSimpleCardViewModel(site, instagramSimpleLink);

  // Assert
  assert.equal(viewModel.leadKind, "avatar");
  assert.equal(viewModel.leadImageUrl, "/generated/images/avatar.jpg");
  assert.equal(viewModel.title, "Peter Justice For The Victims Ryszkiewicz");
  assert.deepEqual(
    viewModel.headerMetaItems.map((item) => `${item.kind}:${item.text}`),
    ["handle:@peterryszkiewicz", "metric:86 Followers", "metric:169 Following"],
  );
  assert.equal(viewModel.footerSourceLabel, "instagram.com");
  assert.equal(viewModel.showFooterIcon, true);
});

test("simple icon-led cards keep the footer text row without duplicating the lead icon", () => {
  // Arrange
  const viewModel = buildSimpleCardViewModel(site, workSimpleLink);

  // Assert
  assert.equal(viewModel.leadKind, "icon");
  assert.equal(viewModel.leadImageUrl, undefined);
  assert.equal(viewModel.title, "OpenLinks");
  assert.deepEqual(viewModel.headerMetaItems, []);
  assert.equal(viewModel.footerSourceLabel, "openlinks.dev");
  assert.equal(viewModel.showFooterIcon, false);
});

test("rich-card image treatment controls preview-vs-fallback lead behavior", () => {
  // Arrange
  const thumbnailSite = {
    ...site,
    ui: {
      richCards: {
        ...site.ui.richCards,
        imageTreatment: "thumbnail",
      },
    },
  } as const satisfies SiteData;
  const offSite = {
    ...site,
    ui: {
      richCards: {
        ...site.ui.richCards,
        imageTreatment: "off",
      },
    },
  } as const satisfies SiteData;

  // Act
  const coverViewModel = buildRichCardViewModel(site, articleRichLink);
  const thumbnailViewModel = buildRichCardViewModel(thumbnailSite, articleRichLink);
  const offViewModel = buildRichCardViewModel(offSite, articleRichLink);

  // Assert
  assert.equal(coverViewModel.imageTreatment, "cover");
  assert.equal(coverViewModel.leadKind, "preview");
  assert.equal(thumbnailViewModel.imageTreatment, "thumbnail");
  assert.equal(thumbnailViewModel.leadKind, "preview");
  assert.equal(offViewModel.imageTreatment, "off");
  assert.equal(offViewModel.leadKind, "icon");
  assert.equal(offViewModel.showFooterIcon, false);
});

test("deprecated mobile image-layout settings no longer affect non-payment card presentation", () => {
  // Arrange
  const fullWidthSite = {
    ...site,
    ui: {
      richCards: {
        ...site.ui.richCards,
        mobile: {
          imageLayout: "full-width",
        },
      },
    },
  } as const satisfies SiteData;
  const fullWidthLink = {
    ...articleRichLink,
    metadata: {
      ...articleRichLink.metadata,
      mobileImageLayout: "full-width",
    },
  } as const satisfies OpenLink;

  // Act
  const inlineSiteViewModel = buildRichCardViewModel(site, articleRichLink);
  const fullWidthSiteViewModel = buildRichCardViewModel(fullWidthSite, articleRichLink);
  const fullWidthLinkViewModel = buildNonPaymentCardViewModel(site, fullWidthLink, "rich");

  // Assert
  assert.deepEqual(fullWidthSiteViewModel, inlineSiteViewModel);
  assert.deepEqual(fullWidthLinkViewModel, inlineSiteViewModel);
});
