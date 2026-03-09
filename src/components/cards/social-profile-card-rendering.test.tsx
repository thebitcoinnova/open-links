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

const xRichLink = {
  id: "x",
  label: "X",
  url: "https://x.com/pryszkie",
  type: "rich",
  icon: "x",
  description: "Short updates and project notes",
  metadata: {
    title: "@pryszkie on X",
    description: "Posts and updates from @pryszkie on X.",
    profileDescription:
      "We the people demand justice for the victims. Otherwise, our politicians no longer represent us. Therefore, no taxation without representation.",
    sourceLabel: "x.com",
    handle: "pryszkie",
    image: "/generated/images/x-avatar.jpg",
    profileImage: "/generated/images/x-avatar.jpg",
    followersCount: 1350,
    followersCountRaw: "1,350 Followers",
    followingCount: 648,
    followingCountRaw: "648 Following",
  },
} as const satisfies OpenLink;

const primalRichLink = {
  id: "primal",
  label: "Primal",
  url: "https://primal.net/peterryszkiewicz",
  type: "rich",
  icon: "primal",
  description: "Nostr profile and notes",
  metadata: {
    title: "Peter No Taxation Without Representation Ryszkiewicz",
    description: "Agentic engineer, making things in the AI space, Bitcoin space, and many others.",
    sourceLabel: "primal.net",
    handle: "peterryszkiewicz",
    image: "/generated/images/primal-avatar.jpg",
    profileImage: "/generated/images/primal-avatar.jpg",
    followersCount: 15,
    followersCountRaw: "15 followers",
    followingCount: 90,
    followingCountRaw: "90 following",
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
    description:
      "Talented software engineer, excited to work on new and challenging problems. · Experience: Venmo · Education: Illinois Institute of Technology · Location: Chicago · 190 connections on LinkedIn. View Peter Ryszkiewicz’s profile on LinkedIn, a professional community of 1 billion members.",
    profileDescription:
      "Talented software engineer, excited to work on new and challenging problems.",
    sourceLabel: "linkedin.com",
    image: "/cache/rich-authenticated/linkedin-avatar.jpg",
  },
} as const satisfies OpenLink;

const mediumRichLink = {
  id: "medium",
  label: "Medium",
  url: "https://medium.com/@peterryszkiewicz",
  type: "rich",
  icon: "medium",
  description: "Articles and blog posts",
  metadata: {
    title: "Stories by Peter Ryszkiewicz on Medium",
    description: "Stories by Peter Ryszkiewicz on Medium",
    sourceLabel: "medium.com",
    handle: "peterryszkiewicz",
    image: "/generated/images/medium-avatar.jpg",
    profileImage: "/generated/images/medium-avatar.jpg",
    followersCount: 3300,
    followersCountRaw: "3.3K followers",
  },
} as const satisfies OpenLink;

const substackRichLink = {
  id: "substack",
  label: "Substack",
  url: "https://peter.ryszkiewicz.us/",
  type: "rich",
  icon: "substack",
  description: "Newsletter and long-form writing",
  metadata: {
    title: "Peter Ryszkiewicz | Substack",
    description: "Software Engineer",
    sourceLabel: "peter.ryszkiewicz.us",
    handle: "peterryszkiewicz",
    image: "/generated/images/substack-preview.jpg",
    profileImage: "/generated/images/substack-avatar.jpg",
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
  assert.equal(viewModel.showDescriptionImageRow, false);
  assert.equal(viewModel.descriptionImageUrl, undefined);
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
  assert.equal(viewModel.showDescriptionImageRow, false);
  assert.deepEqual(
    viewModel.socialProfile.metrics.map((metric) => metric.displayText),
    ["90 followers", "87 following"],
  );
});

test("x rich cards surface best-effort public audience metrics without changing layout chrome", () => {
  // Arrange
  const viewModel = buildRichCardViewModel(site, xRichLink);

  // Assert
  assert.equal(viewModel.leadKind, "avatar");
  assert.equal(viewModel.leadImageUrl, "/generated/images/x-avatar.jpg");
  assert.equal(viewModel.title, "@pryszkie on X");
  assert.equal(
    viewModel.description,
    "We the people demand justice for the victims. Otherwise, our politicians no longer represent us. Therefore, no taxation without representation.",
  );
  assert.deepEqual(
    viewModel.headerMetaItems.map((item) => `${item.kind}:${item.text}`),
    ["handle:@pryszkie", "metric:1.4K Followers", "metric:648 Following"],
  );
  assert.equal(viewModel.footerSourceLabel, "x.com");
  assert.equal(viewModel.showDescriptionImageRow, false);
  assert.deepEqual(
    viewModel.socialProfile.metrics.map((metric) => metric.displayText),
    ["1.4K Followers", "648 Following"],
  );
});

