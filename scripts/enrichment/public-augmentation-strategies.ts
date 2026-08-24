import {
  type GeneratedLinkReferralConfig,
  type LinkReferralConfig,
  REFERRAL_PROVENANCE_FIELDS,
  type ReferralFieldName,
  mergeReferralWithManualOverrides,
  normalizeReferralConfig,
  resolveReferralCompleteness,
} from "../../src/lib/content/referral-fields";
import { resolveSupportedSocialProfile } from "../../src/lib/content/social-profile-fields";
import {
  isXCommunityUrl,
  normalizeHandle,
  resolveHandleFromUrl,
} from "../../src/lib/identity/handle-resolver";
import {
  decodeEntities,
  detectPlaceholderSignals,
  extractJsonLdBlocks,
  hasSchemaType,
  isRecord,
  parseJson,
  resolveCompleteness,
  safeTrim,
  toAbsoluteUrl,
  toSourceLabel,
} from "./document-primitives";
import { parseMetadata } from "./parse-metadata";
import {
  INSTAGRAM_DESCRIPTION_PATTERN,
  InstagramProfileMetadata,
  PUBLIC_BROWSER_USER_AGENT,
  PublicAugmentationOutcome,
  type PublicAugmentationStrategy,
  type PublicAugmentationStrategyId,
  type PublicAugmentationTarget,
  REFERRAL_HEADLINE_HINT_PATTERN,
  REFERRAL_OWNER_BENEFIT_PATTERN,
  REFERRAL_TERMS_PATTERN,
  REFERRAL_VISITOR_BENEFIT_PATTERN,
  type ResolvePublicAugmentationTargetInput,
  ResolvePublicReferralAugmentationInput,
  SUBSTACK_PRELOADS_PATTERN,
  SubstackJsonLdPerson,
  SubstackProfileMetadata,
  SubstackPublicationMetadata,
  SubstackPublishedByline,
  X_COMMUNITY_METADATA_USER_AGENT,
  YOUTUBE_ABOUT_CHANNEL_MARKER,
  YOUTUBE_METADATA_ROWS_MARKER,
  YOUTUBE_SUBSCRIBER_SEGMENT_LENGTH,
  YOUTUBE_THUMBNAIL_URL_PATTERN,
  YoutubeProfileMetadata,
  buildGenericXDescription,
  buildSubstackCanonicalProfileUrl,
  buildXOEmbedUrl,
  detectInstagramPlaceholderSignals,
  detectMediumPlaceholderSignals,
  detectXPlaceholderSignals,
  detectYoutubePlaceholderSignals,
  extractSubstackJsonLdPerson,
  extractSubstackPreloads,
  extractSubstackPublishedByline,
  extractXDisplayHandle,
  findJsonLdPerson,
  firstMatch,
  formatSubstackSubscriberCountRaw,
  isLikelySubstackProfileUrl,
  isSubstackGenericPreviewImage,
  parseSubstackSubscriberCountValue,
  resolveClubOrangeReferralSignupTarget,
  resolveInstagramTargetUrl,
  resolveMediumFeedUrl,
  resolveSubstackCanonicalHandle,
  resolveSubstackProfileMetadata,
  resolveSubstackPublicationMetadata,
  resolveXHandle,
  resolveYoutubeTargetUrl,
} from "./public-augmentation-core";
import {
  buildReferralBenefitTextCandidates,
  extractYoutubeProfileImageUrl,
  extractYoutubeSubscriberCountRaw,
  hasReferralFieldValue,
  isLikelyAuthGatedUrl,
  mergeCatalogSeedWithGeneratedReferral,
  parseClubOrangeReferralSignupPage,
  parseInstagramProfileMetadata,
  parseMediumFeed,
  parsePrimalPublicProfile,
  parseYoutubeProfileMetadata,
  resolveExplicitReferralBenefit,
  resolvePublicReferralAugmentation,
  resolveReferralOfferSummary,
  resolveReferralOwnerBenefit,
  resolveReferralTermsSummary,
  resolveReferralVisitorBenefit,
  splitIntoSentences,
} from "./public-augmentation-profile-parsers";
import {
  parseInstagramPublicProfile,
  parseSubstackPublicProfile,
  parseXCommunityPage,
  parseXOEmbed,
  parseYoutubePublicProfile,
} from "./public-augmentation-social-parsers";
import { type ReferralTargetCatalogContribution, resolveReferralTarget } from "./referral-targets";
import { parseRumblePublicProfile, resolveRumbleAboutUrl } from "./rumble-public-profile";
import { parseAudienceCount } from "./social-profile-counts";
import type {
  EnrichmentStrategy,
  NormalizedEnrichmentResult,
  ResolveEnrichmentStrategyInput,
  ResolvedPublicEnrichmentStrategy,
} from "./strategy-types";
import type { EnrichmentMetadata } from "./types";

