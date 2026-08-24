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
  type InstagramProfileMetadata,
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
  type ResolvePublicReferralAugmentationInput,
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
  type YoutubeProfileMetadata,
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

export const parseInstagramProfileMetadata = (
  description: string | undefined,
): InstagramProfileMetadata => {
  const trimmed = safeTrim(description);
  if (!trimmed) {
    return {};
  }

  const match = INSTAGRAM_DESCRIPTION_PATTERN.exec(trimmed);
  const followersValue = safeTrim(match?.groups?.followersValue);
  const followersLabel = safeTrim(match?.groups?.followersLabel);
  const followingValue = safeTrim(match?.groups?.followingValue);
  const followingLabel = safeTrim(match?.groups?.followingLabel);

  const followersCountRaw =
    followersValue && followersLabel ? `${followersValue} ${followersLabel}` : undefined;
  const followingCountRaw =
    followingValue && followingLabel ? `${followingValue} ${followingLabel}` : undefined;

  return {
    followersCount: parseAudienceCount(followersCountRaw),
    followersCountRaw,
    followingCount: parseAudienceCount(followingCountRaw),
    followingCountRaw,
  };
};

export const extractYoutubeSubscriberCountRaw = (html: string): string | undefined => {
  const extractSubscriberTextFromSegment = (
    marker: string,
    patterns: RegExp[],
  ): string | undefined => {
    const maybeStartIndex = html.indexOf(marker);
    if (maybeStartIndex < 0) {
      return undefined;
    }

    const maybeSegment = html.slice(
      maybeStartIndex,
      maybeStartIndex + YOUTUBE_SUBSCRIBER_SEGMENT_LENGTH,
    );
    return firstMatch(maybeSegment, patterns);
  };

  const maybeAboutPageCount = extractSubscriberTextFromSegment(YOUTUBE_ABOUT_CHANNEL_MARKER, [
    /"subscriberCountText":"([^"]+ subscribers?)"/i,
    /"subscriberCountText":\{[^}]*"(?:simpleText|content)":"([^"]+ subscribers?)"/i,
  ]);
  if (maybeAboutPageCount) {
    return maybeAboutPageCount;
  }

  const maybeLegacyCount = extractSubscriberTextFromSegment(YOUTUBE_METADATA_ROWS_MARKER, [
    /"content":"([^"]+ subscribers?)"/i,
    /"accessibilityLabel":"([^"]+ subscribers?)"/i,
  ]);
  if (maybeLegacyCount) {
    return maybeLegacyCount;
  }

  const maybeSubscriberCount = firstMatch(html, [
    /"subscriberCountText":"([^"]+ subscribers?)"/i,
    /"subscriberCountText":\{[^}]*"(?:simpleText|content)":"([^"]+ subscribers?)"/i,
  ]);
  if (maybeSubscriberCount) {
    return maybeSubscriberCount;
  }
  return undefined;
};

export const extractYoutubeProfileImageUrl = (html: string): string | undefined => {
  const match = YOUTUBE_THUMBNAIL_URL_PATTERN.exec(html);
  return safeTrim(match?.[1] ?? match?.[2]);
};

export const parseYoutubeProfileMetadata = (html: string): YoutubeProfileMetadata => {
  const subscribersCountRaw = extractYoutubeSubscriberCountRaw(html);
  return {
    subscribersCount: parseAudienceCount(subscribersCountRaw),
    subscribersCountRaw,
  };
};

export const parseMediumFeed = (sourceUrl: string, xml: string): PublicAugmentationOutcome => {
  const channel = firstMatch(xml, [/<channel>([\s\S]*?)<\/channel>/i]) ?? xml;
  const title = firstMatch(channel, [
    /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i,
    /<title>([\s\S]*?)<\/title>/i,
  ]);
  const description = firstMatch(channel, [
    /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i,
    /<description>([\s\S]*?)<\/description>/i,
  ]);
  const image = firstMatch(channel, [/<image>[\s\S]*?<url>([\s\S]*?)<\/url>[\s\S]*?<\/image>/i]);
  const placeholderSignals = detectMediumPlaceholderSignals(xml);

  if (placeholderSignals.length > 0) {
    throw new Error(
      `Medium public augmentation captured placeholder content: ${placeholderSignals.join(", ")}.`,
    );
  }

  const handleResolution = resolveHandleFromUrl({ url: sourceUrl, icon: "medium" });
  const handle =
    handleResolution.reason === "resolved" && handleResolution.extractorId === "medium"
      ? handleResolution.handle
      : undefined;

  return resolveCompleteness({
    title,
    description,
    image,
    profileImage: image,
    handle,
    sourceLabel: "medium.com",
  });
};

