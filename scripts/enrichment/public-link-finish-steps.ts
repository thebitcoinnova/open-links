import {
  hasManualMetadataFallback,
  isBlockingReason,
  knownBlockerMessageFor,
  knownBlockerRemediationFor,
  makeEntryMessage,
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
} from "../enrich-rich-links-support";
import {
  buildPublicCacheEntry,
  resolveCachedEntryStatus,
  resolvePublicCacheMetadataRegression,
  toEnrichmentMetadataFromPublicCache,
  toPublicCacheMetadata,
} from "./public-cache-metadata";
import {
  applyPublicCachePersistence,
  computePublicCacheExpiresAt,
  hasCacheablePublicMetadata,
  mergePublicCacheMetadataForTarget,
} from "./public-cache-persistence";
import type { FetchedPublicPreparation, PublicLinkHandlerContext } from "./public-link-context";
import { augmentSupportedSocialProfileMetadata } from "./supported-social-profile-metadata";
import type { EnrichmentMetadata, EnrichmentReason, EnrichmentRunEntry } from "./types";

type ParsedPublicMetadata = {
  metadata: EnrichmentMetadata;
  completeness: "full" | "partial" | "none";
  missing: Array<"title" | "description" | "image">;
};

export type PublicParseOutcome =
  | { kind: "parsed"; parsed: ParsedPublicMetadata }
  | { kind: "failed"; maybeMessage?: string };

type ParsedPublicState = {
  parsed: ParsedPublicMetadata;
  cacheMetadata: ReturnType<typeof toPublicCacheMetadata>;
  metadataRegressionEntry: ReturnType<typeof resolvePublicCacheMetadataRegression>;
};

const profileWarningContextFor = (
  input: PublicLinkHandlerContext,
  metadata: EnrichmentMetadata,
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

export const parseFetchedPublicMetadata = (
  preparation: FetchedPublicPreparation,
): PublicParseOutcome => {
  try {
    const parsed = preparation.publicStrategy.normalize(preparation.html);
    return parsed ? { kind: "parsed", parsed } : { kind: "failed" };
  } catch (error: unknown) {
    return {
      kind: "failed",
      maybeMessage: error instanceof Error ? error.message : String(error),
    };
  }
};

const handleStaleCacheAfterParseFailure = async (
  input: PublicLinkHandlerContext,
  preparation: FetchedPublicPreparation,
): Promise<boolean> => {
  const cached = preparation.cachedPublicEntry;
  if (!cached || !hasCacheablePublicMetadata(cached.entry.metadata)) return false;
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
    publicStrategy: preparation.publicStrategy,
    sourceUrl: preparation.publicSourceUrl,
    finalUrl: preparation.fetched.finalUrl,
    metadata,
    generatedAt: input.generatedAt,
  });
  input.entries.push({
    linkId: input.link.id,
    url: input.link.url,
    status: cachedStatus.status,
    reason: "public_cache",
    attempts: preparation.fetched.attempts,
    durationMs: preparation.fetched.durationMs,
    statusCode: preparation.fetched.statusCode,
    message: publicCacheMessageFor(true, manualFallbackUsed, false),
    remediation: publicCacheRemediationFor(input.link.id, true),
    metadata,
    blocking: false,
    manualFallbackUsed: manualFallbackUsed || undefined,
    missingFields: cachedStatus.missingFields,
    cacheKey: preparation.publicCacheKey,
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
  return true;
};

const handlePublicParseFailure = (
  input: PublicLinkHandlerContext,
  preparation: FetchedPublicPreparation,
  maybeMessage: string | undefined,
): boolean => {
  const reason: EnrichmentReason =
    preparation.knownBlockerMatch &&
    !preparation.allowKnownBlocker &&
    preparation.allowKnownBlockerByPublicStrategy
      ? "known_blocker"
      : "fetch_failed";
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
    attempts: preparation.fetched.attempts,
    durationMs: preparation.fetched.durationMs,
    statusCode: preparation.fetched.statusCode,
    message:
      reason === "known_blocker" && preparation.knownBlockerMatch
        ? knownBlockerMessageFor(preparation.knownBlockerMatch, maybeMessage)
        : (maybeMessage ?? makeEntryMessage("failed", reason)),
    remediation:
      reason === "known_blocker" && preparation.knownBlockerMatch
        ? knownBlockerRemediationFor(preparation.knownBlockerMatch)
        : remediationFor("failed", reason),
    metadata,
    blocking,
    ...profileWarningContext,
  });
  input.generatedLinks[input.link.id] = { metadata };
  return input.enforceStrictBlocking && input.config.failureMode === "immediate" && blocking;
};

