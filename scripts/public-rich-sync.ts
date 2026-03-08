import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { resolveSupportedSocialProfile } from "../src/lib/content/social-profile-fields";
import { fetchMetadata } from "./enrichment/fetch-metadata";
import {
  type MediumPublicProfileBrowserSnapshot,
  parseMediumPublicProfileMetrics,
} from "./enrichment/medium-public-browser";
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
  loadPublicCacheRegistry,
  mergePublicCacheMetadataForTarget,
  toPublicCacheMetadata,
  writePublicCacheRegistry,
} from "./enrichment/public-cache";
import { augmentSupportedSocialProfileMetadata } from "./enrichment/supported-social-profile-metadata";
import {
  type XPublicProfileBrowserSnapshot,
  parseXPublicProfileMetrics,
} from "./enrichment/x-public-browser";
import { loadEmbeddedCode } from "./shared/embedded-code-loader";

const ROOT = process.cwd();
const DEFAULT_BROWSER_WAIT_MS = 8_000;
const DEFAULT_FETCH_TIMEOUT_MS = 4_000;
const DEFAULT_FETCH_RETRIES = 1;
const PUBLIC_BROWSER_ARGS = ["--disable-blink-features=AutomationControlled"] as const;
const MEDIUM_PUBLIC_PROFILE_METRICS_SNIPPET = loadEmbeddedCode(
  "browser/medium/extract-public-profile-metrics.js",
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
  headed: boolean;
  browserWaitMs: number;
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

interface XPublicTarget extends PublicAugmentationTarget {
  id: "x-public-oembed";
}

type SyncablePublicTarget = MediumPublicTarget | XPublicTarget;
type SyncablePublicTargetId = SyncablePublicTarget["id"];
type PublicBrowserAudienceSnapshot =
  | MediumPublicProfileBrowserSnapshot
  | XPublicProfileBrowserSnapshot;

export interface PublicBrowserAudienceMetrics {
  followersCount?: number;
  followersCountRaw?: string;
  followingCount?: number;
  followingCountRaw?: string;
  placeholderSignals: string[];
}

interface BootstrapBaseEntryInput {
  link: RichLinkInput;
  target: SyncablePublicTarget;
  existingEntry?: PublicCacheEntry;
  generatedAt: string;
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
}

export interface PublicRichSyncResult {
  dirty: boolean;
  processed: number;
  skipped: number;
  failed: number;
  entries: PublicRichSyncRunEntry[];
  registry: PublicCacheRegistry;
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
  headed: argv.includes("--headed"),
  browserWaitMs: Math.max(
    1_000,
    parseInteger(getFlagValue(argv, "--wait-ms")) ?? DEFAULT_BROWSER_WAIT_MS,
  ),
});

const isRichLink = (link: LinkInput): link is RichLinkInput =>
  link.type === "rich" && typeof link.url === "string" && link.url.trim().length > 0;

const isMediumPublicTarget = (
  target: PublicAugmentationTarget | null,
): target is MediumPublicTarget => target?.id === "medium-public-feed";

const isXPublicTarget = (target: PublicAugmentationTarget | null): target is XPublicTarget =>
  target?.id === "x-public-oembed";

const isSyncablePublicTarget = (
  target: PublicAugmentationTarget | null,
): target is SyncablePublicTarget => isMediumPublicTarget(target) || isXPublicTarget(target);

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

  return (
    typeof entry.metadata.title === "string" &&
    entry.metadata.title.trim().length > 0 &&
    typeof entry.metadata.description === "string" &&
    entry.metadata.description.trim().length > 0 &&
    typeof entry.metadata.image === "string" &&
    entry.metadata.image.trim().length > 0 &&
    typeof entry.metadata.profileImage === "string" &&
    entry.metadata.profileImage.trim().length > 0 &&
    typeof entry.metadata.handle === "string" &&
    entry.metadata.handle.trim().length > 0
  );
};

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

  if (targetId === "medium-public-feed") {
    return hasFollowers;
  }

  const hasFollowing =
    hasDefinedAudienceMetric(entry.metadata.followingCount) ||
    hasDefinedAudienceMetric(entry.metadata.followingCountRaw);

  return hasFollowers && hasFollowing;
};

const skipReasonForTarget = (targetId: SyncablePublicTargetId): string =>
  targetId === "medium-public-feed" ? "followers_present" : "audience_present";

const skipMessageForTarget = (targetId: SyncablePublicTargetId): string =>
  targetId === "medium-public-feed"
    ? "followers already present"
    : "followers and following already present";

const missingMetricsReasonForTarget = (targetId: SyncablePublicTargetId): string =>
  targetId === "medium-public-feed" ? "followers_missing" : "audience_missing";

const captureSummaryForTarget = (
  targetId: SyncablePublicTargetId,
  metrics: PublicBrowserAudienceMetrics,
): string =>
  targetId === "medium-public-feed"
    ? (metrics.followersCountRaw ?? "followers missing")
    : `${metrics.followingCountRaw ?? "following missing"} / ${
        metrics.followersCountRaw ?? "followers missing"
      }`;

