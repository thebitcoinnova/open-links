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
  type PublicRichSyncCandidate,
  PublicRichSyncCandidateAttemptInput,
  type PublicRichSyncCandidateAttemptResult,
  buildPublicRichSyncRunSummary,
  defaultDependencies,
  facebookMetricsDetail,
  runFacebookPageMetricsSyncCandidateAttempt,
  runPublicRichSyncCandidateAttempt,
  shouldPublicRichSyncExitWithFailure,
  withAttemptCount,
  writePublicRichSyncRunSummary,
} from "./public-rich-sync-candidates";
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
  FacebookPageMetricsResult,
  FacebookPageMetricsTarget,
  FetchFacebookPageMetricsInput,
  FetchFallbackAudienceMetricsInput,
  InstagramPublicTarget,
  LinkInput,
  LinksPayload,
  MediumPublicTarget,
  PrimalPublicTarget,
  PublicAudienceFallbackResult,
  PublicBrowserAudienceCaptureResult,
  PublicBrowserAudienceMetrics,
  PublicBrowserAudienceSnapshot,
  type PublicRichSyncDependencies,
  type PublicRichSyncResult,
  type PublicRichSyncRunEntry,
  PublicRichSyncSummary,
  type PublicRichSyncTarget,
  PublicRichSyncTargetId,
  RichLinkInput,
  SubstackPublicTarget,
  SyncablePublicTarget,
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

export const runPublicRichSyncWithDependencies = async (
  args: CliArgs,
  dependencies: PublicRichSyncDependencies,
): Promise<PublicRichSyncResult> => {
  const remoteCachePolicyRegistry = loadRemoteCachePolicyRegistry();
  const remoteCacheStats = new RemoteCacheStatsCollector("public-rich-sync");
  const linksPayload = dependencies.readLinks(args.linksPath);
  const registry = dependencies.loadPublicCache(args.publicCachePath);
  const entries: PublicRichSyncRunEntry[] = [];
  let dirty = false;
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let fatalFailed = 0;
  const captureRetries = Math.max(0, args.captureRetries ?? DEFAULT_CAPTURE_RETRIES);
  const captureRetryDelayMs = Math.max(
    0,
    args.captureRetryDelayMs ?? DEFAULT_CAPTURE_RETRY_DELAY_MS,
  );
  const attemptsAllowed = captureRetries + 1;
  const sleepForRetry = dependencies.sleep ?? sleep;

  const candidates = linksPayload.links
    .filter(isRichLink)
    .filter((link) => !args.onlyLink || link.id === args.onlyLink)
    .flatMap((link): PublicRichSyncCandidate[] => {
      const maybePublicAugmentationTarget = resolvePublicAugmentationTarget({
        url: link.url,
        icon: link.icon,
        metadataHandle: link.metadata?.handle,
      });
      const targets: PublicRichSyncTarget[] = [];
      if (isSyncablePublicTarget(maybePublicAugmentationTarget)) {
        targets.push(maybePublicAugmentationTarget);
      }

      const maybeFacebookPageMetricsTarget = resolveFacebookPageMetricsTarget(link);
      if (maybeFacebookPageMetricsTarget) {
        targets.push(maybeFacebookPageMetricsTarget);
      }

      return targets.map((target) => ({ link, target }));
    });

  if (candidates.length === 0) {
    dependencies.log("No supported public audience sync links matched the sync filters.");
    return {
      dirty: false,
      processed,
      skipped,
      failed,
      fatalFailed,
      entries,
      registry,
    };
  }

  for (const candidate of candidates) {
    const originalExistingEntry = registry.entries[candidate.link.id];
    let finalResult: PublicRichSyncCandidateAttemptResult | undefined;
    let finalAttempt = 1;

    for (let attempt = 1; attempt <= attemptsAllowed; attempt += 1) {
      finalAttempt = attempt;
      finalResult = await runPublicRichSyncCandidateAttempt({
        args,
        candidate,
        originalExistingEntry,
        registry,
        remoteCachePolicyRegistry,
        remoteCacheStats,
        dependencies,
      });
      dirty = dirty || finalResult.dirty;

      if (!finalResult.retryableFailure || attempt >= attemptsAllowed) {
        break;
      }

      const detail = finalResult.entry.detail ?? finalResult.entry.reason;
      dependencies.log(
        `[public:rich:sync] retry ${candidate.link.id}: attempt ${attempt}/${attemptsAllowed} failed with ${detail}; waiting ${captureRetryDelayMs}ms before retry.`,
      );
      if (captureRetryDelayMs > 0) {
        await sleepForRetry(captureRetryDelayMs);
      }
    }

    if (!finalResult) {
      throw new Error(`Internal error: no public sync result for '${candidate.link.id}'.`);
    }

    const entry = withAttemptCount(finalResult.entry, finalAttempt);
    if (finalResult.processed) {
      processed += 1;
    }

    if (entry.status === "skipped") {
      skipped += 1;
      entries.push(entry);
      if (entry.reason === "counts_unchanged") {
        const attemptSummary = entry.attempts ? ` after ${entry.attempts} attempts` : "";
        dependencies.log(
          `[public:rich:sync] fresh unchanged observation ${candidate.link.id}: captured audience metrics matched the committed cache${attemptSummary}.`,
        );
      } else {
        dependencies.log(
          `[public:rich:sync] skip ${candidate.link.id}: ${skipMessageForTarget(candidate.target.id)}.`,
        );
      }
      continue;
    }

    if (entry.status === "failed") {
      failed += 1;
      if (entry.fatal === true) {
        fatalFailed += 1;
      }
      entries.push(entry);
      const artifact = entry.artifactPath ? ` (${entry.artifactPath})` : "";
      const attemptSummary = entry.attempts ? ` after ${entry.attempts} attempts` : "";
      dependencies.log(
        `[public:rich:sync] fail ${candidate.link.id}: ${entry.detail ?? entry.reason}; excluded from this run's follower history snapshots${attemptSummary}.${artifact}`,
      );
      continue;
    }

    entries.push(entry);
    const attemptSummary = entry.attempts ? ` after ${entry.attempts} attempts` : "";
    const artifactSummary = entry.artifactPath ? ` (${entry.artifactPath})` : "";
    dependencies.log(
      `[public:rich:sync] fresh public observation ${candidate.link.id}${attemptSummary}.${artifactSummary}`,
    );
  }

  if (dirty) {
    dependencies.writePublicCache(args.publicCachePath, registry);
  }

  const remoteCacheStatsPath = createRemoteCacheStatsOutputPath("public-rich-sync");
  writeRemoteCacheRunSummary(remoteCacheStatsPath, remoteCacheStats);
  dependencies.log(`[public:rich:sync] remote cache stats -> ${remoteCacheStatsPath}`);

  return {
    dirty,
    processed,
    skipped,
    failed,
    fatalFailed,
    entries,
    registry,
  };
};
