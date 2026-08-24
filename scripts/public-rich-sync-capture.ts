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
  type BootstrapBaseEntryInput,
  type CapturePublicAudienceMetricsInput,
  CliArgs,
  FACEBOOK_PAGE_ACCESS_TOKEN_ENV,
  FacebookPageMetricsResult,
  FacebookPageMetricsTarget,
  FetchFacebookPageMetricsInput,
  type FetchFallbackAudienceMetricsInput,
  InstagramPublicTarget,
  LinkInput,
  LinksPayload,
  MediumPublicTarget,
  PrimalPublicTarget,
  type PublicAudienceFallbackResult,
  type PublicBrowserAudienceCaptureResult,
  type PublicBrowserAudienceMetrics,
  type PublicBrowserAudienceSnapshot,
  PublicRichSyncDependencies,
  PublicRichSyncResult,
  PublicRichSyncRunEntry,
  PublicRichSyncSummary,
  PublicRichSyncTarget,
  PublicRichSyncTargetId,
  RichLinkInput,
  SubstackPublicTarget,
  SyncablePublicTarget,
  type SyncablePublicTargetId,
  XCommunityPublicTarget,
  XProfilePublicTarget,
  YoutubePublicTarget,
} from "./public-rich-sync-contracts";
import {
  PublicRichSyncFailureClassification,
  SYNCABLE_TARGET_BEHAVIORS,
  SyncableTargetBehavior,
  appendHttpUrl,
  appendSubstackHandleUrl,
  behaviorForTarget,
  captureSummaryForTarget,
  classifyCaptureFailure,
  classifySyncError,
  cloneEntry,
  extractEvalResult,
  fatalPlaceholderSignalsForTarget,
  hasBaseProfileMetadata,
  hasDefinedAudienceMetric,
  hasRequiredAudienceMetrics,
  isFatalSourceFailureDetail,
  isInstagramPublicTarget,
  isMediumPublicTarget,
  isPrimalPublicTarget,
  isSubstackPublicTarget,
  isSyncablePublicTarget,
  isXCommunityPublicTarget,
  isXProfilePublicTarget,
  missingMetricsReasonForTarget,
  resolveInstagramPublicHtmlFallbackUrls,
  resolveSubstackPublicHtmlFallbackUrls,
  skipMessageForTarget,
  skipReasonForTarget,
  toErrorMessage,
} from "./public-rich-sync-providers";
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

export const buildPublicProfileConfig = (
  linkId: string,
  headed: boolean,
): PublicBrowserProfileConfig => ({
  profilePath: toAbsolutePublicRichOutputPath("profiles", linkId),
  headed,
  userAgent: PUBLIC_BROWSER_USER_AGENT,
  browserArgs: [...PUBLIC_BROWSER_ARGS],
});

export const bootstrapPublicBaseEntry = async (
  input: BootstrapBaseEntryInput,
): Promise<PublicCacheEntry> => {
  const fetched = await fetchMetadata(input.target.sourceUrl, {
    timeoutMs: DEFAULT_FETCH_TIMEOUT_MS,
    retries: DEFAULT_FETCH_RETRIES,
    acceptHeader: input.target.acceptHeader,
    headers: input.target.headers,
    policyRegistry: input.remoteCachePolicyRegistry,
    statsCollector: input.remoteCacheStats,
    cache: input.existingEntry
      ? {
          etag: input.existingEntry.etag,
          lastModified: input.existingEntry.lastModified,
          cacheControl: input.existingEntry.cacheControl,
          expiresAt: input.existingEntry.expiresAt,
          hasValue: true,
        }
      : undefined,
  });

  if (!fetched.ok || !fetched.html) {
    throw new Error(
      `Unable to fetch public augmentation source '${input.target.sourceUrl}'. ${
        fetched.error ?? `HTTP ${fetched.statusCode ?? "unknown"}`
      }`,
    );
  }

  const parsed = input.target.parse(fetched.html);
  const supportedProfile = resolveSupportedSocialProfile({
    url: input.link.url,
    icon: input.link.icon,
    metadataHandle: input.link.metadata?.handle,
    profileSemantics: input.link.enrichment?.profileSemantics,
  });
  const augmentedMetadata = augmentSupportedSocialProfileMetadata({
    html: fetched.html,
    metadata: parsed.metadata,
    supportedProfile,
  });
  const mergedMetadata = mergePublicCacheMetadataForTarget({
    targetId: input.target.id,
    previous: input.existingEntry?.metadata,
    next: toPublicCacheMetadata(augmentedMetadata),
  });

  return {
    linkId: input.link.id,
    sourceUrl: input.target.sourceUrl,
    capturedAt: input.generatedAt,
    updatedAt: input.generatedAt,
    metadata: mergedMetadata,
    etag: fetched.etag,
    lastModified: fetched.lastModified,
    cacheControl: fetched.cacheControl,
    expiresAt: computePublicCacheExpiresAt(fetched.cacheControl, fetched.responseDate),
    checkedAt: input.generatedAt,
    checkStatus: fetched.checkStatus,
  };
};

