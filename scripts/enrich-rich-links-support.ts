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
  resolveSupportedSocialProfile,
} from "../src/lib/content/social-profile-fields";
import { normalizeHandle, resolveHandleFromUrl } from "../src/lib/identity/handle-resolver";
import {
  DEFAULT_AUTH_CACHE_PATH,
  loadAuthenticatedCacheRegistry,
  resolveAuthenticatedCacheKey,
  validateAuthenticatedCacheEntry,
} from "./authenticated-extractors/cache";
import {
  DEFAULT_AUTH_EXTRACTORS_POLICY_PATH,
  loadAuthenticatedExtractorsPolicy,
  resolveAuthenticatedExtractorById,
  resolveAuthenticatedExtractorDomainMatch,
} from "./authenticated-extractors/policy";
import {
  DEFAULT_BLOCKERS_REGISTRY_PATH,
  type KnownBlockerMatch,
  loadRichEnrichmentBlockersRegistry,
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
  type toEnrichmentMetadataFromPublicCache,
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
import { loadPublicCacheRegistry } from "./enrichment/public-cache-registry";
import { writeEnrichmentReport } from "./enrichment/report";
import type { resolvePublicEnrichmentStrategy } from "./enrichment/strategy-registry";
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
  ENRICHMENT_BYPASS_ENV,
  PUBLIC_CACHE_WRITE_COMMAND,
  absolutePath,
  isFailureReason,
} from "./enrich-rich-links-config";
export const ensureDirectory = (relativePath: string) => {
  const absoluteDir = path.dirname(absolutePath(relativePath));
  fs.mkdirSync(absoluteDir, { recursive: true });
};

export const pickDefined = (metadata: EnrichmentMetadata): EnrichmentMetadata => {
  const result: EnrichmentMetadata = {};
  const resultRecord = result as Record<string, unknown>;

  if (metadata.title) result.title = metadata.title;
  if (metadata.description) result.description = metadata.description;
  if (metadata.image) result.image = metadata.image;
  if (metadata.ogImage) result.ogImage = metadata.ogImage;
  if (metadata.twitterImage) result.twitterImage = metadata.twitterImage;
  if (metadata.handle) result.handle = metadata.handle;
  if (metadata.sourceLabel) result.sourceLabel = metadata.sourceLabel;
  if (typeof metadata.sourceLabelVisible === "boolean") {
    result.sourceLabelVisible = metadata.sourceLabelVisible;
  }
  if (metadata.enrichmentStatus) result.enrichmentStatus = metadata.enrichmentStatus;
  if (metadata.enrichmentReason) result.enrichmentReason = metadata.enrichmentReason;
  if (metadata.enrichedAt) result.enrichedAt = metadata.enrichedAt;
  for (const field of SOCIAL_PROFILE_METADATA_FIELDS) {
    const value = metadata[field];
    if (typeof value === "number" && Number.isFinite(value)) {
      resultRecord[field] = value;
      continue;
    }
    if (typeof value === "string" && value.trim().length > 0) {
      resultRecord[field] = value;
    }
  }

  return result;
};

export const mergeMetadata = (
  original: EnrichmentMetadata | undefined,
  enriched: EnrichmentMetadata,
): EnrichmentMetadata =>
  pickDefined(mergeMetadataWithManualSocialProfileOverrides(original, enriched) ?? {});

export const mergeLinkMetadata = (
  original: EnrichmentMetadata | undefined,
  enriched: EnrichmentMetadata,
  supportedProfile: ReturnType<typeof resolveSupportedSocialProfile>,
): EnrichmentMetadata => {
  const metadata = mergeMetadata(original, enriched);
  return normalizeSupportedSocialProfileMetadata(metadata, supportedProfile) ?? metadata;
};

export const resolveSupportedProfileForMetadata = (
  link: LinkInput & { type: "rich"; url: string },
  metadata: EnrichmentMetadata,
  fallbackSupportedProfile: ReturnType<typeof resolveSupportedSocialProfile>,
): ReturnType<typeof resolveSupportedSocialProfile> =>
  resolveSupportedSocialProfile({
    url: link.url,
    icon: link.icon,
    metadataHandle: metadata.handle,
    profileSemantics: link.enrichment?.profileSemantics,
  }) ?? fallbackSupportedProfile;

