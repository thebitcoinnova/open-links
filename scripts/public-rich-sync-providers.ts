import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { resolveSupportedSocialProfile } from "../src/lib/content/social-profile-fields";
import { fetchMetadata } from "./enrichment/fetch-metadata";
import { parseInstagramPublicProfileMetrics } from "./enrichment/instagram-public-browser";
import { parseMediumPublicProfileMetrics } from "./enrichment/medium-public-browser";
import { parsePrimalPublicProfileMetrics } from "./enrichment/primal-public-browser";
import type {
  PublicAudienceBrowserSnapshot,
  PublicAudienceMetrics,
} from "./enrichment/public-audience-browser";
import {
  PUBLIC_BROWSER_USER_AGENT,
  type PublicAugmentationTarget,
} from "./enrichment/public-augmentation-core";
import { resolvePublicAugmentationTarget } from "./enrichment/public-augmentation-strategies";
import {
  PUBLIC_RICH_SYNC_OUTPUT_DIRECTORY,
  type PublicBrowserProfileConfig,
  runPublicBrowserJson,
  toAbsolutePublicRichOutputPath,
} from "./enrichment/public-browser";
import {
  DEFAULT_PUBLIC_CACHE_PATH,
  type PublicCacheEntry,
  type PublicCacheMetadata,
  type PublicCacheRegistry,
} from "./enrichment/public-cache-contracts";
import { buildPublicCacheEntry, toPublicCacheMetadata } from "./enrichment/public-cache-metadata";
import { computePublicCacheExpiresAt } from "./enrichment/public-cache-persistence";
import {
  arePublicCacheEntriesEqual,
  mergePublicCacheMetadataForTarget,
  resolvePublicCacheEntry,
  writePublicCacheRegistry,
} from "./enrichment/public-cache-persistence";
import {
  loadPublicCacheRegistry,
  prunePublicCacheMetadataForTarget,
} from "./enrichment/public-cache-registry";
import { parseSubstackPublicProfileMetrics } from "./enrichment/substack-public-browser";
import { augmentSupportedSocialProfileMetadata } from "./enrichment/supported-social-profile-metadata";
import { parseXPublicProfileMetrics } from "./enrichment/x-public-browser";
import { parseYoutubePublicProfileMetrics } from "./enrichment/youtube-public-browser";
import { loadEmbeddedCode } from "./shared/embedded-code-loader";
import { loadRemoteCachePolicyRegistry } from "./shared/remote-cache-policy";
import {
  RemoteCacheStatsCollector,
  createRemoteCacheStatsOutputPath,
  writeRemoteCacheRunSummary,
} from "./shared/remote-cache-stats";

import {
  BootstrapBaseEntryInput,
  CapturePublicAudienceMetricsInput,
  CliArgs,
  FACEBOOK_PAGE_ACCESS_TOKEN_ENV,
  FacebookPageMetricsResult,
  FacebookPageMetricsTarget,
  FetchFacebookPageMetricsInput,
  FetchFallbackAudienceMetricsInput,
  type InstagramPublicTarget,
  LinkInput,
  LinksPayload,
  type MediumPublicTarget,
  type PrimalPublicTarget,
  PublicAudienceFallbackResult,
  type PublicBrowserAudienceCaptureResult,
  type PublicBrowserAudienceMetrics,
  PublicBrowserAudienceSnapshot,
  PublicRichSyncDependencies,
  PublicRichSyncResult,
  PublicRichSyncRunEntry,
  PublicRichSyncSummary,
  PublicRichSyncTarget,
  type PublicRichSyncTargetId,
  RichLinkInput,
  type SubstackPublicTarget,
  type SyncablePublicTarget,
  type SyncablePublicTargetId,
  type XCommunityPublicTarget,
  type XProfilePublicTarget,
  YoutubePublicTarget,
} from "./public-rich-sync-contracts";
import {
  DEFAULT_BROWSER_WAIT_MS,
  DEFAULT_CAPTURE_RETRIES,
  DEFAULT_CAPTURE_RETRY_DELAY_MS,
  DEFAULT_FACEBOOK_GRAPH_API_VERSION,
  DEFAULT_FETCH_RETRIES,
  DEFAULT_FETCH_TIMEOUT_MS,
  FACEBOOK_PAGE_METRICS_FIELDS,
  INSTAGRAM_PUBLIC_PROFILE_METRICS_SNIPPET,
  MEDIUM_PUBLIC_PROFILE_METRICS_SNIPPET,
  PRIMAL_PUBLIC_PROFILE_METRICS_SNIPPET,
  PUBLIC_BROWSER_ARGS,
  ROOT,
  SUBSTACK_PUBLIC_PROFILE_METRICS_SNIPPET,
  X_PUBLIC_PROFILE_METRICS_SNIPPET,
  YOUTUBE_PUBLIC_PROFILE_METRICS_SNIPPET,
  absolutePath,
  buildFacebookPageMetricsSourceUrl,
  fetchFacebookPageMetrics,
  fileTimestamp,
  getFlagValue,
  isFacebookPageMetricsTarget,
  isRecord,
  isRichLink,
  normalizeFacebookGraphApiVersion,
  normalizeFacebookPageMetricsResponse,
  nowIso,
  parseArgs,
  parseInteger,
  readJson,
  resolveFacebookPageMetricsTarget,
  safeTrim,
  sleep,
  toNonNegativeInteger,
  writeJsonArtifact,
} from "./public-rich-sync-support";

