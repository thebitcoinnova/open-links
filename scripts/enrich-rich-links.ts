import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  SOCIAL_PROFILE_METADATA_FIELDS,
  mergeMetadataWithManualSocialProfileOverrides,
  normalizeSupportedSocialProfileMetadata,
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
import { parseMetadata } from "./enrichment/parse-metadata";
import { resolvePublicAugmentationTarget } from "./enrichment/public-augmentation";
import {
  DEFAULT_PUBLIC_CACHE_PATH,
  computePublicCacheExpiresAt,
  hasCacheablePublicMetadata,
  loadPublicCacheRegistry,
  resolveCachedEntryStatus,
  resolvePublicCacheEntry,
  toEnrichmentMetadataFromPublicCache,
  toPublicCacheMetadata,
  writePublicCacheRegistry,
} from "./enrichment/public-cache";
import { writeEnrichmentReport } from "./enrichment/report";
import { augmentSupportedSocialProfileMetadata } from "./enrichment/supported-social-profile-metadata";
import type {
  EnrichmentFailureMode,
  EnrichmentFailureReason,
  EnrichmentMetadata,
  EnrichmentReason,
  EnrichmentRunEntry,
  ExpectedSocialProfileField,
  GeneratedRichMetadata,
} from "./enrichment/types";

interface CliArgs {
  strict: boolean;
  linksPath: string;
  sitePath: string;
  outputPath?: string;
  reportPath?: string;
  timeoutMs?: number;
  retries?: number;
}

interface LinkInput {
  id: string;
  label: string;
  url?: string;
  type: "simple" | "rich" | "payment";
  icon?: string;
  metadata?: EnrichmentMetadata;
  enrichment?: {
    enabled?: boolean;
    allowKnownBlocker?: boolean;
    authenticatedExtractor?: string;
    authenticatedCacheKey?: string;
    sourceLabel?: string;
    sourceLabelVisible?: boolean;
  };
}

interface LinksPayload {
  links: LinkInput[];
}

interface SitePayload {
  ui?: {
    richCards?: {
      enrichment?: {
        enabledByDefault?: boolean;
        timeoutMs?: number;
        retries?: number;
        metadataPath?: string;
        reportPath?: string;
        publicCachePath?: string;
        authenticatedCachePath?: string;
        authenticatedCacheWarnAgeDays?: number;
        failureMode?: EnrichmentFailureMode;
        failOn?: EnrichmentFailureReason[];
        allowManualMetadataFallback?: boolean;
      };
    };
  };
}

interface ResolvedConfig {
  enabledByDefault: boolean;
  timeoutMs: number;
  retries: number;
  outputPath: string;
  reportPath: string;
  publicCachePath: string;
  authenticatedCachePath: string;
  authenticatedCacheWarnAgeDays: number;
  failureMode: EnrichmentFailureMode;
  failOn: EnrichmentFailureReason[];
  allowManualMetadataFallback: boolean;
  bypassActive: boolean;
}

const ROOT = process.cwd();
const ENRICHMENT_BYPASS_ENV = "OPENLINKS_RICH_ENRICHMENT_BYPASS";
const DEFAULT_FAILURE_MODE: EnrichmentFailureMode = "immediate";
const DEFAULT_FAIL_ON: EnrichmentFailureReason[] = ["fetch_failed", "metadata_missing"];
const DEFAULT_AUTH_CACHE_WARN_AGE_DAYS = 30;

const absolutePath = (value: string): string =>
  path.isAbsolute(value) ? value : path.join(ROOT, value);

const parseNumber = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseArgs = (): CliArgs => {
  const args = process.argv.slice(2);

  const argValue = (name: string): string | undefined => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };

  return {
    strict: args.includes("--strict"),
    linksPath: argValue("--links") ?? "data/links.json",
    sitePath: argValue("--site") ?? "data/site.json",
    outputPath: argValue("--out"),
    reportPath: argValue("--report"),
    timeoutMs: parseNumber(argValue("--timeout")),
    retries: parseNumber(argValue("--retries")),
  };
};

const readJson = <T>(relativePath: string): T => {
  const absolute = absolutePath(relativePath);
  return JSON.parse(fs.readFileSync(absolute, "utf8")) as T;
};

const isFailureReason = (value: unknown): value is EnrichmentFailureReason =>
  value === "fetch_failed" || value === "metadata_missing";

