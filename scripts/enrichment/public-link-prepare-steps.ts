import {
  hasManualMetadataFallback,
  isBlockingReason,
  knownBlockerMessageFor,
  knownBlockerRemediationFor,
  mergeCachedPublicMetadata,
  mergeLinkMetadata,
  publicCacheMessageFor,
  publicCacheRemediationFor,
  remediationFor,
  resolveGeneratedReferralWithBrowserFallback,
  resolveProfileWarningContext,
  resolveSupportedProfileForMetadata,
  toGeneratedLinkEntry,
  warnForMissingProfileFields,
} from "../enrich-rich-links-support";
import { resolveKnownBlockerMatch } from "./blockers-registry";
import { fetchMetadata } from "./fetch-metadata";
import {
  buildPublicCacheEntry,
  resolveCachedEntryStatus,
  toEnrichmentMetadataFromPublicCache,
} from "./public-cache-metadata";
import {
  applyPublicCachePersistence,
  computePublicCacheExpiresAt,
  hasCacheablePublicMetadata,
  resolvePublicCacheEntry,
} from "./public-cache-persistence";
import type {
  FetchedPublicPreparation,
  HandledPublicPreparation,
  PublicLinkHandlerContext,
  PublicLinkPreparationContext,
} from "./public-link-context";
import { resolvePublicEnrichmentStrategy } from "./strategy-registry";
import type { EnrichmentReason } from "./types";

const handled = (abortedEarly = false): HandledPublicPreparation => ({
  kind: "handled",
  abortedEarly,
});

export const createPublicLinkPreparationContext = (
  input: PublicLinkHandlerContext,
): PublicLinkPreparationContext => {
  const publicStrategy = resolvePublicEnrichmentStrategy({
    url: input.link.url,
    icon: input.link.icon,
    metadataHandle: input.handleForMetadata,
  });
  const publicCacheKey = input.link.id;
  const publicSourceUrl = publicStrategy.source.sourceUrl;
  return {
    publicStrategy,
    knownBlockerMatch: resolveKnownBlockerMatch(
      input.link.url,
      input.blockersRegistry,
      "direct_fetch",
    ),
    allowKnownBlockerByPublicStrategy: publicStrategy.branch === "public_augmented",
    allowKnownBlocker: input.link.enrichment?.allowKnownBlocker === true,
    publicCacheKey,
    publicSourceUrl,
    existingPublicEntry: input.publicCacheRegistry.entries[publicCacheKey],
    cachedPublicEntry: resolvePublicCacheEntry(
      input.publicCacheRegistry,
      publicCacheKey,
      publicSourceUrl,
    ),
  };
};

const profileWarningContextFor = (
  input: PublicLinkHandlerContext,
  metadata: Parameters<typeof resolveSupportedProfileForMetadata>[1],
) => {
  const warningSupportedProfile = resolveSupportedProfileForMetadata(
    input.link,
    metadata,
    input.supportedProfile,
  );
  const warningContext = resolveProfileWarningContext(warningSupportedProfile, metadata);
  warnForMissingProfileFields(
    input.link.id,
    input.link.url,
    warningSupportedProfile,
    warningContext.missingProfileFields,
  );
  return warningContext;
};

export const maybeHandleKnownPublicBlocker = (
  input: PublicLinkHandlerContext,
  context: PublicLinkPreparationContext,
): HandledPublicPreparation | null => {
  const { link, generatedAt, handleForMetadata, supportedProfile, entries, generatedLinks } = input;
  const { knownBlockerMatch, allowKnownBlocker, allowKnownBlockerByPublicStrategy } = context;
  if (!knownBlockerMatch || allowKnownBlocker || allowKnownBlockerByPublicStrategy) return null;
  const reason: EnrichmentReason = "known_blocker";
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
  const profileWarningContext = profileWarningContextFor(input, metadata);
  entries.push({
    linkId: link.id,
    url: link.url,
    status: "failed",
    reason,
    attempts: 0,
    durationMs: 0,
    message: knownBlockerMessageFor(knownBlockerMatch),
    remediation: knownBlockerRemediationFor(knownBlockerMatch),
    metadata,
    blocking: true,
    ...profileWarningContext,
  });
  generatedLinks[link.id] = { metadata };
  return handled();
};