export const isMediumPublicTarget = (
  target: PublicAugmentationTarget | null,
): target is MediumPublicTarget => target?.id === "medium-public-feed";

export const isInstagramPublicTarget = (
  target: PublicAugmentationTarget | null,
): target is InstagramPublicTarget => target?.id === "instagram-public-profile";

export const isPrimalPublicTarget = (
  target: PublicAugmentationTarget | null,
): target is PrimalPublicTarget => target?.id === "primal-public-profile";

export const isSubstackPublicTarget = (
  target: PublicAugmentationTarget | null,
): target is SubstackPublicTarget => target?.id === "substack-public-profile";

export const appendHttpUrl = (urls: string[], seen: Set<string>, value: unknown): void => {
  const trimmed = safeTrim(value);
  if (!trimmed) {
    return;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return;
    }

    const normalized = url.href;
    if (seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    urls.push(normalized);
  } catch {
    return;
  }
};

export const appendSubstackHandleUrl = (
  urls: string[],
  seen: Set<string>,
  handle: unknown,
): void => {
  const normalizedHandle = safeTrim(handle)?.toLowerCase();
  if (!normalizedHandle || !/^[a-z0-9-]+$/u.test(normalizedHandle)) {
    return;
  }

  appendHttpUrl(urls, seen, `https://${normalizedHandle}.substack.com/`);
};

export const resolveSubstackPublicHtmlFallbackUrls = (input: {
  targetSourceUrl: string;
  linkUrl: string;
  icon?: string;
  metadataHandle?: unknown;
  profileSemantics?: unknown;
}): string[] => {
  const urls: string[] = [];
  const seen = new Set<string>();

  appendHttpUrl(urls, seen, input.targetSourceUrl);
  appendHttpUrl(urls, seen, input.linkUrl);

  const supportedProfile = resolveSupportedSocialProfile({
    url: input.linkUrl,
    icon: input.icon,
    metadataHandle: input.metadataHandle,
    profileSemantics: input.profileSemantics,
  });

  if (supportedProfile?.platform === "substack") {
    appendSubstackHandleUrl(urls, seen, supportedProfile.handle);
  }

  return urls;
};

export const resolveInstagramPublicHtmlFallbackUrls = (input: {
  targetSourceUrl: string;
  linkUrl: string;
}): string[] => {
  const urls: string[] = [];
  const seen = new Set<string>();

  appendHttpUrl(urls, seen, input.targetSourceUrl);
  appendHttpUrl(urls, seen, input.linkUrl);

  return urls;
};

export const isXProfilePublicTarget = (
  target: PublicAugmentationTarget | null,
): target is XProfilePublicTarget => target?.id === "x-public-oembed";

export const isXCommunityPublicTarget = (
  target: PublicAugmentationTarget | null,
): target is XCommunityPublicTarget => target?.id === "x-public-community";

export const isSyncablePublicTarget = (
  target: PublicAugmentationTarget | null,
): target is SyncablePublicTarget =>
  isInstagramPublicTarget(target) ||
  isMediumPublicTarget(target) ||
  isPrimalPublicTarget(target) ||
  isSubstackPublicTarget(target) ||
  isXProfilePublicTarget(target) ||
  isXCommunityPublicTarget(target) ||
  target?.id === "youtube-public-profile";

