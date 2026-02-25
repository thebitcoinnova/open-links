import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import {
  DEFAULT_AUTH_CACHE_PATH,
  loadAuthenticatedCacheRegistry,
  resolveAuthenticatedCacheKey,
  validateAuthenticatedCacheEntry
} from "./authenticated-extractors/cache";
import {
  DEFAULT_AUTH_EXTRACTORS_POLICY_PATH,
  loadAuthenticatedExtractorsPolicy,
  resolveAuthenticatedExtractorById,
  resolveAuthenticatedExtractorDomainMatch
} from "./authenticated-extractors/policy";
import {
  DEFAULT_BLOCKERS_REGISTRY_PATH,
  loadRichEnrichmentBlockersRegistry,
  resolveKnownBlockerMatch,
  type RichEnrichmentBlockersRegistry
} from "./enrichment/blockers-registry";
import { readEnrichmentReport } from "./enrichment/report";
import type {
  EnrichmentFailureReason,
  EnrichmentRunEntry,
  EnrichmentRunReport,
  EnrichmentRunSummary
} from "./enrichment/types";
import { runPolicyRules, type ValidationIssue } from "./validation/rules";
import {
  formatHumanOutput,
  formatJsonOutput,
  type ValidationResult
} from "./validation/format-output";

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
    enrichmentReportPath: getFlagValue("--enrichment-report")
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toStringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const resolveEnrichmentReportPath = (
  site: Record<string, unknown>,
  overridePath?: string
): string => {
  if (overridePath) {
    return overridePath;
  }

  const ui = isRecord(site.ui) ? site.ui : undefined;
  const richCards = ui && isRecord(ui.richCards) ? ui.richCards : undefined;
  const enrichment = richCards && isRecord(richCards.enrichment) ? richCards.enrichment : undefined;
  const reportPath = enrichment && typeof enrichment.reportPath === "string" ? enrichment.reportPath : undefined;

  return reportPath ?? "data/generated/rich-enrichment-report.json";
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
    remediation: `Update ${fieldPath} in ${source} to satisfy schema rule: ${message}.`
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
  site: Record<string, unknown>
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
    warnAgeDays
  };
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
  siteData: Record<string, unknown>
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
      linkId
    );

    targets.push({
      index,
      linkId,
      url,
      extractorId,
      cacheKey
    });
  });

  return targets;
};

