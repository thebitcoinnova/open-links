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
import { loadPublicCacheRegistry } from "./enrichment/public-cache-registry";
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
import { loadRemoteCachePolicyRegistry } from "./shared/remote-cache-policy";
import {
  RemoteCacheStatsCollector,
  createRemoteCacheStatsOutputPath,
  writeRemoteCacheRunSummary,
} from "./shared/remote-cache-stats";

import { handleAuthenticatedLink } from "./enrich-rich-links-authenticated";
import type { LinkInput, LinksPayload, SitePayload } from "./enrich-rich-links-config";
import {
  ENRICHMENT_BYPASS_ENV,
  PUBLIC_CACHE_WRITE_COMMAND,
  absolutePath,
  parseArgs,
  readJson,
  resolveConfig,
} from "./enrich-rich-links-config";
import { finishFetchedPublicLink } from "./enrich-rich-links-public-finish";
import { preparePublicLink } from "./enrich-rich-links-public-prepare";
import {
  ensureDirectory,
  isAlwaysBlockingReason,
  makeEntryMessage,
  mergeLinkMetadata,
  printBlockingDiagnostics,
  remediationFor,
  resolveProfileWarningContext,
  resolveSupportedProfileForMetadata,
  warnForMissingProfileFields,
} from "./enrich-rich-links-support";

interface FinalizeEnrichmentInput {
  args: ReturnType<typeof parseArgs>;
  config: ReturnType<typeof resolveConfig>;
  previousGeneratedMetadata: ReturnType<typeof readGeneratedRichMetadata>;
  generatedLinks: GeneratedRichMetadata["links"];
  generatedAt: string;
  state: { publicCacheDirty: boolean };
  publicCacheRegistry: ReturnType<typeof loadPublicCacheRegistry>;
  entries: EnrichmentRunEntry[];
  abortedEarly: boolean;
  remoteCacheStats: RemoteCacheStatsCollector;
  publicCacheWriteSkippedLinks: Set<string>;
  hasAuthenticatedExtractorConfig: boolean;
  enforceKnownBlockers: boolean;
  enforceStrictBlocking: boolean;
}