export const hasDefinedAudienceMetric = (value: number | string | undefined): boolean => {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  return typeof value === "string" && value.trim().length > 0;
};

export const hasBaseProfileMetadata = (
  targetId: SyncablePublicTargetId,
  entry: PublicCacheEntry | undefined,
): boolean => {
  if (!entry) {
    return false;
  }

  if (targetId === "instagram-public-profile") {
    const hasFollowers =
      hasDefinedAudienceMetric(entry.metadata.followersCount) ||
      hasDefinedAudienceMetric(entry.metadata.followersCountRaw);
    const hasFollowing =
      hasDefinedAudienceMetric(entry.metadata.followingCount) ||
      hasDefinedAudienceMetric(entry.metadata.followingCountRaw);

    return (
      Boolean(safeTrim(entry.metadata.title)) &&
      Boolean(safeTrim(entry.metadata.image) || safeTrim(entry.metadata.profileImage)) &&
      Boolean(safeTrim(entry.metadata.sourceLabel)) &&
      hasFollowers &&
      hasFollowing
    );
  }

  const hasBaseMetadata =
    typeof entry.metadata.title === "string" &&
    entry.metadata.title.trim().length > 0 &&
    typeof entry.metadata.description === "string" &&
    entry.metadata.description.trim().length > 0 &&
    typeof entry.metadata.image === "string" &&
    entry.metadata.image.trim().length > 0;

  if (!hasBaseMetadata) {
    return false;
  }

  if (
    typeof entry.metadata.profileImage === "string" &&
    entry.metadata.profileImage.trim().length > 0
  ) {
    return true;
  }

  if (
    typeof entry.metadata.membersCount === "number" &&
    Number.isFinite(entry.metadata.membersCount)
  ) {
    return true;
  }

  if (
    typeof entry.metadata.membersCountRaw === "string" &&
    entry.metadata.membersCountRaw.trim().length > 0
  ) {
    return true;
  }

  return (
    typeof entry.metadata.sourceLabel === "string" &&
    entry.metadata.sourceLabel.trim().length > 0 &&
    behaviorForTarget("x-public-community").requiresMembersCount
  );
};

export interface SyncableTargetBehavior {
  label: string;
  snippet: string;
  parseMetrics: (snapshot: PublicAudienceBrowserSnapshot) => PublicBrowserAudienceMetrics;
  fatalPlaceholderSignals: readonly string[];
  requiresFollowingCount: boolean;
  requiresMembersCount: boolean;
  requiresProfileDescription: boolean;
  requiresSubscribersCount: boolean;
}

export const SYNCABLE_TARGET_BEHAVIORS = {
  "instagram-public-profile": {
    label: "Instagram",
    snippet: INSTAGRAM_PUBLIC_PROFILE_METRICS_SNIPPET,
    parseMetrics: parseInstagramPublicProfileMetrics,
    fatalPlaceholderSignals: ["not_found"],
    requiresFollowingCount: true,
    requiresMembersCount: false,
    requiresProfileDescription: false,
    requiresSubscribersCount: false,
  },
  "medium-public-feed": {
    label: "Medium",
    snippet: MEDIUM_PUBLIC_PROFILE_METRICS_SNIPPET,
    parseMetrics: parseMediumPublicProfileMetrics,
    fatalPlaceholderSignals: [],
    requiresFollowingCount: false,
    requiresMembersCount: false,
    requiresProfileDescription: false,
    requiresSubscribersCount: false,
  },
  "primal-public-profile": {
    label: "Primal",
    snippet: PRIMAL_PUBLIC_PROFILE_METRICS_SNIPPET,
    parseMetrics: parsePrimalPublicProfileMetrics,
    fatalPlaceholderSignals: ["profile_missing"],
    requiresFollowingCount: true,
    requiresMembersCount: false,
    requiresProfileDescription: false,
    requiresSubscribersCount: false,
  },
  "substack-public-profile": {
    label: "Substack",
    snippet: SUBSTACK_PUBLIC_PROFILE_METRICS_SNIPPET,
    parseMetrics: parseSubstackPublicProfileMetrics,
    fatalPlaceholderSignals: [],
    requiresFollowingCount: false,
    requiresMembersCount: false,
    requiresProfileDescription: false,
    requiresSubscribersCount: true,
  },
  "x-public-oembed": {
    label: "X",
    snippet: X_PUBLIC_PROFILE_METRICS_SNIPPET,
    parseMetrics: parseXPublicProfileMetrics,
    fatalPlaceholderSignals: ["account_missing", "account_suspended"],
    requiresFollowingCount: true,
    requiresMembersCount: false,
    requiresProfileDescription: false,
    requiresSubscribersCount: false,
  },
  "x-public-community": {
    label: "X community",
    snippet: X_PUBLIC_PROFILE_METRICS_SNIPPET,
    parseMetrics: parseXPublicProfileMetrics,
    fatalPlaceholderSignals: ["account_missing", "account_suspended"],
    requiresFollowingCount: false,
    requiresMembersCount: true,
    requiresProfileDescription: false,
    requiresSubscribersCount: false,
  },
  "youtube-public-profile": {
    label: "YouTube",
    snippet: YOUTUBE_PUBLIC_PROFILE_METRICS_SNIPPET,
    parseMetrics: parseYoutubePublicProfileMetrics,
    fatalPlaceholderSignals: ["unavailable_page"],
    requiresFollowingCount: false,
    requiresMembersCount: false,
    requiresProfileDescription: false,
    requiresSubscribersCount: true,
  },
} as const satisfies Record<SyncablePublicTargetId, SyncableTargetBehavior>;