export const warnForAllowedKnownPublicBlocker = (
  input: PublicLinkHandlerContext,
  context: PublicLinkPreparationContext,
) => {
  if (!context.knownBlockerMatch || !context.allowKnownBlocker) return;
  console.warn(
    [
      `Warning: link '${input.link.id}' matches known blocker '${context.knownBlockerMatch.blocker.id}'`,
      "because enrichment.allowKnownBlocker=true is set, enrichment fetch will proceed anyway.",
      `Host: ${context.knownBlockerMatch.host} (matched: ${context.knownBlockerMatch.matchedDomain})`,
    ].join(" "),
  );
};

export const maybeHandleFreshPublicCache = async (
  input: PublicLinkHandlerContext,
  context: PublicLinkPreparationContext,
): Promise<HandledPublicPreparation | null> => {
  const cached = context.cachedPublicEntry;
  if (!cached?.fresh) return null;
  const cachedMetadata = toEnrichmentMetadataFromPublicCache(cached.entry.metadata);
  const cachedStatus = resolveCachedEntryStatus(cached.entry.metadata);
  const manualFallbackUsed =
    !!cachedStatus.missingFields &&
    input.config.allowManualMetadataFallback &&
    hasManualMetadataFallback(input.link.metadata);
  const metadata = mergeCachedPublicMetadata(
    input.link,
    input.supportedProfile,
    input.handleForMetadata,
    cachedMetadata,
    cached.entry.updatedAt,
    cachedStatus.status,
  );
  const profileWarningContext = profileWarningContextFor(input, metadata);
  const generatedReferral = await resolveGeneratedReferralWithBrowserFallback({
    link: input.link,
    publicStrategy: context.publicStrategy,
    sourceUrl: context.publicSourceUrl,
    metadata,
    generatedAt: input.generatedAt,
  });
  input.entries.push({
    linkId: input.link.id,
    url: input.link.url,
    status: cachedStatus.status,
    reason: "public_cache",
    attempts: 0,
    durationMs: 0,
    message: publicCacheMessageFor(false, manualFallbackUsed, true),
    remediation: publicCacheRemediationFor(input.link.id, false),
    metadata,
    blocking: false,
    manualFallbackUsed: manualFallbackUsed || undefined,
    missingFields: cachedStatus.missingFields,
    cacheKey: context.publicCacheKey,
    cacheCapturedAt: cached.entry.capturedAt,
    referral: generatedReferral,
    referralCompleteness: generatedReferral?.completeness,
    ...profileWarningContext,
  });
  input.generatedLinks[input.link.id] = toGeneratedLinkEntry({
    metadata,
    referral: generatedReferral,
  });
  return handled();
};

export const fetchPublicLinkMetadata = async (
  input: PublicLinkHandlerContext,
  context: PublicLinkPreparationContext,
) =>
  fetchMetadata(context.publicSourceUrl, {
    timeoutMs: input.config.timeoutMs,
    retries: input.config.retries,
    headers: context.publicStrategy.source.headers,
    acceptHeader: context.publicStrategy.source.acceptHeader,
    policyRegistry: input.remoteCachePolicyRegistry,
    statsCollector: input.remoteCacheStats,
    cache: context.cachedPublicEntry
      ? {
          etag: context.cachedPublicEntry.entry.etag,
          lastModified: context.cachedPublicEntry.entry.lastModified,
          cacheControl: context.cachedPublicEntry.entry.cacheControl,
          expiresAt: context.cachedPublicEntry.entry.expiresAt,
          hasValue: true,
        }
      : undefined,
  });