test("primal rich cards surface public audience metrics in the shared profile header row", () => {
  // Arrange
  const viewModel = buildRichCardViewModel(site, primalRichLink);

  // Assert
  assert.equal(viewModel.leadKind, "avatar");
  assert.equal(viewModel.leadImageUrl, "/generated/images/primal-avatar.jpg");
  assert.equal(viewModel.title, "Peter No Taxation Without Representation Ryszkiewicz");
  assert.equal(
    viewModel.description,
    "Agentic engineer, making things in the AI space, Bitcoin space, and many others.",
  );
  assert.deepEqual(
    viewModel.headerMetaItems.map((item) => `${item.kind}:${item.text}`),
    ["handle:@peterryszkiewicz", "metric:15 followers", "metric:90 following"],
  );
  assert.equal(viewModel.footerSourceLabel, "primal.net");
  assert.equal(viewModel.showDescriptionImageRow, false);
  assert.deepEqual(
    viewModel.socialProfile.metrics.map((metric) => metric.displayText),
    ["15 followers", "90 following"],
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
  assert.equal(viewModel.showDescriptionImageRow, false);
  assert.deepEqual(viewModel.socialProfile.metrics, []);
});

test("medium rich cards treat the feed avatar as the profile lead and clean the author title", () => {
  // Arrange
  const viewModel = buildRichCardViewModel(site, mediumRichLink);

  // Assert
  assert.equal(viewModel.leadKind, "avatar");
  assert.equal(viewModel.leadImageUrl, "/generated/images/medium-avatar.jpg");
  assert.equal(viewModel.title, "Peter Ryszkiewicz");
  assert.equal(viewModel.description, "Stories by Peter Ryszkiewicz on Medium");
  assert.deepEqual(viewModel.headerMetaItems, [
    { kind: "handle", text: "@peterryszkiewicz" },
    { kind: "metric", text: "3.3K followers" },
  ]);
  assert.equal(viewModel.footerSourceLabel, "medium.com");
  assert.equal(viewModel.showDescriptionImageRow, false);
  assert.deepEqual(
    viewModel.socialProfile.metrics.map((metric) => metric.displayText),
    ["3.3K followers"],
  );
});

test("substack custom-domain rich cards use the explicit handle and avatar-first profile layout", () => {
  // Arrange
  const viewModel = buildRichCardViewModel(site, substackRichLink);

  // Assert
  assert.equal(viewModel.leadKind, "avatar");
  assert.equal(viewModel.leadImageUrl, "/generated/images/substack-avatar.jpg");
  assert.equal(viewModel.showDescriptionImageRow, true);
  assert.equal(viewModel.descriptionImageUrl, "/generated/images/substack-preview.jpg");
  assert.equal(viewModel.title, "Peter Ryszkiewicz");
  assert.equal(viewModel.description, "Software Engineer");
  assert.deepEqual(viewModel.headerMetaItems, [{ kind: "handle", text: "@peterryszkiewicz" }]);
  assert.equal(viewModel.footerSourceLabel, "Substack · peter.ryszkiewicz.us");
  assert.deepEqual(viewModel.socialProfile.metrics, []);
});

test("description-image-row policy can suppress the extra media row without reverting rich profile cards to preview leads", () => {
  // Arrange
  const imageRowOffSite = {
    ...site,
    ui: {
      richCards: {
        ...site.ui.richCards,
        descriptionImageRow: {
          default: "off",
        },
      },
    },
  } as const satisfies SiteData;

  // Act
  const viewModel = buildRichCardViewModel(imageRowOffSite, substackRichLink);

  // Assert
  assert.equal(viewModel.leadKind, "avatar");
  assert.equal(viewModel.leadImageUrl, "/generated/images/substack-avatar.jpg");
  assert.equal(viewModel.showDescriptionImageRow, false);
  assert.equal(viewModel.descriptionImageUrl, undefined);
});

test("site-specific description-image-row overrides only affect the targeted rich profile sites", () => {
  // Arrange
  const siteOverrideConfig = {
    ...site,
    ui: {
      richCards: {
        ...site.ui.richCards,
        descriptionImageRow: {
          default: "auto",
          sites: {
            substack: "off",
          },
        },
      },
    },
  } as const satisfies SiteData;
  const githubDistinctPreviewLink = {
    ...githubRichLink,
    id: "github-preview",
    metadata: {
      ...githubRichLink.metadata,
      image: "/generated/images/github-preview.jpg",
      profileImage: "/generated/images/github-avatar.jpg",
    },
  } as const satisfies OpenLink;

  // Act
  const substackViewModel = buildRichCardViewModel(siteOverrideConfig, substackRichLink);
  const githubViewModel = buildRichCardViewModel(siteOverrideConfig, githubDistinctPreviewLink);

  // Assert
  assert.equal(substackViewModel.showDescriptionImageRow, false);
  assert.equal(githubViewModel.leadKind, "avatar");
  assert.equal(githubViewModel.showDescriptionImageRow, true);
  assert.equal(githubViewModel.descriptionImageUrl, "/generated/images/github-preview.jpg");
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
  assert.equal(viewModel.footerSourceLabel, "Notion · notes.openlinks.dev");
  assert.equal(viewModel.showFooterIcon, true);
  assert.equal(viewModel.showDescriptionImageRow, false);
  assert.equal(viewModel.descriptionImageUrl, undefined);
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
  assert.equal(viewModel.footerSourceLabel, "Notion · notes.openlinks.dev");
  assert.equal(viewModel.showFooterIcon, false);
  assert.equal(viewModel.showDescriptionImageRow, false);
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
  assert.equal(viewModel.showDescriptionImageRow, false);
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
  assert.equal(coverViewModel.showDescriptionImageRow, false);
  assert.equal(thumbnailViewModel.imageTreatment, "thumbnail");
  assert.equal(thumbnailViewModel.leadKind, "preview");
  assert.equal(thumbnailViewModel.showDescriptionImageRow, false);
  assert.equal(offViewModel.imageTreatment, "off");
  assert.equal(offViewModel.leadKind, "icon");
  assert.equal(offViewModel.showFooterIcon, false);
  assert.equal(offViewModel.showDescriptionImageRow, false);
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