export const behaviorForTarget = (targetId: SyncablePublicTargetId): SyncableTargetBehavior =>
  SYNCABLE_TARGET_BEHAVIORS[targetId];

export const hasRequiredAudienceMetrics = (
  targetId: PublicRichSyncTargetId,
  entry: PublicCacheEntry | undefined,
): boolean => {
  if (!entry) {
    return false;
  }

  const hasFollowers =
    hasDefinedAudienceMetric(entry.metadata.followersCount) ||
    hasDefinedAudienceMetric(entry.metadata.followersCountRaw);

  if (targetId === "facebook-page-metrics") {
    return hasFollowers;
  }

  if (behaviorForTarget(targetId).requiresMembersCount) {
    return (
      hasDefinedAudienceMetric(entry.metadata.membersCount) ||
      hasDefinedAudienceMetric(entry.metadata.membersCountRaw)
    );
  }

  if (behaviorForTarget(targetId).requiresSubscribersCount) {
    return (
      hasDefinedAudienceMetric(entry.metadata.subscribersCount) ||
      hasDefinedAudienceMetric(entry.metadata.subscribersCountRaw)
    );
  }

  if (!behaviorForTarget(targetId).requiresFollowingCount) {
    return hasFollowers;
  }

  const hasFollowing =
    hasDefinedAudienceMetric(entry.metadata.followingCount) ||
    hasDefinedAudienceMetric(entry.metadata.followingCountRaw);
  const hasProfileDescription =
    !behaviorForTarget(targetId).requiresProfileDescription ||
    hasDefinedAudienceMetric(entry.metadata.profileDescription);

  return hasFollowers && hasFollowing && hasProfileDescription;
};

export const skipReasonForTarget = (targetId: PublicRichSyncTargetId): string =>
  targetId === "facebook-page-metrics"
    ? "followers_present"
    : behaviorForTarget(targetId).requiresMembersCount
      ? "members_present"
      : behaviorForTarget(targetId).requiresSubscribersCount
        ? "subscribers_present"
        : behaviorForTarget(targetId).requiresProfileDescription
          ? "profile_metadata_present"
          : behaviorForTarget(targetId).requiresFollowingCount
            ? "audience_present"
            : "followers_present";

export const skipMessageForTarget = (targetId: PublicRichSyncTargetId): string =>
  targetId === "facebook-page-metrics"
    ? "followers already present"
    : behaviorForTarget(targetId).requiresMembersCount
      ? "members already present"
      : behaviorForTarget(targetId).requiresSubscribersCount
        ? "subscribers already present"
        : behaviorForTarget(targetId).requiresProfileDescription
          ? "followers, following, and profile description already present"
          : behaviorForTarget(targetId).requiresFollowingCount
            ? "followers and following already present"
            : "followers already present";