export const PUBLIC_AUGMENTATION_STRATEGIES: PublicAugmentationStrategy[] = [
  {
    id: "cluborange-referral-signup",
    branch: "public_augmented",
    sourceKind: "html",
    matches: (input) => Boolean(resolveClubOrangeReferralSignupTarget(input.url)),
    resolve: (input) => {
      const referralTarget = resolveClubOrangeReferralSignupTarget(input.url);
      if (!referralTarget) {
        return null;
      }
      const sourceUrl = referralTarget.sourceUrl;

      return {
        id: "cluborange-referral-signup",
        branch: "public_augmented",
        sourceKind: "html",
        source: {
          sourceUrl,
          originalUrl: input.url,
        },
        normalize: (body) =>
          parseClubOrangeReferralSignupPage(
            {
              originalUrl: input.url,
              fetchUrl: sourceUrl,
            },
            body,
          ),
      };
    },
  },
  {
    id: "instagram-public-profile",
    branch: "public_augmented",
    sourceKind: "html",
    matches: (input) => resolveSupportedSocialProfile(input)?.platform === "instagram",
    resolve: (input) => {
      if (resolveSupportedSocialProfile(input)?.platform !== "instagram") {
        return null;
      }

      const sourceUrl = resolveInstagramTargetUrl(input.url);
      return {
        id: "instagram-public-profile",
        branch: "public_augmented",
        sourceKind: "html",
        source: { sourceUrl },
        normalize: (body) => parseInstagramPublicProfile(sourceUrl, body),
      };
    },
  },
  {
    id: "youtube-public-profile",
    branch: "public_augmented",
    sourceKind: "html",
    matches: (input) => resolveSupportedSocialProfile(input)?.platform === "youtube",
    resolve: (input) => {
      if (resolveSupportedSocialProfile(input)?.platform !== "youtube") {
        return null;
      }

      const sourceUrl = resolveYoutubeTargetUrl(input.url);
      return {
        id: "youtube-public-profile",
        branch: "public_augmented",
        sourceKind: "html",
        source: { sourceUrl },
        normalize: (body) => parseYoutubePublicProfile(sourceUrl, body),
      };
    },
  },
  {
    id: "primal-public-profile",
    branch: "public_augmented",
    sourceKind: "html",
    matches: (input) => resolveSupportedSocialProfile(input)?.platform === "primal",
    resolve: (input) =>
      resolveSupportedSocialProfile(input)?.platform === "primal"
        ? {
            id: "primal-public-profile",
            branch: "public_augmented",
            sourceKind: "html",
            source: { sourceUrl: input.url },
            normalize: (body) => parsePrimalPublicProfile(input.url, body),
          }
        : null,
  },
  {
    id: "rumble-public-profile",
    branch: "public_augmented",
    sourceKind: "html",
    matches: (input) => resolveSupportedSocialProfile(input)?.platform === "rumble",
    resolve: (input) => {
      if (resolveSupportedSocialProfile(input)?.platform !== "rumble") {
        return null;
      }

      const sourceUrl = resolveRumbleAboutUrl(input.url);
      return {
        id: "rumble-public-profile",
        branch: "public_augmented",
        sourceKind: "html",
        source: {
          sourceUrl,
          headers: {
            "accept-language": "en-US,en;q=0.9",
            "user-agent": PUBLIC_BROWSER_USER_AGENT,
          },
        },
        normalize: (body) => parseRumblePublicProfile(sourceUrl, body),
      };
    },
  },
  {
    id: "substack-public-profile",
    branch: "public_augmented",
    sourceKind: "html",
    matches: (input) => isLikelySubstackProfileUrl(input),
    resolve: (input) => {
      if (!isLikelySubstackProfileUrl(input)) {
        return null;
      }

      const supportedProfile = resolveSupportedSocialProfile(input);
      const sourceUrl =
        supportedProfile?.platform === "substack"
          ? buildSubstackCanonicalProfileUrl(supportedProfile.handle)
          : input.url;

      return {
        id: "substack-public-profile",
        branch: "public_augmented",
        sourceKind: "html",
        source: {
          sourceUrl,
          headers: {
            "accept-language": "en-US,en;q=0.9",
            "user-agent": PUBLIC_BROWSER_USER_AGENT,
          },
        },
        normalize: (body) =>
          parseSubstackPublicProfile(
            {
              originalUrl: input.url,
              fetchUrl: sourceUrl,
            },
            body,
          ),
      };
    },
  },
  {
    id: "x-public-community",
    branch: "public_augmented",
    sourceKind: "html",
    matches: (input) => isXCommunityUrl(input),
    resolve: (input) =>
      isXCommunityUrl(input)
        ? {
            id: "x-public-community",
            branch: "public_augmented",
            sourceKind: "html",
            source: {
              sourceUrl: input.url,
              headers: {
                "accept-language": "en-US,en;q=0.9",
                "user-agent": X_COMMUNITY_METADATA_USER_AGENT,
              },
            },
            normalize: (body) => parseXCommunityPage(input.url, body),
          }
        : null,
  },
  {
    id: "x-public-oembed",
    branch: "public_augmented",
    sourceKind: "oembed",
    matches: (input) => {
      const handleResolution = resolveHandleFromUrl(input);
      return (
        !isXCommunityUrl(input) &&
        handleResolution.reason === "resolved" &&
        handleResolution.extractorId === "x"
      );
    },
    resolve: (input) => {
      const handleResolution = resolveHandleFromUrl(input);
      if (
        isXCommunityUrl(input) ||
        handleResolution.reason !== "resolved" ||
        handleResolution.extractorId !== "x"
      ) {
        return null;
      }

      return {
        id: "x-public-oembed",
        branch: "public_augmented",
        sourceKind: "oembed",
        source: {
          sourceUrl: buildXOEmbedUrl(input.url),
          acceptHeader: "application/json",
          headers: {
            "accept-language": "en-US,en;q=0.9",
            "user-agent": PUBLIC_BROWSER_USER_AGENT,
          },
        },
        normalize: (body) => parseXOEmbed(input.url, body),
      };
    },
  },
  {
    id: "medium-public-feed",
    branch: "public_augmented",
    sourceKind: "xml",
    matches: (input) => {
      const handleResolution = resolveHandleFromUrl(input);
      return handleResolution.reason === "resolved" && handleResolution.extractorId === "medium";
    },
    resolve: (input) => {
      const handleResolution = resolveHandleFromUrl(input);
      if (handleResolution.reason !== "resolved" || handleResolution.extractorId !== "medium") {
        return null;
      }

      return {
        id: "medium-public-feed",
        branch: "public_augmented",
        sourceKind: "xml",
        source: {
          sourceUrl: resolveMediumFeedUrl(input.url),
          acceptHeader: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
          headers: {
            "accept-language": "en-US,en;q=0.9",
            "user-agent": PUBLIC_BROWSER_USER_AGENT,
          },
        },
        normalize: (body) => parseMediumFeed(input.url, body),
      };
    },
  },
];