export const maybeReconcileAuthenticatedProfileDescriptions = async (input: {
  link: LinkInput & { type: "rich"; url: string };
  supportedProfile: ReturnType<typeof resolveSupportedSocialProfile>;
  metadata: EnrichmentMetadata;
  config: ResolvedConfig;
  remoteCachePolicyRegistry: ReturnType<typeof loadRemoteCachePolicyRegistry>;
  remoteCacheStats: RemoteCacheStatsCollector;
}): Promise<EnrichmentMetadata> => {
  if (input.supportedProfile?.platform !== "linkedin") {
    return input.metadata;
  }

  if (
    typeof input.metadata.profileDescription === "string" &&
    input.metadata.profileDescription.trim().length > 0
  ) {
    return input.metadata;
  }

  const fetched = await fetchMetadata(input.link.url, {
    timeoutMs: input.config.timeoutMs,
    retries: input.config.retries,
    policyRegistry: input.remoteCachePolicyRegistry,
    statsCollector: input.remoteCacheStats,
  });

  if (!fetched.ok || !fetched.html) {
    return input.metadata;
  }

  return reconcileSupportedProfileDescriptionMetadata({
    supportedProfile: input.supportedProfile,
    metadata: input.metadata,
    publicMetadata: parseMetadata(fetched.html, input.link.url).metadata,
  });
};

export const resolveProfileWarningContext = (
  supportedProfile: ReturnType<typeof resolveSupportedSocialProfile>,
  metadata: EnrichmentMetadata,
): {
  supportedProfilePlatform?: EnrichmentRunEntry["supportedProfilePlatform"];
  missingProfileFields?: ExpectedSocialProfileField[];
} => {
  if (!supportedProfile) {
    return {};
  }

  const missingProfileFields = resolveMissingSupportedSocialProfileFields(
    metadata,
    supportedProfile,
  );
  return {
    supportedProfilePlatform: supportedProfile.platform,
    missingProfileFields: missingProfileFields.length > 0 ? missingProfileFields : undefined,
  };
};

export const warnForMissingProfileFields = (
  linkId: string,
  url: string,
  supportedProfile: ReturnType<typeof resolveSupportedSocialProfile>,
  missingProfileFields: ExpectedSocialProfileField[] | undefined,
) => {
  if (!supportedProfile || !missingProfileFields || missingProfileFields.length === 0) {
    return;
  }

  console.warn(
    [
      `Warning [${linkId}]: supported ${supportedProfile.platform} profile metadata is incomplete.`,
      `Missing fields: ${missingProfileFields.join(", ")}.`,
      `URL: ${url}`,
    ].join(" "),
  );
};

export const hasManualMetadataFallback = (metadata: EnrichmentMetadata | undefined): boolean => {
  if (!metadata) {
    return false;
  }

  const candidates = [metadata.title, metadata.description, metadata.image];
  return candidates.some((value) => typeof value === "string" && value.trim().length > 0);
};

export const makeEntryMessage = (
  status: EnrichmentRunEntry["status"],
  reason: EnrichmentReason,
  manualFallbackUsed = false,
): string => {
  if (status === "skipped") {
    return "Enrichment skipped by configuration.";
  }

  if (reason === "known_blocker") {
    return "Known blocked domain matched the rich-link URL for direct metadata fetch.";
  }

  if (reason === "authenticated_cache") {
    return "Using committed authenticated cache metadata for this link.";
  }

  if (reason === "public_cache") {
    return "Using committed public cache metadata for this link.";
  }

  if (reason === "authenticated_cache_missing") {
    return "Authenticated cache entry was missing or invalid for this link.";
  }

  if (status === "failed") {
    return "Metadata fetch failed for this link.";
  }

  if (reason === "metadata_missing" && manualFallbackUsed) {
    return "No remote preview metadata found; using manual link.metadata fallback.";
  }

  if (reason === "metadata_missing") {
    return "No preview metadata found; rich-card fallback shell will be used.";
  }

  if (reason === "metadata_partial") {
    return "Partial preview metadata found; missing fields will use fallback values.";
  }

  return "Preview metadata fetched successfully.";
};