export const missingMetricsReasonForTarget = (targetId: SyncablePublicTargetId): string =>
  behaviorForTarget(targetId).requiresMembersCount
    ? "members_missing"
    : behaviorForTarget(targetId).requiresSubscribersCount
      ? "subscribers_missing"
      : behaviorForTarget(targetId).requiresProfileDescription
        ? "profile_metadata_missing"
        : behaviorForTarget(targetId).requiresFollowingCount
          ? "audience_missing"
          : "followers_missing";

export const captureSummaryForTarget = (
  targetId: SyncablePublicTargetId,
  metrics: PublicBrowserAudienceMetrics,
): string =>
  behaviorForTarget(targetId).requiresMembersCount
    ? (metrics.membersCountRaw ?? "members missing")
    : behaviorForTarget(targetId).requiresSubscribersCount
      ? (metrics.subscribersCountRaw ?? "subscribers missing")
      : !behaviorForTarget(targetId).requiresFollowingCount
        ? (metrics.followersCountRaw ?? "followers missing")
        : behaviorForTarget(targetId).requiresProfileDescription
          ? `${metrics.followingCountRaw ?? "following missing"} / ${
              metrics.followersCountRaw ?? "followers missing"
            } / ${
              metrics.profileDescription
                ? "profile description captured"
                : "profile description missing"
            }`
          : `${metrics.followingCountRaw ?? "following missing"} / ${
              metrics.followersCountRaw ?? "followers missing"
            }`;

export const cloneEntry = (entry: PublicCacheEntry): PublicCacheEntry => ({
  ...entry,
  metadata: {
    ...entry.metadata,
  },
});

export const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export interface PublicRichSyncFailureClassification {
  reason: string;
  detail: string;
  fatal: boolean;
}

export const fatalPlaceholderSignalsForTarget = (
  targetId: SyncablePublicTargetId,
  metrics: PublicBrowserAudienceMetrics,
): string[] => {
  const fatalSignals = behaviorForTarget(targetId).fatalPlaceholderSignals;
  return metrics.placeholderSignals.filter((signal) => fatalSignals.includes(signal));
};

export const isFatalSourceFailureDetail = (
  targetId: SyncablePublicTargetId,
  detail: string,
): boolean => {
  const normalized = detail.toLowerCase();
  if (/\bhttp\s+404\b|\b404\s+not found\b/u.test(normalized)) {
    return true;
  }

  switch (targetId) {
    case "instagram-public-profile":
      return /not_found|sorry, this page isn't available|user not found/u.test(normalized);
    case "primal-public-profile":
      return /profile not found|user not found|page not found|profile_missing/u.test(normalized);
    case "x-public-oembed":
    case "x-public-community":
      return /account_missing|account_suspended|oembed_unavailable|this account doesn['’]?t exist|account suspended/u.test(
        normalized,
      );
    case "youtube-public-profile":
      return /unavailable_page|this channel does not exist|account has been terminated|channel not found/u.test(
        normalized,
      );
    case "substack-public-profile":
      return false;
    case "medium-public-feed":
      return false;
  }
};

export const classifyCaptureFailure = (
  targetId: SyncablePublicTargetId,
  capture: PublicBrowserAudienceCaptureResult,
): PublicRichSyncFailureClassification => {
  const fatalSignals = fatalPlaceholderSignalsForTarget(targetId, capture.metrics);
  if (fatalSignals.length > 0) {
    return {
      reason: "profile_unavailable",
      detail: `${behaviorForTarget(targetId).label} public browser capture saw fatal profile-unavailable placeholder content: ${fatalSignals.join(
        ", ",
      )}.`,
      fatal: true,
    };
  }

  return {
    reason: missingMetricsReasonForTarget(targetId),
    detail: capture.error ?? captureSummaryForTarget(targetId, capture.metrics),
    fatal: false,
  };
};

export const classifySyncError = (
  targetId: SyncablePublicTargetId,
  detail: string,
): PublicRichSyncFailureClassification => {
  if (isFatalSourceFailureDetail(targetId, detail)) {
    return {
      reason: "profile_unavailable",
      detail,
      fatal: true,
    };
  }

  return {
    reason: "sync_error",
    detail,
    fatal: false,
  };
};

export const extractEvalResult = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  if (
    "result" in value &&
    typeof value.result === "object" &&
    value.result !== null &&
    !Array.isArray(value.result)
  ) {
    return value.result as Record<string, unknown>;
  }

  return value as Record<string, unknown>;
};
