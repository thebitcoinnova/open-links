import assert from "node:assert/strict";
import test from "node:test";
import type { OpenLink, SiteData } from "../../lib/content/load-content";
import {
  buildNonPaymentCardViewModel,
  buildRichCardViewModel,
  buildSimpleCardViewModel,
  resolveLinkCardDescription,
  resolveLinkSourcePresentation,
  resolveProfilePreviewRenderKind,
} from "../../lib/ui/rich-card-policy";
import { resolveSocialProfileMetadata } from "../../lib/ui/social-profile-metadata";

import {
  articleRichLink,
  blogRichLink,
  clubOrangeReferralRichLink,
  customEmailSimpleLink,
  describedEmailSimpleLink,
  emailSimpleLink,
  githubRichLink,
  instagramProfileLink,
  instagramSimpleLink,
  linkedinRichLink,
  mediumRichLink,
  primalRichLink,
  rumbleImageOnlyRichLink,
  site,
  substackRichLink,
  substackSimpleLink,
  workSimpleLink,
  xCommunityRichLink,
  xRichLink,
} from "./social-profile-card-rendering.test-fixtures";

test("rich profile cards resolve avatar leads, header metrics, and footer source context", () => {
  // Arrange
  const viewModel = buildRichCardViewModel(site, instagramProfileLink);

  // Assert
  assert.equal(viewModel.leadKind, "avatar");
  assert.equal(viewModel.leadImageUrl, "/cache/content-images/avatar.jpg");
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
  assert.equal(viewModel.profilePreview.enabled, false);
  assert.equal(viewModel.profilePreview.imageUrl, undefined);
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
  assert.equal(socialProfile.profileImageUrl, "/cache/content-images/avatar.jpg");
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
  assert.equal(viewModel.leadImageUrl, "/cache/content-images/github-avatar.jpg");
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
  assert.equal(viewModel.profilePreview.enabled, false);
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
  assert.equal(viewModel.leadImageUrl, "/cache/content-images/x-avatar.jpg");
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
  assert.equal(viewModel.profilePreview.enabled, false);
  assert.deepEqual(
    viewModel.socialProfile.metrics.map((metric) => metric.displayText),
    ["1.4K Followers", "648 Following"],
  );
});

test("x community rich cards show member counts without a synthetic handle row", () => {
  // Arrange
  const viewModel = buildRichCardViewModel(site, xCommunityRichLink);

  // Assert
  assert.equal(viewModel.leadKind, "preview");
  assert.equal(
    viewModel.leadImageUrl,
    "https://pbs.twimg.com/community_banner_img/1997471355478892544/GydvYqIp?format=jpg&name=orig",
  );
  assert.equal(viewModel.title, "PARANOID BITCOIN ANARCHISTS");
  assert.equal(
    viewModel.description,
    "Hold your keys | Run a Node Paranoid: Question everything Bitcoin: Don’t trust, verify. Anarchists: We build, laugh, and ignore conspiring fiat clowns",
  );
  assert.deepEqual(
    viewModel.headerMetaItems.map((item) => `${item.kind}:${item.text}`),
    ["metric:785 Members"],
  );
  assert.equal(viewModel.footerSourceLabel, "x.com");
  assert.equal(viewModel.profilePreview.enabled, false);
  assert.deepEqual(
    viewModel.socialProfile.metrics.map((metric) => metric.displayText),
    ["785 Members"],
  );
  assert.equal(viewModel.socialProfile.handleDisplay, undefined);
});

test("primal rich cards surface public audience metrics in the shared profile header row", () => {
  // Arrange
  const viewModel = buildRichCardViewModel(site, primalRichLink);

  // Assert
  assert.equal(viewModel.leadKind, "avatar");
  assert.equal(viewModel.leadImageUrl, "/cache/content-images/primal-avatar.jpg");
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
  assert.equal(viewModel.profilePreview.enabled, false);
  assert.deepEqual(
    viewModel.socialProfile.metrics.map((metric) => metric.displayText),
    ["15 followers", "90 following"],
  );
});