export const finishUnparsedPublicLink = async (
  input: PublicLinkHandlerContext,
  preparation: FetchedPublicPreparation,
  outcome: Extract<PublicParseOutcome, { kind: "failed" }>,
): Promise<{ abortedEarly: boolean }> => {
  if (await handleStaleCacheAfterParseFailure(input, preparation)) {
    return { abortedEarly: false };
  }
  return { abortedEarly: handlePublicParseFailure(input, preparation, outcome.maybeMessage) };
};

export const createParsedPublicState = (
  input: PublicLinkHandlerContext,
  preparation: FetchedPublicPreparation,
  parsed: ParsedPublicMetadata,
): ParsedPublicState => {
  const enrichedMetadata = augmentSupportedSocialProfileMetadata({
    html: preparation.html,
    metadata: parsed.metadata,
    supportedProfile: input.supportedProfile,
  });
  const cacheMetadata = mergePublicCacheMetadataForTarget({
    targetId:
      preparation.publicStrategy.branch === "public_augmented"
        ? preparation.publicStrategy.id
        : null,
    previous: preparation.cachedPublicEntry?.entry.metadata,
    next: toPublicCacheMetadata(enrichedMetadata),
  });
  return {
    parsed,
    cacheMetadata,
    metadataRegressionEntry: resolvePublicCacheMetadataRegression({
      previous: preparation.cachedPublicEntry?.entry,
      linkId: input.link.id,
      sourceUrl: preparation.publicSourceUrl,
      nextMetadata: cacheMetadata,
    }),
  };
};

export const maybeHandlePublicMetadataRegression = async (
  input: PublicLinkHandlerContext,
  preparation: FetchedPublicPreparation,
  state: ParsedPublicState,
): Promise<boolean> => {
  const regression = state.metadataRegressionEntry;
  if (!regression) return false;
  const metadata = mergeCachedPublicMetadata(
    input.link,
    input.supportedProfile,
    input.handleForMetadata,
    toEnrichmentMetadataFromPublicCache(regression.metadata),
    regression.capturedAt,
    "fetched",
  );
  const profileWarningContext = profileWarningContextFor(input, metadata);
  const generatedReferral = await resolveGeneratedReferralWithBrowserFallback({
    link: input.link,
    publicStrategy: preparation.publicStrategy,
    sourceUrl: preparation.publicSourceUrl,
    finalUrl: preparation.fetched.finalUrl,
    metadata,
    generatedAt: input.generatedAt,
  });
  metadata.enrichmentReason = "metadata_regression";
  metadata.enrichedAt = input.generatedAt;
  input.entries.push({
    linkId: input.link.id,
    url: input.link.url,
    status: "fetched",
    reason: "metadata_regression",
    attempts: preparation.fetched.attempts,
    durationMs: preparation.fetched.durationMs,
    statusCode: preparation.fetched.statusCode,
    message:
      "Current same-source refresh returned incomplete metadata; retained the complete last-known-good public cache entry.",
    remediation:
      "Retry the public metadata refresh later. The stable cache was intentionally not overwritten.",
    metadata,
    blocking: false,
    missingFields: state.parsed.missing,
    cacheKey: preparation.publicCacheKey,
    cacheCapturedAt: regression.capturedAt,
    staleCache: true,
    referral: generatedReferral,
    referralCompleteness: generatedReferral?.completeness,
    ...profileWarningContext,
  });
  input.generatedLinks[input.link.id] = toGeneratedLinkEntry({
    metadata,
    referral: generatedReferral,
  });
  return true;
};