export const toPublicAugmentationTarget = (
  strategy: ResolvedPublicEnrichmentStrategy,
): PublicAugmentationTarget => ({
  id: strategy.id as PublicAugmentationStrategyId,
  sourceUrl: strategy.source.sourceUrl,
  originalUrl: strategy.source.originalUrl,
  acceptHeader: strategy.source.acceptHeader,
  headers: strategy.source.headers,
  parse: strategy.normalize,
});

export const listPublicAugmentationStrategies = (): PublicAugmentationStrategy[] => [
  ...PUBLIC_AUGMENTATION_STRATEGIES,
];

export const resolvePublicAugmentedStrategy = (
  input: ResolveEnrichmentStrategyInput,
): ResolvedPublicEnrichmentStrategy | null => {
  for (const strategy of PUBLIC_AUGMENTATION_STRATEGIES) {
    if (!strategy.matches(input)) {
      continue;
    }

    const resolved = strategy.resolve(input);
    if (resolved) {
      return resolved;
    }
  }

  return null;
};

export const resolvePublicAugmentationTarget = (
  input: ResolvePublicAugmentationTargetInput,
): PublicAugmentationTarget | null => {
  const resolved = resolvePublicAugmentedStrategy(input);
  return resolved ? toPublicAugmentationTarget(resolved) : null;
};

export const hasPublicAugmentationTarget = (input: { url: string; icon?: string }): boolean =>
  resolvePublicAugmentedStrategy(input) !== null;