test("rumble rich cards backfill image-only metadata into avatar leads instead of empty placeholders", () => {
  // Arrange
  const viewModel = buildRichCardViewModel(site, rumbleImageOnlyRichLink);

  // Assert
  assert.equal(viewModel.leadKind, "avatar");
  assert.equal(viewModel.leadImageUrl, "/cache/content-images/rumble-avatar.jpg");
  assert.equal(viewModel.title, "In The Litter Box w/ Jewels & Catturd");
  assert.deepEqual(
    viewModel.headerMetaItems.map((item) => `${item.kind}:${item.text}`),
    ["handle:@inthelitterbox", "metric:112K Followers"],
  );
  assert.equal(viewModel.profilePreview.enabled, false);
  assert.equal(viewModel.profilePreview.imageUrl, undefined);
  assert.equal(viewModel.socialProfile.profileImageUrl, "/cache/content-images/rumble-avatar.jpg");
  assert.equal(viewModel.socialProfile.previewImageUrl, "/cache/content-images/rumble-avatar.jpg");
  assert.equal(viewModel.socialProfile.hasDistinctPreviewImage, false);
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
  assert.equal(viewModel.profilePreview.enabled, false);
  assert.deepEqual(viewModel.socialProfile.metrics, []);
});

test("medium rich cards treat the feed avatar as the profile lead and clean the author title", () => {
  // Arrange
  const viewModel = buildRichCardViewModel(site, mediumRichLink);

  // Assert
  assert.equal(viewModel.leadKind, "avatar");
  assert.equal(viewModel.leadImageUrl, "/cache/content-images/medium-avatar.jpg");
  assert.equal(viewModel.title, "Peter Ryszkiewicz");
  assert.equal(viewModel.description, "Stories by Peter Ryszkiewicz on Medium");
  assert.deepEqual(viewModel.headerMetaItems, [
    { kind: "handle", text: "@peterryszkiewicz" },
    { kind: "metric", text: "3.3K followers" },
  ]);
  assert.equal(viewModel.footerSourceLabel, "medium.com");
  assert.equal(viewModel.profilePreview.enabled, false);
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
  assert.equal(viewModel.leadImageUrl, "/cache/content-images/substack-avatar.jpg");
  assert.equal(viewModel.profilePreview.enabled, true);
  assert.equal(viewModel.profilePreview.imageUrl, "/cache/content-images/substack-preview.jpg");
  assert.equal(viewModel.profilePreview.placement, "top-banner");
  assert.equal(viewModel.profilePreview.bannerMinAspectRatio, 2);
  assert.equal(viewModel.profilePreview.nonBannerFallback, "off");
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
  assert.equal(viewModel.leadImageUrl, "/cache/content-images/substack-avatar.jpg");
  assert.equal(viewModel.profilePreview.enabled, false);
  assert.equal(viewModel.profilePreview.imageUrl, undefined);
});

test("image treatment off keeps avatar leads for rich profile cards while suppressing preview media", () => {
  // Arrange
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
  const viewModel = buildRichCardViewModel(offSite, substackRichLink);

  // Assert
  assert.equal(viewModel.imageTreatment, "off");
  assert.equal(viewModel.leadKind, "avatar");
  assert.equal(viewModel.leadImageUrl, "/cache/content-images/substack-avatar.jpg");
  assert.equal(viewModel.profilePreview.enabled, false);
  assert.equal(viewModel.profilePreview.imageUrl, undefined);
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
      image: "/cache/content-images/github-preview.jpg",
      profileImage: "/cache/content-images/github-avatar.jpg",
    },
  } as const satisfies OpenLink;

  // Act
  const substackViewModel = buildRichCardViewModel(siteOverrideConfig, substackRichLink);
  const githubViewModel = buildRichCardViewModel(siteOverrideConfig, githubDistinctPreviewLink);

  // Assert
  assert.equal(substackViewModel.profilePreview.enabled, false);
  assert.equal(githubViewModel.leadKind, "avatar");
  assert.equal(githubViewModel.profilePreview.enabled, true);
  assert.equal(githubViewModel.profilePreview.imageUrl, "/cache/content-images/github-preview.jpg");
});