const finalizeEnrichmentRun = (input: FinalizeEnrichmentInput): never => {
  const {
    args,
    config,
    previousGeneratedMetadata,
    generatedLinks,
    generatedAt,
    state,
    publicCacheRegistry,
    entries,
    abortedEarly,
    remoteCacheStats,
    publicCacheWriteSkippedLinks,
    hasAuthenticatedExtractorConfig,
    enforceKnownBlockers,
    enforceStrictBlocking,
  } = input;
  const generated = buildStableGeneratedRichMetadata({
    previousManifest: previousGeneratedMetadata,
    links: generatedLinks,
    generatedAt,
  });

  if (state.publicCacheDirty) {
    if (config.writePublicCache) {
      writePublicCacheRegistry(config.publicCachePath, publicCacheRegistry);
    } else {
      writePublicCacheRuntimeRegistry(config.publicCachePath, publicCacheRegistry);
    }
  }

  ensureDirectory(config.outputPath);
  if (!areGeneratedRichMetadataEqual(previousGeneratedMetadata, generated)) {
    fs.writeFileSync(
      absolutePath(config.outputPath),
      `${JSON.stringify(generated, null, 2)}\n`,
      "utf8",
    );
  }

  const report = writeEnrichmentReport({
    reportPath: config.reportPath,
    generatedAt,
    strict: args.strict,
    entries,
    failureMode: config.failureMode,
    failOn: config.failOn,
    bypassActive: config.bypassActive,
    abortedEarly,
  });

  const blockingEntries = report.entries.filter((entry) => entry.blocking === true);
  const hasAuthenticatedCacheBlockingEntries = blockingEntries.some(
    (entry) => entry.reason === "authenticated_cache_missing",
  );

  console.log("OpenLinks rich enrichment run");
  console.log(`Links processed: ${report.summary.total}`);
  console.log(
    `Results: fetched=${report.summary.fetched}, partial=${report.summary.partial}, failed=${report.summary.failed}, skipped=${report.summary.skipped}`,
  );
  console.log(
    `Policy: failureMode=${config.failureMode}, failOn=${config.failOn.join(", ")}, allowManualMetadataFallback=${config.allowManualMetadataFallback}`,
  );
  console.log(`Known blockers registry: ${DEFAULT_BLOCKERS_REGISTRY_PATH}`);
  console.log(
    `Known blocker policy: ${enforceKnownBlockers ? "enforced" : "bypassed"} (override per link: enrichment.allowKnownBlocker=true)`,
  );
  if (hasAuthenticatedExtractorConfig) {
    console.log(`Authenticated extractor policy: ${DEFAULT_AUTH_EXTRACTORS_POLICY_PATH}`);
    console.log(`Authenticated cache: ${config.authenticatedCachePath}`);
    console.log(`Authenticated cache warn age days: ${config.authenticatedCacheWarnAgeDays}`);
  }
  console.log(`Bypass active: ${config.bypassActive ? "yes" : "no"} (${ENRICHMENT_BYPASS_ENV})`);
  console.log(`Public cache: ${config.publicCachePath}`);
  console.log(
    `Public cache persistence: ${
      config.writePublicCache ? "stable manifest + runtime overlay" : "runtime overlay only"
    }`,
  );
  console.log(`Generated metadata: ${config.outputPath}`);
  console.log(`Enrichment report: ${config.reportPath}`);
  const remoteCacheStatsPath = createRemoteCacheStatsOutputPath("enrich-rich-links");
  writeRemoteCacheRunSummary(remoteCacheStatsPath, remoteCacheStats);
  console.log(`Remote cache stats: ${remoteCacheStatsPath}`);
  if (abortedEarly) {
    console.log("Run status: aborted early due to blocking failure and failureMode=immediate.");
  }

  for (const entry of report.entries) {
    console.log(
      `- ${entry.linkId}: ${entry.status} (${entry.reason})${entry.blocking ? " [blocking]" : ""}${
        entry.manualFallbackUsed ? " [manual-fallback]" : ""
      }${entry.staleCache ? " [stale-cache]" : ""}${entry.statusCode ? ` [HTTP ${entry.statusCode}]` : ""}`,
    );
  }

  if (publicCacheWriteSkippedLinks.size > 0) {
    console.warn(
      `Warning: stable public-cache updates were skipped for ${publicCacheWriteSkippedLinks.size} link(s): ${Array.from(
        publicCacheWriteSkippedLinks,
      ).join(", ")}. Run \`${PUBLIC_CACHE_WRITE_COMMAND}\` to persist them.`,
    );
  }

  const alwaysBlockingEntries = blockingEntries.filter((entry) =>
    isAlwaysBlockingReason(entry.reason),
  );
  const strictPolicyEntries = blockingEntries.filter(
    (entry) => !isAlwaysBlockingReason(entry.reason),
  );
  const entriesToFailOn = [
    ...(!config.bypassActive ? alwaysBlockingEntries : []),
    ...(enforceStrictBlocking ? strictPolicyEntries : []),
  ];
  const shouldFail = entriesToFailOn.length > 0;

  if (config.bypassActive && blockingEntries.length > 0) {
    console.warn(
      `Warning: ${blockingEntries.length} blocking enrichment issue(s) were detected but bypassed due to ${ENRICHMENT_BYPASS_ENV}=1.`,
    );
  }

  if (!config.bypassActive && hasAuthenticatedCacheBlockingEntries) {
    console.error("");
    console.error(
      "Authenticated rich cache setup is required for one or more configured extractors. Run `npm run setup:rich-auth`, commit cache/assets, then rerun build.",
    );
  }

  if (shouldFail) {
    printBlockingDiagnostics(entriesToFailOn, config, config.reportPath, abortedEarly);
  }

  process.exit(shouldFail ? 1 : 0);
};

const initializeEnrichmentRun = (
  linksPayload: LinksPayload,
  config: ReturnType<typeof resolveConfig>,
  strict: boolean,
) => {
  const hasAuthenticatedExtractorConfig = (linksPayload.links ?? []).some(
    (link) => link.type === "rich" && typeof link.enrichment?.authenticatedExtractor === "string",
  );
  return {
    hasAuthenticatedExtractorConfig,
    authenticatedExtractorsPolicy: hasAuthenticatedExtractorConfig
      ? loadAuthenticatedExtractorsPolicy({ policyPath: DEFAULT_AUTH_EXTRACTORS_POLICY_PATH })
      : null,
    authenticatedCacheRegistry: hasAuthenticatedExtractorConfig
      ? loadAuthenticatedCacheRegistry({ cachePath: config.authenticatedCachePath })
      : null,
    blockersRegistry: loadRichEnrichmentBlockersRegistry({
      registryPath: DEFAULT_BLOCKERS_REGISTRY_PATH,
    }),
    remoteCachePolicyRegistry: loadRemoteCachePolicyRegistry(),
    remoteCacheStats: new RemoteCacheStatsCollector("enrich-rich-links"),
    publicCacheRegistry: loadPublicCacheRegistry({ cachePath: config.publicCachePath }),
    previousGeneratedMetadata: readGeneratedRichMetadata(config.outputPath),
    state: { publicCacheDirty: false },
    publicCacheWriteSkippedLinks: new Set<string>(),
    generatedAt: new Date().toISOString(),
    enforceStrictBlocking: strict && !config.bypassActive,
    enforceKnownBlockers: !config.bypassActive,
  };
};