export const remediationFor = (
  status: EnrichmentRunEntry["status"],
  reason: EnrichmentReason,
  manualFallbackUsed = false,
): string => {
  if (status === "skipped") {
    return "Set enrichment.enabled=true on this rich link or adjust site.ui.richCards.enrichment.enabledByDefault.";
  }

  if (reason === "known_blocker") {
    return "Disable enrichment for this link, set enrichment.allowKnownBlocker=true to force-attempt anyway, or provide manual metadata under links[].metadata.";
  }

  if (reason === "authenticated_cache") {
    return "No action required. Keep cache fresh with `npm run setup:rich-auth` (or `npm run auth:rich:sync`) when metadata changes.";
  }

  if (reason === "public_cache") {
    return `No action required. Stable public-cache refreshes are explicit; run \`${PUBLIC_CACHE_WRITE_COMMAND}\` when you want to persist fetched public metadata changes.`;
  }

  if (reason === "authenticated_cache_missing") {
    return "Run `npm run setup:rich-auth` (or `npm run auth:rich:sync -- --only-link <link-id>`), commit `data/cache/rich-authenticated-cache.json` and `public/cache/rich-authenticated/*`, then rerun build.";
  }

  if (status === "failed") {
    return "Check URL/network availability, provide metadata manually under link.metadata, or disable enrichment for this link.";
  }

  if (reason === "metadata_missing" && manualFallbackUsed) {
    return "Manual metadata fallback is active. Optional: improve target-site Open Graph/Twitter metadata to clear this warning.";
  }

  if (reason === "metadata_missing") {
    return "Add Open Graph/Twitter metadata on the target site or set link.metadata fields manually in data/links.json.";
  }

  if (reason === "metadata_partial") {
    return "Fill missing preview fields via link.metadata or improve target-site SEO metadata completeness.";
  }

  return "No action required.";
};

export const isBlockingReason = (
  reason: EnrichmentReason,
  failOn: EnrichmentFailureReason[],
): boolean => isFailureReason(reason) && failOn.includes(reason);

export const isAlwaysBlockingReason = (reason: EnrichmentReason): boolean =>
  reason === "known_blocker" || reason === "authenticated_cache_missing";

export const publicCacheMessageFor = (
  staleCache: boolean,
  manualFallbackUsed: boolean,
  reusedWithoutFetch: boolean,
): string => {
  if (staleCache) {
    return "Public metadata fetch failed; using stale committed public cache metadata.";
  }

  if (manualFallbackUsed) {
    return "Using committed public cache metadata; manual link.metadata fallback remains active for missing preview fields.";
  }

  if (reusedWithoutFetch) {
    return "Using fresh committed public cache metadata without a network fetch.";
  }

  return "Using committed public cache metadata.";
};

export const publicCacheRemediationFor = (linkId: string, staleCache: boolean): string =>
  staleCache
    ? `Transient fetch failure. Re-run \`bun run enrich:rich:strict\` later for fresh generated output for '${linkId}', then use \`${PUBLIC_CACHE_WRITE_COMMAND}\` if you want to persist the recovered public cache entry.`
    : remediationFor("fetched", "public_cache");

export const publicCacheWriteSkippedNoticeFor = (
  operation: "upsert" | "delete",
): {
  message: string;
  remediation: string;
} =>
  operation === "delete"
    ? {
        message:
          "Stable public-cache persistence was skipped for this run, so the tracked cache entry was left unchanged and any runtime freshness for it was cleared.",
        remediation: `Run \`${PUBLIC_CACHE_WRITE_COMMAND}\` to persist removal of the tracked public cache entry.`,
      }
    : {
        message:
          "Stable public-cache persistence was skipped for this run, so generated output uses the freshly fetched metadata while the tracked cache manifest stays unchanged.",
        remediation: `Run \`${PUBLIC_CACHE_WRITE_COMMAND}\` to persist the updated public cache entry.`,
      };

