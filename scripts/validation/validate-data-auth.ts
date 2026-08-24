import {
  loadAuthenticatedCacheRegistry,
  resolveAuthenticatedCacheKey,
  validateAuthenticatedCacheEntry,
} from "../authenticated-extractors/cache";
import {
  DEFAULT_AUTH_EXTRACTORS_POLICY_PATH,
  loadAuthenticatedExtractorsPolicy,
  resolveAuthenticatedExtractorById,
  resolveAuthenticatedExtractorDomainMatch,
} from "../authenticated-extractors/policy";
import {
  type RichEnrichmentBlockersRegistry,
  resolveKnownBlockerMatch,
} from "../enrichment/blockers-registry";
import { resolvePublicEnrichmentStrategy } from "../enrichment/strategy-registry";
import type { EnrichmentRunReport } from "../enrichment/types";
import type { ValidationIssue } from "./rules-contracts";
import { ENRICHMENT_BYPASS_ENV } from "./validate-data-contracts";
import {
  isBlockingEntry,
  isNonStrictBlockingStalePublicCacheEntry,
  resolveAuthenticatedCacheConfig,
  resolveEnabledByDefault,
  resolveEnrichmentFailOn,
} from "./validate-data-enrichment-cache";
import { isRecord, toStringOrUndefined } from "./validate-data-runtime";

export interface AuthenticatedExtractorTarget {
  index: number;
  linkId: string;
  url: string;
  extractorId: string;
  cacheKey: string;
  enrichment?: Record<string, unknown>;
}

export const collectAuthenticatedExtractorTargets = (
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
      enrichment,
    });
  });

  return targets;
};

export const authenticatedExtractorConfigIssues = (
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
      profileSemantics: target.enrichment?.profileSemantics,
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

export const knownBlockerConfigIssues = (
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

    const publicStrategy = resolvePublicEnrichmentStrategy({
      url,
      icon: toStringOrUndefined(rawLink.icon),
    });
    if (publicStrategy.branch === "public_augmented") {
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

export const enrichmentIssues = (
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
      (entry.reason === "metadata_missing" || entry.reason === "metadata_regression") &&
      entry.missingFields &&
      entry.missingFields.length > 0
        ? ` Missing fields: ${entry.missingFields.join(", ")}.`
        : "";
    const missingProfileFields =
      entry.missingProfileFields && entry.missingProfileFields.length > 0
        ? ` Expected social profile fields missing: ${entry.missingProfileFields.join(", ")}.`
        : "";
    const nonStrictBlocking = isNonStrictBlockingStalePublicCacheEntry(entry);

    issues.push({
      level,
      source: reportPath,
      path: `$.entries[${index}]`,
      message:
        `Rich enrichment ${diagnosticClass} for link '${entry.linkId}' (${entry.reason}). ${entry.message}` +
        `${missingFields}${missingProfileFields} Policy: failureMode=${failureMode}, failOn=${failOn.join(", ")}.`,
      remediation: entry.remediation,
      strictBlocking: nonStrictBlocking ? false : undefined,
    });
  });

  return issues;
};