const resolveFailOn = (value: unknown): EnrichmentFailureReason[] => {
  if (!Array.isArray(value)) {
    return [...DEFAULT_FAIL_ON];
  }

  const resolved: EnrichmentFailureReason[] = [];
  for (const item of value) {
    if (isFailureReason(item) && !resolved.includes(item)) {
      resolved.push(item);
    }
  }

  return resolved.length > 0 ? resolved : [...DEFAULT_FAIL_ON];
};

const resolveFailureMode = (value: unknown): EnrichmentFailureMode =>
  value === "aggregate" ? "aggregate" : DEFAULT_FAILURE_MODE;

const resolveConfig = (site: SitePayload, args: CliArgs): ResolvedConfig => {
  const defaults = site.ui?.richCards?.enrichment;

  return {
    enabledByDefault: defaults?.enabledByDefault ?? true,
    timeoutMs: Math.max(500, args.timeoutMs ?? defaults?.timeoutMs ?? 4000),
    retries: Math.max(0, args.retries ?? defaults?.retries ?? 1),
    outputPath: args.outputPath ?? defaults?.metadataPath ?? "data/generated/rich-metadata.json",
    reportPath:
      args.reportPath ?? defaults?.reportPath ?? "data/generated/rich-enrichment-report.json",
    publicCachePath: defaults?.publicCachePath ?? DEFAULT_PUBLIC_CACHE_PATH,
    authenticatedCachePath: defaults?.authenticatedCachePath ?? DEFAULT_AUTH_CACHE_PATH,
    authenticatedCacheWarnAgeDays: Math.max(
      1,
      defaults?.authenticatedCacheWarnAgeDays ?? DEFAULT_AUTH_CACHE_WARN_AGE_DAYS,
    ),
    failureMode: resolveFailureMode(defaults?.failureMode),
    failOn: resolveFailOn(defaults?.failOn),
    allowManualMetadataFallback: defaults?.allowManualMetadataFallback ?? true,
    bypassActive: process.env[ENRICHMENT_BYPASS_ENV] === "1",
  };
};

const ensureDirectory = (relativePath: string) => {
  const absoluteDir = path.dirname(absolutePath(relativePath));
  fs.mkdirSync(absoluteDir, { recursive: true });
};