export const mergeCachedPublicMetadata = (
  link: LinkInput & { type: "rich"; url: string },
  supportedProfile: ReturnType<typeof resolveSupportedSocialProfile>,
  handleForMetadata: string | undefined,
  cachedMetadata: ReturnType<typeof toEnrichmentMetadataFromPublicCache>,
  enrichedAt: string,
  status: EnrichmentRunEntry["status"],
): EnrichmentMetadata =>
  mergeLinkMetadata(
    link.metadata,
    {
      ...cachedMetadata,
      handle: handleForMetadata ?? cachedMetadata.handle,
      sourceLabel: link.enrichment?.sourceLabel ?? cachedMetadata.sourceLabel,
      sourceLabelVisible: link.enrichment?.sourceLabelVisible,
      enrichmentStatus: status,
      enrichmentReason: "public_cache",
      enrichedAt,
    },
    supportedProfile,
  );

export const toGeneratedLinkEntry = (input: {
  metadata: EnrichmentMetadata;
  referral?: GeneratedLinkReferralConfig;
}): GeneratedRichMetadata["links"][string] =>
  input.referral
    ? { metadata: input.metadata, referral: input.referral }
    : { metadata: input.metadata };

export const resolveGeneratedReferral = (input: {
  link: LinkInput & { type: "rich"; url: string };
  strategyId: string;
  sourceUrl: string;
  metadata: EnrichmentMetadata;
  finalUrl?: string;
  benefitTextCandidates?: string[];
}): GeneratedLinkReferralConfig | undefined =>
  resolvePublicReferralAugmentation({
    originalUrl: input.link.url,
    sourceUrl: input.sourceUrl,
    finalUrl: input.finalUrl,
    strategyId: input.strategyId,
    metadata: input.metadata,
    manualReferral: input.link.referral,
    benefitTextCandidates: input.benefitTextCandidates,
  });

export const hasGeneratedReferralBenefits = (
  referral: GeneratedLinkReferralConfig | undefined,
): boolean => Boolean(referral?.visitorBenefit || referral?.ownerBenefit);

export const resolveGeneratedReferralWithBrowserFallback = async (input: {
  link: LinkInput & { type: "rich"; url: string };
  publicStrategy: ReturnType<typeof resolvePublicEnrichmentStrategy>;
  sourceUrl: string;
  metadata: EnrichmentMetadata;
  generatedAt: string;
  finalUrl?: string;
}): Promise<GeneratedLinkReferralConfig | undefined> => {
  const generatedReferral = resolveGeneratedReferral({
    link: input.link,
    strategyId: input.publicStrategy.id,
    sourceUrl: input.sourceUrl,
    finalUrl: input.finalUrl,
    metadata: input.metadata,
  });

  const needsVisitorBenefit =
    !input.link.referral?.visitorBenefit && !generatedReferral?.visitorBenefit;
  const needsOwnerBenefit = !input.link.referral?.ownerBenefit && !generatedReferral?.ownerBenefit;

  if (
    !generatedReferral ||
    hasGeneratedReferralBenefits(generatedReferral) ||
    (!needsVisitorBenefit && !needsOwnerBenefit) ||
    input.publicStrategy.sourceKind !== "html"
  ) {
    return generatedReferral;
  }

  const browserCapture = capturePublicReferralTextFromBrowser({
    linkId: input.link.id,
    sourceUrl: input.sourceUrl,
    generatedAt: input.generatedAt,
    browserWaitMs: 8_000,
    userAgent: input.publicStrategy.source.headers?.["user-agent"],
  });

  if (!browserCapture.snapshot) {
    return generatedReferral;
  }

  const browserReferral = resolveGeneratedReferral({
    link: input.link,
    strategyId: input.publicStrategy.id,
    sourceUrl: input.sourceUrl,
    finalUrl: input.finalUrl,
    metadata: input.metadata,
    benefitTextCandidates: [
      ...(browserCapture.snapshot.candidateTexts ?? []),
      browserCapture.snapshot.bodyText ?? "",
    ].filter((candidate) => candidate.length > 0),
  });

  if (!browserReferral) {
    return generatedReferral;
  }

  return {
    ...generatedReferral,
    visitorBenefit: browserReferral.visitorBenefit ?? generatedReferral.visitorBenefit,
    ownerBenefit: browserReferral.ownerBenefit ?? generatedReferral.ownerBenefit,
  };
};

