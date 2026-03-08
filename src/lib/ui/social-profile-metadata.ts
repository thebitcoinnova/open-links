import type { OpenLink } from "../content/load-content";
import {
  normalizeSupportedSocialProfileMetadata,
  resolveSupportedSocialProfile,
} from "../content/social-profile-fields";
import type { HandleExtractorId } from "../identity/handle-resolver";
import { resolveLinkHandle } from "../identity/handle-resolver";

export type SocialAudienceMetricKind = "followers" | "following" | "subscribers";

export interface SocialAudienceMetric {
  kind: SocialAudienceMetricKind;
  label: string;
  count?: number;
  rawText?: string;
  parsedCountCompactText?: string;
  displayLabel: string;
  displayText: string;
}

export interface ResolvedSocialProfileMetadata {
  platform?: HandleExtractorId;
  displayName?: string;
  handle?: string;
  handleDisplay?: string;
  usesProfileLayout: boolean;
  hasDistinctPreviewImage: boolean;
  profileImageUrl?: string;
  previewImageUrl?: string;
  metrics: SocialAudienceMetric[];
}

const audienceCountFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});

const collapseWhitespace = (value: string): string => value.replace(/\s+/gu, " ").trim();

const resolveMetadataText = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = collapseWhitespace(value);
  return normalized.length > 0 ? normalized : undefined;
};

const resolveDisplayLabel = (rawText: string | undefined, fallbackLabel: string): string => {
  if (!rawText) {
    return fallbackLabel;
  }

  const tokens = rawText.split(/\s+/u).filter((token) => token.length > 0);
  const labelStartIndex = tokens.findIndex((token) => !/\d/u.test(token));
  if (labelStartIndex <= 0) {
    return fallbackLabel;
  }

  return tokens.slice(labelStartIndex).join(" ").trim();
};

const resolveDisplayNameFromTitle = (
  rawTitle: string | undefined,
  platform: HandleExtractorId | undefined,
): string | undefined => {
  if (!rawTitle) {
    return undefined;
  }

  if (platform === "instagram") {
    return rawTitle
      .replace(/\s*[•·]\s*Instagram photos and videos$/iu, "")
      .replace(/\s*\(\s*@?[^)]+\)\s*$/u, "")
      .trim();
  }

  if (platform === "youtube") {
    return rawTitle.replace(/\s*-\s*YouTube$/iu, "").trim();
  }

  if (platform === "github") {
    return rawTitle
      .replace(/\s*-\s*Overview$/iu, "")
      .replace(/\s*[·•]\s*GitHub$/iu, "")
      .trim();
  }

  if (platform === "linkedin") {
    const cleaned = rawTitle.replace(/\s*[|·•-]\s*LinkedIn$/iu, "").trim();
    return cleaned.length > 0 ? cleaned : rawTitle;
  }

  if (platform === "medium") {
    const cleaned = rawTitle
      .replace(/^Stories by\s+/iu, "")
      .replace(/\s+on Medium$/iu, "")
      .trim();
    return cleaned.length > 0 ? cleaned : rawTitle;
  }

  if (platform === "substack") {
    const cleaned = rawTitle.replace(/\s*[|·•-]\s*Substack$/iu, "").trim();
    return cleaned.length > 0 ? cleaned : rawTitle;
  }

  return rawTitle;
};

const pushMetric = (
  metrics: SocialAudienceMetric[],
  kind: SocialAudienceMetricKind,
  label: string,
  count: unknown,
  rawText: unknown,
) => {
  const resolvedCount = typeof count === "number" && Number.isFinite(count) ? count : undefined;
  const resolvedRawText = resolveMetadataText(rawText);

  if (resolvedCount === undefined && !resolvedRawText) {
    return;
  }

  const parsedCountCompactText =
    resolvedCount === undefined ? undefined : audienceCountFormatter.format(resolvedCount);
  const displayLabel = resolveDisplayLabel(resolvedRawText, label);

  metrics.push({
    kind,
    label,
    count: resolvedCount,
    rawText: resolvedRawText,
    parsedCountCompactText,
    displayLabel,
    displayText:
      parsedCountCompactText !== undefined
        ? `${parsedCountCompactText} ${displayLabel}`
        : (resolvedRawText ?? displayLabel),
  });
};

export const resolveSocialProfileMetadata = (link: OpenLink): ResolvedSocialProfileMetadata => {
  const metadata = link.metadata ?? {};
  const resolvedHandle = resolveLinkHandle({
    metadataHandle: metadata.handle,
    url: link.url,
    icon: link.icon,
  });
  const supportedProfile = resolveSupportedSocialProfile({
    url: link.url,
    icon: link.icon,
    metadataHandle: metadata.handle,
  });
  const normalizedMetadata =
    normalizeSupportedSocialProfileMetadata(
      metadata as Record<string, unknown> & { image?: string; profileImage?: string },
      supportedProfile,
    ) ?? metadata;
  const platform = resolvedHandle.resolution.extractorId;
  const metrics: SocialAudienceMetric[] = [];
  const profileImageUrl = resolveMetadataText(normalizedMetadata.profileImage);
  const previewImageUrl = resolveMetadataText(normalizedMetadata.image);
  const displayName = resolveDisplayNameFromTitle(
    resolveMetadataText(normalizedMetadata.title),
    platform,
  );

  pushMetric(
    metrics,
    "followers",
    "Followers",
    normalizedMetadata.followersCount,
    normalizedMetadata.followersCountRaw,
  );
  pushMetric(
    metrics,
    "following",
    "Following",
    normalizedMetadata.followingCount,
    normalizedMetadata.followingCountRaw,
  );
  pushMetric(
    metrics,
    "subscribers",
    "Subscribers",
    normalizedMetadata.subscribersCount,
    normalizedMetadata.subscribersCountRaw,
  );

  return {
    platform,
    displayName:
      displayName ?? (supportedProfile ? resolvedHandle.displayHandle : undefined) ?? link.label,
    handle: resolvedHandle.handle,
    handleDisplay: resolvedHandle.displayHandle,
    usesProfileLayout: Boolean(supportedProfile || profileImageUrl || metrics.length > 0),
    hasDistinctPreviewImage: Boolean(
      previewImageUrl && (!profileImageUrl || previewImageUrl !== profileImageUrl),
    ),
    profileImageUrl,
    previewImageUrl,
    metrics,
  };
};
