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

test("legacy bottom-row placement remains available as an explicit opt-out", () => {
  // Arrange
  const legacyPlacementSite = {
    ...site,
    ui: {
      richCards: {
        ...site.ui.richCards,
        descriptionImageRow: {
          placement: {
            default: "bottom-row",
          },
        },
      },
    },
  } as const satisfies SiteData;

  // Act
  const viewModel = buildRichCardViewModel(legacyPlacementSite, substackRichLink);

  // Assert
  assert.equal(viewModel.profilePreview.enabled, true);
  assert.equal(viewModel.profilePreview.placement, "bottom-row");
  assert.equal(viewModel.profilePreview.nonBannerFallback, "off");
});

test("profile preview policy can opt into compact-end fallback for non-banner media", () => {
  // Arrange
  const compactFallbackSite = {
    ...site,
    ui: {
      richCards: {
        ...site.ui.richCards,
        descriptionImageRow: {
          bannerMinAspectRatio: 2.4,
          nonBannerFallback: {
            default: "compact-end",
          },
        },
      },
    },
  } as const satisfies SiteData;

  // Act
  const viewModel = buildRichCardViewModel(compactFallbackSite, substackRichLink);

  // Assert
  assert.equal(viewModel.profilePreview.enabled, true);
  assert.equal(viewModel.profilePreview.placement, "top-banner");
  assert.equal(viewModel.profilePreview.bannerMinAspectRatio, 2.4);
  assert.equal(viewModel.profilePreview.nonBannerFallback, "compact-end");
});

test("profile preview render classification uses the configured banner cutoff", () => {
  // Assert
  assert.equal(
    resolveProfilePreviewRenderKind({
      enabled: true,
      placement: "top-banner",
      maybeMeasuredAspectRatio: 2.1,
      bannerMinAspectRatio: 2,
      nonBannerFallback: "off",
    }),
    "top-banner",
  );
  assert.equal(
    resolveProfilePreviewRenderKind({
      enabled: true,
      placement: "top-banner",
      maybeMeasuredAspectRatio: 1,
      bannerMinAspectRatio: 2,
      nonBannerFallback: "off",
    }),
    "hidden",
  );
  assert.equal(
    resolveProfilePreviewRenderKind({
      enabled: true,
      placement: "top-banner",
      maybeMeasuredAspectRatio: 1,
      bannerMinAspectRatio: 2,
      nonBannerFallback: "compact-end",
    }),
    "compact-end",
  );
  assert.equal(
    resolveProfilePreviewRenderKind({
      enabled: true,
      placement: "bottom-row",
      maybeMeasuredAspectRatio: 0.8,
      bannerMinAspectRatio: 2,
      nonBannerFallback: "off",
    }),
    "bottom-row",
  );
});

test("non-profile rich cards keep preview leads with compact header and footer source rows", () => {
  // Arrange
  const viewModel = buildRichCardViewModel(site, articleRichLink);

  // Assert
  assert.equal(viewModel.leadKind, "preview");
  assert.equal(viewModel.leadImageUrl, "/cache/content-images/article-preview.jpg");
  assert.equal(viewModel.title, "Engineering Notes");
  assert.equal(viewModel.description, "Shipping notes and technical writeups");
  assert.deepEqual(viewModel.headerMetaItems, [{ kind: "source", text: "notes.openlinks.dev" }]);
  assert.equal(viewModel.footerSourceLabel, "Notion · notes.openlinks.dev");
  assert.equal(viewModel.showFooterIcon, true);
  assert.equal(viewModel.profilePreview.enabled, false);
  assert.equal(viewModel.profilePreview.imageUrl, undefined);
  assert.deepEqual(viewModel.socialProfile.metrics, []);
});

test("referral-rich cards stay in the shared non-profile layout while adding referral presentation state", () => {
  // Arrange
  const viewModel = buildRichCardViewModel(site, clubOrangeReferralRichLink);

  // Assert
  assert.equal(viewModel.leadKind, "preview");
  assert.equal(viewModel.leadImageUrl, "/cache/content-images/cluborange-referral-preview.jpg");
  assert.equal(viewModel.title, "Join Club Orange");
  assert.equal(viewModel.description, "Get Club Orange access and connect with Bitcoin builders.");
  assert.deepEqual(viewModel.headerMetaItems, [{ kind: "source", text: "app.cluborange.org" }]);
  assert.equal(viewModel.footerSourceLabel, "app.cluborange.org");
  assert.equal(viewModel.showFooterIcon, true);
  assert.equal(viewModel.socialProfile.usesProfileLayout, false);
  assert.equal(viewModel.referral?.disclosureLabel, "Referral");
  assert.deepEqual(viewModel.referral?.benefitRows, [
    {
      kind: "visitor",
      label: "You get",
      value: "Join Club Orange starting at $40/year",
    },
    {
      kind: "owner",
      label: "Supports",
      value: "Supports the project",
    },
  ]);
  assert.deepEqual(viewModel.referral?.terms, {
    inlineSummary: "Pricing varies by plan. Terms apply.",
    isTruncated: false,
    linkLabel: "Terms",
    url: "https://www.cluborange.org/signup?referral=pryszkie",
  });
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
  assert.equal(viewModel.profilePreview.enabled, false);
});