export const runRichLinkEnrichment = async () => {
  const args = parseArgs();
  const linksPayload = readJson<LinksPayload>(args.linksPath);
  const sitePayload = readJson<SitePayload>(args.sitePath);
  const config = resolveConfig(sitePayload, args);
  const {
    hasAuthenticatedExtractorConfig,
    authenticatedExtractorsPolicy,
    authenticatedCacheRegistry,
    blockersRegistry,
    remoteCachePolicyRegistry,
    remoteCacheStats,
    publicCacheRegistry,
    previousGeneratedMetadata,
    state,
    publicCacheWriteSkippedLinks,
    generatedAt,
    enforceStrictBlocking,
    enforceKnownBlockers,
  } = initializeEnrichmentRun(linksPayload, config, args.strict);

  if (config.bypassActive) {
    console.warn(
      `Warning: ${ENRICHMENT_BYPASS_ENV}=1 is active. Blocking enrichment failures (including known blocked domains) will be reported but will not fail this run.`,
    );
  }

  const richLinks = (linksPayload.links ?? []).filter(
    (link): link is LinkInput & { type: "rich"; url: string } =>
      link.type === "rich" && typeof link.url === "string" && link.url.length > 0,
  );
  const entries: EnrichmentRunEntry[] = [];
  const generatedLinks: GeneratedRichMetadata["links"] = {};
  let abortedEarly = false;

  for (const link of richLinks) {
    const profileSemantics = resolveLinkProfileSemantics(link.enrichment?.profileSemantics);
    const supportedProfile = resolveSupportedSocialProfile({
      url: link.url,
      icon: link.icon,
      metadataHandle: link.metadata?.handle,
      profileSemantics,
    });
    const urlDerivedHandle = resolveHandleFromUrl({
      url: link.url,
      icon: link.icon,
    }).handle;
    const handleForMetadata =
      normalizeHandle(link.metadata?.handle) ??
      (profileSemantics === "non_profile" ? undefined : urlDerivedHandle);
    const linkEnabled = link.enrichment?.enabled ?? config.enabledByDefault;
    const authenticatedExtractorId = link.enrichment?.authenticatedExtractor?.trim();

    if (!linkEnabled) {
      const reason: EnrichmentReason = "enrichment_disabled";
      const metadata = mergeLinkMetadata(
        link.metadata,
        {
          handle: handleForMetadata,
          sourceLabel: link.enrichment?.sourceLabel,
          sourceLabelVisible: link.enrichment?.sourceLabelVisible,
          enrichmentStatus: "skipped",
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
        status: "skipped",
        reason,
        attempts: 0,
        durationMs: 0,
        message: makeEntryMessage("skipped", reason),
        remediation: remediationFor("skipped", reason),
        metadata,
        blocking: false,
        ...profileWarningContext,
      });

      generatedLinks[link.id] = { metadata };
      continue;
    }

    const handlerContext = {
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
    };

    if (await handleAuthenticatedLink(handlerContext)) {
      continue;
    }

    const preparation = await preparePublicLink(handlerContext);
    if (preparation.kind === "handled") {
      if (preparation.abortedEarly) {
        abortedEarly = true;
        break;
      }
      continue;
    }

    const completion = await finishFetchedPublicLink(handlerContext, preparation);
    if (completion.abortedEarly) {
      abortedEarly = true;
      break;
    }
  }

  return finalizeEnrichmentRun({
    args,
    config,
    previousGeneratedMetadata,
    generatedLinks,
    generatedAt,
    state,
    publicCacheRegistry,
    entries,
    abortedEarly,
    remoteCacheStats,
    publicCacheWriteSkippedLinks,
    hasAuthenticatedExtractorConfig,
    enforceKnownBlockers,
    enforceStrictBlocking,
  });
};