export const fetchPublicAudienceMetricsFallback = async (
  input: FetchFallbackAudienceMetricsInput,
): Promise<PublicAudienceFallbackResult | null> => {
  const sourceUrls = publicHtmlFallbackUrlsForTarget(input);
  if (!sourceUrls) {
    return null;
  }

  const failures: string[] = [];

  for (const sourceUrl of sourceUrls) {
    try {
      const fetched = await fetchMetadata(sourceUrl, {
        timeoutMs: DEFAULT_FETCH_TIMEOUT_MS,
        retries: DEFAULT_FETCH_RETRIES,
        acceptHeader: input.target.acceptHeader,
        headers: input.target.headers,
        policyRegistry: input.remoteCachePolicyRegistry,
        statsCollector: input.remoteCacheStats,
        force: true,
      });

      if (!fetched.ok || !fetched.html) {
        failures.push(
          `${sourceUrl}: ${
            fetched.error ??
            `Unable to fetch public audience fallback source. HTTP ${fetched.statusCode ?? "unknown"}`
          }`,
        );
        continue;
      }

      const parsed = input.target.parse(fetched.html);
      const metadata = toPublicCacheMetadata(parsed.metadata);
      const metrics = toPublicHtmlFallbackAudienceMetrics(input.target.id, metadata);
      if (!metrics) {
        failures.push(`${sourceUrl}: ${input.target.id} does not support public HTML fallback.`);
        continue;
      }

      const maybeError = buildAudienceCaptureError(input.target.id, metrics);

      if (maybeError) {
        failures.push(`${sourceUrl}: ${maybeError}`);
        continue;
      }

      return {
        ok: true,
        source: "public-html",
        metrics,
        ...(input.target.id === "instagram-public-profile" ? { metadata } : {}),
      };
    } catch (error: unknown) {
      failures.push(`${sourceUrl}: ${toErrorMessage(error)}`);
    }
  }

  return {
    ok: false,
    source: "public-html",
    metrics: { placeholderSignals: [] },
    detail:
      failures.length > 0 ? failures.join("; ") : "No public HTML fallback source was available.",
  };
};

export const publicHtmlFallbackUrlsForTarget = (
  input: FetchFallbackAudienceMetricsInput,
): string[] | null => {
  if (input.target.id === "instagram-public-profile") {
    return resolveInstagramPublicHtmlFallbackUrls({
      targetSourceUrl: input.target.sourceUrl,
      linkUrl: input.link.url,
    });
  }

  if (input.target.id === "substack-public-profile") {
    return resolveSubstackPublicHtmlFallbackUrls({
      targetSourceUrl: input.target.sourceUrl,
      linkUrl: input.link.url,
      icon: input.link.icon,
      metadataHandle: input.link.metadata?.handle,
      profileSemantics: input.link.enrichment?.profileSemantics,
    });
  }

  return null;
};

export const toPublicHtmlFallbackAudienceMetrics = (
  targetId: string,
  metadata: PublicCacheMetadata,
): PublicBrowserAudienceMetrics | null => {
  if (targetId === "instagram-public-profile") {
    return {
      placeholderSignals: [],
      followersCount: metadata.followersCount,
      followersCountRaw: metadata.followersCountRaw,
      followingCount: metadata.followingCount,
      followingCountRaw: metadata.followingCountRaw,
    };
  }

  if (targetId === "substack-public-profile") {
    return {
      placeholderSignals: [],
      subscribersCount: metadata.subscribersCount,
      subscribersCountRaw: metadata.subscribersCountRaw,
    };
  }

  return null;
};

export const extractMetricTexts = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const metricTexts = value
    .map((entry) => safeTrim(entry))
    .filter((entry): entry is string => Boolean(entry));

  return metricTexts.length > 0 ? metricTexts : undefined;
};

export const toAudienceSnapshot = (
  payload: Record<string, unknown> | null,
): PublicAudienceBrowserSnapshot | undefined => {
  if (!payload) {
    return undefined;
  }

  return {
    currentUrl: safeTrim(payload.currentUrl),
    title: safeTrim(payload.title),
    bodyText: safeTrim(payload.bodyText),
    metricTexts: extractMetricTexts(payload.metricTexts),
    profileDescription: safeTrim(payload.profileDescription),
  };
};

export const metricsSnippetForTarget = (targetId: SyncablePublicTargetId): string =>
  behaviorForTarget(targetId).snippet;

