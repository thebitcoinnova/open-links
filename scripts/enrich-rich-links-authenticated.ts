import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import type {
  GeneratedLinkReferralConfig,
  LinkReferralConfig,
} from "../src/lib/content/referral-fields";
import {
  type LinkProfileSemantics,
  SOCIAL_PROFILE_METADATA_FIELDS,
  mergeMetadataWithManualSocialProfileOverrides,
  normalizeSupportedSocialProfileMetadata,
  resolveLinkProfileSemantics,
  resolveMissingSupportedSocialProfileFields,
  type resolveSupportedSocialProfile,
} from "../src/lib/content/social-profile-fields";
import { normalizeHandle, resolveHandleFromUrl } from "../src/lib/identity/handle-resolver";
import {
  DEFAULT_AUTH_CACHE_PATH,
  type loadAuthenticatedCacheRegistry,
  resolveAuthenticatedCacheKey,
  validateAuthenticatedCacheEntry,
} from "./authenticated-extractors/cache";
import {
  DEFAULT_AUTH_EXTRACTORS_POLICY_PATH,
  type loadAuthenticatedExtractorsPolicy,
  resolveAuthenticatedExtractorById,
  resolveAuthenticatedExtractorDomainMatch,
} from "./authenticated-extractors/policy";
import {
  DEFAULT_BLOCKERS_REGISTRY_PATH,
  type KnownBlockerMatch,
  type loadRichEnrichmentBlockersRegistry,
  resolveKnownBlockerMatch,
} from "./enrichment/blockers-registry";
import { fetchMetadata } from "./enrichment/fetch-metadata";
import {
  areGeneratedRichMetadataEqual,
  buildStableGeneratedRichMetadata,
  readGeneratedRichMetadata,
} from "./enrichment/generated-metadata";
import { parseMetadata } from "./enrichment/parse-metadata";
import { resolvePublicReferralAugmentation } from "./enrichment/public-augmentation-profile-parsers";
import { capturePublicReferralTextFromBrowser } from "./enrichment/public-browser";
import { DEFAULT_PUBLIC_CACHE_PATH } from "./enrichment/public-cache-contracts";
import {
  buildPublicCacheEntry,
  resolveCachedEntryStatus,
  resolvePublicCacheMetadataRegression,
  toEnrichmentMetadataFromPublicCache,
  toPublicCacheMetadata,
} from "./enrichment/public-cache-metadata";
import {
  applyPublicCachePersistence,
  computePublicCacheExpiresAt,
  hasCacheablePublicMetadata,
  mergePublicCacheMetadataForTarget,
  resolvePublicCacheEntry,
  writePublicCacheRegistry,
  writePublicCacheRuntimeRegistry,
} from "./enrichment/public-cache-persistence";
import type { loadPublicCacheRegistry } from "./enrichment/public-cache-registry";
import { writeEnrichmentReport } from "./enrichment/report";
import { resolvePublicEnrichmentStrategy } from "./enrichment/strategy-registry";
import {
  augmentSupportedSocialProfileMetadata,
  reconcileSupportedProfileDescriptionMetadata,
} from "./enrichment/supported-social-profile-metadata";
import type {
  EnrichmentFailureMode,
  EnrichmentFailureReason,
  EnrichmentMetadata,
  EnrichmentReason,
  EnrichmentRunEntry,
  ExpectedSocialProfileField,
  GeneratedRichMetadata,
} from "./enrichment/types";
import type { loadRemoteCachePolicyRegistry } from "./shared/remote-cache-policy";
import {
  type RemoteCacheStatsCollector,
  createRemoteCacheStatsOutputPath,
  writeRemoteCacheRunSummary,
} from "./shared/remote-cache-stats";

