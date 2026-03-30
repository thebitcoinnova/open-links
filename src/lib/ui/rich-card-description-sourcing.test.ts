import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { LinksData, OpenLink, RichLinkMetadata, SiteData } from "../content/load-content";
import {
  type GeneratedLinkReferralConfig,
  mergeReferralWithManualOverrides,
} from "../content/referral-fields";
import { mergeMetadataWithManualSocialProfileOverrides } from "../content/social-profile-fields";
import { buildRichCardViewModel, resolveLinkCardDescription } from "./rich-card-policy";

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
    },
  },
} as const satisfies SiteData;

const richLink = {
  id: "instagram",
  label: "Instagram",
  url: "https://www.instagram.com/peterryszkiewicz/",
  type: "rich",
  icon: "instagram",
  description: "Photos and stories",
  metadata: {
    description:
      "86 Followers, 172 Following, 36 Posts - See Instagram photos and videos from Peter Justice For The Victims Ryszkiewicz (@peterryszkiewicz)",
  },
} as const satisfies OpenLink;

const distinctPreviewProfileLink = {
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
    image: "/cache/content-images/substack-preview.jpg",
    profileImage: "/cache/content-images/substack-avatar.jpg",
  },
} as const satisfies OpenLink;

const readJson = <T>(relativePath: string): T =>
  JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8")) as T;

interface GeneratedRichMetadataPayload {
  links?: Record<string, { metadata?: RichLinkMetadata; referral?: GeneratedLinkReferralConfig }>;
}

const datasetSite = readJson<SiteData>("../../../data/site.json");
const datasetLinksData = readJson<LinksData>("../../../data/links.json");
const generatedRichMetadata = readJson<GeneratedRichMetadataPayload>(
  "../../../data/generated/rich-metadata.json",
);

const buildMergedDatasetLink = (linkId: string): OpenLink | undefined => {
  const sourceLink = datasetLinksData.links.find((entry) => entry.id === linkId);
  if (!sourceLink) {
    return undefined;
  }

  const generatedEntry = generatedRichMetadata.links?.[linkId];
  const metadata = mergeMetadataWithManualSocialProfileOverrides(
    sourceLink.metadata,
    generatedEntry?.metadata,
  );
  const referral = mergeReferralWithManualOverrides(sourceLink.referral, generatedEntry?.referral);

  return {
    ...sourceLink,
    ...(metadata ? { metadata } : {}),
    ...(referral ? { referral } : {}),
  };
};

test("defaults rich-link descriptions to fetched metadata over manual copy", () => {
  // Act
  const description = resolveLinkCardDescription(site, richLink);

  // Assert
  assert.equal(
    description,
    "86 Followers, 172 Following, 36 Posts - See Instagram photos and videos from Peter Justice For The Victims Ryszkiewicz (@peterryszkiewicz)",
  );
});

test("site policy can prefer manual descriptions over fetched metadata", () => {
  // Arrange
  const manualSite = {
    ...site,
    ui: {
      ...site.ui,
      richCards: {
        ...site.ui.richCards,
        descriptionSource: "manual",
      },
    },
  } as const satisfies SiteData;

  // Act
  const description = resolveLinkCardDescription(manualSite, richLink);

  // Assert
  assert.equal(description, "Photos and stories");
});

test("per-link description source overrides the site default", () => {
  // Arrange
  const manualSite = {
    ...site,
    ui: {
      ...site.ui,
      richCards: {
        ...site.ui.richCards,
        descriptionSource: "manual",
      },
    },
  } as const satisfies SiteData;
  const fetchedOverrideLink = {
    ...richLink,
    metadata: {
      ...richLink.metadata,
      descriptionSource: "fetched",
    },
  } as const satisfies OpenLink;
  const manualOverrideLink = {
    ...richLink,
    metadata: {
      ...richLink.metadata,
      descriptionSource: "manual",
    },
  } as const satisfies OpenLink;

  // Act
  const fetchedOverride = resolveLinkCardDescription(manualSite, fetchedOverrideLink);
  const manualOverride = resolveLinkCardDescription(site, manualOverrideLink);

  // Assert
  assert.equal(
    fetchedOverride,
    "86 Followers, 172 Following, 36 Posts - See Instagram photos and videos from Peter Justice For The Victims Ryszkiewicz (@peterryszkiewicz)",
  );
  assert.equal(manualOverride, "Photos and stories");
});

