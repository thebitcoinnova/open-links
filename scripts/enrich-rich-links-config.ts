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

export interface CliArgs {
  strict: boolean;
  writePublicCache: boolean;
  linksPath: string;
  sitePath: string;
  outputPath?: string;
  reportPath?: string;
  timeoutMs?: number;
  retries?: number;
}

export interface LinkInput {
  id: string;
  label: string;
  url?: string;
  type: "simple" | "rich" | "payment";
  icon?: string;
  metadata?: EnrichmentMetadata;
  referral?: LinkReferralConfig;
  enrichment?: {
    enabled?: boolean;
    profileSemantics?: LinkProfileSemantics;
    allowKnownBlocker?: boolean;
    authenticatedExtractor?: string;
    authenticatedCacheKey?: string;
    sourceLabel?: string;
    sourceLabelVisible?: boolean;
  };
}

export interface LinksPayload {
  links: LinkInput[];
}

export interface SitePayload {
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

export interface ResolvedConfig {
  enabledByDefault: boolean;
  timeoutMs: number;
  retries: number;
  outputPath: string;
  reportPath: string;
  publicCachePath: string;
  writePublicCache: boolean;
  authenticatedCachePath: string;
  authenticatedCacheWarnAgeDays: number;
  failureMode: EnrichmentFailureMode;
  failOn: EnrichmentFailureReason[];
  allowManualMetadataFallback: boolean;
  bypassActive: boolean;
}

export const ROOT = process.cwd();
export const ENRICHMENT_BYPASS_ENV = "OPENLINKS_RICH_ENRICHMENT_BYPASS";
export const DEFAULT_FAILURE_MODE: EnrichmentFailureMode = "immediate";
export const DEFAULT_FAIL_ON: EnrichmentFailureReason[] = ["fetch_failed", "metadata_missing"];
export const DEFAULT_AUTH_CACHE_WARN_AGE_DAYS = 30;
export const PUBLIC_CACHE_WRITE_COMMAND = "bun run enrich:rich:strict:write-cache";

export const absolutePath = (value: string): string =>
  path.isAbsolute(value) ? value : path.join(ROOT, value);

export const parseNumber = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const parseArgs = (): CliArgs => {
  const args = process.argv.slice(2);

  const argValue = (name: string): string | undefined => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };

  return {
    strict: args.includes("--strict"),
    writePublicCache: args.includes("--write-public-cache"),
    linksPath: argValue("--links") ?? "data/links.json",
    sitePath: argValue("--site") ?? "data/site.json",
    outputPath: argValue("--out"),
    reportPath: argValue("--report"),
    timeoutMs: parseNumber(argValue("--timeout")),
    retries: parseNumber(argValue("--retries")),
  };
};

export const readJson = <T>(relativePath: string): T => {
  const absolute = absolutePath(relativePath);
  return JSON.parse(fs.readFileSync(absolute, "utf8")) as T;
};

export const isFailureReason = (value: unknown): value is EnrichmentFailureReason =>
  value === "fetch_failed" || value === "metadata_missing";

export const resolveFailOn = (value: unknown): EnrichmentFailureReason[] => {
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

export const resolveFailureMode = (value: unknown): EnrichmentFailureMode =>
  value === "aggregate" ? "aggregate" : DEFAULT_FAILURE_MODE;

export const resolveConfig = (site: SitePayload, args: CliArgs): ResolvedConfig => {
  const defaults = site.ui?.richCards?.enrichment;

  return {
    enabledByDefault: defaults?.enabledByDefault ?? true,
    timeoutMs: Math.max(500, args.timeoutMs ?? defaults?.timeoutMs ?? 4000),
    retries: Math.max(0, args.retries ?? defaults?.retries ?? 1),
    outputPath: args.outputPath ?? defaults?.metadataPath ?? "data/generated/rich-metadata.json",
    reportPath:
      args.reportPath ?? defaults?.reportPath ?? "data/generated/rich-enrichment-report.json",
    publicCachePath: defaults?.publicCachePath ?? DEFAULT_PUBLIC_CACHE_PATH,
    writePublicCache: args.writePublicCache,
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
