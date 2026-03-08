import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import addFormats from "ajv-formats";
import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import {
  mergeMetadataWithManualSocialProfileOverrides,
  resolveMissingSupportedSocialProfileFields,
  resolveSupportedSocialProfile,
} from "../src/lib/content/social-profile-fields";
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
  type RichEnrichmentBlockersRegistry,
  loadRichEnrichmentBlockersRegistry,
  resolveKnownBlockerMatch,
} from "./enrichment/blockers-registry";
import { hasPublicAugmentationTarget } from "./enrichment/public-augmentation";
import { readEnrichmentReport } from "./enrichment/report";
import type {
  EnrichmentFailureReason,
  EnrichmentRunEntry,
  EnrichmentRunReport,
  EnrichmentRunSummary,
} from "./enrichment/types";
import {
  type ValidationResult,
  formatHumanOutput,
  formatJsonOutput,
} from "./validation/format-output";
import { type ValidationIssue, runPolicyRules } from "./validation/rules";

type OutputFormat = "human" | "json";

type ArgMap = {
  strict: boolean;
  format: OutputFormat;
  profilePath: string;
  linksPath: string;
  sitePath: string;
  enrichmentReportPath?: string;
};

const ROOT = process.cwd();
const ENRICHMENT_BYPASS_ENV = "OPENLINKS_RICH_ENRICHMENT_BYPASS";
const DEFAULT_AUTH_CACHE_WARN_AGE_DAYS = 30;
const DEFAULT_ENRICHMENT_METADATA_PATH = "data/generated/rich-metadata.json";
const DEFAULT_CONTENT_IMAGES_MANIFEST_PATH = "data/generated/content-images.json";

interface GeneratedRichMetadataPayload {
  links?: Record<string, { metadata?: Record<string, unknown> }>;
}

interface GeneratedContentImagesPayload {
  byUrl?: Record<string, { resolvedPath?: string }>;
}

const absolutePath = (value: string): string =>
  path.isAbsolute(value) ? value : path.join(ROOT, value);

const readJsonFile = <T>(relativePath: string): T => {
  const absolute = absolutePath(relativePath);
  return JSON.parse(fs.readFileSync(absolute, "utf8")) as T;
};