export const formatDurationMs = (durationMs: number): string =>
  `${Math.max(0, Math.round(durationMs))}ms`;

export const knownBlockerMessageFor = (match: KnownBlockerMatch, detail?: string): string => {
  const parts = [
    `Known direct-fetch blocker '${match.blocker.id}' matched host '${match.host}' via domain '${match.matchedDomain}'.`,
    match.blocker.summary,
  ];

  if (detail) {
    parts.push(detail);
  }

  return parts.join(" ");
};

export const knownBlockerRemediationFor = (match: KnownBlockerMatch): string => {
  const parts: string[] = [];

  parts.push(...match.blocker.remediation);
  parts.push(
    "Disable enrichment for this link, or set links[].enrichment.allowKnownBlocker=true to override and attempt enrichment anyway.",
  );
  if (match.blocker.plannedSupportNote) {
    parts.push(match.blocker.plannedSupportNote);
  }
  if (match.blocker.docs.length > 0) {
    parts.push(`Docs: ${match.blocker.docs.join(", ")}`);
  }

  return parts.join(" ");
};

export const printBlockingDiagnostics = (
  entries: EnrichmentRunEntry[],
  config: ResolvedConfig,
  reportPath: string,
  abortedEarly: boolean,
) => {
  console.error("");
  console.error("OpenLinks rich enrichment failed due to blocking metadata issues.");
  console.error(`Policy: failureMode=${config.failureMode}, failOn=${config.failOn.join(", ")}`);
  if (abortedEarly) {
    console.error(
      "Processing stopped early after the first blocking failure (failureMode=immediate).",
    );
  }
  console.error(`Report path: ${reportPath}`);
  console.error("");

  for (const [index, entry] of entries.entries()) {
    console.error(`${index + 1}. linkId='${entry.linkId}'`);
    console.error(`   url: ${entry.url}`);
    console.error(`   reason: ${entry.reason}`);
    console.error(`   attempts: ${entry.attempts}`);
    console.error(`   durationMs: ${formatDurationMs(entry.durationMs)}`);
    if (typeof entry.statusCode === "number") {
      console.error(`   statusCode: ${entry.statusCode}`);
    }
    if (entry.extractorId) {
      console.error(`   extractorId: ${entry.extractorId}`);
    }
    if (entry.cacheKey) {
      console.error(`   cacheKey: ${entry.cacheKey}`);
    }
    if (entry.cacheCapturedAt) {
      console.error(`   cacheCapturedAt: ${entry.cacheCapturedAt}`);
    }
    if (
      (entry.reason === "metadata_missing" || entry.reason === "metadata_regression") &&
      entry.missingFields &&
      entry.missingFields.length > 0
    ) {
      console.error(`   missingFields: ${entry.missingFields.join(", ")}`);
    }
    if (entry.staleCache) {
      console.error("   staleCache: true");
    }
    console.error(`   message: ${entry.message}`);
    console.error(`   remediation: ${entry.remediation}`);
    console.error("");
  }

  console.error("Suggested commands:");
  if (entries.some((entry) => entry.reason === "authenticated_cache_missing")) {
    console.error("  - First-time authenticated cache setup: npm run setup:rich-auth");
  }
  console.error("  - Re-run diagnostics: npm run enrich:rich:strict");
  console.error(
    `  - Temporary bypass (local/emergency only): ${ENRICHMENT_BYPASS_ENV}=1 npm run build`,
  );
};
