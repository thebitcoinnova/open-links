import type { OpenLink } from "../content/load-content";
import { resolveLinkHandle } from "../identity/handle-resolver";

export type SocialAudienceMetricKind = "followers" | "following" | "subscribers";

export interface SocialAudienceMetric {
  kind: SocialAudienceMetricKind;
  label: string;
  count?: number;
  rawText?: string;
}

export interface ResolvedSocialProfileMetadata {
  handle?: string;
  handleDisplay?: string;
  profileImageUrl?: string;
  previewImageUrl?: string;
  metrics: SocialAudienceMetric[];
}

const pushMetric = (
  metrics: SocialAudienceMetric[],
  kind: SocialAudienceMetricKind,
  label: string,
  count: unknown,
  rawText: unknown,
) => {
  const resolvedCount = typeof count === "number" && Number.isFinite(count) ? count : undefined;
  const resolvedRawText =
    typeof rawText === "string" && rawText.trim().length > 0 ? rawText : undefined;

  if (resolvedCount === undefined && !resolvedRawText) {
    return;
  }

  metrics.push({
    kind,
    label,
    count: resolvedCount,
    rawText: resolvedRawText,
  });
};

export const resolveSocialProfileMetadata = (link: OpenLink): ResolvedSocialProfileMetadata => {
  const metadata = link.metadata ?? {};
  const resolvedHandle = resolveLinkHandle({
    metadataHandle: metadata.handle,
    url: link.url,
    icon: link.icon,
  });
  const metrics: SocialAudienceMetric[] = [];

  pushMetric(
    metrics,
    "followers",
    "Followers",
    metadata.followersCount,
    metadata.followersCountRaw,
  );
  pushMetric(
    metrics,
    "following",
    "Following",
    metadata.followingCount,
    metadata.followingCountRaw,
  );
  pushMetric(
    metrics,
    "subscribers",
    "Subscribers",
    metadata.subscribersCount,
    metadata.subscribersCountRaw,
  );

  return {
    handle: resolvedHandle.handle,
    handleDisplay: resolvedHandle.displayHandle,
    profileImageUrl:
      typeof metadata.profileImage === "string" && metadata.profileImage.trim().length > 0
        ? metadata.profileImage
        : undefined,
    previewImageUrl:
      typeof metadata.image === "string" && metadata.image.trim().length > 0
        ? metadata.image
        : undefined,
    metrics,
  };
};
