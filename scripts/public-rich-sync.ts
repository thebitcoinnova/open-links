import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { resolveSupportedSocialProfile } from "../src/lib/content/social-profile-fields";
import { fetchMetadata } from "./enrichment/fetch-metadata";
import { parseMediumPublicProfileMetrics } from "./enrichment/medium-public-browser";
import { parsePrimalPublicProfileMetrics } from "./enrichment/primal-public-browser";
import type {
  PublicAudienceBrowserSnapshot,
  PublicAudienceMetrics,
} from "./enrichment/public-audience-browser";
import {
  PUBLIC_BROWSER_USER_AGENT,
  type PublicAugmentationTarget,
  resolvePublicAugmentationTarget,
} from "./enrichment/public-augmentation";
import {
  PUBLIC_RICH_SYNC_OUTPUT_DIRECTORY,
  type PublicBrowserProfileConfig,
  runPublicBrowserJson,
  toAbsolutePublicRichOutputPath,
} from "./enrichment/public-browser";
import { computePublicCacheExpiresAt } from "./enrichment/public-cache";
import {
  DEFAULT_PUBLIC_CACHE_PATH,
  type PublicCacheEntry,
  type PublicCacheRegistry,
  arePublicCacheEntriesEqual,
  buildPublicCacheEntry,
  loadPublicCacheRegistry,
  mergePublicCacheMetadataForTarget,
  toPublicCacheMetadata,
  writePublicCacheRegistry,
} from "./enrichment/public-cache";
import { augmentSupportedSocialProfileMetadata } from "./enrichment/supported-social-profile-metadata";
import { parseXPublicProfileMetrics } from "./enrichment/x-public-browser";
import { loadEmbeddedCode } from "./shared/embedded-code-loader";
import {
  RemoteCacheStatsCollector,
  createRemoteCacheStatsOutputPath,
  writeRemoteCacheRunSummary,
} from "./shared/remote-cache-fetch";
import { loadRemoteCachePolicyRegistry } from "./shared/remote-cache-policy";

const ROOT = process.cwd();
const DEFAULT_BROWSER_WAIT_MS = 8_000;
const DEFAULT_FETCH_TIMEOUT_MS = 4_000;
const DEFAULT_FETCH_RETRIES = 1;
const PUBLIC_BROWSER_ARGS = ["--disable-blink-features=AutomationControlled"] as const;
const MEDIUM_PUBLIC_PROFILE_METRICS_SNIPPET = loadEmbeddedCode(
  "browser/medium/extract-public-profile-metrics.js",
);
const PRIMAL_PUBLIC_PROFILE_METRICS_SNIPPET = loadEmbeddedCode(
  "browser/primal/extract-public-profile-metrics.js",
);
const X_PUBLIC_PROFILE_METRICS_SNIPPET = loadEmbeddedCode(
  "browser/x/extract-public-profile-metrics.js",
);

interface CliArgs {
  linksPath: string;
  publicCachePath: string;
  onlyLink?: string;
  onlyMissing: boolean;
  force: boolean;
  allowFailures?: boolean;
  headed: boolean;
  browserWaitMs: number;
  summaryJsonPath?: string;
}

interface LinkInput {
  id: string;
  label: string;
  url?: string;
  type: "simple" | "rich" | "payment";
  icon?: string;
  metadata?: Record<string, unknown>;
}

interface LinksPayload {
  links: LinkInput[];
}

interface RichLinkInput extends LinkInput {
  url: string;
  type: "rich";
}

interface MediumPublicTarget extends PublicAugmentationTarget {
  id: "medium-public-feed";
}

interface XProfilePublicTarget extends PublicAugmentationTarget {
  id: "x-public-oembed";
}

interface XCommunityPublicTarget extends PublicAugmentationTarget {
  id: "x-public-community";
}

interface PrimalPublicTarget extends PublicAugmentationTarget {
  id: "primal-public-profile";
}

type SyncablePublicTarget =
  | MediumPublicTarget
  | PrimalPublicTarget
  | XProfilePublicTarget
  | XCommunityPublicTarget;
type SyncablePublicTargetId = SyncablePublicTarget["id"];
type PublicBrowserAudienceSnapshot = PublicAudienceBrowserSnapshot;
export type PublicBrowserAudienceMetrics = PublicAudienceMetrics;

interface BootstrapBaseEntryInput {
  link: RichLinkInput;
  target: SyncablePublicTarget;
  existingEntry?: PublicCacheEntry;
  generatedAt: string;
  remoteCachePolicyRegistry: ReturnType<typeof loadRemoteCachePolicyRegistry>;
  remoteCacheStats: RemoteCacheStatsCollector;
}

