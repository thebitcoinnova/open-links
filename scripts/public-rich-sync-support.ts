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
  type CliArgs,
  FACEBOOK_PAGE_ACCESS_TOKEN_ENV,
  type FacebookPageMetricsResult,
  type FacebookPageMetricsTarget,
  type FetchFacebookPageMetricsInput,
  FetchFallbackAudienceMetricsInput,
  InstagramPublicTarget,
  type LinkInput,
  LinksPayload,
  MediumPublicTarget,
  PrimalPublicTarget,
  PublicAudienceFallbackResult,
  PublicBrowserAudienceCaptureResult,
  PublicBrowserAudienceMetrics,
  PublicBrowserAudienceSnapshot,
  PublicRichSyncDependencies,
  PublicRichSyncResult,
  PublicRichSyncRunEntry,
  PublicRichSyncSummary,
  type PublicRichSyncTarget,
  PublicRichSyncTargetId,
  type RichLinkInput,
  SubstackPublicTarget,
  SyncablePublicTarget,
  SyncablePublicTargetId,
  XCommunityPublicTarget,
  XProfilePublicTarget,
  YoutubePublicTarget,
} from "./public-rich-sync-contracts";

export const ROOT = process.cwd();
export const DEFAULT_BROWSER_WAIT_MS = 8_000;
export const DEFAULT_FETCH_TIMEOUT_MS = 4_000;
export const DEFAULT_FETCH_RETRIES = 1;
export const DEFAULT_CAPTURE_RETRIES = 2;
export const DEFAULT_CAPTURE_RETRY_DELAY_MS = 120_000;
export const DEFAULT_FACEBOOK_GRAPH_API_VERSION = "v24.0";
export const FACEBOOK_PAGE_METRICS_FIELDS = "id,name,followers_count,fan_count";
export const PUBLIC_BROWSER_ARGS = ["--disable-blink-features=AutomationControlled"] as const;
export const INSTAGRAM_PUBLIC_PROFILE_METRICS_SNIPPET = loadEmbeddedCode(
  "browser/instagram/extract-public-profile-metrics.js",
);
export const MEDIUM_PUBLIC_PROFILE_METRICS_SNIPPET = loadEmbeddedCode(
  "browser/medium/extract-public-profile-metrics.js",
);
export const PRIMAL_PUBLIC_PROFILE_METRICS_SNIPPET = loadEmbeddedCode(
  "browser/primal/extract-public-profile-metrics.js",
);
export const SUBSTACK_PUBLIC_PROFILE_METRICS_SNIPPET = loadEmbeddedCode(
  "browser/substack/extract-public-profile-metrics.js",
);
export const X_PUBLIC_PROFILE_METRICS_SNIPPET = loadEmbeddedCode(
  "browser/x/extract-public-profile-metrics.js",
);
export const YOUTUBE_PUBLIC_PROFILE_METRICS_SNIPPET = loadEmbeddedCode(
  "browser/youtube/extract-public-profile-metrics.js",
);

export const safeTrim = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const parseInteger = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const absolutePath = (value: string): string =>
  path.isAbsolute(value) ? value : path.join(ROOT, value);

export const readJson = <T>(relativePath: string): T =>
  JSON.parse(fs.readFileSync(absolutePath(relativePath), "utf8")) as T;

export const nowIso = (): string => new Date().toISOString();
export const fileTimestamp = (): string => nowIso().replaceAll(":", "-");
export const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export const writeJsonArtifact = (absoluteArtifactPath: string, payload: unknown): string => {
  fs.mkdirSync(path.dirname(absoluteArtifactPath), { recursive: true });
  fs.writeFileSync(absoluteArtifactPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return absoluteArtifactPath;
};

export const getFlagValue = (args: string[], flag: string): string | undefined => {
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

export const parseArgs = (argv = process.argv.slice(2)): CliArgs => ({
  linksPath: getFlagValue(argv, "--links") ?? "data/links.json",
  publicCachePath: getFlagValue(argv, "--cache") ?? DEFAULT_PUBLIC_CACHE_PATH,
  onlyLink: getFlagValue(argv, "--only-link")?.trim(),
  onlyMissing: argv.includes("--only-missing"),
  force: argv.includes("--force"),
  allowFailures: argv.includes("--allow-failures"),
  deferFailures: argv.includes("--defer-failures"),
  headed: argv.includes("--headed"),
  browserWaitMs: Math.max(
    1_000,
    parseInteger(getFlagValue(argv, "--wait-ms")) ?? DEFAULT_BROWSER_WAIT_MS,
  ),
  captureRetries: Math.max(
    0,
    parseInteger(getFlagValue(argv, "--capture-retries")) ?? DEFAULT_CAPTURE_RETRIES,
  ),
  captureRetryDelayMs: Math.max(
    0,
    parseInteger(getFlagValue(argv, "--capture-retry-delay-ms")) ?? DEFAULT_CAPTURE_RETRY_DELAY_MS,
  ),
  summaryJsonPath: getFlagValue(argv, "--summary-json"),
});

export const isRichLink = (link: LinkInput): link is RichLinkInput =>
  link.type === "rich" && typeof link.url === "string" && link.url.trim().length > 0;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const toNonNegativeInteger = (value: unknown): number | undefined => {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0 ? value : undefined;
  }

  if (typeof value === "string" && /^\d+$/u.test(value.trim())) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
  }

  return undefined;
};