test("falls back from the preferred description source to the remaining available source", () => {
  // Arrange
  const manualSite = {
    ...site,
    ui: {
      ...site.ui,
      richCards: {
        ...site.ui.richCards,
        descriptionSource: "manual",
      },
    },
  } as const satisfies SiteData;
  const fetchedOnlyLink = {
    ...richLink,
    description: undefined,
  } as const satisfies OpenLink;
  const manualOnlyLink = {
    ...richLink,
    metadata: {
      descriptionSource: "fetched",
    },
  } as const satisfies OpenLink;
  const domainFallbackLink = {
    ...richLink,
    description: undefined,
    metadata: undefined,
  } as const satisfies OpenLink;

  // Act
  const fetchedOnly = resolveLinkCardDescription(manualSite, fetchedOnlyLink);
  const manualOnly = resolveLinkCardDescription(site, manualOnlyLink);
  const domainFallback = resolveLinkCardDescription(site, domainFallbackLink);

  // Assert
  assert.equal(
    fetchedOnly,
    "86 Followers, 172 Following, 36 Posts - See Instagram photos and videos from Peter Justice For The Victims Ryszkiewicz (@peterryszkiewicz)",
  );
  assert.equal(manualOnly, "Photos and stories");
  assert.equal(domainFallback, "instagram.com");
});

test("supported profile links prefer profile descriptions over generic description-source policy", () => {
  // Arrange
  const profileLink = {
    id: "x",
    label: "X",
    url: "https://x.com/pryszkie",
    type: "rich",
    icon: "x",
    description: "Manual link copy",
    metadata: {
      description: "Posts and updates from @pryszkie on X.",
      profileDescription:
        "We the people demand justice for the victims. Otherwise, our politicians no longer represent us. Therefore, no taxation without representation.",
      descriptionSource: "manual",
    },
  } as const satisfies OpenLink;

  // Act
  const description = resolveLinkCardDescription(site, profileLink);

  // Assert
  assert.equal(
    description,
    "We the people demand justice for the victims. Otherwise, our politicians no longer represent us. Therefore, no taxation without representation.",
  );
});

test("explicit non-profile semantics suppress profileDescription precedence on supported-family links", () => {
  // Arrange
  const nonProfileClubOrangeLink = {
    id: "cluborange-referral",
    label: "Join Club Orange",
    url: "https://app.cluborange.org/pryszkie",
    type: "rich",
    icon: "cluborange",
    description: "Manual signup copy",
    metadata: {
      description: "Fetched signup copy",
      profileDescription: "Profile copy that should not override the generic description",
      descriptionSource: "fetched",
    },
    enrichment: {
      profileSemantics: "non_profile",
    },
  } as const satisfies OpenLink;

  // Act
  const description = resolveLinkCardDescription(site, nonProfileClubOrangeLink);

  // Assert
  assert.equal(description, "Fetched signup copy");
});

test("referral offer summaries override the shared card description slot without changing base description resolution", () => {
  // Arrange
  const referralLink = {
    id: "cluborange-referral",
    label: "Join Club Orange",
    url: "https://app.cluborange.org/pryszkie",
    type: "rich",
    icon: "cluborange",
    description: "Manual signup copy",
    metadata: {
      title: "Join Club Orange",
      description: "Fetched signup copy",
      sourceLabel: "app.cluborange.org",
      image: "/cache/content-images/cluborange-referral-preview.jpg",
      profileImage: "/cache/content-images/cluborange-referral-avatar.jpg",
    },
    enrichment: {
      profileSemantics: "non_profile",
    },
    referral: {
      kind: "referral",
      offerSummary: "Get $40/year Club Orange access and connect with Bitcoin builders.",
    },
  } as const satisfies OpenLink;

  // Act
  const baseDescription = resolveLinkCardDescription(site, referralLink);
  const viewModelDescription = buildRichCardViewModel(site, referralLink).description;

  // Assert
  assert.equal(baseDescription, "Fetched signup copy");
  assert.equal(
    viewModelDescription,
    "Get $40/year Club Orange access and connect with Bitcoin builders.",
  );
});