export const parsePrimalPublicProfile = (
  sourceUrl: string,
  html: string,
): PublicAugmentationOutcome => {
  const parsed = parseMetadata(html, sourceUrl);
  const handleResolution = resolveHandleFromUrl({ url: sourceUrl, icon: "primal" });
  const handle =
    handleResolution.reason === "resolved" && handleResolution.extractorId === "primal"
      ? handleResolution.handle
      : undefined;

  return resolveCompleteness({
    title: safeTrim(parsed.metadata.title),
    description: safeTrim(parsed.metadata.description),
    image: safeTrim(parsed.metadata.image),
    ogImage: safeTrim(parsed.metadata.ogImage),
    twitterImage: safeTrim(parsed.metadata.twitterImage),
    profileImage: safeTrim(parsed.metadata.image),
    handle,
    sourceLabel: "primal.net",
  });
};

export const parseClubOrangeReferralSignupPage = (
  input: {
    originalUrl: string;
    fetchUrl: string;
  },
  html: string,
): PublicAugmentationOutcome => {
  const parsed = parseMetadata(html, input.fetchUrl);

  return resolveCompleteness({
    title: safeTrim(parsed.metadata.title),
    description: safeTrim(parsed.metadata.description),
    image: safeTrim(parsed.metadata.image),
    ogImage: safeTrim(parsed.metadata.ogImage),
    twitterImage: safeTrim(parsed.metadata.twitterImage),
    sourceLabel: toSourceLabel(input.originalUrl) ?? parsed.metadata.sourceLabel,
  });
};

export const splitIntoSentences = (value: string | undefined): string[] => {
  const normalized = safeTrim(value);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => safeTrim(sentence))
    .filter((sentence): sentence is string => Boolean(sentence));
};

export const resolveReferralOfferSummary = (metadata: EnrichmentMetadata): string | undefined => {
  const title = safeTrim(metadata.title);
  if (title && REFERRAL_HEADLINE_HINT_PATTERN.test(title)) {
    return title;
  }

  const firstSentence = splitIntoSentences(metadata.description)[0];
  return firstSentence && REFERRAL_HEADLINE_HINT_PATTERN.test(firstSentence)
    ? firstSentence
    : undefined;
};

export const resolveReferralTermsSummary = (metadata: EnrichmentMetadata): string | undefined => {
  const matchingSentences = splitIntoSentences(metadata.description).filter((sentence) =>
    REFERRAL_TERMS_PATTERN.test(sentence),
  );
  return matchingSentences.length > 0 ? matchingSentences.join(" ") : undefined;
};

export const buildReferralBenefitTextCandidates = (input: {
  metadata: EnrichmentMetadata;
  benefitTextCandidates?: string[];
}): string[] => {
  const candidates: string[] = [];
  const seen = new Set<string>();

  const push = (value: string | undefined) => {
    const trimmed = safeTrim(value);
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    candidates.push(trimmed);
  };

  push(input.metadata.title);
  for (const sentence of splitIntoSentences(input.metadata.description)) {
    push(sentence);
  }
  for (const candidate of input.benefitTextCandidates ?? []) {
    push(candidate);
  }

  return candidates;
};

export const resolveExplicitReferralBenefit = (
  input: {
    metadata: EnrichmentMetadata;
    benefitTextCandidates?: string[];
  },
  pattern: RegExp,
): string | undefined =>
  buildReferralBenefitTextCandidates(input).find((candidate) => pattern.test(candidate));

export const resolveReferralVisitorBenefit = (input: {
  metadata: EnrichmentMetadata;
  benefitTextCandidates?: string[];
}): string | undefined => resolveExplicitReferralBenefit(input, REFERRAL_VISITOR_BENEFIT_PATTERN);

export const resolveReferralOwnerBenefit = (input: {
  metadata: EnrichmentMetadata;
  benefitTextCandidates?: string[];
}): string | undefined => resolveExplicitReferralBenefit(input, REFERRAL_OWNER_BENEFIT_PATTERN);