export const normalizeFacebookGraphApiVersion = (value: unknown): string => {
  const maybeVersion = safeTrim(value);
  if (!maybeVersion) {
    return DEFAULT_FACEBOOK_GRAPH_API_VERSION;
  }

  return /^v\d+\.\d+$/u.test(maybeVersion) ? maybeVersion : DEFAULT_FACEBOOK_GRAPH_API_VERSION;
};

export const buildFacebookPageMetricsSourceUrl = (input: {
  pageId: string;
  apiVersion: string;
}): string => {
  const url = new URL(`${input.apiVersion}/${input.pageId}`, "https://graph.facebook.com/");
  url.searchParams.set("fields", FACEBOOK_PAGE_METRICS_FIELDS);
  return url.href;
};

export const resolveFacebookPageMetricsTarget = (
  link: Pick<RichLinkInput, "enrichment">,
): FacebookPageMetricsTarget | null => {
  const config = link.enrichment?.facebookPageMetrics;
  if (!isRecord(config) || config.enabled !== true) {
    return null;
  }

  const pageId = safeTrim(config.pageId);
  if (!pageId || !/^\d{5,30}$/u.test(pageId)) {
    return null;
  }

  const apiVersion = normalizeFacebookGraphApiVersion(config.apiVersion);
  return {
    id: "facebook-page-metrics",
    pageId,
    apiVersion,
    sourceUrl: buildFacebookPageMetricsSourceUrl({ pageId, apiVersion }),
    tokenEnv: FACEBOOK_PAGE_ACCESS_TOKEN_ENV,
  };
};

export const isFacebookPageMetricsTarget = (
  target: PublicRichSyncTarget,
): target is FacebookPageMetricsTarget => target.id === "facebook-page-metrics";

export const normalizeFacebookPageMetricsResponse = (
  payload: unknown,
  target: FacebookPageMetricsTarget,
): FacebookPageMetricsResult => {
  if (!isRecord(payload)) {
    throw new Error("Facebook Graph API response must be a JSON object.");
  }

  const responsePageId = safeTrim(payload.id);
  if (responsePageId && responsePageId !== target.pageId) {
    throw new Error(
      `Facebook Graph API response id '${responsePageId}' did not match requested page '${target.pageId}'.`,
    );
  }

  const followersCount = toNonNegativeInteger(payload.followers_count);
  if (followersCount === undefined) {
    throw new Error("Facebook Graph API response did not include followers_count.");
  }

  return {
    pageId: responsePageId ?? target.pageId,
    pageName: safeTrim(payload.name),
    followersCount,
    followersCountRaw: `${followersCount.toLocaleString("en-US")} followers`,
    fanCount: toNonNegativeInteger(payload.fan_count),
    sourceUrl: target.sourceUrl,
  };
};

export const fetchFacebookPageMetrics = async ({
  target,
  accessToken = process.env[FACEBOOK_PAGE_ACCESS_TOKEN_ENV],
  fetchImpl = fetch,
}: FetchFacebookPageMetricsInput): Promise<FacebookPageMetricsResult> => {
  const token = safeTrim(accessToken);
  if (!token) {
    throw new Error(
      `Missing ${FACEBOOK_PAGE_ACCESS_TOKEN_ENV}; configure a Facebook Page access token before syncing '${target.pageId}'.`,
    );
  }

  const requestUrl = new URL(target.sourceUrl);
  requestUrl.searchParams.set("access_token", token);

  const response = await fetchImpl(requestUrl, {
    headers: {
      accept: "application/json",
    },
  });
  const body = await response.text();
  const payload = body.trim().length > 0 ? JSON.parse(body) : {};

  if (!response.ok) {
    const maybeError = isRecord(payload.error) ? payload.error : undefined;
    const maybeMessage = maybeError ? safeTrim(maybeError.message) : undefined;
    const maybeCode = maybeError ? toNonNegativeInteger(maybeError.code) : undefined;
    const maybeSubcode = maybeError ? toNonNegativeInteger(maybeError.error_subcode) : undefined;
    const maybePageIdHint =
      maybeCode === 100 && maybeSubcode === 33
        ? " This usually means facebookPageMetrics.pageId is not the Meta Graph Page ID, or the Page token cannot access that Page. Use the Graph Page ID shown in Meta Business Suite or a successful Graph Explorer Page object."
        : "";
    throw new Error(
      `Facebook Graph API request failed for page '${target.pageId}': HTTP ${response.status}${
        maybeMessage ? ` ${maybeMessage}` : ""
      }${maybePageIdHint}`,
    );
  }

  return normalizeFacebookPageMetricsResponse(payload, target);
};