test("live cluborange-referral data keeps manual referral fields while generated offer text still drives the card summary", () => {
  // Arrange
  const referralLink = buildMergedDatasetLink("cluborange-referral");

  // Act
  const viewModel = referralLink ? buildRichCardViewModel(datasetSite, referralLink) : undefined;

  // Assert
  assert.ok(referralLink);
  assert.equal(referralLink.referral?.ownerBenefit, "Supports the project");
  assert.equal(
    referralLink.referral?.termsUrl,
    "https://www.cluborange.org/signup?referral=pryszkie",
  );
  assert.equal(
    referralLink.referral?.offerSummary,
    "Join Club Orange — Connect with 19K+ Bitcoiners",
  );
  assert.equal(
    referralLink.referral?.termsSummary,
    "Get a Club Orange membership starting at $40/year or pay in sats.",
  );
  assert.ok(viewModel);
  assert.equal(viewModel.description, "Join Club Orange — Connect with 19K+ Bitcoiners");
  assert.deepEqual(viewModel.referral?.benefitRows, [
    {
      kind: "owner",
      label: "Supports",
      value: "Supports the project",
    },
  ]);
  assert.equal(
    viewModel.referral?.terms?.inlineSummary,
    "Get a Club Orange membership starting at $40/year or pay in sats.",
  );
  assert.equal(
    viewModel.referral?.terms?.url,
    "https://www.cluborange.org/signup?referral=pryszkie",
  );
});

test("supported profile links without profileDescription still obey description-source fallback rules", () => {
  // Arrange
  const mediumProfileLink = {
    id: "medium",
    label: "Medium",
    url: "https://medium.com/@peterryszkiewicz",
    type: "rich",
    icon: "medium",
    description: "Manual medium copy",
    metadata: {
      description: "Fetched medium copy",
      descriptionSource: "manual",
    },
  } as const satisfies OpenLink;
  const fetchedOverrideLink = {
    ...mediumProfileLink,
    metadata: {
      ...mediumProfileLink.metadata,
      descriptionSource: "fetched",
    },
  } as const satisfies OpenLink;

  // Act
  const manualDescription = resolveLinkCardDescription(site, mediumProfileLink);
  const fetchedDescription = resolveLinkCardDescription(site, fetchedOverrideLink);

  // Assert
  assert.equal(manualDescription, "Manual medium copy");
  assert.equal(fetchedDescription, "Fetched medium copy");
});

test("non-profile links ignore profileDescription and keep existing description rules", () => {
  // Arrange
  const nonProfileLink = {
    id: "article",
    label: "Article",
    url: "https://example.com/article",
    type: "rich",
    icon: "notion",
    description: "Manual article copy",
    metadata: {
      description: "Fetched article copy",
      profileDescription: "Should not be used for a non-profile link",
      descriptionSource: "fetched",
    },
  } as const satisfies OpenLink;

  // Act
  const description = resolveLinkCardDescription(site, nonProfileLink);

  // Assert
  assert.equal(description, "Fetched article copy");
});