export const snapshotFromPayload = (
  payload: Record<string, unknown> | null,
): PublicBrowserAudienceSnapshot | undefined => toAudienceSnapshot(payload);

export const parseAudienceMetricsForTarget = (
  targetId: SyncablePublicTargetId,
  snapshot: PublicBrowserAudienceSnapshot | undefined,
): PublicBrowserAudienceMetrics => behaviorForTarget(targetId).parseMetrics(snapshot ?? {});

export const buildAudienceCaptureError = (
  targetId: SyncablePublicTargetId,
  metrics: PublicBrowserAudienceMetrics,
): string | undefined => {
  if (metrics.placeholderSignals.length > 0) {
    return `${behaviorForTarget(targetId).label} public browser capture saw placeholder content: ${metrics.placeholderSignals.join(
      ", ",
    )}.`;
  }

  if (behaviorForTarget(targetId).requiresMembersCount) {
    return metrics.membersCountRaw
      ? undefined
      : `${behaviorForTarget(targetId).label} public browser capture did not find a member count.`;
  }

  if (behaviorForTarget(targetId).requiresSubscribersCount) {
    return metrics.subscribersCountRaw
      ? undefined
      : `${behaviorForTarget(targetId).label} public browser capture did not find a subscriber count.`;
  }

  if (!behaviorForTarget(targetId).requiresFollowingCount) {
    return metrics.followersCountRaw
      ? undefined
      : `${behaviorForTarget(targetId).label} public browser capture did not find a follower count.`;
  }

  if (!metrics.followersCountRaw && !metrics.followingCountRaw) {
    return `${behaviorForTarget(targetId).label} public browser capture did not find follower or following counts.`;
  }

  if (!metrics.followersCountRaw) {
    return `${behaviorForTarget(targetId).label} public browser capture did not find a follower count.`;
  }

  if (!metrics.followingCountRaw) {
    return `${behaviorForTarget(targetId).label} public browser capture did not find a following count.`;
  }

  if (
    behaviorForTarget(targetId).requiresProfileDescription &&
    !metrics.profileDescription?.trim().length
  ) {
    return `${behaviorForTarget(targetId).label} public browser capture did not find a profile description.`;
  }

  return undefined;
};

export const browserCaptureUrlForTarget = (input: CapturePublicAudienceMetricsInput): string =>
  input.target.id === "substack-public-profile" ? input.target.sourceUrl : input.link.url;

export const capturePublicAudienceMetricsFromBrowser = async (
  input: CapturePublicAudienceMetricsInput,
): Promise<PublicBrowserAudienceCaptureResult> => {
  const config = buildPublicProfileConfig(input.link.id, input.headed);
  const browserCaptureUrl = browserCaptureUrlForTarget(input);
  fs.mkdirSync(config.profilePath, { recursive: true });

  const artifactRelativePath = path.join(
    PUBLIC_RICH_SYNC_OUTPUT_DIRECTORY,
    `${input.link.id}-${fileTimestamp()}.json`,
  );
  const artifactAbsolutePath = absolutePath(artifactRelativePath);
  let snapshot: PublicBrowserAudienceSnapshot | undefined;
  let error: string | undefined;

  try {
    runPublicBrowserJson(["open", browserCaptureUrl], config, {
      allowFailure: true,
    });
    runPublicBrowserJson(["wait", "1500"], config, {
      allowFailure: true,
    });
    runPublicBrowserJson(["wait", String(input.browserWaitMs)], config, {
      allowFailure: true,
    });

    const evalResult = runPublicBrowserJson<unknown>(
      [
        "eval",
        "--base64",
        Buffer.from(metricsSnippetForTarget(input.target.id), "utf8").toString("base64"),
      ],
      config,
      {
        allowFailure: false,
      },
    );
    const payload = extractEvalResult(evalResult.response?.data);
    snapshot = snapshotFromPayload(payload);
  } catch (captureError: unknown) {
    error = captureError instanceof Error ? captureError.message : String(captureError);
  } finally {
    runPublicBrowserJson(["close"], config, {
      allowFailure: true,
    });
  }

  const metrics = parseAudienceMetricsForTarget(input.target.id, snapshot);
  if (!error) {
    error = buildAudienceCaptureError(input.target.id, metrics);
  }

  writeJsonArtifact(artifactAbsolutePath, {
    timestamp: input.generatedAt,
    linkId: input.link.id,
    targetId: input.target.id,
    targetUrl: browserCaptureUrl,
    headed: input.headed,
    browserWaitMs: input.browserWaitMs,
    profilePath: path.relative(ROOT, config.profilePath),
    snapshot: snapshot ?? null,
    metrics,
    ok: !error,
    error: error ?? null,
  });

  return {
    ok: !error,
    artifactPath: artifactRelativePath,
    metrics,
    snapshot,
    error,
  };
};