const parseArgs = (): ArgMap => {
  const args = process.argv.slice(2);

  const getFlagValue = (name: string): string | undefined => {
    const index = args.indexOf(name);
    if (index < 0) return undefined;
    return args[index + 1];
  };

  const formatRaw = getFlagValue("--format");
  const format: OutputFormat = formatRaw === "json" ? "json" : "human";

  return {
    strict: args.includes("--strict"),
    format,
    profilePath: getFlagValue("--profile") ?? "data/profile.json",
    linksPath: getFlagValue("--links") ?? "data/links.json",
    sitePath: getFlagValue("--site") ?? "data/site.json",
    enrichmentReportPath: getFlagValue("--enrichment-report"),
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toStringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const resolveEnrichmentReportPath = (
  site: Record<string, unknown>,
  overridePath?: string,
): string => {
  if (overridePath) {
    return overridePath;
  }

  const ui = isRecord(site.ui) ? site.ui : undefined;
  const richCards = ui && isRecord(ui.richCards) ? ui.richCards : undefined;
  const enrichment = richCards && isRecord(richCards.enrichment) ? richCards.enrichment : undefined;
  const reportPath =
    enrichment && typeof enrichment.reportPath === "string" ? enrichment.reportPath : undefined;

  return reportPath ?? "data/generated/rich-enrichment-report.json";
};

const resolveEnrichmentMetadataPath = (site: Record<string, unknown>): string => {
  const ui = isRecord(site.ui) ? site.ui : undefined;
  const richCards = ui && isRecord(ui.richCards) ? ui.richCards : undefined;
  const enrichment = richCards && isRecord(richCards.enrichment) ? richCards.enrichment : undefined;
  const metadataPath =
    enrichment && typeof enrichment.metadataPath === "string" ? enrichment.metadataPath.trim() : "";

  return metadataPath.length > 0 ? metadataPath : DEFAULT_ENRICHMENT_METADATA_PATH;
};

const tryReadJsonFile = <T>(relativePath: string): { value: T | null; errorMessage?: string } => {
  try {
    return { value: readJsonFile<T>(relativePath) };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { value: null, errorMessage: message };
  }
};

const normalizePath = (instancePath: string): string => {
  if (!instancePath || instancePath === "/") {
    return "$";
  }
  return `$${instancePath.replaceAll("/", ".")}`;
};

const schemaIssue = (source: string, error: ErrorObject): ValidationIssue => {
  const fieldPath = normalizePath(error.instancePath);
  const message = error.message ?? "Validation issue";

  return {
    level: "error",
    source,
    path: fieldPath,
    message,
    remediation: `Update ${fieldPath} in ${source} to satisfy schema rule: ${message}.`,
  };
};

const sortIssues = (issues: ValidationIssue[]): ValidationIssue[] =>
  [...issues].sort((left, right) => {
    if (left.source !== right.source) return left.source.localeCompare(right.source);
    if (left.path !== right.path) return left.path.localeCompare(right.path);
    return left.message.localeCompare(right.message);
  });

const DEFAULT_ENRICHMENT_FAIL_ON: EnrichmentFailureReason[] = ["fetch_failed", "metadata_missing"];

const isFailureReason = (value: unknown): value is EnrichmentFailureReason =>
  value === "fetch_failed" || value === "metadata_missing";

const resolveEnrichmentFailOn = (report: EnrichmentRunReport): EnrichmentFailureReason[] => {
  if (!Array.isArray(report.failOn)) {
    return [...DEFAULT_ENRICHMENT_FAIL_ON];
  }

  const resolved: EnrichmentFailureReason[] = [];
  for (const value of report.failOn) {
    if (isFailureReason(value) && !resolved.includes(value)) {
      resolved.push(value);
    }
  }

  return resolved.length > 0 ? resolved : [...DEFAULT_ENRICHMENT_FAIL_ON];
};

const isBlockingEntry = (entry: EnrichmentRunEntry, failOn: EnrichmentFailureReason[]): boolean => {
  if (typeof entry.blocking === "boolean") {
    return entry.blocking;
  }
  if (entry.manualFallbackUsed) {
    return false;
  }
  return isFailureReason(entry.reason) && failOn.includes(entry.reason);
};

const resolveEnabledByDefault = (site: Record<string, unknown>): boolean => {
  const ui = isRecord(site.ui) ? site.ui : undefined;
  const richCards = ui && isRecord(ui.richCards) ? ui.richCards : undefined;
  const enrichment = richCards && isRecord(richCards.enrichment) ? richCards.enrichment : undefined;
  return typeof enrichment?.enabledByDefault === "boolean" ? enrichment.enabledByDefault : true;
};

const resolveAuthenticatedCacheConfig = (
  site: Record<string, unknown>,
): { cachePath: string; warnAgeDays: number } => {
  const ui = isRecord(site.ui) ? site.ui : undefined;
  const richCards = ui && isRecord(ui.richCards) ? ui.richCards : undefined;
  const enrichment = richCards && isRecord(richCards.enrichment) ? richCards.enrichment : undefined;

  const configuredPath =
    typeof enrichment?.authenticatedCachePath === "string"
      ? enrichment.authenticatedCachePath.trim()
      : "";
  const rawWarnAge =
    typeof enrichment?.authenticatedCacheWarnAgeDays === "number"
      ? enrichment.authenticatedCacheWarnAgeDays
      : DEFAULT_AUTH_CACHE_WARN_AGE_DAYS;
  const warnAgeDays = Number.isFinite(rawWarnAge)
    ? Math.max(1, Math.round(rawWarnAge))
    : DEFAULT_AUTH_CACHE_WARN_AGE_DAYS;

  return {
    cachePath: configuredPath.length > 0 ? configuredPath : DEFAULT_AUTH_CACHE_PATH,
    warnAgeDays,
  };
};

const resolveRichRenderMode = (site: Record<string, unknown>): "auto" | "simple" => {
  const ui = isRecord(site.ui) ? site.ui : undefined;
  const richCards = ui && isRecord(ui.richCards) ? ui.richCards : undefined;
  return richCards?.renderMode === "simple" ? "simple" : "auto";
};

const hasRichRenderCandidates = (
  linksData: Record<string, unknown>,
  siteData: Record<string, unknown>,
): boolean => {
  if (resolveRichRenderMode(siteData) === "simple") {
    return false;
  }

  const links = Array.isArray(linksData.links) ? linksData.links : [];
  return links.some(
    (rawLink) => isRecord(rawLink) && rawLink.type === "rich" && rawLink.enabled !== false,
  );
};

const hasUrlScheme = (value: string): boolean => /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value);

const toCanonicalHttpUrl = (value: string): string | null => {
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
};

const resolveGeneratedMetadataByLink = (
  payload: GeneratedRichMetadataPayload,
): Record<string, Record<string, unknown>> => {
  if (!isRecord(payload) || !isRecord(payload.links)) {
    return {};
  }

  const byLink: Record<string, Record<string, unknown>> = {};

  for (const [linkId, value] of Object.entries(payload.links)) {
    if (isRecord(value) && isRecord(value.metadata)) {
      byLink[linkId] = value.metadata;
    }
  }

  return byLink;
};

const resolveGeneratedContentImagesByUrl = (
  payload: GeneratedContentImagesPayload,
): Record<string, { resolvedPath?: string }> => {
  if (!isRecord(payload) || !isRecord(payload.byUrl)) {
    return {};
  }

  const byUrl: Record<string, { resolvedPath?: string }> = {};

  for (const [url, value] of Object.entries(payload.byUrl)) {
    if (isRecord(value)) {
      byUrl[url] = {
        resolvedPath: typeof value.resolvedPath === "string" ? value.resolvedPath : undefined,
      };
    }
  }

  return byUrl;
};

const resolvePreviewImageAvailability = (
  imageCandidate: string | undefined,
  generatedContentImagesByUrl: Record<string, { resolvedPath?: string }>,
  contentImagesPath: string,
): { hasImage: boolean; detail: string } => {
  if (!imageCandidate) {
    return {
      hasImage: false,
      detail: "No metadata.image value was found.",
    };
  }

  const trimmed = imageCandidate.trim();
  if (trimmed.length === 0) {
    return {
      hasImage: false,
      detail: "metadata.image is an empty string.",
    };
  }

  if (!hasUrlScheme(trimmed)) {
    return { hasImage: true, detail: "" };
  }

  const canonical = toCanonicalHttpUrl(trimmed);
  if (!canonical) {
    return {
      hasImage: false,
      detail: `metadata.image uses an unsupported URL scheme (${trimmed}).`,
    };
  }

  const entry = generatedContentImagesByUrl[canonical] ?? generatedContentImagesByUrl[trimmed];
  if (entry && typeof entry.resolvedPath === "string" && entry.resolvedPath.trim().length > 0) {
    return { hasImage: true, detail: "" };
  }

  return {
    hasImage: false,
    detail: `metadata.image points to a remote URL that was not materialized in ${contentImagesPath}. Runtime strips that image before rendering.`,
  };
};

const richCardPreviewImageIssues = (
  linksSource: string,
  linksData: Record<string, unknown>,
  siteData: Record<string, unknown>,
  generatedMetadataByLink: Record<string, Record<string, unknown>>,
  generatedContentImagesByUrl: Record<string, { resolvedPath?: string }>,
  metadataPath: string,
  contentImagesPath: string,
): ValidationIssue[] => {
  if (resolveRichRenderMode(siteData) === "simple") {
    return [];
  }

  const links = Array.isArray(linksData.links) ? linksData.links : [];
  const enabledByDefault = resolveEnabledByDefault(siteData);
  const issues: ValidationIssue[] = [];

  links.forEach((rawLink, index) => {
    if (!isRecord(rawLink) || rawLink.type !== "rich" || rawLink.enabled === false) {
      return;
    }

    const linkId = toStringOrUndefined(rawLink.id) ?? `links[${index}]`;
    const metadata = isRecord(rawLink.metadata) ? rawLink.metadata : {};
    const generatedMetadata = generatedMetadataByLink[linkId] ?? {};
    const mergedMetadata: Record<string, unknown> = {
      ...metadata,
      ...generatedMetadata,
    };
    const previewImage = toStringOrUndefined(mergedMetadata.image);
    const imageAvailability = resolvePreviewImageAvailability(
      previewImage,
      generatedContentImagesByUrl,
      contentImagesPath,
    );

    if (imageAvailability.hasImage) {
      return;
    }

    const enrichment = isRecord(rawLink.enrichment) ? rawLink.enrichment : undefined;
    const enrichmentEnabled =
      typeof enrichment?.enabled === "boolean" ? enrichment.enabled : enabledByDefault;
    const url = toStringOrUndefined(rawLink.url);
    const linkPath = `$.links[${index}]`;
    const imagePath = `${linkPath}.metadata.image`;

    const remediationBase = `Add a preview image at ${imagePath} (for example a local 'generated/images/<hash>.jpg' asset or a remote URL that resolves into ${contentImagesPath}).`;
    const enrichmentRemediation = enrichmentEnabled
      ? `If this rich link should use enrichment, rerun npm run enrich:rich:strict && npm run images:sync and verify ${metadataPath} has metadata.image for '${linkId}'.`
      : "This link has enrichment disabled; either add manual metadata.image, switch the link type to 'simple', or re-enable enrichment and rerun npm run enrich:rich:strict && npm run images:sync.";

    issues.push({
      level: "error",
      source: linksSource,
      path: imagePath,
      message:
        `Rich-card rendering is enabled for link '${linkId}'${url ? ` (${url})` : ""}, ` +
        `but no renderable preview image is available. ${imageAvailability.detail}`,
      remediation:
        `${remediationBase} ${enrichmentRemediation} If this link should never use a rich card, ` +
        `${linkPath}.type can be set to 'simple' (or set site.ui.richCards.renderMode='simple' globally).`,
    });
  });

  return issues;
};

const supportedSocialProfileMetadataIssues = (
  linksSource: string,
  linksData: Record<string, unknown>,
  siteData: Record<string, unknown>,
  generatedMetadataByLink: Record<string, Record<string, unknown>>,
): ValidationIssue[] => {
  const links = Array.isArray(linksData.links) ? linksData.links : [];
  const enabledByDefault = resolveEnabledByDefault(siteData);
  const issues: ValidationIssue[] = [];

  links.forEach((rawLink, index) => {
    if (!isRecord(rawLink) || rawLink.type !== "rich" || rawLink.enabled === false) {
      return;
    }

    const enrichment = isRecord(rawLink.enrichment) ? rawLink.enrichment : undefined;
    const enrichmentEnabled =
      typeof enrichment?.enabled === "boolean" ? enrichment.enabled : enabledByDefault;
    if (!enrichmentEnabled) {
      return;
    }

    const url = toStringOrUndefined(rawLink.url);
    if (!url) {
      return;
    }

    const supportedProfile = resolveSupportedSocialProfile({
      url,
      icon: toStringOrUndefined(rawLink.icon),
    });
    if (!supportedProfile) {
      return;
    }

    const linkId = toStringOrUndefined(rawLink.id) ?? `links[${index}]`;
    const manualMetadata = isRecord(rawLink.metadata) ? rawLink.metadata : {};
    const generatedMetadata = generatedMetadataByLink[linkId] ?? {};
    const mergedMetadata =
      mergeMetadataWithManualSocialProfileOverrides(manualMetadata, generatedMetadata) ?? {};
    const missingProfileFields = resolveMissingSupportedSocialProfileFields(
      mergedMetadata,
      supportedProfile,
    );

    if (missingProfileFields.length === 0) {
      return;
    }

    const refreshCommand = toStringOrUndefined(enrichment?.authenticatedExtractor)
      ? `Run npm run setup:rich-auth (or npm run auth:rich:sync -- --only-link ${linkId})`
      : "Run npm run enrich:rich:strict";

    issues.push({
      level: "warning",
      source: linksSource,
      path: `$.links[${index}].metadata`,
      message:
        `Supported ${supportedProfile.platform} profile link '${linkId}' is missing expected social profile metadata: ` +
        `${missingProfileFields.join(", ")}.`,
      remediation: `${refreshCommand}, or add manual values under $.links[${index}].metadata for the missing fields.`,
      strictBlocking: false,
    });
  });

  return issues;
};

interface AuthenticatedExtractorTarget {
  index: number;
  linkId: string;
  url: string;
  extractorId: string;
  cacheKey: string;
}

const collectAuthenticatedExtractorTargets = (
  linksData: Record<string, unknown>,
  siteData: Record<string, unknown>,
): AuthenticatedExtractorTarget[] => {
  const links = Array.isArray(linksData.links) ? linksData.links : [];
  const enabledByDefault = resolveEnabledByDefault(siteData);
  const targets: AuthenticatedExtractorTarget[] = [];

  links.forEach((rawLink, index) => {
    if (!isRecord(rawLink) || rawLink.type !== "rich") {
      return;
    }

    const linkId = toStringOrUndefined(rawLink.id) ?? `links[${index}]`;
    const url = toStringOrUndefined(rawLink.url);
    if (!url) {
      return;
    }

    const enrichment = isRecord(rawLink.enrichment) ? rawLink.enrichment : undefined;
    const enabled =
      typeof enrichment?.enabled === "boolean" ? enrichment.enabled : enabledByDefault;
    if (!enabled) {
      return;
    }

    const extractorId = toStringOrUndefined(enrichment?.authenticatedExtractor);
    if (!extractorId) {
      return;
    }

    const cacheKey = resolveAuthenticatedCacheKey(
      toStringOrUndefined(enrichment?.authenticatedCacheKey),
      linkId,
    );

    targets.push({
      index,
      linkId,
      url,
      extractorId,
      cacheKey,
    });
  });

  return targets;
};

const authenticatedExtractorConfigIssues = (
  linksSource: string,
  linksData: Record<string, unknown>,
  siteData: Record<string, unknown>,
  bypassActive: boolean,
): { issues: ValidationIssue[]; suppressedAuthenticatedCacheLinkIds: Set<string> } => {
  const issues: ValidationIssue[] = [];
  const suppressedAuthenticatedCacheLinkIds = new Set<string>();
  const targets = collectAuthenticatedExtractorTargets(linksData, siteData);

  if (targets.length === 0) {
    return { issues, suppressedAuthenticatedCacheLinkIds };
  }

  const { cachePath, warnAgeDays } = resolveAuthenticatedCacheConfig(siteData);

  let policy: ReturnType<typeof loadAuthenticatedExtractorsPolicy>;
  try {
    policy = loadAuthenticatedExtractorsPolicy({
      policyPath: DEFAULT_AUTH_EXTRACTORS_POLICY_PATH,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    issues.push({
      level: "error",
      source: DEFAULT_AUTH_EXTRACTORS_POLICY_PATH,
      path: "$",
      message: `Failed to load authenticated extractors policy. ${message}`,
      remediation:
        "Restore data/policy/rich-authenticated-extractors.json, ensure it validates against schema/rich-authenticated-extractors.schema.json, then run npm run setup:rich-auth.",
    });
    for (const target of targets) {
      suppressedAuthenticatedCacheLinkIds.add(target.linkId);
    }
    return { issues, suppressedAuthenticatedCacheLinkIds };
  }

  let cacheRegistry: ReturnType<typeof loadAuthenticatedCacheRegistry>;
  try {
    cacheRegistry = loadAuthenticatedCacheRegistry({
      cachePath,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    issues.push({
      level: bypassActive ? "warning" : "error",
      source: cachePath,
      path: "$",
      message: `Failed to load authenticated rich cache. ${message}`,
      remediation:
        "Restore/fix data/cache/rich-authenticated-cache.json, ensure it validates against schema/rich-authenticated-cache.schema.json, then run npm run setup:rich-auth.",
    });
    for (const target of targets) {
      suppressedAuthenticatedCacheLinkIds.add(target.linkId);
    }
    return { issues, suppressedAuthenticatedCacheLinkIds };
  }

  for (const target of targets) {
    const extractorPath = `$.links[${target.index}].enrichment.authenticatedExtractor`;
    const cacheKeyPath = `$.links[${target.index}].enrichment.authenticatedCacheKey`;

    const extractor = resolveAuthenticatedExtractorById(target.extractorId, policy);
    if (!extractor) {
      suppressedAuthenticatedCacheLinkIds.add(target.linkId);
      issues.push({
        level: bypassActive ? "warning" : "error",
        source: linksSource,
        path: extractorPath,
        message: `Unknown authenticated extractor '${target.extractorId}' for link '${target.linkId}'.`,
        remediation:
          "Use a valid extractor id from data/policy/rich-authenticated-extractors.json or remove links[].enrichment.authenticatedExtractor for this link, then run npm run setup:rich-auth.",
      });
      continue;
    }

    if (extractor.status === "disabled") {
      suppressedAuthenticatedCacheLinkIds.add(target.linkId);
      issues.push({
        level: bypassActive ? "warning" : "error",
        source: linksSource,
        path: extractorPath,
        message: `Authenticated extractor '${target.extractorId}' is disabled for link '${target.linkId}'.`,
        remediation:
          "Enable the extractor in data/policy/rich-authenticated-extractors.json or remove links[].enrichment.authenticatedExtractor for this link, then run npm run setup:rich-auth.",
      });
      continue;
    }

    const domainMatch = resolveAuthenticatedExtractorDomainMatch(target.url, extractor);
    if (!domainMatch) {
      suppressedAuthenticatedCacheLinkIds.add(target.linkId);
      issues.push({
        level: bypassActive ? "warning" : "error",
        source: linksSource,
        path: extractorPath,
        message: `Link '${target.linkId}' URL host is not allowed by extractor '${target.extractorId}'.`,
        remediation: `Allowed domains: ${extractor.domains.join(
          ", ",
        )}. Fix links[].enrichment.authenticatedExtractor or the link URL, then run npm run setup:rich-auth.`,
      });
      continue;
    }

    const validation = validateAuthenticatedCacheEntry({
      cacheKey: target.cacheKey,
      expectedLinkId: target.linkId,
      expectedExtractorId: target.extractorId,
      expectedUrl: target.url,
      warnAgeDays,
      registry: cacheRegistry,
    });

    if (validation.issues.length > 0) {
      suppressedAuthenticatedCacheLinkIds.add(target.linkId);
    }

    for (const issue of validation.issues) {
      issues.push({
        level: issue.level === "error" ? (bypassActive ? "warning" : "error") : "warning",
        source: cachePath,
        path: issue.level === "error" ? cacheKeyPath : `$.entries.${target.cacheKey}`,
        message: `Authenticated cache check for link '${target.linkId}' failed: ${issue.message}`,
        remediation: issue.remediation,
      });
    }
  }

  return { issues, suppressedAuthenticatedCacheLinkIds };
};

const knownBlockerConfigIssues = (
  linksSource: string,
  linksData: Record<string, unknown>,
  siteData: Record<string, unknown>,
  registry: RichEnrichmentBlockersRegistry,
  bypassActive: boolean,
): { issues: ValidationIssue[]; suppressedKnownBlockerLinkIds: Set<string> } => {
  const issues: ValidationIssue[] = [];
  const suppressedKnownBlockerLinkIds = new Set<string>();
  const links = Array.isArray(linksData.links) ? linksData.links : [];
  const enabledByDefault = resolveEnabledByDefault(siteData);

  links.forEach((rawLink, index) => {
    if (!isRecord(rawLink)) {
      return;
    }

    if (rawLink.type !== "rich") {
      return;
    }

    const linkId = toStringOrUndefined(rawLink.id) ?? `links[${index}]`;
    const url = toStringOrUndefined(rawLink.url);
    if (!url) {
      return;
    }

    const enrichment = isRecord(rawLink.enrichment) ? rawLink.enrichment : undefined;
    const enabled =
      typeof enrichment?.enabled === "boolean" ? enrichment.enabled : enabledByDefault;
    if (!enabled) {
      return;
    }

    const authenticatedExtractor = toStringOrUndefined(enrichment?.authenticatedExtractor);
    if (authenticatedExtractor) {
      return;
    }

    const match = resolveKnownBlockerMatch(url, registry, "direct_fetch");
    if (!match) {
      return;
    }

    if (hasPublicAugmentationTarget({ url, icon: toStringOrUndefined(rawLink.icon) })) {
      return;
    }

    const allowKnownBlocker = enrichment?.allowKnownBlocker === true;
    const docsHint =
      match.blocker.docs.length > 0 ? ` Docs: ${match.blocker.docs.join(", ")}.` : "";
    const supportHint = match.blocker.plannedSupportNote
      ? ` ${match.blocker.plannedSupportNote}`
      : "";
    const path = `$.links[${index}].enrichment`;

    if (allowKnownBlocker) {
      suppressedKnownBlockerLinkIds.add(linkId);
      issues.push({
        level: "warning",
        source: linksSource,
        path,
        message: `Known blocker override enabled for rich link '${linkId}' (${url}). Matched blocker '${match.blocker.id}' on '${match.matchedDomain}'.`,
        remediation:
          "This link is allowed to attempt direct-fetch enrichment despite known blocker policy. Keep this override temporary and monitor enrichment outcomes.",
      });
      return;
    }

    suppressedKnownBlockerLinkIds.add(linkId);
    issues.push({
      level: bypassActive ? "warning" : "error",
      source: linksSource,
      path,
      message: `Blocked rich-enrichment target for link '${linkId}' (${url}). Matched blocker '${match.blocker.id}' on '${match.matchedDomain}'.${supportHint}`,
      remediation: [
        ...match.blocker.remediation,
        "Set links[].enrichment.enabled=false for this link or set links[].enrichment.allowKnownBlocker=true to explicitly override.",
        `Emergency local bypass: ${ENRICHMENT_BYPASS_ENV}=1 npm run build.${docsHint}`,
      ].join(" "),
    });
  });

  return { issues, suppressedKnownBlockerLinkIds };
};

const enrichmentIssues = (
  reportPath: string,
  report: EnrichmentRunReport | null,
  strict: boolean,
  bypassActive: boolean,
  suppressedKnownBlockerLinkIds: Set<string>,
  suppressedAuthenticatedCacheLinkIds: Set<string>,
): ValidationIssue[] => {
  if (!report) {
    return [
      {
        level: strict ? "error" : "warning",
        source: reportPath,
        path: "$",
        message: "Rich enrichment report not found.",
        remediation:
          "Run `npm run enrich:rich:strict` before validation/build so policy-based rich-link enrichment outcomes are available.",
      },
    ];
  }

  const issues: ValidationIssue[] = [];
  const failOn = resolveEnrichmentFailOn(report);
  const failureMode = report.failureMode ?? "immediate";

  report.entries.forEach((entry, index) => {
    if (entry.reason === "known_blocker" && suppressedKnownBlockerLinkIds.has(entry.linkId)) {
      return;
    }
    if (
      entry.reason === "authenticated_cache_missing" &&
      suppressedAuthenticatedCacheLinkIds.has(entry.linkId)
    ) {
      return;
    }

    const blocking = isBlockingEntry(entry, failOn);
    const shouldReport =
      blocking ||
      entry.status === "failed" ||
      entry.status === "partial" ||
      entry.manualFallbackUsed === true ||
      entry.staleCache === true;

    if (!shouldReport) {
      return;
    }

    const level: ValidationIssue["level"] =
      strict && blocking && !bypassActive ? "error" : "warning";
    const diagnosticClass = blocking
      ? "blocking"
      : entry.staleCache
        ? "stale-cache"
        : entry.manualFallbackUsed
          ? "manual-fallback"
          : entry.status === "failed"
            ? "fetch-warning"
            : "partial-warning";

    const missingFields =
      entry.reason === "metadata_missing" && entry.missingFields && entry.missingFields.length > 0
        ? ` Missing fields: ${entry.missingFields.join(", ")}.`
        : "";
    const missingProfileFields =
      entry.missingProfileFields && entry.missingProfileFields.length > 0
        ? ` Expected social profile fields missing: ${entry.missingProfileFields.join(", ")}.`
        : "";

    issues.push({
      level,
      source: reportPath,
      path: `$.entries[${index}]`,
      message:
        `Rich enrichment ${diagnosticClass} for link '${entry.linkId}' (${entry.reason}). ${entry.message}` +
        `${missingFields}${missingProfileFields} Policy: failureMode=${failureMode}, failOn=${failOn.join(", ")}.`,
      remediation: entry.remediation,
    });
  });

  return issues;
};

const run = () => {
  const args = parseArgs();

  const profileSchema = readJsonFile<Record<string, unknown>>("schema/profile.schema.json");
  const linksSchema = readJsonFile<Record<string, unknown>>("schema/links.schema.json");
  const siteSchema = readJsonFile<Record<string, unknown>>("schema/site.schema.json");

  const profileData = readJsonFile<Record<string, unknown>>(args.profilePath);
  const linksData = readJsonFile<Record<string, unknown>>(args.linksPath);
  const siteData = readJsonFile<Record<string, unknown>>(args.sitePath);
  const enrichmentReportPath = resolveEnrichmentReportPath(siteData, args.enrichmentReportPath);
  const enrichmentReport = readEnrichmentReport(enrichmentReportPath);
  const bypassActive =
    process.env[ENRICHMENT_BYPASS_ENV] === "1" || enrichmentReport?.bypassActive === true;

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const schemaChecks: Array<{
    source: string;
    schema: Record<string, unknown>;
    data: Record<string, unknown>;
  }> = [
    { source: args.profilePath, schema: profileSchema, data: profileData },
    { source: args.linksPath, schema: linksSchema, data: linksData },
    { source: args.sitePath, schema: siteSchema, data: siteData },
  ];

  const issues: ValidationIssue[] = [];
  const suppressedKnownBlockerLinkIds = new Set<string>();
  const suppressedAuthenticatedCacheLinkIds = new Set<string>();

  for (const check of schemaChecks) {
    const validate = ajv.compile(check.schema);
    const valid = validate(check.data);
    if (!valid && validate.errors) {
      for (const error of validate.errors) {
        issues.push(schemaIssue(check.source, error));
      }
    }
  }

  issues.push(
    ...runPolicyRules({
      profile: profileData,
      links: linksData,
      site: siteData,
      sources: {
        profile: args.profilePath,
        links: args.linksPath,
        site: args.sitePath,
      },
    }),
  );

  try {
    const authenticatedConfigResult = authenticatedExtractorConfigIssues(
      args.linksPath,
      linksData,
      siteData,
      bypassActive,
    );
    issues.push(...authenticatedConfigResult.issues);
    for (const linkId of authenticatedConfigResult.suppressedAuthenticatedCacheLinkIds) {
      suppressedAuthenticatedCacheLinkIds.add(linkId);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    issues.push({
      level: "error",
      source: args.linksPath,
      path: "$.links",
      message: `Failed to evaluate authenticated extractor policy checks. ${message}`,
      remediation:
        "Fix authenticated extractor link configuration and policy/cache files, run npm run setup:rich-auth, then rerun validation.",
    });
  }

  try {
    const blockersRegistry = loadRichEnrichmentBlockersRegistry({
      registryPath: DEFAULT_BLOCKERS_REGISTRY_PATH,
    });
    const blockerConfigResult = knownBlockerConfigIssues(
      args.linksPath,
      linksData,
      siteData,
      blockersRegistry,
      bypassActive,
    );
    issues.push(...blockerConfigResult.issues);
    for (const linkId of blockerConfigResult.suppressedKnownBlockerLinkIds) {
      suppressedKnownBlockerLinkIds.add(linkId);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    issues.push({
      level: "error",
      source: DEFAULT_BLOCKERS_REGISTRY_PATH,
      path: "$",
      message: `Failed to load rich-enrichment blockers registry. ${message}`,
      remediation:
        "Restore data/policy/rich-enrichment-blockers.json and ensure it validates against schema/rich-enrichment-blockers.schema.json.",
    });
  }

  if (hasRichRenderCandidates(linksData, siteData)) {
    const metadataPath = resolveEnrichmentMetadataPath(siteData);
    const metadataRead = tryReadJsonFile<GeneratedRichMetadataPayload>(metadataPath);
    const contentImagesRead = tryReadJsonFile<GeneratedContentImagesPayload>(
      DEFAULT_CONTENT_IMAGES_MANIFEST_PATH,
    );

    if (!metadataRead.value) {
      issues.push({
        level: "error",
        source: metadataPath,
        path: "$",
        message:
          "Generated rich metadata is required to validate rich-card preview images, but it could not be loaded.",
        remediation: `Run npm run enrich:rich:strict to regenerate ${metadataPath}. ${`Then rerun npm run validate:data. ${metadataRead.errorMessage ?? ""}`.trim()}`,
      });
    }

    if (!contentImagesRead.value) {
      issues.push({
        level: "error",
        source: DEFAULT_CONTENT_IMAGES_MANIFEST_PATH,
        path: "$",
        message:
          "Generated content-image manifest is required to validate rich-card preview images, but it could not be loaded.",
        remediation: `Run npm run images:sync to regenerate ${DEFAULT_CONTENT_IMAGES_MANIFEST_PATH}. ${`Then rerun npm run validate:data. ${contentImagesRead.errorMessage ?? ""}`.trim()}`,
      });
    }

    if (metadataRead.value && contentImagesRead.value) {
      const generatedMetadataByLink = resolveGeneratedMetadataByLink(metadataRead.value);

      issues.push(
        ...richCardPreviewImageIssues(
          args.linksPath,
          linksData,
          siteData,
          generatedMetadataByLink,
          resolveGeneratedContentImagesByUrl(contentImagesRead.value),
          metadataPath,
          DEFAULT_CONTENT_IMAGES_MANIFEST_PATH,
        ),
      );

      issues.push(
        ...supportedSocialProfileMetadataIssues(
          args.linksPath,
          linksData,
          siteData,
          generatedMetadataByLink,
        ),
      );
    }
  }

  issues.push(
    ...enrichmentIssues(
      enrichmentReportPath,
      enrichmentReport,
      args.strict,
      bypassActive,
      suppressedKnownBlockerLinkIds,
      suppressedAuthenticatedCacheLinkIds,
    ),
  );

  const errors = sortIssues(issues.filter((issue) => issue.level === "error"));
  const warnings = sortIssues(issues.filter((issue) => issue.level === "warning"));
  const strictBlockingWarnings = warnings.filter((issue) => issue.strictBlocking !== false);
  const hasAuthenticatedSetupIssue = [...errors, ...warnings].some((issue) => {
    const normalizedMessage = issue.message.toLowerCase();
    const normalizedSource = issue.source.toLowerCase();
    return (
      normalizedMessage.includes("authenticated extractor") ||
      normalizedMessage.includes("authenticated cache") ||
      normalizedSource.includes("rich-authenticated")
    );
  });

  const enrichmentSummary: EnrichmentRunSummary | undefined = enrichmentReport?.summary;

  const result: ValidationResult = {
    strict: args.strict,
    format: args.format,
    success: errors.length === 0 && (!args.strict || strictBlockingWarnings.length === 0),
    errors,
    warnings,
    strictBlockingWarnings: strictBlockingWarnings.length,
    files: {
      profile: args.profilePath,
      links: args.linksPath,
      site: args.sitePath,
    },
    enrichment: {
      reportPath: enrichmentReportPath,
      found: enrichmentReport !== null,
      generatedAt: enrichmentReport?.generatedAt,
      summary: enrichmentSummary,
      failureMode: enrichmentReport?.failureMode,
      failOn: enrichmentReport?.failOn,
      bypassActive,
      abortedEarly: enrichmentReport?.abortedEarly,
    },
  };

  if (args.format === "human" && hasAuthenticatedSetupIssue && !bypassActive) {
    console.log(
      "Hint: authenticated rich cache setup is required. Run `npm run setup:rich-auth`, commit updated cache/assets, then rerun validation/build.",
    );
    console.log("");
  }

  if (args.format === "json") {
    console.log(formatJsonOutput(result));
  } else {
    console.log(formatHumanOutput(result));
  }

  process.exit(result.success ? 0 : 1);
};

run();