test("simple profile cards reuse avatar leads and footer source rows in the shared layout", () => {
  // Arrange
  const viewModel = buildSimpleCardViewModel(site, instagramSimpleLink);

  // Assert
  assert.equal(viewModel.leadKind, "avatar");
  assert.equal(viewModel.leadImageUrl, "/cache/content-images/avatar.jpg");
  assert.equal(viewModel.title, "Peter Justice For The Victims Ryszkiewicz");
  assert.deepEqual(
    viewModel.headerMetaItems.map((item) => `${item.kind}:${item.text}`),
    ["handle:@peterryszkiewicz", "metric:86 Followers", "metric:169 Following"],
  );
  assert.equal(viewModel.footerSourceLabel, "instagram.com");
  assert.equal(viewModel.showFooterIcon, true);
  assert.equal(viewModel.profilePreview.enabled, false);
});

test("simple profile cards do not render description-image rows even when preview media is distinct", () => {
  // Arrange
  const viewModel = buildSimpleCardViewModel(site, substackSimpleLink);

  // Assert
  assert.equal(viewModel.leadKind, "avatar");
  assert.equal(viewModel.leadImageUrl, "/cache/content-images/substack-avatar.jpg");
  assert.equal(viewModel.profilePreview.enabled, false);
  assert.equal(viewModel.profilePreview.imageUrl, undefined);
  assert.equal(viewModel.footerSourceLabel, "Substack · peter.ryszkiewicz.us");
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

test("simple email cards derive the visible address without emitting empty source chrome", () => {
  // Arrange
  const sourcePresentation = resolveLinkSourcePresentation(site, emailSimpleLink);
  const viewModel = buildSimpleCardViewModel(site, emailSimpleLink);

  // Assert
  assert.equal(sourcePresentation.sourceLabel, undefined);
  assert.equal(sourcePresentation.showSourceLabel, true);
  assert.equal(viewModel.linkKind, "contact");
  assert.equal(viewModel.linkScheme, "mailto");
  assert.equal(viewModel.contactKind, "email");
  assert.equal(viewModel.contactValue, "Hello.Team@example.com");
  assert.equal(viewModel.title, "Email");
  assert.equal(viewModel.description, "Hello.Team@example.com");
  assert.deepEqual(viewModel.headerMetaItems, []);
  assert.equal(viewModel.sourceLabel, undefined);
  assert.equal(viewModel.footerSourceLabel, undefined);
  assert.equal(viewModel.showFooterIcon, false);
});

test("simple email cards keep custom labels while deriving the address as fallback copy", () => {
  // Arrange
  const viewModel = buildSimpleCardViewModel(site, customEmailSimpleLink);

  // Assert
  assert.equal(viewModel.title, "Business Email");
  assert.equal(viewModel.description, "hello@example.com");
  assert.equal(viewModel.contactValue, "hello@example.com");
});

test("simple email cards prefer explicit descriptions over derived address fallbacks", () => {
  // Arrange
  const viewModel = buildSimpleCardViewModel(site, describedEmailSimpleLink);

  // Assert
  assert.equal(viewModel.title, "Press Email");
  assert.equal(viewModel.description, "For media requests and interview coordination");
  assert.equal(viewModel.contactValue, "press@example.com");
  assert.equal(viewModel.footerSourceLabel, undefined);
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
  assert.equal(coverViewModel.profilePreview.enabled, false);
  assert.equal(thumbnailViewModel.imageTreatment, "thumbnail");
  assert.equal(thumbnailViewModel.leadKind, "preview");
  assert.equal(thumbnailViewModel.profilePreview.enabled, false);
  assert.equal(offViewModel.imageTreatment, "off");
  assert.equal(offViewModel.leadKind, "icon");
  assert.equal(offViewModel.showFooterIcon, false);
  assert.equal(offViewModel.profilePreview.enabled, false);
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