export const hasReferralFieldValue = (
  referral: LinkReferralConfig | undefined,
  field: ReferralFieldName,
): boolean => {
  const value = referral?.[field];
  return typeof value === "string" && value.trim().length > 0;
};

export const mergeCatalogSeedWithGeneratedReferral = (input: {
  catalogReferral: LinkReferralConfig;
  generatedReferral: GeneratedLinkReferralConfig;
  catalogContribution?: ReferralTargetCatalogContribution;
}): GeneratedLinkReferralConfig => {
  const normalizedCatalog = normalizeReferralConfig(input.catalogReferral);
  const normalizedGenerated = normalizeReferralConfig(input.generatedReferral);
  const merged = {
    ...normalizedCatalog,
    ...normalizedGenerated,
  } as GeneratedLinkReferralConfig;
  const provenance: Partial<Record<ReferralFieldName, "catalog" | "generated">> = {};

  for (const field of REFERRAL_PROVENANCE_FIELDS) {
    if (hasReferralFieldValue(normalizedGenerated, field)) {
      provenance[field] = "generated";
      continue;
    }

    if (hasReferralFieldValue(normalizedCatalog, field)) {
      provenance[field] = "catalog";
    }
  }

  if (Object.keys(provenance).length > 0) {
    merged.provenance = provenance;
  }

  if (input.catalogContribution) {
    merged.catalog = input.catalogContribution;
  }

  return merged;
};

export const isLikelyAuthGatedUrl = (value: string): boolean => {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("/login") ||
    normalized.includes("/signin") ||
    normalized.includes("/sign-in") ||
    normalized.includes("/authorize") ||
    normalized.includes("/oauth") ||
    normalized.includes("/checkpoint") ||
    normalized.includes("/challenge") ||
    normalized.includes("consent.")
  );
};

export const resolvePublicReferralAugmentation = (
  input: ResolvePublicReferralAugmentationInput,
): GeneratedLinkReferralConfig | undefined => {
  const normalizedManual = normalizeReferralConfig(input.manualReferral);
  const target = resolveReferralTarget({
    url: input.originalUrl,
    finalUrl: input.finalUrl ?? input.sourceUrl,
    referral: normalizedManual,
  });
  const catalogReferral = target?.catalogReferral;
  const shouldAttemptReferral =
    Boolean(normalizedManual) ||
    Boolean(target && target.pattern !== "direct") ||
    Boolean(target?.catalog) ||
    input.strategyId === "cluborange-referral-signup";

  if (!shouldAttemptReferral) {
    return undefined;
  }
  const resolvedUrl = target?.sourceUrl ?? input.finalUrl ?? input.sourceUrl;
  if (isLikelyAuthGatedUrl(resolvedUrl)) {
    return undefined;
  }

  const visitorBenefit = resolveReferralVisitorBenefit(input);
  const ownerBenefit = resolveReferralOwnerBenefit(input);
  const offerSummary = resolveReferralOfferSummary(input.metadata);
  const termsSummary = resolveReferralTermsSummary(input.metadata);
  const generatedKind =
    normalizedManual?.kind ??
    (catalogReferral?.kind
      ? undefined
      : input.strategyId === "cluborange-referral-signup"
        ? "referral"
        : undefined);

  const generatedReferral = normalizeReferralConfig({
    kind: generatedKind,
    visitorBenefit,
    ownerBenefit,
    offerSummary,
    termsSummary,
    originalUrl: input.originalUrl,
    resolvedUrl,
    strategyId: input.strategyId,
    termsSourceUrl: termsSummary ? resolvedUrl : undefined,
    ...(target?.catalog ? { catalog: target.catalog } : {}),
  });

  if (!catalogReferral || !generatedReferral) {
    return generatedReferral
      ? normalizeReferralConfig({
          ...generatedReferral,
          completeness: resolveReferralCompleteness(generatedReferral),
        })
      : undefined;
  }

  const catalogBackedReferral = mergeCatalogSeedWithGeneratedReferral({
    catalogReferral,
    generatedReferral,
    catalogContribution: target?.catalog,
  });
  const mergedReferral = normalizedManual
    ? (mergeReferralWithManualOverrides(normalizedManual, catalogBackedReferral, undefined) ??
      catalogBackedReferral)
    : catalogBackedReferral;

  return normalizeReferralConfig({
    ...mergedReferral,
    completeness: resolveReferralCompleteness(mergedReferral),
  });
};
