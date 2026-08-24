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
import type { loadRemoteCachePolicyRegistry } from "./shared/remote-cache-policy";
import {
  type RemoteCacheStatsCollector,
  createRemoteCacheStatsOutputPath,
  writeRemoteCacheRunSummary,
} from "./shared/remote-cache-stats";

import {
  bootstrapPublicBaseEntry,
  browserCaptureUrlForTarget,
  buildAudienceCaptureError,
  capturePublicAudienceMetricsFromBrowser,
  extractMetricTexts,
  fetchPublicAudienceMetricsFallback,
  metricsSnippetForTarget,
  parseAudienceMetricsForTarget,
  publicHtmlFallbackUrlsForTarget,
  snapshotFromPayload,
  toAudienceSnapshot,
  toPublicHtmlFallbackAudienceMetrics,
} from "./public-rich-sync-capture";
import { buildPublicProfileConfig } from "./public-rich-sync-capture";
import {
  BootstrapBaseEntryInput,
  CapturePublicAudienceMetricsInput,
  type CliArgs,
  FACEBOOK_PAGE_ACCESS_TOKEN_ENV,
  type FacebookPageMetricsResult,
  type FacebookPageMetricsTarget,
  FetchFacebookPageMetricsInput,
  FetchFallbackAudienceMetricsInput,
  InstagramPublicTarget,
  LinkInput,
  type LinksPayload,
  MediumPublicTarget,
  PrimalPublicTarget,
  PublicAudienceFallbackResult,
  type PublicBrowserAudienceCaptureResult,
  PublicBrowserAudienceMetrics,
  PublicBrowserAudienceSnapshot,
  type PublicRichSyncDependencies,
  type PublicRichSyncResult,
  type PublicRichSyncRunEntry,
  type PublicRichSyncSummary,
  type PublicRichSyncTarget,
  PublicRichSyncTargetId,
  type RichLinkInput,
  SubstackPublicTarget,
  type SyncablePublicTarget,
  SyncablePublicTargetId,
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

export const defaultDependencies: PublicRichSyncDependencies = {
  readLinks: (linksPath) => readJson<LinksPayload>(linksPath),
  loadPublicCache: (publicCachePath) => loadPublicCacheRegistry({ cachePath: publicCachePath }),
  writePublicCache: (publicCachePath, registry) =>
    writePublicCacheRegistry(publicCachePath, registry),
  fetchFacebookPageMetrics,
  bootstrapBaseEntry: bootstrapPublicBaseEntry,
  captureAudienceMetrics: capturePublicAudienceMetricsFromBrowser,
  fetchFallbackAudienceMetrics: fetchPublicAudienceMetricsFallback,
  nowIso,
  log: (message) => console.log(message),
  sleep,
};

export const buildPublicRichSyncRunSummary = (
  result: Pick<
    PublicRichSyncResult,
    "dirty" | "processed" | "skipped" | "failed" | "fatalFailed" | "entries"
  >,
): PublicRichSyncSummary => ({
  dirty: result.dirty,
  processed: result.processed,
  skipped: result.skipped,
  failed: result.failed,
  fatalFailed: result.fatalFailed,
  entries: result.entries.map((entry) => ({ ...entry })),
});

export const writePublicRichSyncRunSummary = (
  summaryPath: string,
  summary: PublicRichSyncSummary,
): void => {
  writeJsonArtifact(absolutePath(summaryPath), summary);
};

export const shouldPublicRichSyncExitWithFailure = (
  result: Pick<PublicRichSyncResult, "failed"> & { fatalFailed?: number },
  allowFailures: boolean,
  deferFailures = false,
): boolean =>
  !deferFailures && ((result.fatalFailed ?? 0) > 0 || (result.failed > 0 && !allowFailures));

export interface PublicRichSyncCandidate {
  link: RichLinkInput;
  target: PublicRichSyncTarget;
}

export interface PublicRichSyncCandidateAttemptInput {
  args: CliArgs;
  candidate: PublicRichSyncCandidate;
  originalExistingEntry?: PublicCacheEntry;
  registry: PublicCacheRegistry;
  remoteCachePolicyRegistry: ReturnType<typeof loadRemoteCachePolicyRegistry>;
  remoteCacheStats: RemoteCacheStatsCollector;
  dependencies: PublicRichSyncDependencies;
}

export interface PublicRichSyncCandidateAttemptResult {
  dirty: boolean;
  processed: boolean;
  retryableFailure: boolean;
  entry: PublicRichSyncRunEntry;
}

export const withAttemptCount = (
  entry: PublicRichSyncRunEntry,
  attempts: number,
): PublicRichSyncRunEntry => (attempts > 1 ? { ...entry, attempts } : entry);

export const facebookMetricsDetail = (metrics: FacebookPageMetricsResult): string =>
  [
    `followers_count=${metrics.followersCount}`,
    metrics.fanCount === undefined ? undefined : `fan_count=${metrics.fanCount}`,
    metrics.pageName ? `page=${metrics.pageName}` : undefined,
  ]
    .filter((value): value is string => Boolean(value))
    .join("; ");

export const runFacebookPageMetricsSyncCandidateAttempt = async (
  input: PublicRichSyncCandidateAttemptInput & {
    candidate: {
      link: RichLinkInput;
      target: FacebookPageMetricsTarget;
    };
  },
): Promise<PublicRichSyncCandidateAttemptResult> => {
  const { args, candidate, dependencies, registry } = input;
  const generatedAt = dependencies.nowIso();
  const existingEntry = registry.entries[candidate.link.id];

  if (
    args.onlyMissing &&
    !args.force &&
    hasRequiredAudienceMetrics(candidate.target.id, existingEntry)
  ) {
    return {
      dirty: false,
      processed: false,
      retryableFailure: false,
      entry: {
        linkId: candidate.link.id,
        status: "skipped",
        reason: skipReasonForTarget(candidate.target.id),
      },
    };
  }

  try {
    const metrics = await (dependencies.fetchFacebookPageMetrics ?? fetchFacebookPageMetrics)({
      target: candidate.target,
    });
    const nextMetadata: PublicCacheMetadata = {
      ...(existingEntry?.metadata ?? {}),
      followersCount: metrics.followersCount,
      followersCountRaw: metrics.followersCountRaw,
      sourceLabel: existingEntry?.metadata.sourceLabel ?? "facebook.com",
    };
    const stabilizedEntry = buildPublicCacheEntry({
      previous: existingEntry,
      linkId: candidate.link.id,
      sourceUrl: metrics.sourceUrl,
      metadata: nextMetadata,
      updatedAt: generatedAt,
    });

    if (arePublicCacheEntriesEqual(existingEntry, stabilizedEntry)) {
      return {
        dirty: false,
        processed: true,
        retryableFailure: false,
        entry: {
          linkId: candidate.link.id,
          status: "skipped",
          reason: "counts_unchanged",
          detail: facebookMetricsDetail(metrics),
        },
      };
    }

    registry.entries[candidate.link.id] = stabilizedEntry;
    registry.updatedAt = generatedAt;
    return {
      dirty: true,
      processed: true,
      retryableFailure: false,
      entry: {
        linkId: candidate.link.id,
        status: "synced",
        reason: input.originalExistingEntry ? "counts_refreshed" : "bootstrapped_and_refreshed",
        detail: facebookMetricsDetail(metrics),
      },
    };
  } catch (error: unknown) {
    return {
      dirty: false,
      processed: true,
      retryableFailure: false,
      entry: {
        linkId: candidate.link.id,
        status: "failed",
        reason: toErrorMessage(error).includes(FACEBOOK_PAGE_ACCESS_TOKEN_ENV)
          ? "token_missing"
          : "facebook_graph_error",
        detail: toErrorMessage(error),
        fatal: true,
      },
    };
  }
};

const captureCandidateAudience = async (
  input: PublicRichSyncCandidateAttemptInput,
  workingEntry: PublicCacheEntry | undefined,
  generatedAt: string,
) => {
  const { args, candidate, dependencies, remoteCachePolicyRegistry, remoteCacheStats } = input;
  const target = candidate.target as SyncablePublicTarget;
  let nextWorkingEntry = workingEntry;
  let capture = await dependencies.captureAudienceMetrics({
    link: candidate.link,
    target,
    headed: args.headed,
    browserWaitMs: args.browserWaitMs,
    generatedAt,
  });
  let fallbackMetadataApplied = false;
  if (capture.ok) return { capture, fallbackMetadataApplied, workingEntry: nextWorkingEntry };

  const fallback = await dependencies.fetchFallbackAudienceMetrics?.({
    link: candidate.link,
    target,
    existingEntry: nextWorkingEntry,
    failedCapture: capture,
    generatedAt,
    remoteCachePolicyRegistry,
    remoteCacheStats,
  });
  if (fallback?.ok) {
    if (target.id === "instagram-public-profile" && fallback.metadata && nextWorkingEntry) {
      nextWorkingEntry = {
        ...nextWorkingEntry,
        metadata: mergePublicCacheMetadataForTarget({
          targetId: target.id,
          previous: nextWorkingEntry.metadata,
          next: fallback.metadata,
        }),
      };
      fallbackMetadataApplied = true;
    }
    capture = { ...capture, ok: true, metrics: fallback.metrics, error: undefined };
    dependencies.log(
      `[public:rich:sync] recovered ${candidate.link.id}: ${captureSummaryForTarget(target.id, fallback.metrics)} via ${fallback.source} fallback after browser capture missed audience metrics.`,
    );
  } else if (fallback) {
    capture = {
      ...capture,
      error: `${capture.error ?? captureSummaryForTarget(target.id, capture.metrics)} Fallback ${fallback.source} capture also failed: ${fallback.detail ?? "unknown failure"}`,
    };
  }
  return { capture, fallbackMetadataApplied, workingEntry: nextWorkingEntry };
};

const persistCandidateAudience = (input: {
  attempt: PublicRichSyncCandidateAttemptInput;
  capture: PublicBrowserAudienceCaptureResult;
  fallbackMetadataApplied: boolean;
  generatedAt: string;
  sourceMatchedEntry: PublicCacheEntry | undefined;
  workingEntry: PublicCacheEntry;
}): PublicRichSyncCandidateAttemptResult => {
  const {
    attempt,
    capture,
    fallbackMetadataApplied,
    generatedAt,
    sourceMatchedEntry,
    workingEntry,
  } = input;
  const { candidate, registry } = attempt;
  const nextEntry = cloneEntry(workingEntry);
  Object.assign(nextEntry.metadata, {
    followersCount: capture.metrics.followersCount,
    followersCountRaw: capture.metrics.followersCountRaw,
    ...(capture.metrics.membersCount !== undefined
      ? { membersCount: capture.metrics.membersCount }
      : {}),
    ...(capture.metrics.membersCountRaw
      ? { membersCountRaw: capture.metrics.membersCountRaw }
      : {}),
    ...(capture.metrics.followingCount !== undefined
      ? { followingCount: capture.metrics.followingCount }
      : {}),
    ...(capture.metrics.followingCountRaw
      ? { followingCountRaw: capture.metrics.followingCountRaw }
      : {}),
    ...(capture.metrics.subscribersCount !== undefined
      ? { subscribersCount: capture.metrics.subscribersCount }
      : {}),
    ...(capture.metrics.subscribersCountRaw
      ? { subscribersCountRaw: capture.metrics.subscribersCountRaw }
      : {}),
    ...(capture.metrics.profileDescription
      ? { profileDescription: capture.metrics.profileDescription }
      : {}),
  });
  nextEntry.metadata = prunePublicCacheMetadataForTarget({
    targetId: candidate.target.id,
    metadata: nextEntry.metadata,
    audienceMetricsAreAuthoritative: !fallbackMetadataApplied,
  });
  const stabilizedEntry = buildPublicCacheEntry({
    previous: workingEntry,
    linkId: candidate.link.id,
    sourceUrl: nextEntry.sourceUrl,
    metadata: nextEntry.metadata,
    updatedAt: generatedAt,
    etag: nextEntry.etag,
    lastModified: nextEntry.lastModified,
    cacheControl: nextEntry.cacheControl,
    expiresAt: nextEntry.expiresAt,
    checkedAt: nextEntry.checkedAt,
  });
  if (arePublicCacheEntriesEqual(workingEntry, stabilizedEntry)) {
    return {
      dirty: false,
      processed: true,
      retryableFailure: false,
      entry: { linkId: candidate.link.id, status: "skipped", reason: "counts_unchanged" },
    };
  }
  registry.entries[candidate.link.id] = stabilizedEntry;
  registry.updatedAt = generatedAt;
  return {
    dirty: true,
    processed: true,
    retryableFailure: false,
    entry: {
      linkId: candidate.link.id,
      status: "synced",
      reason: sourceMatchedEntry ? "counts_refreshed" : "bootstrapped_and_refreshed",
      artifactPath: capture.artifactPath,
    },
  };
};

export const runPublicRichSyncCandidateAttempt = async (
  input: PublicRichSyncCandidateAttemptInput,
): Promise<PublicRichSyncCandidateAttemptResult> => {
  const { args, candidate, dependencies, registry, remoteCachePolicyRegistry, remoteCacheStats } =
    input;
  if (isFacebookPageMetricsTarget(candidate.target)) {
    return runFacebookPageMetricsSyncCandidateAttempt({
      ...input,
      candidate: {
        link: candidate.link,
        target: candidate.target,
      },
    });
  }

  const generatedAt = dependencies.nowIso();
  const existingEntry = registry.entries[candidate.link.id];
  const sourceMatchedEntry =
    resolvePublicCacheEntry(registry, candidate.link.id, candidate.target.sourceUrl)?.entry ??
    undefined;
  const attemptDirty = false;
  let attemptProcessed = false;

  try {
    if (
      args.onlyMissing &&
      !args.force &&
      hasRequiredAudienceMetrics(candidate.target.id, sourceMatchedEntry)
    ) {
      return {
        dirty: false,
        processed: false,
        retryableFailure: false,
        entry: {
          linkId: candidate.link.id,
          status: "skipped",
          reason: skipReasonForTarget(candidate.target.id),
        },
      };
    }

    let workingEntry = sourceMatchedEntry ? cloneEntry(sourceMatchedEntry) : undefined;
    if (!hasBaseProfileMetadata(candidate.target.id, workingEntry)) {
      workingEntry = await dependencies.bootstrapBaseEntry({
        link: candidate.link,
        target: candidate.target,
        existingEntry: workingEntry,
        generatedAt,
        remoteCachePolicyRegistry,
        remoteCacheStats,
      });
      dependencies.log(`[public:rich:sync] bootstrapped base metadata for ${candidate.link.id}.`);
    }

    attemptProcessed = true;
    const audience = await captureCandidateAudience(input, workingEntry, generatedAt);
    const { capture, fallbackMetadataApplied } = audience;
    workingEntry = audience.workingEntry;

    if (!capture.ok) {
      const failure = classifyCaptureFailure(candidate.target.id, capture);
      return {
        dirty: attemptDirty,
        processed: attemptProcessed,
        retryableFailure: !failure.fatal,
        entry: {
          linkId: candidate.link.id,
          status: "failed",
          reason: failure.reason,
          artifactPath: capture.artifactPath,
          detail: failure.detail,
          ...(failure.fatal ? { fatal: true } : {}),
        },
      };
    }

    if (!workingEntry) {
      throw new Error(`Internal error: working entry missing for '${candidate.link.id}'.`);
    }
    return persistCandidateAudience({
      attempt: input,
      capture,
      fallbackMetadataApplied,
      generatedAt,
      sourceMatchedEntry,
      workingEntry,
    });
  } catch (candidateError: unknown) {
    const failure = classifySyncError(candidate.target.id, toErrorMessage(candidateError));
    return {
      dirty: attemptDirty,
      processed: attemptProcessed,
      retryableFailure: !failure.fatal,
      entry: {
        linkId: candidate.link.id,
        status: "failed",
        reason: failure.reason,
        detail: failure.detail,
        ...(failure.fatal ? { fatal: true } : {}),
      },
    };
  }
};