import type { LinkInput, ResolvedConfig } from "./enrich-rich-links-config";
import {
  hasManualMetadataFallback,
  isBlockingReason,
  knownBlockerMessageFor,
  knownBlockerRemediationFor,
  makeEntryMessage,
  maybeReconcileAuthenticatedProfileDescriptions,
  mergeCachedPublicMetadata,
  mergeLinkMetadata,
  publicCacheMessageFor,
  publicCacheRemediationFor,
  publicCacheWriteSkippedNoticeFor,
  remediationFor,
  resolveGeneratedReferralWithBrowserFallback,
  resolveProfileWarningContext,
  resolveSupportedProfileForMetadata,
  toGeneratedLinkEntry,
  warnForMissingProfileFields,
} from "./enrich-rich-links-support";
type HandlerContext = {
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

const recordAuthenticatedFailure = (
  input: HandlerContext,
  detail: {
    authenticatedExtractorId: string;
    cacheKey: string;
    message: string;
    remediation: string;
    cacheCapturedAt?: string;
  },
): void => {
  const { link, generatedAt, handleForMetadata, supportedProfile, entries, generatedLinks } = input;
  const reason: EnrichmentReason = "authenticated_cache_missing";
  const metadata = mergeLinkMetadata(
    link.metadata,
    {
      handle: handleForMetadata,
      sourceLabel: link.enrichment?.sourceLabel,
      sourceLabelVisible: link.enrichment?.sourceLabelVisible,
      enrichmentStatus: "failed",
      enrichmentReason: reason,
      enrichedAt: generatedAt,
    },
    supportedProfile,
  );
  const warningSupportedProfile = resolveSupportedProfileForMetadata(
    link,
    metadata,
    supportedProfile,
  );
  const profileWarningContext = resolveProfileWarningContext(warningSupportedProfile, metadata);
  warnForMissingProfileFields(
    link.id,
    link.url,
    warningSupportedProfile,
    profileWarningContext.missingProfileFields,
  );
  entries.push({
    linkId: link.id,
    url: link.url,
    status: "failed",
    reason,
    attempts: 0,
    durationMs: 0,
    message: detail.message,
    remediation: detail.remediation,
    metadata,
    blocking: true,
    extractorId: detail.authenticatedExtractorId,
    cacheKey: detail.cacheKey,
    cacheCapturedAt: detail.cacheCapturedAt,
    ...profileWarningContext,
  });
  generatedLinks[link.id] = { metadata };
};

export const handleAuthenticatedLink = async (input: HandlerContext): Promise<boolean> => {
  const {
    link,
    config,
    generatedAt,
    handleForMetadata,
    supportedProfile,
    entries,
    generatedLinks,
    authenticatedExtractorId,
    authenticatedExtractorsPolicy,
    authenticatedCacheRegistry,
    blockersRegistry,
    remoteCachePolicyRegistry,
    remoteCacheStats,
    publicCacheRegistry,
    publicCacheWriteSkippedLinks,
    enforceStrictBlocking,
    state,
  } = input;

  if (!authenticatedExtractorId) return false;
  if (!authenticatedExtractorsPolicy || !authenticatedCacheRegistry) {
    throw new Error(
      "Authenticated extractor is configured but policy/cache registry was not initialized.",
    );
  }

  const extractor = resolveAuthenticatedExtractorById(
    authenticatedExtractorId,
    authenticatedExtractorsPolicy,
  );
  const cacheKey = resolveAuthenticatedCacheKey(link.enrichment?.authenticatedCacheKey, link.id);

  if (!extractor) {
    recordAuthenticatedFailure(input, {
      authenticatedExtractorId,
      cacheKey,
      message: `Authenticated extractor '${authenticatedExtractorId}' is not defined in ${DEFAULT_AUTH_EXTRACTORS_POLICY_PATH}.`,
      remediation:
        "Fix links[].enrichment.authenticatedExtractor or add the extractor to the authenticated policy registry, then run npm run setup:rich-auth.",
    });
    return true;
  }

  if (extractor.status === "disabled") {
    recordAuthenticatedFailure(input, {
      authenticatedExtractorId,
      cacheKey,
      message: `Authenticated extractor '${authenticatedExtractorId}' is disabled in policy.`,
      remediation:
        "Enable the extractor in data/policy/rich-authenticated-extractors.json or remove it from this link configuration, then run npm run setup:rich-auth.",
    });
    return true;
  }

  const domainMatch = resolveAuthenticatedExtractorDomainMatch(link.url, extractor);
  if (!domainMatch) {
    recordAuthenticatedFailure(input, {
      authenticatedExtractorId,
      cacheKey,
      message: `Link URL host does not match authenticated extractor '${authenticatedExtractorId}' policy domains.`,
      remediation: `Allowed domains: ${extractor.domains.join(
        ", ",
      )}. Fix links[].enrichment.authenticatedExtractor or link URL, then run npm run setup:rich-auth.`,
    });
    return true;
  }

  const cacheValidation = validateAuthenticatedCacheEntry({
    cacheKey,
    expectedLinkId: link.id,
    expectedExtractorId: authenticatedExtractorId,
    expectedUrl: link.url,
    profileSemantics: link.enrichment?.profileSemantics,
    warnAgeDays: config.authenticatedCacheWarnAgeDays,
    registry: authenticatedCacheRegistry,
  });

  const cacheErrors = cacheValidation.issues.filter((issue) => issue.level === "error");
  const cacheWarnings = cacheValidation.issues.filter((issue) => issue.level === "warning");
  const staleCache = cacheValidation.entry?.stale === true;

  if (cacheErrors.length > 0 || !cacheValidation.metadata || !cacheValidation.valid) {
    recordAuthenticatedFailure(input, {
      authenticatedExtractorId,
      cacheKey,
      message: cacheErrors.map((issue) => issue.message).join(" "),
      remediation: cacheErrors.map((issue) => issue.remediation).join(" "),
      cacheCapturedAt: cacheValidation.entry?.entry.capturedAt,
    });
    return true;
  }

  if (cacheWarnings.length > 0) {
    for (const warning of cacheWarnings) {
      console.warn(`Warning [${link.id}][${cacheKey}]: ${warning.message}`);
    }
  }

  const reason: EnrichmentReason = "authenticated_cache";
  const authenticatedMetadata = await maybeReconcileAuthenticatedProfileDescriptions({
    link,
    supportedProfile,
    metadata: cacheValidation.metadata,
    config,
    remoteCachePolicyRegistry,
    remoteCacheStats,
  });
  const metadata = mergeLinkMetadata(
    link.metadata,
    {
      ...authenticatedMetadata,
      handle: handleForMetadata ?? authenticatedMetadata.handle,
      sourceLabel:
        link.enrichment?.sourceLabel ?? authenticatedMetadata.sourceLabel ?? extractor.domains[0],
      sourceLabelVisible: link.enrichment?.sourceLabelVisible,
      enrichmentStatus: "fetched",
      enrichmentReason: reason,
      enrichedAt: generatedAt,
    },
    supportedProfile,
  );
  const warningSupportedProfile = resolveSupportedProfileForMetadata(
    link,
    metadata,
    supportedProfile,
  );
  const profileWarningContext = resolveProfileWarningContext(warningSupportedProfile, metadata);
  warnForMissingProfileFields(
    link.id,
    link.url,
    warningSupportedProfile,
    profileWarningContext.missingProfileFields,
  );

  entries.push({
    linkId: link.id,
    url: link.url,
    status: "fetched",
    reason,
    attempts: 0,
    durationMs: 0,
    message: staleCache
      ? "Using authenticated cache metadata (stale warning threshold exceeded)."
      : "Using authenticated cache metadata.",
    remediation: staleCache
      ? `Refresh cache with \`npm run setup:rich-auth\` (or \`npm run auth:rich:sync -- --only-link ${link.id}\`).`
      : remediationFor("fetched", reason),
    metadata,
    blocking: false,
    extractorId: authenticatedExtractorId,
    cacheKey,
    cacheCapturedAt: cacheValidation.entry?.entry.capturedAt,
    staleCache: staleCache || undefined,
    ...profileWarningContext,
  });
  generatedLinks[link.id] = { metadata };
  return true;
};
