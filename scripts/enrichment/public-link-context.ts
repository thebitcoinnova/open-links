import type { resolveSupportedSocialProfile } from "../../src/lib/content/social-profile-fields";
import type { loadAuthenticatedCacheRegistry } from "../authenticated-extractors/cache";
import type { loadAuthenticatedExtractorsPolicy } from "../authenticated-extractors/policy";
import type { LinkInput, ResolvedConfig } from "../enrich-rich-links-config";
import type { loadRemoteCachePolicyRegistry } from "../shared/remote-cache-policy";
import type { RemoteCacheStatsCollector } from "../shared/remote-cache-stats";
import type { loadRichEnrichmentBlockersRegistry } from "./blockers-registry";
import type { fetchMetadata } from "./fetch-metadata";
import type { resolvePublicCacheEntry } from "./public-cache-persistence";
import type { loadPublicCacheRegistry } from "./public-cache-registry";
import type { resolvePublicEnrichmentStrategy } from "./strategy-registry";
import type { EnrichmentRunEntry, GeneratedRichMetadata } from "./types";

export type PublicLinkHandlerContext = {
  link: LinkInput & { type: "rich"; url: string };
  config: ResolvedConfig;
  generatedAt: string;
  handleForMetadata: string | undefined;
  supportedProfile: ReturnType<typeof resolveSupportedSocialProfile>;
  entries: EnrichmentRunEntry[];
  generatedLinks: GeneratedRichMetadata["links"];
  authenticatedExtractorId?: string;
  authenticatedExtractorsPolicy: ReturnType<typeof loadAuthenticatedExtractorsPolicy> | null;
  authenticatedCacheRegistry: ReturnType<typeof loadAuthenticatedCacheRegistry> | null;
  blockersRegistry: ReturnType<typeof loadRichEnrichmentBlockersRegistry>;
  remoteCachePolicyRegistry: ReturnType<typeof loadRemoteCachePolicyRegistry>;
  remoteCacheStats: RemoteCacheStatsCollector;
  publicCacheRegistry: ReturnType<typeof loadPublicCacheRegistry>;
  publicCacheWriteSkippedLinks: Set<string>;
  enforceStrictBlocking: boolean;
  state: { publicCacheDirty: boolean };
};

export type PublicLinkPreparationContext = {
  publicStrategy: ReturnType<typeof resolvePublicEnrichmentStrategy>;
  knownBlockerMatch: ReturnType<typeof import("./blockers-registry").resolveKnownBlockerMatch>;
  allowKnownBlockerByPublicStrategy: boolean;
  allowKnownBlocker: boolean;
  publicCacheKey: string;
  publicSourceUrl: string;
  existingPublicEntry: PublicLinkHandlerContext["publicCacheRegistry"]["entries"][string];
  cachedPublicEntry: ReturnType<typeof resolvePublicCacheEntry>;
};

export type HandledPublicPreparation = {
  kind: "handled";
  abortedEarly: boolean;
};

export type FetchedPublicPreparation = PublicLinkPreparationContext & {
  kind: "fetched";
  abortedEarly: false;
  fetched: Awaited<ReturnType<typeof fetchMetadata>>;
  html: string;
};

export type PublicPreparation = HandledPublicPreparation | FetchedPublicPreparation;
