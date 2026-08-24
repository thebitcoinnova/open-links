import type {
  PublicAudienceBrowserSnapshot,
  PublicAudienceMetrics,
} from "./enrichment/public-audience-browser";
import type { PublicAugmentationTarget } from "./enrichment/public-augmentation-core";
import type {
  PublicCacheEntry,
  PublicCacheMetadata,
  PublicCacheRegistry,
} from "./enrichment/public-cache-contracts";
import type { loadRemoteCachePolicyRegistry } from "./shared/remote-cache-policy";
import type { RemoteCacheStatsCollector } from "./shared/remote-cache-stats";

export const FACEBOOK_PAGE_ACCESS_TOKEN_ENV = "OPENLINKS_FACEBOOK_PAGE_ACCESS_TOKEN";

export interface CliArgs {
  linksPath: string;
  publicCachePath: string;
  onlyLink?: string;
  onlyMissing: boolean;
  force: boolean;
  allowFailures?: boolean;
  deferFailures?: boolean;
  headed: boolean;
  browserWaitMs: number;
  captureRetries?: number;
  captureRetryDelayMs?: number;
  summaryJsonPath?: string;
}

export interface LinkInput {
  id: string;
  label: string;
  url?: string;
  type: "simple" | "rich" | "payment";
  icon?: string;
  metadata?: Record<string, unknown>;
  enrichment?: {
    profileSemantics?: unknown;
    facebookPageMetrics?: {
      enabled?: unknown;
      pageId?: unknown;
      apiVersion?: unknown;
    };
  };
}

export interface LinksPayload {
  links: LinkInput[];
}

export interface RichLinkInput extends LinkInput {
  url: string;
  type: "rich";
}

export interface MediumPublicTarget extends PublicAugmentationTarget {
  id: "medium-public-feed";
}

export interface XProfilePublicTarget extends PublicAugmentationTarget {
  id: "x-public-oembed";
}

export interface XCommunityPublicTarget extends PublicAugmentationTarget {
  id: "x-public-community";
}

export interface PrimalPublicTarget extends PublicAugmentationTarget {
  id: "primal-public-profile";
}

export interface InstagramPublicTarget extends PublicAugmentationTarget {
  id: "instagram-public-profile";
}

export interface YoutubePublicTarget extends PublicAugmentationTarget {
  id: "youtube-public-profile";
}

export interface SubstackPublicTarget extends PublicAugmentationTarget {
  id: "substack-public-profile";
}

export interface FacebookPageMetricsTarget {
  id: "facebook-page-metrics";
  pageId: string;
  apiVersion: string;
  sourceUrl: string;
  tokenEnv: typeof FACEBOOK_PAGE_ACCESS_TOKEN_ENV;
}

export type SyncablePublicTarget =
  | InstagramPublicTarget
  | MediumPublicTarget
  | PrimalPublicTarget
  | SubstackPublicTarget
  | XProfilePublicTarget
  | XCommunityPublicTarget
  | YoutubePublicTarget;
export type SyncablePublicTargetId = SyncablePublicTarget["id"];
export type PublicRichSyncTarget = SyncablePublicTarget | FacebookPageMetricsTarget;
export type PublicRichSyncTargetId = PublicRichSyncTarget["id"];
export type PublicBrowserAudienceSnapshot = PublicAudienceBrowserSnapshot;
export type PublicBrowserAudienceMetrics = PublicAudienceMetrics;

export interface FacebookPageMetricsResult {
  pageId: string;
  pageName?: string;
  followersCount: number;
  followersCountRaw: string;
  fanCount?: number;
  sourceUrl: string;
}

export interface FetchFacebookPageMetricsInput {
  target: FacebookPageMetricsTarget;
  accessToken?: string;
  fetchImpl?: typeof fetch;
}

export interface BootstrapBaseEntryInput {
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

export interface PublicAudienceFallbackResult {
  ok: boolean;
  source: string;
  metrics: PublicBrowserAudienceMetrics;
  metadata?: PublicCacheMetadata;
  detail?: string;
}

export interface CapturePublicAudienceMetricsInput {
  link: RichLinkInput;
  target: SyncablePublicTarget;
  headed: boolean;
  browserWaitMs: number;
  generatedAt: string;
}

export interface FetchFallbackAudienceMetricsInput {
  link: RichLinkInput;
  target: SyncablePublicTarget;
  existingEntry?: PublicCacheEntry;
  failedCapture: PublicBrowserAudienceCaptureResult;
  generatedAt: string;
  remoteCachePolicyRegistry: ReturnType<typeof loadRemoteCachePolicyRegistry>;
  remoteCacheStats: RemoteCacheStatsCollector;
}

export interface PublicRichSyncDependencies {
  readLinks: (linksPath: string) => LinksPayload;
  loadPublicCache: (publicCachePath: string) => PublicCacheRegistry;
  writePublicCache: (publicCachePath: string, registry: PublicCacheRegistry) => void;
  fetchFacebookPageMetrics?: (
    input: FetchFacebookPageMetricsInput,
  ) => Promise<FacebookPageMetricsResult>;
  bootstrapBaseEntry: (input: BootstrapBaseEntryInput) => Promise<PublicCacheEntry>;
  captureAudienceMetrics: (
    input: CapturePublicAudienceMetricsInput,
  ) => Promise<PublicBrowserAudienceCaptureResult>;
  fetchFallbackAudienceMetrics?: (
    input: FetchFallbackAudienceMetricsInput,
  ) => Promise<PublicAudienceFallbackResult | null>;
  nowIso: () => string;
  log: (message: string) => void;
  sleep?: (milliseconds: number) => Promise<void>;
}

export interface PublicRichSyncRunEntry {
  linkId: string;
  status: "synced" | "skipped" | "failed";
  reason: string;
  artifactPath?: string;
  detail?: string;
  fatal?: boolean;
  attempts?: number;
}

export interface PublicRichSyncResult {
  dirty: boolean;
  processed: number;
  skipped: number;
  failed: number;
  fatalFailed: number;
  entries: PublicRichSyncRunEntry[];
  registry: PublicCacheRegistry;
}

export interface PublicRichSyncSummary {
  dirty: boolean;
  processed: number;
  skipped: number;
  failed: number;
  fatalFailed: number;
  entries: PublicRichSyncRunEntry[];
}