const authenticatedExtractorConfigIssues = (
  linksSource: string,
  linksData: Record<string, unknown>,
  siteData: Record<string, unknown>,
  bypassActive: boolean
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
      policyPath: DEFAULT_AUTH_EXTRACTORS_POLICY_PATH
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    issues.push({
      level: "error",
      source: DEFAULT_AUTH_EXTRACTORS_POLICY_PATH,
      path: "$",
      message: `Failed to load authenticated extractors policy. ${message}`,
      remediation:
        "Restore data/policy/rich-authenticated-extractors.json, ensure it validates against schema/rich-authenticated-extractors.schema.json, then run npm run setup:rich-auth."
    });
    targets.forEach((target) => suppressedAuthenticatedCacheLinkIds.add(target.linkId));
    return { issues, suppressedAuthenticatedCacheLinkIds };
  }

  let cacheRegistry: ReturnType<typeof loadAuthenticatedCacheRegistry>;
  try {
    cacheRegistry = loadAuthenticatedCacheRegistry({
      cachePath
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    issues.push({
      level: bypassActive ? "warning" : "error",
      source: cachePath,
      path: "$",
      message: `Failed to load authenticated rich cache. ${message}`,
      remediation:
        "Restore/fix data/cache/rich-authenticated-cache.json, ensure it validates against schema/rich-authenticated-cache.schema.json, then run npm run setup:rich-auth."
    });
    targets.forEach((target) => suppressedAuthenticatedCacheLinkIds.add(target.linkId));
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
          "Use a valid extractor id from data/policy/rich-authenticated-extractors.json or remove links[].enrichment.authenticatedExtractor for this link, then run npm run setup:rich-auth."
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
          "Enable the extractor in data/policy/rich-authenticated-extractors.json or remove links[].enrichment.authenticatedExtractor for this link, then run npm run setup:rich-auth."
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
          ", "
        )}. Fix links[].enrichment.authenticatedExtractor or the link URL, then run npm run setup:rich-auth.`
      });
      continue;
    }

    const validation = validateAuthenticatedCacheEntry({
      cacheKey: target.cacheKey,
      expectedLinkId: target.linkId,
      expectedExtractorId: target.extractorId,
      expectedUrl: target.url,
      warnAgeDays,
      registry: cacheRegistry
    });

    if (validation.issues.length > 0) {
      suppressedAuthenticatedCacheLinkIds.add(target.linkId);
    }

    for (const issue of validation.issues) {
      issues.push({
        level:
          issue.level === "error"
            ? bypassActive
              ? "warning"
              : "error"
            : "warning",
        source: cachePath,
        path: issue.level === "error" ? cacheKeyPath : `$.entries.${target.cacheKey}`,
        message: `Authenticated cache check for link '${target.linkId}' failed: ${issue.message}`,
        remediation: issue.remediation
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
  bypassActive: boolean
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

    const allowKnownBlocker = enrichment?.allowKnownBlocker === true;
    const docsHint = match.blocker.docs.length > 0 ? ` Docs: ${match.blocker.docs.join(", ")}.` : "";
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
          "This link is allowed to attempt direct-fetch enrichment despite known blocker policy. Keep this override temporary and monitor enrichment outcomes."
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
        `Emergency local bypass: ${ENRICHMENT_BYPASS_ENV}=1 npm run build.${docsHint}`
      ].join(" ")
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
  suppressedAuthenticatedCacheLinkIds: Set<string>
): ValidationIssue[] => {
  if (!report) {
    return [
      {
        level: strict ? "error" : "warning",
        source: reportPath,
        path: "$",
        message: "Rich enrichment report not found.",
        remediation:
          "Run `npm run enrich:rich:strict` before validation/build so policy-based rich-link enrichment outcomes are available."
      }
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

    const level: ValidationIssue["level"] = strict && blocking && !bypassActive ? "error" : "warning";
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

    issues.push({
      level,
      source: reportPath,
      path: `$.entries[${index}]`,
      message:
        `Rich enrichment ${diagnosticClass} for link '${entry.linkId}' (${entry.reason}). ${entry.message}` +
        `${missingFields} Policy: failureMode=${failureMode}, failOn=${failOn.join(", ")}.`,
      remediation: entry.remediation
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

  const schemaChecks: Array<{ source: string; schema: Record<string, unknown>; data: Record<string, unknown> }> = [
    { source: args.profilePath, schema: profileSchema, data: profileData },
    { source: args.linksPath, schema: linksSchema, data: linksData },
    { source: args.sitePath, schema: siteSchema, data: siteData }
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
        site: args.sitePath
      }
    })
  );

  try {
    const authenticatedConfigResult = authenticatedExtractorConfigIssues(
      args.linksPath,
      linksData,
      siteData,
      bypassActive
    );
    issues.push(...authenticatedConfigResult.issues);
    authenticatedConfigResult.suppressedAuthenticatedCacheLinkIds.forEach((linkId) =>
      suppressedAuthenticatedCacheLinkIds.add(linkId)
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    issues.push({
      level: "error",
      source: args.linksPath,
      path: "$.links",
      message: `Failed to evaluate authenticated extractor policy checks. ${message}`,
      remediation:
        "Fix authenticated extractor link configuration and policy/cache files, run npm run setup:rich-auth, then rerun validation."
    });
  }

  try {
    const blockersRegistry = loadRichEnrichmentBlockersRegistry({
      registryPath: DEFAULT_BLOCKERS_REGISTRY_PATH
    });
    const blockerConfigResult = knownBlockerConfigIssues(
      args.linksPath,
      linksData,
      siteData,
      blockersRegistry,
      bypassActive
    );
    issues.push(...blockerConfigResult.issues);
    blockerConfigResult.suppressedKnownBlockerLinkIds.forEach((linkId) =>
      suppressedKnownBlockerLinkIds.add(linkId)
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    issues.push({
      level: "error",
      source: DEFAULT_BLOCKERS_REGISTRY_PATH,
      path: "$",
      message: `Failed to load rich-enrichment blockers registry. ${message}`,
      remediation:
        "Restore data/policy/rich-enrichment-blockers.json and ensure it validates against schema/rich-enrichment-blockers.schema.json."
    });
  }

  issues.push(
    ...enrichmentIssues(
      enrichmentReportPath,
      enrichmentReport,
      args.strict,
      bypassActive,
      suppressedKnownBlockerLinkIds,
      suppressedAuthenticatedCacheLinkIds
    )
  );

  const errors = sortIssues(issues.filter((issue) => issue.level === "error"));
  const warnings = sortIssues(issues.filter((issue) => issue.level === "warning"));
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
    success: errors.length === 0 && (!args.strict || warnings.length === 0),
    errors,
    warnings,
    files: {
      profile: args.profilePath,
      links: args.linksPath,
      site: args.sitePath
    },
    enrichment: {
      reportPath: enrichmentReportPath,
      found: enrichmentReport !== null,
      generatedAt: enrichmentReport?.generatedAt,
      summary: enrichmentSummary,
      failureMode: enrichmentReport?.failureMode,
      failOn: enrichmentReport?.failOn,
      bypassActive,
      abortedEarly: enrichmentReport?.abortedEarly
    }
  };

  if (args.format === "human" && hasAuthenticatedSetupIssue && !bypassActive) {
    console.log(
      "Hint: authenticated rich cache setup is required. Run `npm run setup:rich-auth`, commit updated cache/assets, then rerun validation/build."
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