test("dataset audit defaults current rich links to fetched descriptions across card paths", () => {
  // Arrange
  const linksData = datasetLinksData;
  const publicCache = readJson<{
    entries?: Record<string, { linkId?: string; metadata?: RichLinkMetadata }>;
  }>("../../../data/cache/rich-public-cache.json");
  const authenticatedCache = readJson<{
    entries?: Record<string, { linkId?: string; metadata?: RichLinkMetadata }>;
  }>("../../../data/cache/rich-authenticated-cache.json");
  const publicMetadataByLinkId = new Map<string, RichLinkMetadata>();
  const authenticatedMetadataByLinkId = new Map<string, RichLinkMetadata>();

  for (const entry of Object.values(publicCache.entries ?? {})) {
    if (entry.linkId && entry.metadata) {
      publicMetadataByLinkId.set(entry.linkId, entry.metadata);
    }
  }

  for (const entry of Object.values(authenticatedCache.entries ?? {})) {
    if (entry.linkId && entry.metadata) {
      authenticatedMetadataByLinkId.set(entry.linkId, entry.metadata);
    }
  }

  const richLinks = linksData.links
    .filter((link) => link.enabled !== false && link.type === "rich")
    .map((link) => {
      const generatedMetadata =
        authenticatedMetadataByLinkId.get(link.id) ?? publicMetadataByLinkId.get(link.id);
      const mergedMetadata = mergeMetadataWithManualSocialProfileOverrides(
        link.metadata,
        generatedMetadata,
      );
      return mergedMetadata ? { ...link, metadata: mergedMetadata } : link;
    })
    .filter((link): link is OpenLink & { metadata: RichLinkMetadata } => Boolean(link.metadata));

  // Assert
  assert.deepEqual(
    richLinks.map((link) => link.id),
    [
      "primal",
      "github",
      "x",
      "linkedin",
      "bright-builds-facebook",
      "facebook",
      "cluborange",
      "cluborange-referral",
      "instagram",
      "youtube",
      "rumble",
      "medium",
      "substack",
    ],
  );

  for (const link of richLinks) {
    assert.ok(link.metadata, `expected metadata for ${link.id}`);
    const sharedDescription = resolveLinkCardDescription(datasetSite, link);
    const richDescription = buildRichCardViewModel(datasetSite, link).description;

    assert.ok(sharedDescription.length > 0, `expected rich description for ${link.id}`);
    assert.equal(richDescription, sharedDescription);
  }
});

test("description image rows default to auto for rich profile cards with distinct preview media", () => {
  // Act
  const richViewModel = buildRichCardViewModel(site, distinctPreviewProfileLink);

  // Assert
  assert.equal(richViewModel.leadKind, "avatar");
  assert.equal(richViewModel.leadImageUrl, "/cache/content-images/substack-avatar.jpg");
  assert.equal(richViewModel.profilePreview.enabled, true);
  assert.equal(richViewModel.profilePreview.imageUrl, "/cache/content-images/substack-preview.jpg");
  assert.equal(richViewModel.profilePreview.placement, "top-banner");
  assert.equal(richViewModel.profilePreview.bannerMinAspectRatio, 2);
  assert.equal(richViewModel.profilePreview.nonBannerFallback, "off");
});

test("site policy can disable description image rows globally", () => {
  // Arrange
  const imageRowOffSite = {
    ...site,
    ui: {
      ...site.ui,
      richCards: {
        ...site.ui.richCards,
        descriptionImageRow: {
          default: "off",
        },
      },
    },
  } as const satisfies SiteData;

  // Act
  const richViewModel = buildRichCardViewModel(imageRowOffSite, distinctPreviewProfileLink);

  // Assert
  assert.equal(richViewModel.leadKind, "avatar");
  assert.equal(richViewModel.profilePreview.enabled, false);
  assert.equal(richViewModel.profilePreview.imageUrl, undefined);
});

test("host-level description image row overrides win without changing the global default", () => {
  // Arrange
  const hostOverrideSite = {
    ...site,
    ui: {
      ...site.ui,
      richCards: {
        ...site.ui.richCards,
        descriptionImageRow: {
          default: "auto",
          sites: {
            "peter.ryszkiewicz.us": "off",
          },
        },
      },
    },
  } as const satisfies SiteData;
  const githubDistinctPreviewLink = {
    id: "github",
    label: "GitHub",
    url: "https://github.com/pRizz",
    type: "rich",
    icon: "github",
    description: "Code, experiments, and open-source projects",
    metadata: {
      title: "pRizz - Overview",
      description: "An agentic engineer and builder.",
      sourceLabel: "github.com",
      handle: "prizz",
      image: "/cache/content-images/github-preview.jpg",
      profileImage: "/cache/content-images/github-avatar.jpg",
    },
  } as const satisfies OpenLink;

  // Act
  const hostOverrideViewModel = buildRichCardViewModel(
    hostOverrideSite,
    distinctPreviewProfileLink,
  );
  const unaffectedViewModel = buildRichCardViewModel(hostOverrideSite, githubDistinctPreviewLink);

  // Assert
  assert.equal(hostOverrideViewModel.profilePreview.enabled, false);
  assert.equal(unaffectedViewModel.profilePreview.enabled, true);
  assert.equal(
    unaffectedViewModel.profilePreview.imageUrl,
    "/cache/content-images/github-preview.jpg",
  );
});