const pickDefined = (metadata: EnrichmentMetadata): EnrichmentMetadata => {
  const result: EnrichmentMetadata = {};
  const resultRecord = result as Record<string, unknown>;

  if (metadata.title) result.title = metadata.title;
  if (metadata.description) result.description = metadata.description;
  if (metadata.image) result.image = metadata.image;
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

const mergeMetadata = (
  original: EnrichmentMetadata | undefined,
  enriched: EnrichmentMetadata,
): EnrichmentMetadata =>
  pickDefined(mergeMetadataWithManualSocialProfileOverrides(original, enriched) ?? {});

const mergeLinkMetadata = (
  original: EnrichmentMetadata | undefined,
  enriched: EnrichmentMetadata,
  supportedProfile: ReturnType<typeof resolveSupportedSocialProfile>,
): EnrichmentMetadata => {
  const metadata = mergeMetadata(original, enriched);
  return normalizeSupportedSocialProfileMetadata(metadata, supportedProfile) ?? metadata;
};

const resolveProfileWarningContext = (
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

const warnForMissingProfileFields = (
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

const hasManualMetadataFallback = (metadata: EnrichmentMetadata | undefined): boolean => {
  if (!metadata) {
    return false;
  }

  const candidates = [metadata.title, metadata.description, metadata.image];
  return candidates.some((value) => typeof value === "string" && value.trim().length > 0);
};

const makeEntryMessage = (
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

const remediationFor = (
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
    return "No action required. The public cache refreshes automatically during `npm run enrich:rich` and `npm run enrich:rich:strict`.";
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

const isBlockingReason = (reason: EnrichmentReason, failOn: EnrichmentFailureReason[]): boolean =>
  isFailureReason(reason) && failOn.includes(reason);

const isAlwaysBlockingReason = (reason: EnrichmentReason): boolean =>
  reason === "known_blocker" || reason === "authenticated_cache_missing";

const publicCacheMessageFor = (
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

const publicCacheRemediationFor = (linkId: string, staleCache: boolean): string =>
  staleCache
    ? `Transient fetch failure. Re-run \`npm run enrich:rich:strict\` later to refresh the public cache for '${linkId}'.`
    : remediationFor("fetched", "public_cache");

const mergeCachedPublicMetadata = (
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
      handle: handleForMetadata,
      sourceLabel: link.enrichment?.sourceLabel ?? cachedMetadata.sourceLabel,
      sourceLabelVisible: link.enrichment?.sourceLabelVisible,
      enrichmentStatus: status,
      enrichmentReason: "public_cache",
      enrichedAt,
    },
    supportedProfile,
  );

const formatDurationMs = (durationMs: number): string => `${Math.max(0, Math.round(durationMs))}ms`;

const knownBlockerMessageFor = (match: KnownBlockerMatch, detail?: string): string => {
  const parts = [
    `Known direct-fetch blocker '${match.blocker.id}' matched host '${match.host}' via domain '${match.matchedDomain}'.`,
    match.blocker.summary,
  ];

  if (detail) {
    parts.push(detail);
  }

  return parts.join(" ");
};

const knownBlockerRemediationFor = (match: KnownBlockerMatch): string => {
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

const printBlockingDiagnostics = (
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
      entry.reason === "metadata_missing" &&
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

const run = async () => {
  const args = parseArgs();
  const linksPayload = readJson<LinksPayload>(args.linksPath);
  const sitePayload = readJson<SitePayload>(args.sitePath);
  const config = resolveConfig(sitePayload, args);
  const hasAuthenticatedExtractorConfig = (linksPayload.links ?? []).some(
    (link) => link.type === "rich" && typeof link.enrichment?.authenticatedExtractor === "string",
  );

  const authenticatedExtractorsPolicy = hasAuthenticatedExtractorConfig
    ? loadAuthenticatedExtractorsPolicy({
        policyPath: DEFAULT_AUTH_EXTRACTORS_POLICY_PATH,
      })
    : null;

  const authenticatedCacheRegistry = hasAuthenticatedExtractorConfig
    ? loadAuthenticatedCacheRegistry({
        cachePath: config.authenticatedCachePath,
      })
    : null;

  const blockersRegistry = loadRichEnrichmentBlockersRegistry({
    registryPath: DEFAULT_BLOCKERS_REGISTRY_PATH,
  });
  const publicCacheRegistry = loadPublicCacheRegistry({
    cachePath: config.publicCachePath,
  });
  let publicCacheDirty = false;
  const generatedAt = new Date().toISOString();
  const enforceStrictBlocking = args.strict && !config.bypassActive;
  const enforceKnownBlockers = !config.bypassActive;

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
    const supportedProfile = resolveSupportedSocialProfile({
      url: link.url,
      icon: link.icon,
    });
    const urlDerivedHandle = resolveHandleFromUrl({
      url: link.url,
      icon: link.icon,
    }).handle;
    const handleForMetadata = normalizeHandle(link.metadata?.handle) ?? urlDerivedHandle;
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
      const profileWarningContext = resolveProfileWarningContext(supportedProfile, metadata);
      warnForMissingProfileFields(
        link.id,
        link.url,
        supportedProfile,
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

    if (authenticatedExtractorId) {
      if (!authenticatedExtractorsPolicy || !authenticatedCacheRegistry) {
        throw new Error(
          "Authenticated extractor is configured but policy/cache registry was not initialized.",
        );
      }

      const extractor = resolveAuthenticatedExtractorById(
        authenticatedExtractorId,
        authenticatedExtractorsPolicy,
      );
      const cacheKey = resolveAuthenticatedCacheKey(
        link.enrichment?.authenticatedCacheKey,
        link.id,
      );

      if (!extractor) {
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
        const profileWarningContext = resolveProfileWarningContext(supportedProfile, metadata);
        warnForMissingProfileFields(
          link.id,
          link.url,
          supportedProfile,
          profileWarningContext.missingProfileFields,
        );

        entries.push({
          linkId: link.id,
          url: link.url,
          status: "failed",
          reason,
          attempts: 0,
          durationMs: 0,
          message: `Authenticated extractor '${authenticatedExtractorId}' is not defined in ${DEFAULT_AUTH_EXTRACTORS_POLICY_PATH}.`,
          remediation:
            "Fix links[].enrichment.authenticatedExtractor or add the extractor to the authenticated policy registry, then run npm run setup:rich-auth.",
          metadata,
          blocking: true,
          extractorId: authenticatedExtractorId,
          cacheKey,
          ...profileWarningContext,
        });
        generatedLinks[link.id] = { metadata };
        continue;
      }

      if (extractor.status === "disabled") {
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
        const profileWarningContext = resolveProfileWarningContext(supportedProfile, metadata);
        warnForMissingProfileFields(
          link.id,
          link.url,
          supportedProfile,
          profileWarningContext.missingProfileFields,
        );

        entries.push({
          linkId: link.id,
          url: link.url,
          status: "failed",
          reason,
          attempts: 0,
          durationMs: 0,
          message: `Authenticated extractor '${authenticatedExtractorId}' is disabled in policy.`,
          remediation:
            "Enable the extractor in data/policy/rich-authenticated-extractors.json or remove it from this link configuration, then run npm run setup:rich-auth.",
          metadata,
          blocking: true,
          extractorId: authenticatedExtractorId,
          cacheKey,
          ...profileWarningContext,
        });
        generatedLinks[link.id] = { metadata };
        continue;
      }

      const domainMatch = resolveAuthenticatedExtractorDomainMatch(link.url, extractor);
      if (!domainMatch) {
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
        const profileWarningContext = resolveProfileWarningContext(supportedProfile, metadata);
        warnForMissingProfileFields(
          link.id,
          link.url,
          supportedProfile,
          profileWarningContext.missingProfileFields,
        );

        entries.push({
          linkId: link.id,
          url: link.url,
          status: "failed",
          reason,
          attempts: 0,
          durationMs: 0,
          message: `Link URL host does not match authenticated extractor '${authenticatedExtractorId}' policy domains.`,
          remediation: `Allowed domains: ${extractor.domains.join(
            ", ",
          )}. Fix links[].enrichment.authenticatedExtractor or link URL, then run npm run setup:rich-auth.`,
          metadata,
          blocking: true,
          extractorId: authenticatedExtractorId,
          cacheKey,
          ...profileWarningContext,
        });
        generatedLinks[link.id] = { metadata };
        continue;
      }

      const cacheValidation = validateAuthenticatedCacheEntry({
        cacheKey,
        expectedLinkId: link.id,
        expectedExtractorId: authenticatedExtractorId,
        expectedUrl: link.url,
        warnAgeDays: config.authenticatedCacheWarnAgeDays,
        registry: authenticatedCacheRegistry,
      });

      const cacheErrors = cacheValidation.issues.filter((issue) => issue.level === "error");
      const cacheWarnings = cacheValidation.issues.filter((issue) => issue.level === "warning");
      const staleCache = cacheValidation.entry?.stale === true;

      if (cacheErrors.length > 0 || !cacheValidation.metadata || !cacheValidation.valid) {
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
        const profileWarningContext = resolveProfileWarningContext(supportedProfile, metadata);
        warnForMissingProfileFields(
          link.id,
          link.url,
          supportedProfile,
          profileWarningContext.missingProfileFields,
        );

        entries.push({
          linkId: link.id,
          url: link.url,
          status: "failed",
          reason,
          attempts: 0,
          durationMs: 0,
          message: cacheErrors.map((issue) => issue.message).join(" "),
          remediation: cacheErrors.map((issue) => issue.remediation).join(" "),
          metadata,
          blocking: true,
          extractorId: authenticatedExtractorId,
          cacheKey,
          cacheCapturedAt: cacheValidation.entry?.entry.capturedAt,
          ...profileWarningContext,
        });
        generatedLinks[link.id] = { metadata };
        continue;
      }

      if (cacheWarnings.length > 0) {
        for (const warning of cacheWarnings) {
          console.warn(`Warning [${link.id}][${cacheKey}]: ${warning.message}`);
        }
      }

      const reason: EnrichmentReason = "authenticated_cache";
      const metadata = mergeLinkMetadata(
        link.metadata,
        {
          ...cacheValidation.metadata,
          handle: handleForMetadata,
          sourceLabel:
            link.enrichment?.sourceLabel ??
            cacheValidation.metadata.sourceLabel ??
            extractor.domains[0],
          sourceLabelVisible: link.enrichment?.sourceLabelVisible,
          enrichmentStatus: "fetched",
          enrichmentReason: reason,
          enrichedAt: generatedAt,
        },
        supportedProfile,
      );
      const profileWarningContext = resolveProfileWarningContext(supportedProfile, metadata);
      warnForMissingProfileFields(
        link.id,
        link.url,
        supportedProfile,
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
      continue;
    }

    const publicAugmentationTarget = resolvePublicAugmentationTarget({
      url: link.url,
      icon: link.icon,
    });
    const knownBlockerMatch = resolveKnownBlockerMatch(link.url, blockersRegistry, "direct_fetch");
    const allowKnownBlocker = link.enrichment?.allowKnownBlocker === true;
    if (knownBlockerMatch && !allowKnownBlocker && !publicAugmentationTarget) {
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
      const profileWarningContext = resolveProfileWarningContext(supportedProfile, metadata);
      warnForMissingProfileFields(
        link.id,
        link.url,
        supportedProfile,
        profileWarningContext.missingProfileFields,
      );

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
      continue;
    }

    if (knownBlockerMatch && allowKnownBlocker) {
      console.warn(
        [
          `Warning: link '${link.id}' matches known blocker '${knownBlockerMatch.blocker.id}'`,
          "because enrichment.allowKnownBlocker=true is set, enrichment fetch will proceed anyway.",
          `Host: ${knownBlockerMatch.host} (matched: ${knownBlockerMatch.matchedDomain})`,
        ].join(" "),
      );
    }

    const publicCacheKey = link.id;
    const publicSourceUrl = publicAugmentationTarget?.sourceUrl ?? link.url;
    const cachedPublicEntry = resolvePublicCacheEntry(
      publicCacheRegistry,
      publicCacheKey,
      publicSourceUrl,
    );

    if (cachedPublicEntry?.fresh) {
      const cachedMetadata = toEnrichmentMetadataFromPublicCache(cachedPublicEntry.entry.metadata);
      const cachedStatus = resolveCachedEntryStatus(cachedPublicEntry.entry.metadata);
      const manualFallbackUsed =
        !!cachedStatus.missingFields &&
        config.allowManualMetadataFallback &&
        hasManualMetadataFallback(link.metadata);
      const metadata = mergeCachedPublicMetadata(
        link,
        supportedProfile,
        handleForMetadata,
        cachedMetadata,
        cachedPublicEntry.entry.updatedAt,
        cachedStatus.status,
      );
      const profileWarningContext = resolveProfileWarningContext(supportedProfile, metadata);
      warnForMissingProfileFields(
        link.id,
        link.url,
        supportedProfile,
        profileWarningContext.missingProfileFields,
      );

      entries.push({
        linkId: link.id,
        url: link.url,
        status: cachedStatus.status,
        reason: "public_cache",
        attempts: 0,
        durationMs: 0,
        message: publicCacheMessageFor(false, manualFallbackUsed, true),
        remediation: publicCacheRemediationFor(link.id, false),
        metadata,
        blocking: false,
        manualFallbackUsed: manualFallbackUsed || undefined,
        missingFields: cachedStatus.missingFields,
        cacheKey: publicCacheKey,
        cacheCapturedAt: cachedPublicEntry.entry.capturedAt,
        ...profileWarningContext,
      });
      generatedLinks[link.id] = { metadata };
      continue;
    }

    const requestHeaders: Record<string, string> = {
      ...(publicAugmentationTarget?.headers ?? {}),
    };
    if (cachedPublicEntry?.entry.etag) {
      requestHeaders["if-none-match"] = cachedPublicEntry.entry.etag;
    }
    if (cachedPublicEntry?.entry.lastModified) {
      requestHeaders["if-modified-since"] = cachedPublicEntry.entry.lastModified;
    }

    const fetched = await fetchMetadata(publicSourceUrl, {
      timeoutMs: config.timeoutMs,
      retries: config.retries,
      headers: requestHeaders,
      acceptHeader: publicAugmentationTarget?.acceptHeader,
    });

    if (fetched.notModified && cachedPublicEntry) {
      const cacheControl = fetched.cacheControl ?? cachedPublicEntry.entry.cacheControl;
      const expiresAt =
        computePublicCacheExpiresAt(cacheControl, fetched.responseDate) ??
        cachedPublicEntry.entry.expiresAt;

      publicCacheRegistry.entries[publicCacheKey] = {
        ...cachedPublicEntry.entry,
        updatedAt: generatedAt,
        etag: fetched.etag ?? cachedPublicEntry.entry.etag,
        lastModified: fetched.lastModified ?? cachedPublicEntry.entry.lastModified,
        cacheControl,
        expiresAt,
      };
      publicCacheRegistry.updatedAt = generatedAt;
      publicCacheDirty = true;

      const refreshedEntry = publicCacheRegistry.entries[publicCacheKey];
      const cachedMetadata = toEnrichmentMetadataFromPublicCache(refreshedEntry.metadata);
      const cachedStatus = resolveCachedEntryStatus(refreshedEntry.metadata);
      const manualFallbackUsed =
        !!cachedStatus.missingFields &&
        config.allowManualMetadataFallback &&
        hasManualMetadataFallback(link.metadata);
      const metadata = mergeCachedPublicMetadata(
        link,
        supportedProfile,
        handleForMetadata,
        cachedMetadata,
        refreshedEntry.updatedAt,
        cachedStatus.status,
      );
      const profileWarningContext = resolveProfileWarningContext(supportedProfile, metadata);
      warnForMissingProfileFields(
        link.id,
        link.url,
        supportedProfile,
        profileWarningContext.missingProfileFields,
      );

      entries.push({
        linkId: link.id,
        url: link.url,
        status: cachedStatus.status,
        reason: "public_cache",
        attempts: fetched.attempts,
        durationMs: fetched.durationMs,
        statusCode: fetched.statusCode,
        message: publicCacheMessageFor(false, manualFallbackUsed, false),
        remediation: publicCacheRemediationFor(link.id, false),
        metadata,
        blocking: false,
        manualFallbackUsed: manualFallbackUsed || undefined,
        missingFields: cachedStatus.missingFields,
        cacheKey: publicCacheKey,
        cacheCapturedAt: refreshedEntry.capturedAt,
        ...profileWarningContext,
      });
      generatedLinks[link.id] = { metadata };
      continue;
    }

    if (!fetched.ok || !fetched.html) {
      const failureDetail =
        fetched.error ??
        `Failed to fetch public metadata source '${publicSourceUrl}' (status=${fetched.statusCode ?? "n/a"}).`;
      if (cachedPublicEntry && hasCacheablePublicMetadata(cachedPublicEntry.entry.metadata)) {
        const cachedMetadata = toEnrichmentMetadataFromPublicCache(
          cachedPublicEntry.entry.metadata,
        );
        const cachedStatus = resolveCachedEntryStatus(cachedPublicEntry.entry.metadata);
        const manualFallbackUsed =
          !!cachedStatus.missingFields &&
          config.allowManualMetadataFallback &&
          hasManualMetadataFallback(link.metadata);
        const metadata = mergeCachedPublicMetadata(
          link,
          supportedProfile,
          handleForMetadata,
          cachedMetadata,
          cachedPublicEntry.entry.capturedAt,
          cachedStatus.status,
        );
        const profileWarningContext = resolveProfileWarningContext(supportedProfile, metadata);
        warnForMissingProfileFields(
          link.id,
          link.url,
          supportedProfile,
          profileWarningContext.missingProfileFields,
        );

        entries.push({
          linkId: link.id,
          url: link.url,
          status: cachedStatus.status,
          reason: "public_cache",
          attempts: fetched.attempts,
          durationMs: fetched.durationMs,
          statusCode: fetched.statusCode,
          message: publicCacheMessageFor(true, manualFallbackUsed, false),
          remediation: publicCacheRemediationFor(link.id, true),
          metadata,
          blocking: false,
          manualFallbackUsed: manualFallbackUsed || undefined,
          missingFields: cachedStatus.missingFields,
          cacheKey: publicCacheKey,
          cacheCapturedAt: cachedPublicEntry.entry.capturedAt,
          staleCache: true,
          ...profileWarningContext,
        });
        generatedLinks[link.id] = { metadata };
        continue;
      }

      const reason: EnrichmentReason =
        knownBlockerMatch && !allowKnownBlocker && publicAugmentationTarget
          ? "known_blocker"
          : "fetch_failed";
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
      const profileWarningContext = resolveProfileWarningContext(supportedProfile, metadata);
      warnForMissingProfileFields(
        link.id,
        link.url,
        supportedProfile,
        profileWarningContext.missingProfileFields,
      );
      const blocking = reason === "known_blocker" ? true : isBlockingReason(reason, config.failOn);

      entries.push({
        linkId: link.id,
        url: link.url,
        status: "failed",
        reason,
        attempts: fetched.attempts,
        durationMs: fetched.durationMs,
        statusCode: fetched.statusCode,
        message:
          reason === "known_blocker" && knownBlockerMatch
            ? knownBlockerMessageFor(knownBlockerMatch, failureDetail)
            : failureDetail,
        remediation:
          reason === "known_blocker" && knownBlockerMatch
            ? knownBlockerRemediationFor(knownBlockerMatch)
            : remediationFor("failed", reason),
        metadata,
        blocking,
        ...profileWarningContext,
      });

      generatedLinks[link.id] = { metadata };

      if (enforceStrictBlocking && config.failureMode === "immediate" && blocking) {
        abortedEarly = true;
        break;
      }

      continue;
    }

    let parsed:
      | {
          metadata: EnrichmentMetadata;
          completeness: "full" | "partial" | "none";
          missing: Array<"title" | "description" | "image">;
        }
      | undefined;
    let parseFailureMessage: string | undefined;

    if (!publicAugmentationTarget) {
      const genericParsed = parseMetadata(fetched.html, link.url);
      parsed = {
        metadata: genericParsed.metadata,
        completeness: genericParsed.completeness,
        missing: genericParsed.missing,
      };
    } else {
      try {
        parsed = publicAugmentationTarget.parse(fetched.html);
      } catch (error: unknown) {
        parsed = undefined;
        parseFailureMessage = error instanceof Error ? error.message : String(error);
      }
    }

    if (!parsed) {
      if (cachedPublicEntry && hasCacheablePublicMetadata(cachedPublicEntry.entry.metadata)) {
        const cachedMetadata = toEnrichmentMetadataFromPublicCache(
          cachedPublicEntry.entry.metadata,
        );
        const cachedStatus = resolveCachedEntryStatus(cachedPublicEntry.entry.metadata);
        const manualFallbackUsed =
          !!cachedStatus.missingFields &&
          config.allowManualMetadataFallback &&
          hasManualMetadataFallback(link.metadata);
        const metadata = mergeCachedPublicMetadata(
          link,
          supportedProfile,
          handleForMetadata,
          cachedMetadata,
          cachedPublicEntry.entry.capturedAt,
          cachedStatus.status,
        );
        const profileWarningContext = resolveProfileWarningContext(supportedProfile, metadata);
        warnForMissingProfileFields(
          link.id,
          link.url,
          supportedProfile,
          profileWarningContext.missingProfileFields,
        );

        entries.push({
          linkId: link.id,
          url: link.url,
          status: cachedStatus.status,
          reason: "public_cache",
          attempts: fetched.attempts,
          durationMs: fetched.durationMs,
          statusCode: fetched.statusCode,
          message: publicCacheMessageFor(true, manualFallbackUsed, false),
          remediation: publicCacheRemediationFor(link.id, true),
          metadata,
          blocking: false,
          manualFallbackUsed: manualFallbackUsed || undefined,
          missingFields: cachedStatus.missingFields,
          cacheKey: publicCacheKey,
          cacheCapturedAt: cachedPublicEntry.entry.capturedAt,
          staleCache: true,
          ...profileWarningContext,
        });
        generatedLinks[link.id] = { metadata };
        continue;
      }

      const reason: EnrichmentReason =
        knownBlockerMatch && !allowKnownBlocker && publicAugmentationTarget
          ? "known_blocker"
          : "fetch_failed";
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
      const profileWarningContext = resolveProfileWarningContext(supportedProfile, metadata);
      warnForMissingProfileFields(
        link.id,
        link.url,
        supportedProfile,
        profileWarningContext.missingProfileFields,
      );
      const blocking = reason === "known_blocker" ? true : isBlockingReason(reason, config.failOn);

      entries.push({
        linkId: link.id,
        url: link.url,
        status: "failed",
        reason,
        attempts: fetched.attempts,
        durationMs: fetched.durationMs,
        statusCode: fetched.statusCode,
        message:
          reason === "known_blocker" && knownBlockerMatch
            ? knownBlockerMessageFor(knownBlockerMatch, parseFailureMessage)
            : (parseFailureMessage ?? makeEntryMessage("failed", reason)),
        remediation:
          reason === "known_blocker" && knownBlockerMatch
            ? knownBlockerRemediationFor(knownBlockerMatch)
            : remediationFor("failed", reason),
        metadata,
        blocking,
        ...profileWarningContext,
      });

      generatedLinks[link.id] = { metadata };

      if (enforceStrictBlocking && config.failureMode === "immediate" && blocking) {
        abortedEarly = true;
        break;
      }

      continue;
    }

    const enrichedMetadata = augmentSupportedSocialProfileMetadata({
      html: fetched.html,
      metadata: parsed.metadata,
      supportedProfile,
    });
    const cacheMetadata = toPublicCacheMetadata(enrichedMetadata);

    if (hasCacheablePublicMetadata(cacheMetadata)) {
      publicCacheRegistry.entries[publicCacheKey] = {
        linkId: link.id,
        sourceUrl: publicSourceUrl,
        capturedAt: generatedAt,
        updatedAt: generatedAt,
        metadata: cacheMetadata,
        etag: fetched.etag,
        lastModified: fetched.lastModified,
        cacheControl: fetched.cacheControl,
        expiresAt: computePublicCacheExpiresAt(fetched.cacheControl, fetched.responseDate),
      };
      publicCacheRegistry.updatedAt = generatedAt;
      publicCacheDirty = true;
    } else if (publicCacheRegistry.entries[publicCacheKey]) {
      delete publicCacheRegistry.entries[publicCacheKey];
      publicCacheRegistry.updatedAt = generatedAt;
      publicCacheDirty = true;
    }

    const reason: EnrichmentReason =
      parsed.completeness === "full"
        ? "metadata_complete"
        : parsed.completeness === "partial"
          ? "metadata_partial"
          : "metadata_missing";

    const status: EnrichmentRunEntry["status"] =
      parsed.completeness === "full" ? "fetched" : "partial";
    const manualFallbackUsed =
      reason === "metadata_missing" &&
      config.allowManualMetadataFallback &&
      hasManualMetadataFallback(link.metadata);
    const blocking = isBlockingReason(reason, config.failOn) && !manualFallbackUsed;

    const metadata = mergeLinkMetadata(
      link.metadata,
      {
        ...enrichedMetadata,
        handle: handleForMetadata,
        sourceLabel: link.enrichment?.sourceLabel ?? enrichedMetadata.sourceLabel,
        sourceLabelVisible: link.enrichment?.sourceLabelVisible,
        enrichmentStatus: status,
        enrichmentReason: reason,
        enrichedAt: generatedAt,
      },
      supportedProfile,
    );
    const profileWarningContext = resolveProfileWarningContext(supportedProfile, metadata);
    warnForMissingProfileFields(
      link.id,
      link.url,
      supportedProfile,
      profileWarningContext.missingProfileFields,
    );

    entries.push({
      linkId: link.id,
      url: link.url,
      status,
      reason,
      attempts: fetched.attempts,
      durationMs: fetched.durationMs,
      statusCode: fetched.statusCode,
      message: makeEntryMessage(status, reason, manualFallbackUsed),
      remediation: remediationFor(status, reason, manualFallbackUsed),
      metadata,
      blocking,
      manualFallbackUsed: manualFallbackUsed || undefined,
      missingFields: reason === "metadata_missing" ? parsed.missing : undefined,
      ...profileWarningContext,
    });

    generatedLinks[link.id] = { metadata };

    if (enforceStrictBlocking && config.failureMode === "immediate" && blocking) {
      abortedEarly = true;
      break;
    }
  }

  const generated: GeneratedRichMetadata = {
    generatedAt,
    links: generatedLinks,
  };

  if (publicCacheDirty) {
    writePublicCacheRegistry(config.publicCachePath, publicCacheRegistry);
  }

  ensureDirectory(config.outputPath);
  fs.writeFileSync(
    absolutePath(config.outputPath),
    `${JSON.stringify(generated, null, 2)}\n`,
    "utf8",
  );

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
  console.log(`Generated metadata: ${config.outputPath}`);
  console.log(`Enrichment report: ${config.reportPath}`);
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

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Rich enrichment failed unexpectedly: ${message}`);
  process.exit(1);
});