const cloneEntry = (entry: PublicCacheEntry): PublicCacheEntry => ({
  ...entry,
  metadata: {
    ...entry.metadata,
  },
});

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

const toMediumSnapshot = (
  payload: Record<string, unknown> | null,
): MediumPublicProfileBrowserSnapshot | undefined => {
  if (!payload) {
    return undefined;
  }

  return {
    currentUrl: safeTrim(payload.currentUrl),
    title: safeTrim(payload.title),
    bodyText: safeTrim(payload.bodyText),
    metricTexts: extractMetricTexts(payload.metricTexts),
  };
};

const toXSnapshot = (
  payload: Record<string, unknown> | null,
): XPublicProfileBrowserSnapshot | undefined => {
  if (!payload) {
    return undefined;
  }

  return {
    currentUrl: safeTrim(payload.currentUrl),
    title: safeTrim(payload.title),
    bodyText: safeTrim(payload.bodyText),
    metricTexts: extractMetricTexts(payload.metricTexts),
  };
};

const metricsSnippetForTarget = (targetId: SyncablePublicTargetId): string =>
  targetId === "medium-public-feed"
    ? MEDIUM_PUBLIC_PROFILE_METRICS_SNIPPET
    : X_PUBLIC_PROFILE_METRICS_SNIPPET;

const snapshotFromPayload = (
  targetId: SyncablePublicTargetId,
  payload: Record<string, unknown> | null,
): PublicBrowserAudienceSnapshot | undefined =>
  targetId === "medium-public-feed" ? toMediumSnapshot(payload) : toXSnapshot(payload);

const parseAudienceMetricsForTarget = (
  targetId: SyncablePublicTargetId,
  snapshot: PublicBrowserAudienceSnapshot | undefined,
): PublicBrowserAudienceMetrics =>
  targetId === "medium-public-feed"
    ? parseMediumPublicProfileMetrics((snapshot ?? {}) as MediumPublicProfileBrowserSnapshot)
    : parseXPublicProfileMetrics((snapshot ?? {}) as XPublicProfileBrowserSnapshot);

const buildAudienceCaptureError = (
  targetId: SyncablePublicTargetId,
  metrics: PublicBrowserAudienceMetrics,
): string | undefined => {
  if (metrics.placeholderSignals.length > 0) {
    return `${
      targetId === "medium-public-feed" ? "Medium" : "X"
    } public browser capture saw placeholder content: ${metrics.placeholderSignals.join(", ")}.`;
  }

  if (targetId === "medium-public-feed" && !metrics.followersCountRaw) {
    return "Medium public browser capture did not find a follower count.";
  }

  if (targetId === "x-public-oembed") {
    if (!metrics.followersCountRaw && !metrics.followingCountRaw) {
      return "X public browser capture did not find follower or following counts.";
    }

    if (!metrics.followersCountRaw) {
      return "X public browser capture did not find a follower count.";
    }

    if (!metrics.followingCountRaw) {
      return "X public browser capture did not find a following count.";
    }
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
    snapshot = snapshotFromPayload(input.target.id, payload);
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

export const runPublicRichSyncWithDependencies = async (
  args: CliArgs,
  dependencies: PublicRichSyncDependencies,
): Promise<PublicRichSyncResult> => {
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
      failed += 1;
      entries.push({
        linkId: candidate.link.id,
        status: "failed",
        reason: missingMetricsReasonForTarget(candidate.target.id),
        artifactPath: capture.artifactPath,
      });
      dependencies.log(
        `[public:rich:sync] fail ${candidate.link.id}: ${
          capture.error ?? captureSummaryForTarget(candidate.target.id, capture.metrics)
        } (${capture.artifactPath})`,
      );
      continue;
    }

    const nextEntry = workingEntry ? cloneEntry(workingEntry) : undefined;
    if (!nextEntry) {
      throw new Error(`Internal error: working entry missing for '${candidate.link.id}'.`);
    }

    nextEntry.updatedAt = generatedAt;
    nextEntry.metadata.followersCount = capture.metrics.followersCount;
    nextEntry.metadata.followersCountRaw = capture.metrics.followersCountRaw;
    if (capture.metrics.followingCount !== undefined) {
      nextEntry.metadata.followingCount = capture.metrics.followingCount;
    }
    if (capture.metrics.followingCountRaw) {
      nextEntry.metadata.followingCountRaw = capture.metrics.followingCountRaw;
    }

    registry.entries[candidate.link.id] = nextEntry;
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
  }

  if (dirty) {
    dependencies.writePublicCache(args.publicCachePath, registry);
  }

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

  console.log("");
  console.log("Public rich sync summary");
  console.log(`Processed: ${result.processed}`);
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Failed: ${result.failed}`);
  console.log(`Cache updated: ${result.dirty ? "yes" : "no"}`);

  if (result.failed > 0) {
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