const persistParsedPublicMetadata = (
  input: PublicLinkHandlerContext,
  preparation: FetchedPublicPreparation,
  state: ParsedPublicState,
) => {
  const sourceIdentityChanged = Boolean(
    preparation.existingPublicEntry &&
      (preparation.existingPublicEntry.linkId !== input.link.id ||
        preparation.existingPublicEntry.sourceUrl !== preparation.publicSourceUrl),
  );
  const canPersist = !sourceIdentityChanged || state.parsed.completeness === "full";
  const persistence = hasCacheablePublicMetadata(state.cacheMetadata)
    ? canPersist
      ? applyPublicCachePersistence({
          registry: input.publicCacheRegistry,
          cacheKey: preparation.publicCacheKey,
          nextEntry: buildPublicCacheEntry({
            previous: preparation.cachedPublicEntry?.entry,
            linkId: input.link.id,
            sourceUrl: preparation.publicSourceUrl,
            metadata: state.cacheMetadata,
            updatedAt: input.generatedAt,
            etag: preparation.fetched.etag,
            lastModified: preparation.fetched.lastModified,
            cacheControl: preparation.fetched.cacheControl,
            expiresAt: computePublicCacheExpiresAt(
              preparation.fetched.cacheControl,
              preparation.fetched.responseDate,
            ),
            checkedAt: input.generatedAt,
            checkStatus: preparation.fetched.checkStatus,
          }),
          allowStableWrite: input.config.writePublicCache,
          updatedAt: input.generatedAt,
        })
      : {
          action: "noop" as const,
          changed: false,
          stableWriteSkipped: true,
          skippedStableOperation: "upsert" as const,
        }
    : applyPublicCachePersistence({
        registry: input.publicCacheRegistry,
        cacheKey: preparation.publicCacheKey,
        allowStableWrite: input.config.writePublicCache,
        updatedAt: input.generatedAt,
      });
  if (persistence.changed) input.state.publicCacheDirty = true;
  if (persistence.stableWriteSkipped) input.publicCacheWriteSkippedLinks.add(input.link.id);
  return persistence;
};

export const finishParsedPublicLink = async (
  input: PublicLinkHandlerContext,
  preparation: FetchedPublicPreparation,
  state: ParsedPublicState,
): Promise<{ abortedEarly: boolean }> => {
  const persistence = persistParsedPublicMetadata(input, preparation, state);
  const reason: EnrichmentReason =
    state.parsed.completeness === "full"
      ? "metadata_complete"
      : state.parsed.completeness === "partial"
        ? "metadata_partial"
        : "metadata_missing";
  const status: EnrichmentRunEntry["status"] =
    state.parsed.completeness === "full" ? "fetched" : "partial";
  const manualFallbackUsed =
    reason === "metadata_missing" &&
    input.config.allowManualMetadataFallback &&
    hasManualMetadataFallback(input.link.metadata);
  const blocking = isBlockingReason(reason, input.config.failOn) && !manualFallbackUsed;
  let message = makeEntryMessage(status, reason, manualFallbackUsed);
  let remediation = remediationFor(status, reason, manualFallbackUsed);
  if (persistence.stableWriteSkipped) {
    const notice = publicCacheWriteSkippedNoticeFor(persistence.skippedStableOperation ?? "upsert");
    message = `${message} ${notice.message}`;
    remediation = notice.remediation;
  }
  const fromCache = toEnrichmentMetadataFromPublicCache(state.cacheMetadata);
  const metadata = mergeLinkMetadata(
    input.link.metadata,
    {
      ...fromCache,
      handle: input.handleForMetadata ?? fromCache.handle,
      sourceLabel: input.link.enrichment?.sourceLabel ?? fromCache.sourceLabel,
      sourceLabelVisible: input.link.enrichment?.sourceLabelVisible,
      enrichmentStatus: status,
      enrichmentReason: reason,
      enrichedAt: input.generatedAt,
    },
    input.supportedProfile,
  );
  const profileWarningContext = profileWarningContextFor(input, metadata);
  const generatedReferral = await resolveGeneratedReferralWithBrowserFallback({
    link: input.link,
    publicStrategy: preparation.publicStrategy,
    sourceUrl: preparation.publicSourceUrl,
    finalUrl: preparation.fetched.finalUrl,
    metadata,
    generatedAt: input.generatedAt,
  });
  input.entries.push({
    linkId: input.link.id,
    url: input.link.url,
    status,
    reason,
    attempts: preparation.fetched.attempts,
    durationMs: preparation.fetched.durationMs,
    statusCode: preparation.fetched.statusCode,
    message,
    remediation,
    metadata,
    blocking,
    manualFallbackUsed: manualFallbackUsed || undefined,
    missingFields: reason === "metadata_missing" ? state.parsed.missing : undefined,
    referral: generatedReferral,
    referralCompleteness: generatedReferral?.completeness,
    ...profileWarningContext,
  });
  input.generatedLinks[input.link.id] = toGeneratedLinkEntry({
    metadata,
    referral: generatedReferral,
  });
  return {
    abortedEarly:
      input.enforceStrictBlocking && input.config.failureMode === "immediate" && blocking,
  };
};