export const maybeHandleRevalidatedPublicCache = async (
  input: PublicLinkHandlerContext,
  context: PublicLinkPreparationContext,
  fetched: Awaited<ReturnType<typeof fetchMetadata>>,
): Promise<HandledPublicPreparation | null> => {
  const cached = context.cachedPublicEntry;
  if (!fetched.notModified || !cached) return null;
  const cacheControl = fetched.cacheControl ?? cached.entry.cacheControl;
  const refreshedEntry = buildPublicCacheEntry({
    previous: cached.entry,
    linkId: input.link.id,
    sourceUrl: context.publicSourceUrl,
    metadata: cached.entry.metadata,
    updatedAt: input.generatedAt,
    etag: fetched.etag ?? cached.entry.etag,
    lastModified: fetched.lastModified ?? cached.entry.lastModified,
    cacheControl,
    expiresAt:
      computePublicCacheExpiresAt(cacheControl, fetched.responseDate) ?? cached.entry.expiresAt,
    checkedAt: input.generatedAt,
    checkStatus: fetched.checkStatus,
  });
  const persistence = applyPublicCachePersistence({
    registry: input.publicCacheRegistry,
    cacheKey: context.publicCacheKey,
    nextEntry: refreshedEntry,
    allowStableWrite: input.config.writePublicCache,
    updatedAt: input.generatedAt,
  });
  if (persistence.changed) input.state.publicCacheDirty = true;
  const cachedMetadata = toEnrichmentMetadataFromPublicCache(refreshedEntry.metadata);
  const cachedStatus = resolveCachedEntryStatus(refreshedEntry.metadata);
  const manualFallbackUsed =
    !!cachedStatus.missingFields &&
    input.config.allowManualMetadataFallback &&
    hasManualMetadataFallback(input.link.metadata);
  const metadata = mergeCachedPublicMetadata(
    input.link,
    input.supportedProfile,
    input.handleForMetadata,
    cachedMetadata,
    refreshedEntry.updatedAt,
    cachedStatus.status,
  );
  const profileWarningContext = profileWarningContextFor(input, metadata);
  const generatedReferral = await resolveGeneratedReferralWithBrowserFallback({
    link: input.link,
    publicStrategy: context.publicStrategy,
    sourceUrl: context.publicSourceUrl,
    finalUrl: fetched.finalUrl,
    metadata,
    generatedAt: input.generatedAt,
  });
  input.entries.push({
    linkId: input.link.id,
    url: input.link.url,
    status: cachedStatus.status,
    reason: "public_cache",
    attempts: fetched.attempts,
    durationMs: fetched.durationMs,
    statusCode: fetched.statusCode,
    message: publicCacheMessageFor(false, manualFallbackUsed, false),
    remediation: publicCacheRemediationFor(input.link.id, false),
    metadata,
    blocking: false,
    manualFallbackUsed: manualFallbackUsed || undefined,
    missingFields: cachedStatus.missingFields,
    cacheKey: context.publicCacheKey,
    cacheCapturedAt: refreshedEntry.capturedAt,
    referral: generatedReferral,
    referralCompleteness: generatedReferral?.completeness,
    ...profileWarningContext,
  });
  input.generatedLinks[input.link.id] = toGeneratedLinkEntry({
    metadata,
    referral: generatedReferral,
  });
  return handled();
};