export interface PublicBrowserAudienceCaptureResult {
  ok: boolean;
  artifactPath: string;
  metrics: PublicBrowserAudienceMetrics;
  snapshot?: PublicBrowserAudienceSnapshot;
  error?: string;
}

interface CapturePublicAudienceMetricsInput {
  link: RichLinkInput;
  target: SyncablePublicTarget;
  headed: boolean;
  browserWaitMs: number;
  generatedAt: string;
}

export interface PublicRichSyncDependencies {
  readLinks: (linksPath: string) => LinksPayload;
  loadPublicCache: (publicCachePath: string) => PublicCacheRegistry;
  writePublicCache: (publicCachePath: string, registry: PublicCacheRegistry) => void;
  bootstrapBaseEntry: (input: BootstrapBaseEntryInput) => Promise<PublicCacheEntry>;
  captureAudienceMetrics: (
    input: CapturePublicAudienceMetricsInput,
  ) => Promise<PublicBrowserAudienceCaptureResult>;
  nowIso: () => string;
  log: (message: string) => void;
}

export interface PublicRichSyncRunEntry {
  linkId: string;
  status: "synced" | "skipped" | "failed";
  reason: string;
  artifactPath?: string;
  detail?: string;
}

export interface PublicRichSyncResult {
  dirty: boolean;
  processed: number;
  skipped: number;
  failed: number;
  entries: PublicRichSyncRunEntry[];
  registry: PublicCacheRegistry;
}

export interface PublicRichSyncSummary {
  dirty: boolean;
  processed: number;
  skipped: number;
  failed: number;
  entries: PublicRichSyncRunEntry[];
}

const safeTrim = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseInteger = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const absolutePath = (value: string): string =>
  path.isAbsolute(value) ? value : path.join(ROOT, value);

const readJson = <T>(relativePath: string): T =>
  JSON.parse(fs.readFileSync(absolutePath(relativePath), "utf8")) as T;

const nowIso = (): string => new Date().toISOString();
const fileTimestamp = (): string => nowIso().replaceAll(":", "-");

