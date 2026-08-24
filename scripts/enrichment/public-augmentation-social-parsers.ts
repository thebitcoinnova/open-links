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
  type PublicAugmentationOutcome,
  PublicAugmentationStrategy,
  PublicAugmentationStrategyId,
  PublicAugmentationTarget,
  REFERRAL_HEADLINE_HINT_PATTERN,
  REFERRAL_OWNER_BENEFIT_PATTERN,
  REFERRAL_TERMS_PATTERN,
  REFERRAL_VISITOR_BENEFIT_PATTERN,
  ResolvePublicAugmentationTargetInput,
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

export const parseSubstackPublicProfile = (
  input: {
    originalUrl: string;
    fetchUrl: string;
  },
  html: string,
): PublicAugmentationOutcome => {
  const parsed = parseMetadata(html, input.fetchUrl);
  const person = extractSubstackJsonLdPerson(html);
  const preloads = extractSubstackPreloads(html);
  const profile = resolveSubstackProfileMetadata(preloads);
  const publication = resolveSubstackPublicationMetadata(preloads);
  const byline = extractSubstackPublishedByline(preloads);
  const profileImage = toAbsoluteUrl(
    safeTrim(person?.image) ??
      safeTrim(profile?.photoUrl) ??
      safeTrim(byline?.photoUrl) ??
      safeTrim(publication?.logoUrl),
    input.fetchUrl,
  );
  const parsedPreviewImage =
    toAbsoluteUrl(safeTrim(parsed.metadata.image), input.fetchUrl) ??
    safeTrim(parsed.metadata.image);
  const image =
    parsedPreviewImage &&
    parsedPreviewImage !== profileImage &&
    !isSubstackGenericPreviewImage(parsedPreviewImage)
      ? parsedPreviewImage
      : (profileImage ?? parsedPreviewImage);

  return resolveCompleteness({
    title:
      safeTrim(person?.name) ??
      safeTrim(profile?.name) ??
      safeTrim(publication?.name) ??
      safeTrim(byline?.name) ??
      safeTrim(parsed.metadata.title),
    description:
      safeTrim(person?.jobTitle) ??
      safeTrim(profile?.bio) ??
      safeTrim(publication?.heroText) ??
      safeTrim(byline?.bio) ??
      safeTrim(person?.description) ??
      safeTrim(parsed.metadata.description),
    image,
    ogImage: safeTrim(parsed.metadata.ogImage),
    twitterImage: safeTrim(parsed.metadata.twitterImage),
    profileImage,
    handle: resolveSubstackCanonicalHandle(person, profile, byline, publication),
    subscribersCount: profile?.subscribersCount,
    subscribersCountRaw: profile?.subscribersCountRaw,
    sourceLabel: toSourceLabel(input.originalUrl) ?? parsed.metadata.sourceLabel,
  });
};

export const parseXOEmbed = (sourceUrl: string, payloadText: string): PublicAugmentationOutcome => {
  const payload = JSON.parse(payloadText) as {
    title?: string;
    html?: string;
    provider_name?: string;
  };
  const handle = resolveXHandle(sourceUrl);
  const providerName = safeTrim(payload.provider_name) ?? "";
  const displayHandle = extractXDisplayHandle(payload.html, handle);
  const placeholderSignals = detectXPlaceholderSignals({
    title: payload.title,
    providerName,
    html: payload.html,
  });

  if (!["twitter", "x"].includes(providerName.toLowerCase())) {
    throw new Error(
      `X public augmentation expected oEmbed provider 'Twitter' or 'X' but received '${providerName || "missing"}'.`,
    );
  }

  if (placeholderSignals.length > 0) {
    throw new Error(
      `X public augmentation received placeholder oEmbed payload: ${placeholderSignals.join(", ")}.`,
    );
  }

  const avatarUrl = `https://unavatar.io/x/${encodeURIComponent(displayHandle)}`;
  return resolveCompleteness({
    title: safeTrim(payload.title) ?? `@${displayHandle} on X`,
    description: buildGenericXDescription(displayHandle),
    image: avatarUrl,
    profileImage: avatarUrl,
    sourceLabel: "x.com",
  });
};

export const parseXCommunityPage = (sourceUrl: string, html: string): PublicAugmentationOutcome => {
  const parsed = parseMetadata(html, sourceUrl);
  const title = safeTrim(parsed.metadata.title);
  const description = safeTrim(parsed.metadata.description);
  const image = safeTrim(parsed.metadata.image);
  const hasCompleteCommunityMetadata = Boolean(title && description && image);
  const placeholderSignals = detectXPlaceholderSignals({
    title,
    description,
    html: hasCompleteCommunityMetadata ? undefined : html,
  });

  if (placeholderSignals.length > 0) {
    throw new Error(
      `X public augmentation captured placeholder community metadata: ${placeholderSignals.join(", ")}.`,
    );
  }

  return resolveCompleteness({
    title,
    description,
    image,
    ogImage: safeTrim(parsed.metadata.ogImage),
    twitterImage: safeTrim(parsed.metadata.twitterImage),
    sourceLabel: "x.com",
  });
};

export const parseInstagramPublicProfile = (
  sourceUrl: string,
  html: string,
): PublicAugmentationOutcome => {
  const parsed = parseMetadata(html, sourceUrl);
  const title = safeTrim(parsed.metadata.title);
  const description = safeTrim(parsed.metadata.description);
  const image = safeTrim(parsed.metadata.image);
  const placeholderSignals = detectInstagramPlaceholderSignals({
    html,
    currentUrl: sourceUrl,
    title,
    description,
  });

  if (placeholderSignals.length > 0) {
    throw new Error(
      `Instagram public augmentation captured placeholder content: ${placeholderSignals.join(", ")}.`,
    );
  }

  const counts = parseInstagramProfileMetadata(description);
  return resolveCompleteness({
    title,
    description,
    image,
    ogImage: safeTrim(parsed.metadata.ogImage),
    twitterImage: safeTrim(parsed.metadata.twitterImage),
    profileImage: image,
    followersCount: counts.followersCount,
    followersCountRaw: counts.followersCountRaw,
    followingCount: counts.followingCount,
    followingCountRaw: counts.followingCountRaw,
    sourceLabel: "instagram.com",
  });
};

export const parseYoutubePublicProfile = (
  sourceUrl: string,
  html: string,
): PublicAugmentationOutcome => {
  const parsed = parseMetadata(html, sourceUrl);
  const title = safeTrim(parsed.metadata.title);
  const description = safeTrim(parsed.metadata.description);
  const profileImage = extractYoutubeProfileImageUrl(html);
  const image = safeTrim(parsed.metadata.image) ?? profileImage;
  const placeholderSignals = detectYoutubePlaceholderSignals({
    html,
    currentUrl: sourceUrl,
    title,
    description,
  });

  if (placeholderSignals.length > 0) {
    throw new Error(
      `YouTube public augmentation captured placeholder content: ${placeholderSignals.join(", ")}.`,
    );
  }

  const counts = parseYoutubeProfileMetadata(html);
  return resolveCompleteness({
    title,
    description,
    image,
    ogImage: safeTrim(parsed.metadata.ogImage),
    twitterImage: safeTrim(parsed.metadata.twitterImage),
    profileImage,
    subscribersCount: counts.subscribersCount,
    subscribersCountRaw: counts.subscribersCountRaw,
    sourceLabel: "youtube.com",
  });
};