const handleStalePublicCacheAfterFailure = async (
  input: PublicLinkHandlerContext,
  context: PublicLinkPreparationContext,
  fetched: Awaited<ReturnType<typeof fetchMetadata>>,
): Promise<HandledPublicPreparation | null> => {
  const cached = context.cachedPublicEntry;
  if (!cached || !hasCacheablePublicMetadata(cached.entry.metadata)) return null;
  const cachedMetadata = toEnrichmentMetadataFromPublicCache(cached.entry.metadata);
  const cachedStatus = resolveCachedEntryStatus(cached.entry.metadata);
  const manualFallbackUsed =
    !!cachedStatus.missingFields &&
    input.config.allowManualMetadataFallback &&
    hasManualMetadataFallback(input.link.metadata);
  const metadata = mergeCachedPublicMetadata(
    input.link,
    input.supportedProfile,
    input.handleForMetadata,
    cachedMetadata,
    cached.entry.capturedAt,
    cachedStatus.status,
  );
  const profileWarningContext = profileWarningContextFor(input, metadata);
  const generatedReferral = await resolveGeneratedReferralWithBrowserFallback({
    link: input.link,
    publicStrategy: context.publicStrategy,
    sourceUrl: context.publicSourceUrl,
    metadata,
    generatedAt: input.generatedAt,
  });
  input.entries.push({
    linkId: input.link.id,
    url: input.link.url,
    status: cachedStatus.status,
    reason: "public_cache",
    attempts: fetched.attempts,
    durationMs: fetched.durationMs,
    statusCode: fetched.statusCode,
    message: publicCacheMessageFor(true, manualFallbackUsed, false),
    remediation: publicCacheRemediationFor(input.link.id, true),
    metadata,
    blocking: false,
    manualFallbackUsed: manualFallbackUsed || undefined,
    missingFields: cachedStatus.missingFields,
    cacheKey: context.publicCacheKey,
    cacheCapturedAt: cached.entry.capturedAt,
    staleCache: true,
    referral: generatedReferral,
    referralCompleteness: generatedReferral?.completeness,
    ...profileWarningContext,
  });
  input.generatedLinks[input.link.id] = toGeneratedLinkEntry({
    metadata,
    referral: generatedReferral,
  });
  return handled();
};

const handlePublicFetchFailure = (
  input: PublicLinkHandlerContext,
  context: PublicLinkPreparationContext,
  fetched: Awaited<ReturnType<typeof fetchMetadata>>,
): HandledPublicPreparation => {
  const reason: EnrichmentReason =
    context.knownBlockerMatch &&
    !context.allowKnownBlocker &&
    context.allowKnownBlockerByPublicStrategy
      ? "known_blocker"
      : "fetch_failed";
  const failureDetail =
    fetched.error ??
    `Failed to fetch public metadata source '${context.publicSourceUrl}' (status=${fetched.statusCode ?? "n/a"}).`;
  const metadata = mergeLinkMetadata(
    input.link.metadata,
    {
      handle: input.handleForMetadata,
      sourceLabel: input.link.enrichment?.sourceLabel,
      sourceLabelVisible: input.link.enrichment?.sourceLabelVisible,
      enrichmentStatus: "failed",
      enrichmentReason: reason,
      enrichedAt: input.generatedAt,
    },
    input.supportedProfile,
  );
  const profileWarningContext = profileWarningContextFor(input, metadata);
  const blocking = reason === "known_blocker" || isBlockingReason(reason, input.config.failOn);
  input.entries.push({
    linkId: input.link.id,
    url: input.link.url,
    status: "failed",
    reason,
    attempts: fetched.attempts,
    durationMs: fetched.durationMs,
    statusCode: fetched.statusCode,
    message:
      reason === "known_blocker" && context.knownBlockerMatch
        ? knownBlockerMessageFor(context.knownBlockerMatch, failureDetail)
        : failureDetail,
    remediation:
      reason === "known_blocker" && context.knownBlockerMatch
        ? knownBlockerRemediationFor(context.knownBlockerMatch)
        : remediationFor("failed", reason),
    metadata,
    blocking,
    ...profileWarningContext,
  });
  input.generatedLinks[input.link.id] = { metadata };
  return handled(
    input.enforceStrictBlocking && input.config.failureMode === "immediate" && blocking,
  );
};

export const maybeHandlePublicFetchFailure = async (
  input: PublicLinkHandlerContext,
  context: PublicLinkPreparationContext,
  fetched: Awaited<ReturnType<typeof fetchMetadata>>,
): Promise<HandledPublicPreparation | null> => {
  if (fetched.ok && fetched.html) return null;
  return (
    (await handleStalePublicCacheAfterFailure(input, context, fetched)) ??
    handlePublicFetchFailure(input, context, fetched)
  );
};

export const toFetchedPublicPreparation = (
  context: PublicLinkPreparationContext,
  fetched: Awaited<ReturnType<typeof fetchMetadata>> & { html: string },
): FetchedPublicPreparation => ({
  kind: "fetched",
  abortedEarly: false,
  fetched,
  html: fetched.html,
  ...context,
});