const writeJsonArtifact = (absoluteArtifactPath: string, payload: unknown): string => {
  fs.mkdirSync(path.dirname(absoluteArtifactPath), { recursive: true });
  fs.writeFileSync(absoluteArtifactPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return absoluteArtifactPath;
};

const getFlagValue = (args: string[], flag: string): string | undefined => {
  const index = args.indexOf(flag);
  if (index < 0) {
    return undefined;
  }

  const value = args[index + 1];
  if (typeof value !== "string" || value.startsWith("--")) {
    return undefined;
  }

  return value;
};

const parseArgs = (argv = process.argv.slice(2)): CliArgs => ({
  linksPath: getFlagValue(argv, "--links") ?? "data/links.json",
  publicCachePath: getFlagValue(argv, "--cache") ?? DEFAULT_PUBLIC_CACHE_PATH,
  onlyLink: getFlagValue(argv, "--only-link")?.trim(),
  onlyMissing: argv.includes("--only-missing"),
  force: argv.includes("--force"),
  allowFailures: argv.includes("--allow-failures"),
  headed: argv.includes("--headed"),
  browserWaitMs: Math.max(
    1_000,
    parseInteger(getFlagValue(argv, "--wait-ms")) ?? DEFAULT_BROWSER_WAIT_MS,
  ),
  summaryJsonPath: getFlagValue(argv, "--summary-json"),
});

const isRichLink = (link: LinkInput): link is RichLinkInput =>
  link.type === "rich" && typeof link.url === "string" && link.url.trim().length > 0;

const isMediumPublicTarget = (
  target: PublicAugmentationTarget | null,
): target is MediumPublicTarget => target?.id === "medium-public-feed";

const isPrimalPublicTarget = (
  target: PublicAugmentationTarget | null,
): target is PrimalPublicTarget => target?.id === "primal-public-profile";

const isXProfilePublicTarget = (
  target: PublicAugmentationTarget | null,
): target is XProfilePublicTarget => target?.id === "x-public-oembed";

const isXCommunityPublicTarget = (
  target: PublicAugmentationTarget | null,
): target is XCommunityPublicTarget => target?.id === "x-public-community";

const isSyncablePublicTarget = (
  target: PublicAugmentationTarget | null,
): target is SyncablePublicTarget =>
  isMediumPublicTarget(target) ||
  isPrimalPublicTarget(target) ||
  isXProfilePublicTarget(target) ||
  isXCommunityPublicTarget(target);

const hasDefinedAudienceMetric = (value: number | string | undefined): boolean => {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  return typeof value === "string" && value.trim().length > 0;
};

const hasBaseProfileMetadata = (entry: PublicCacheEntry | undefined): boolean => {
  if (!entry) {
    return false;
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

interface SyncableTargetBehavior {
  label: string;
  snippet: string;
  parseMetrics: (snapshot: PublicAudienceBrowserSnapshot) => PublicBrowserAudienceMetrics;
  requiresFollowingCount: boolean;
  requiresMembersCount: boolean;
  requiresProfileDescription: boolean;
}

const SYNCABLE_TARGET_BEHAVIORS = {
  "medium-public-feed": {
    label: "Medium",
    snippet: MEDIUM_PUBLIC_PROFILE_METRICS_SNIPPET,
    parseMetrics: parseMediumPublicProfileMetrics,
    requiresFollowingCount: false,
    requiresMembersCount: false,
    requiresProfileDescription: false,
  },
  "primal-public-profile": {
    label: "Primal",
    snippet: PRIMAL_PUBLIC_PROFILE_METRICS_SNIPPET,
    parseMetrics: parsePrimalPublicProfileMetrics,
    requiresFollowingCount: true,
    requiresMembersCount: false,
    requiresProfileDescription: false,
  },
  "x-public-oembed": {
    label: "X",
    snippet: X_PUBLIC_PROFILE_METRICS_SNIPPET,
    parseMetrics: parseXPublicProfileMetrics,
    requiresFollowingCount: true,
    requiresMembersCount: false,
    requiresProfileDescription: true,
  },
  "x-public-community": {
    label: "X community",
    snippet: X_PUBLIC_PROFILE_METRICS_SNIPPET,
    parseMetrics: parseXPublicProfileMetrics,
    requiresFollowingCount: false,
    requiresMembersCount: true,
    requiresProfileDescription: false,
  },
} as const satisfies Record<SyncablePublicTargetId, SyncableTargetBehavior>;

const behaviorForTarget = (targetId: SyncablePublicTargetId): SyncableTargetBehavior =>
  SYNCABLE_TARGET_BEHAVIORS[targetId];

const hasRequiredAudienceMetrics = (
  targetId: SyncablePublicTargetId,
  entry: PublicCacheEntry | undefined,
): boolean => {
  if (!entry) {
    return false;
  }

  const hasFollowers =
    hasDefinedAudienceMetric(entry.metadata.followersCount) ||
    hasDefinedAudienceMetric(entry.metadata.followersCountRaw);

  if (behaviorForTarget(targetId).requiresMembersCount) {
    return (
      hasDefinedAudienceMetric(entry.metadata.membersCount) ||
      hasDefinedAudienceMetric(entry.metadata.membersCountRaw)
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

const skipReasonForTarget = (targetId: SyncablePublicTargetId): string =>
  behaviorForTarget(targetId).requiresMembersCount
    ? "members_present"
    : behaviorForTarget(targetId).requiresProfileDescription
      ? "profile_metadata_present"
      : behaviorForTarget(targetId).requiresFollowingCount
        ? "audience_present"
        : "followers_present";

const skipMessageForTarget = (targetId: SyncablePublicTargetId): string =>
  behaviorForTarget(targetId).requiresMembersCount
    ? "members already present"
    : behaviorForTarget(targetId).requiresProfileDescription
      ? "followers, following, and profile description already present"
      : behaviorForTarget(targetId).requiresFollowingCount
        ? "followers and following already present"
        : "followers already present";

const missingMetricsReasonForTarget = (targetId: SyncablePublicTargetId): string =>
  behaviorForTarget(targetId).requiresMembersCount
    ? "members_missing"
    : behaviorForTarget(targetId).requiresProfileDescription
      ? "profile_metadata_missing"
      : behaviorForTarget(targetId).requiresFollowingCount
        ? "audience_missing"
        : "followers_missing";

const captureSummaryForTarget = (
  targetId: SyncablePublicTargetId,
  metrics: PublicBrowserAudienceMetrics,
): string =>
  behaviorForTarget(targetId).requiresMembersCount
    ? (metrics.membersCountRaw ?? "members missing")
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

const cloneEntry = (entry: PublicCacheEntry): PublicCacheEntry => ({
  ...entry,
  metadata: {
    ...entry.metadata,
  },
});

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const extractEvalResult = (value: unknown): Record<string, unknown> | null => {
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

const buildPublicProfileConfig = (linkId: string, headed: boolean): PublicBrowserProfileConfig => ({
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

const extractMetricTexts = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const metricTexts = value
    .map((entry) => safeTrim(entry))
    .filter((entry): entry is string => Boolean(entry));

  return metricTexts.length > 0 ? metricTexts : undefined;
};

const toAudienceSnapshot = (
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

const metricsSnippetForTarget = (targetId: SyncablePublicTargetId): string =>
  behaviorForTarget(targetId).snippet;

const snapshotFromPayload = (
  payload: Record<string, unknown> | null,
): PublicBrowserAudienceSnapshot | undefined => toAudienceSnapshot(payload);

const parseAudienceMetricsForTarget = (
  targetId: SyncablePublicTargetId,
  snapshot: PublicBrowserAudienceSnapshot | undefined,
): PublicBrowserAudienceMetrics => behaviorForTarget(targetId).parseMetrics(snapshot ?? {});

const buildAudienceCaptureError = (
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

export const capturePublicAudienceMetricsFromBrowser = async (
  input: CapturePublicAudienceMetricsInput,
): Promise<PublicBrowserAudienceCaptureResult> => {
  const config = buildPublicProfileConfig(input.link.id, input.headed);
  fs.mkdirSync(config.profilePath, { recursive: true });

  const artifactRelativePath = path.join(
    PUBLIC_RICH_SYNC_OUTPUT_DIRECTORY,
    `${input.link.id}-${fileTimestamp()}.json`,
  );
  const artifactAbsolutePath = absolutePath(artifactRelativePath);
  let snapshot: PublicBrowserAudienceSnapshot | undefined;
  let error: string | undefined;

  try {
    runPublicBrowserJson(["open", input.link.url], config, {
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
    targetUrl: input.link.url,
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

const defaultDependencies: PublicRichSyncDependencies = {
  readLinks: (linksPath) => readJson<LinksPayload>(linksPath),
  loadPublicCache: (publicCachePath) => loadPublicCacheRegistry({ cachePath: publicCachePath }),
  writePublicCache: (publicCachePath, registry) =>
    writePublicCacheRegistry(publicCachePath, registry),
  bootstrapBaseEntry: bootstrapPublicBaseEntry,
  captureAudienceMetrics: capturePublicAudienceMetricsFromBrowser,
  nowIso,
  log: (message) => console.log(message),
};

export const buildPublicRichSyncRunSummary = (
  result: Pick<PublicRichSyncResult, "dirty" | "processed" | "skipped" | "failed" | "entries">,
): PublicRichSyncSummary => ({
  dirty: result.dirty,
  processed: result.processed,
  skipped: result.skipped,
  failed: result.failed,
  entries: result.entries.map((entry) => ({ ...entry })),
});

export const writePublicRichSyncRunSummary = (
  summaryPath: string,
  summary: PublicRichSyncSummary,
): void => {
  writeJsonArtifact(absolutePath(summaryPath), summary);
};

export const shouldPublicRichSyncExitWithFailure = (
  result: Pick<PublicRichSyncResult, "failed">,
  allowFailures: boolean,
): boolean => result.failed > 0 && !allowFailures;

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

  const candidates = linksPayload.links
    .filter(isRichLink)
    .filter((link) => !args.onlyLink || link.id === args.onlyLink)
    .map((link) => ({
      link,
      target: resolvePublicAugmentationTarget({
        url: link.url,
        icon: link.icon,
        metadataHandle: link.metadata?.handle,
      }),
    }))
    .filter((candidate): candidate is { link: RichLinkInput; target: SyncablePublicTarget } =>
      isSyncablePublicTarget(candidate.target),
    );

  if (candidates.length === 0) {
    dependencies.log("No supported public-browser sync links matched the sync filters.");
    return {
      dirty: false,
      processed,
      skipped,
      failed,
      entries,
      registry,
    };
  }

  for (const candidate of candidates) {
    const generatedAt = dependencies.nowIso();
    const existingEntry = registry.entries[candidate.link.id];
    try {
      if (
        args.onlyMissing &&
        !args.force &&
        hasRequiredAudienceMetrics(candidate.target.id, existingEntry)
      ) {
        skipped += 1;
        entries.push({
          linkId: candidate.link.id,
          status: "skipped",
          reason: skipReasonForTarget(candidate.target.id),
        });
        dependencies.log(
          `[public:rich:sync] skip ${candidate.link.id}: ${skipMessageForTarget(candidate.target.id)}.`,
        );
        continue;
      }

      let workingEntry = existingEntry ? cloneEntry(existingEntry) : undefined;
      if (!hasBaseProfileMetadata(workingEntry)) {
        workingEntry = await dependencies.bootstrapBaseEntry({
          link: candidate.link,
          target: candidate.target,
          existingEntry: workingEntry,
          generatedAt,
          remoteCachePolicyRegistry,
          remoteCacheStats,
        });
        registry.entries[candidate.link.id] = workingEntry;
        registry.updatedAt = generatedAt;
        dirty = true;
        dependencies.log(`[public:rich:sync] bootstrapped base metadata for ${candidate.link.id}.`);
      }

      processed += 1;
      const capture = await dependencies.captureAudienceMetrics({
        link: candidate.link,
        target: candidate.target,
        headed: args.headed,
        browserWaitMs: args.browserWaitMs,
        generatedAt,
      });

      if (!capture.ok) {
        const detail =
          capture.error ?? captureSummaryForTarget(candidate.target.id, capture.metrics);
        failed += 1;
        entries.push({
          linkId: candidate.link.id,
          status: "failed",
          reason: missingMetricsReasonForTarget(candidate.target.id),
          artifactPath: capture.artifactPath,
          detail,
        });
        dependencies.log(
          `[public:rich:sync] fail ${candidate.link.id}: ${detail} (${capture.artifactPath})`,
        );
        continue;
      }

      const nextEntry = workingEntry ? cloneEntry(workingEntry) : undefined;
      if (!nextEntry) {
        throw new Error(`Internal error: working entry missing for '${candidate.link.id}'.`);
      }

      nextEntry.metadata.followersCount = capture.metrics.followersCount;
      nextEntry.metadata.followersCountRaw = capture.metrics.followersCountRaw;
      if (capture.metrics.membersCount !== undefined) {
        nextEntry.metadata.membersCount = capture.metrics.membersCount;
      }
      if (capture.metrics.membersCountRaw) {
        nextEntry.metadata.membersCountRaw = capture.metrics.membersCountRaw;
      }
      if (capture.metrics.followingCount !== undefined) {
        nextEntry.metadata.followingCount = capture.metrics.followingCount;
      }
      if (capture.metrics.followingCountRaw) {
        nextEntry.metadata.followingCountRaw = capture.metrics.followingCountRaw;
      }
      if (capture.metrics.profileDescription) {
        nextEntry.metadata.profileDescription = capture.metrics.profileDescription;
      }

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
        skipped += 1;
        entries.push({
          linkId: candidate.link.id,
          status: "skipped",
          reason: "counts_unchanged",
        });
        dependencies.log(
          `[public:rich:sync] no-op ${candidate.link.id}: captured audience metrics matched the committed cache.`,
        );
        continue;
      }

      registry.entries[candidate.link.id] = stabilizedEntry;
      registry.updatedAt = generatedAt;
      dirty = true;
      entries.push({
        linkId: candidate.link.id,
        status: "synced",
        reason: existingEntry ? "counts_refreshed" : "bootstrapped_and_refreshed",
        artifactPath: capture.artifactPath,
      });
      dependencies.log(
        `[public:rich:sync] synced ${candidate.link.id}: ${captureSummaryForTarget(
          candidate.target.id,
          capture.metrics,
        )} (${capture.artifactPath})`,
      );
    } catch (candidateError: unknown) {
      const detail = toErrorMessage(candidateError);
      failed += 1;
      entries.push({
        linkId: candidate.link.id,
        status: "failed",
        reason: "sync_error",
        detail,
      });
      dependencies.log(`[public:rich:sync] fail ${candidate.link.id}: ${detail}`);
    }
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
    entries,
    registry,
  };
};

const runCli = async () => {
  const args = parseArgs();
  const result = await runPublicRichSyncWithDependencies(args, defaultDependencies);
  if (args.summaryJsonPath) {
    writePublicRichSyncRunSummary(args.summaryJsonPath, buildPublicRichSyncRunSummary(result));
  }

  console.log("");
  console.log("Public rich sync summary");
  console.log(`Processed: ${result.processed}`);
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Failed: ${result.failed}`);
  console.log(`Cache updated: ${result.dirty ? "yes" : "no"}`);

  if (shouldPublicRichSyncExitWithFailure(result, args.allowFailures ?? false)) {
    process.exit(1);
  }
};

if (import.meta.main) {
  runCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Public rich sync failed: ${message}`);
    process.exit(1);
  });
}
