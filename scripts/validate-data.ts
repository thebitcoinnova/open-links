import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import addFormats from "ajv-formats";
import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import {
  FOLLOWER_HISTORY_INDEX_PUBLIC_PATH,
  FOLLOWER_HISTORY_PUBLIC_ROOT,
  normalizeFollowerHistoryRows,
  parseFollowerHistoryCsv,
  parseFollowerHistoryIndex,
} from "../src/lib/analytics/follower-history";
import type { OpenLink, SiteData } from "../src/lib/content/load-content";
import {
  mergeMetadataWithManualSocialProfileOverrides,
  resolveMissingSupportedSocialProfileFields,
  resolveSupportedSocialProfile,
} from "../src/lib/content/social-profile-fields";
import { buildRichCardViewModel } from "../src/lib/ui/rich-card-policy";
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
import {
  hasPublicAugmentationTarget,
  resolvePublicAugmentationTarget,
} from "./enrichment/public-augmentation";
import { readEnrichmentReport } from "./enrichment/report";
import type {
  EnrichmentFailureReason,
  EnrichmentRunEntry,
  EnrichmentRunReport,
  EnrichmentRunSummary,
} from "./enrichment/types";
import {
  DEFAULT_REMOTE_CACHE_POLICY_PATH,
  loadRemoteCachePolicyRegistry,
  resolveRemoteCachePolicyRule,
} from "./shared/remote-cache-policy";
import { collectCandidates } from "./sync-content-images";
import {
  type ValidationResult,
  formatHumanOutput,
  formatJsonOutput,
} from "./validation/format-output";
import { type ValidationIssue, runPolicyRules } from "./validation/rules";

type OutputFormat = "human" | "json";
export type ValidationMode = "full" | "hook";

type ArgMap = {
  strict: boolean;
  format: OutputFormat;
  mode: ValidationMode;
  profilePath: string;
  linksPath: string;
  sitePath: string;
  enrichmentReportPath?: string;
  changedPathsFile?: string;
};

const ROOT = process.cwd();
const ENRICHMENT_BYPASS_ENV = "OPENLINKS_RICH_ENRICHMENT_BYPASS";
const DEFAULT_AUTH_CACHE_WARN_AGE_DAYS = 30;
const DEFAULT_ENRICHMENT_METADATA_PATH = "data/generated/rich-metadata.json";
const DEFAULT_CONTENT_IMAGES_MANIFEST_PATH = "data/cache/content-images.json";
const DEFAULT_FOLLOWER_HISTORY_REPO_ROOT = "public/history/followers";
const DEFAULT_FOLLOWER_HISTORY_INDEX_PATH = `public/${FOLLOWER_HISTORY_INDEX_PUBLIC_PATH}`;
export const DEFAULT_HOOK_CHANGED_PATHS_PATH = ".cache/openlinks-precommit/staged-files.txt";
const HOOK_SKIP_RICH_ARTIFACT_CHECKS_MESSAGE =
  "Hook mode skipped generated rich-artifact checks because staged paths did not touch rich metadata/image inputs.";

const HOOK_RICH_ARTIFACT_TRIGGER_EXACT_PATHS = new Set([
  "data/links.json",
  "data/site.json",
  "data/generated/rich-metadata.json",
  "data/cache/content-images.json",
  "data/cache/content-images.runtime.json",
  "data/cache/profile-avatar.json",
  "data/cache/profile-avatar.runtime.json",
  "data/policy/remote-cache-policy.json",
  "data/generated/rich-enrichment-report.json",
  "schema/links.schema.json",
  "schema/remote-cache-policy.schema.json",
  "schema/site.schema.json",
  "scripts/enrich-rich-links.ts",
  "scripts/sync-profile-avatar.ts",
  "scripts/sync-content-images.ts",
  "scripts/validate-data.ts",
]);

const HOOK_RICH_ARTIFACT_TRIGGER_PREFIXES = [
  "data/cache/",
  "public/cache/content-images/",
  "public/cache/rich-authenticated/",
  "scripts/enrichment/",
  "scripts/validation/",
  "src/lib/content/",
] as const;

export interface HookRichArtifactCheckDecision {
  shouldRun: boolean;
  humanNote?: string;
}

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
  const modeRaw = getFlagValue("--mode");
  const mode: ValidationMode = modeRaw === "hook" ? "hook" : "full";

  return {
    strict: args.includes("--strict"),
    format,
    mode,
    profilePath: getFlagValue("--profile") ?? "data/profile.json",
    linksPath: getFlagValue("--links") ?? "data/links.json",
    sitePath: getFlagValue("--site") ?? "data/site.json",
    enrichmentReportPath: getFlagValue("--enrichment-report"),
    changedPathsFile: getFlagValue("--changed-paths-file"),
  };
};

const normalizeRepoPath = (value: string): string =>
  value
    .replaceAll("\\", "/")
    .replace(/^\.?\//, "")
    .trim();

export const pathTouchesHookRichArtifactInputs = (repoPath: string): boolean => {
  const normalized = normalizeRepoPath(repoPath);
  if (normalized.length === 0) {
    return false;
  }

  if (HOOK_RICH_ARTIFACT_TRIGGER_EXACT_PATHS.has(normalized)) {
    return true;
  }

  return HOOK_RICH_ARTIFACT_TRIGGER_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

const tryReadChangedPaths = (
  changedPathsFile: string,
): { paths: string[] | null; errorMessage?: string } => {
  try {
    const absolute = absolutePath(changedPathsFile);
    const contents = fs.readFileSync(absolute, "utf8");
    return {
      paths: contents
        .split(/\r?\n/u)
        .map((entry) => normalizeRepoPath(entry))
        .filter((entry) => entry.length > 0),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      paths: null,
      errorMessage: message,
    };
  }
};

export const resolveHookRichArtifactCheckDecision = (input: {
  mode: ValidationMode;
  changedPathsFile?: string;
}): HookRichArtifactCheckDecision => {
  if (input.mode === "full") {
    return { shouldRun: true };
  }

  if (!input.changedPathsFile) {
    return {
      shouldRun: true,
      humanNote:
        "Hook mode could not find a changed-paths file, so generated rich-artifact checks fell back to full validation.",
    };
  }

  const changedPaths = tryReadChangedPaths(input.changedPathsFile);
  if (!changedPaths.paths) {
    return {
      shouldRun: true,
      humanNote:
        `Hook mode could not read '${input.changedPathsFile}', so generated rich-artifact checks fell back to full validation. ${changedPaths.errorMessage ?? ""}`.trim(),
    };
  }

  if (changedPaths.paths.some((entry) => pathTouchesHookRichArtifactInputs(entry))) {
    return { shouldRun: true };
  }

  return {
    shouldRun: false,
    humanNote: HOOK_SKIP_RICH_ARTIFACT_CHECKS_MESSAGE,
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

const readContentImagesManifest = (): {
  path: string;
  value: GeneratedContentImagesPayload | null;
  errorMessage?: string;
} => {
  const manifest = tryReadJsonFile<GeneratedContentImagesPayload>(
    DEFAULT_CONTENT_IMAGES_MANIFEST_PATH,
  );
  if (manifest.value) {
    return {
      path: DEFAULT_CONTENT_IMAGES_MANIFEST_PATH,
      value: manifest.value,
    };
  }

  return {
    path: DEFAULT_CONTENT_IMAGES_MANIFEST_PATH,
    value: null,
    errorMessage: manifest.errorMessage,
  };
};

const readTextFile = (relativePath: string): { value: string | null; errorMessage?: string } => {
  try {
    const absolute = absolutePath(relativePath);
    return { value: fs.readFileSync(absolute, "utf8") };
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

const isNonStrictBlockingStalePublicCacheEntry = (entry: EnrichmentRunEntry): boolean =>
  entry.reason === "public_cache" &&
  entry.staleCache === true &&
  entry.status === "fetched" &&
  entry.manualFallbackUsed !== true &&
  (!entry.missingFields || entry.missingFields.length === 0) &&
  (!entry.missingProfileFields || entry.missingProfileFields.length === 0);

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

const richLinkNeedsPreviewValidation = (
  siteData: Record<string, unknown>,
  rawLink: Record<string, unknown>,
  generatedMetadata: Record<string, unknown> | undefined,
): boolean => {
  const metadata = isRecord(rawLink.metadata) ? rawLink.metadata : undefined;
  const mergedMetadata = mergeMetadataWithManualSocialProfileOverrides(metadata, generatedMetadata);
  const mergedLink = {
    ...rawLink,
    metadata: mergedMetadata,
  } as unknown as OpenLink;
  const viewModel = buildRichCardViewModel(siteData as SiteData, mergedLink);

  return viewModel.leadKind === "preview" || viewModel.showDescriptionImageRow;
};

const hasRichPreviewValidationCandidates = (
  linksData: Record<string, unknown>,
  siteData: Record<string, unknown>,
  generatedMetadataByLink: Record<string, Record<string, unknown>>,
): boolean => {
  if (resolveRichRenderMode(siteData) === "simple") {
    return false;
  }

  const links = Array.isArray(linksData.links) ? linksData.links : [];

  return links.some(
    (rawLink) =>
      isRecord(rawLink) &&
      rawLink.type === "rich" &&
      rawLink.enabled !== false &&
      richLinkNeedsPreviewValidation(
        siteData,
        rawLink,
        generatedMetadataByLink[toStringOrUndefined(rawLink.id) ?? ""],
      ),
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

const remoteCachePolicyCoverageIssues = (input: {
  profileSource: string;
  profileData: Record<string, unknown>;
  linksSource: string;
  linksData: Record<string, unknown>;
  siteData: Record<string, unknown>;
  generatedMetadataByLink: Record<string, Record<string, unknown>>;
}): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  let registry: ReturnType<typeof loadRemoteCachePolicyRegistry>;

  try {
    registry = loadRemoteCachePolicyRegistry();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return [
      {
        level: "error",
        source: DEFAULT_REMOTE_CACHE_POLICY_PATH,
        path: "$",
        message: `Failed to load remote cache policy registry. ${message}`,
        remediation:
          "Restore data/policy/remote-cache-policy.json, ensure it validates against schema/remote-cache-policy.schema.json, then rerun validation.",
      },
    ];
  }

  const seenCoverageKeys = new Set<string>();
  const requireCoverage = (
    pipeline: Parameters<typeof resolveRemoteCachePolicyRule>[0]["pipeline"],
    url: string | undefined,
    source: string,
    fieldPath: string,
  ) => {
    if (!url) {
      return;
    }

    const canonicalUrl = toCanonicalHttpUrl(url);
    if (!canonicalUrl) {
      return;
    }

    const coverageKey = `${pipeline}:${canonicalUrl}`;
    if (seenCoverageKeys.has(coverageKey)) {
      return;
    }
    seenCoverageKeys.add(coverageKey);

    const match = resolveRemoteCachePolicyRule({
      registry,
      pipeline,
      url: canonicalUrl,
    });
    if (match) {
      return;
    }

    issues.push({
      level: "error",
      source,
      path: fieldPath,
      message: `Remote cache policy coverage is missing for pipeline '${pipeline}' and URL '${canonicalUrl}'.`,
      remediation: `Add a matching rule to ${DEFAULT_REMOTE_CACHE_POLICY_PATH} for host '${
        new URL(canonicalUrl).hostname
      }', then rerun validation/build.`,
    });
  };

  const avatarUrl = toStringOrUndefined(input.profileData.avatar);
  requireCoverage("profile_avatar", avatarUrl, input.profileSource, "$.avatar");

  const contentImageCandidates = collectCandidates(
    input.linksData as Parameters<typeof collectCandidates>[0],
    {
      links: Object.fromEntries(
        Object.entries(input.generatedMetadataByLink).map(([linkId, metadata]) => [
          linkId,
          { metadata },
        ]),
      ),
    },
    input.siteData as Parameters<typeof collectCandidates>[2],
  );
  for (const candidate of contentImageCandidates) {
    requireCoverage("content_images", candidate, input.linksSource, "$.links");
  }

  const enabledByDefault = resolveEnabledByDefault(input.siteData);
  const links = Array.isArray(input.linksData.links) ? input.linksData.links : [];
  links.forEach((rawLink, index) => {
    if (!isRecord(rawLink) || rawLink.type !== "rich") {
      return;
    }

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

    const supportedProfile = resolveSupportedSocialProfile({
      url,
      icon: toStringOrUndefined(rawLink.icon),
      metadataHandle: toStringOrUndefined(
        isRecord(rawLink.metadata) ? rawLink.metadata.handle : undefined,
      ),
    });
    const authenticatedExtractor = toStringOrUndefined(enrichment?.authenticatedExtractor);
    if (authenticatedExtractor) {
      if (supportedProfile?.platform === "linkedin") {
        requireCoverage("public_rich_metadata", url, input.linksSource, `$.links[${index}].url`);
      }
      return;
    }

    const publicSourceUrl =
      resolvePublicAugmentationTarget({
        url,
        icon: toStringOrUndefined(rawLink.icon),
        metadataHandle: toStringOrUndefined(
          isRecord(rawLink.metadata) ? rawLink.metadata.handle : undefined,
        ),
      })?.sourceUrl ?? url;

    requireCoverage(
      "public_rich_metadata",
      publicSourceUrl,
      input.linksSource,
      `$.links[${index}].url`,
    );
  });

  const { cachePath } = resolveAuthenticatedCacheConfig(input.siteData);
  try {
    const cacheRegistry = loadAuthenticatedCacheRegistry({ cachePath });

    for (const [cacheKey, entry] of Object.entries(cacheRegistry.entries)) {
      requireCoverage(
        "authenticated_asset_images",
        entry.assets.image.sourceUrl,
        cachePath,
        `$.entries.${cacheKey}.assets.image.sourceUrl`,
      );

      if (entry.assets.profileImage) {
        requireCoverage(
          "authenticated_asset_images",
          entry.assets.profileImage.sourceUrl,
          cachePath,
          `$.entries.${cacheKey}.assets.profileImage.sourceUrl`,
        );
      }
      if (entry.assets.ogImage) {
        requireCoverage(
          "authenticated_asset_images",
          entry.assets.ogImage.sourceUrl,
          cachePath,
          `$.entries.${cacheKey}.assets.ogImage.sourceUrl`,
        );
      }
      if (entry.assets.twitterImage) {
        requireCoverage(
          "authenticated_asset_images",
          entry.assets.twitterImage.sourceUrl,
          cachePath,
          `$.entries.${cacheKey}.assets.twitterImage.sourceUrl`,
        );
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    issues.push({
      level: "error",
      source: cachePath,
      path: "$",
      message: `Failed to load authenticated cache while checking remote cache policy coverage. ${message}`,
      remediation:
        "Restore/fix data/cache/rich-authenticated-cache.json, ensure it validates against schema/rich-authenticated-cache.schema.json, then rerun validation.",
    });
  }

  return issues;
};

const resolveHistoryRepoPath = (
  csvPath: string,
  publicRoot: string,
  repoRoot: string,
): string | null => {
  const normalizedCsvPath = normalizeRepoPath(csvPath);
  const normalizedPublicRoot = normalizeRepoPath(publicRoot);
  const normalizedRepoRoot = normalizeRepoPath(repoRoot);

  if (!normalizedCsvPath.startsWith(`${normalizedPublicRoot}/`)) {
    return null;
  }

  return `${normalizedRepoRoot}/${normalizedCsvPath.slice(normalizedPublicRoot.length + 1)}`;
};

export const followerHistoryArtifactIssues = (input?: {
  historyRepoRoot?: string;
  indexPath?: string;
  publicRoot?: string;
}): ValidationIssue[] => {
  const historyRepoRoot = input?.historyRepoRoot ?? DEFAULT_FOLLOWER_HISTORY_REPO_ROOT;
  const indexPath = input?.indexPath ?? DEFAULT_FOLLOWER_HISTORY_INDEX_PATH;
  const publicRoot = input?.publicRoot ?? FOLLOWER_HISTORY_PUBLIC_ROOT;
  const issues: ValidationIssue[] = [];
  const indexRead = tryReadJsonFile<unknown>(indexPath);

  if (!indexRead.value) {
    issues.push({
      level: "error",
      source: indexPath,
      path: "$",
      message: "Follower-history index not found.",
      remediation:
        "Run `bun scripts/sync-follower-history.ts` (or the package-script wrapper once wired), commit the generated files under public history, then rerun validation.",
    });
    return issues;
  }

  let index: ReturnType<typeof parseFollowerHistoryIndex>;
  try {
    index = parseFollowerHistoryIndex(indexRead.value);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    issues.push({
      level: "error",
      source: indexPath,
      path: "$",
      message: `Follower-history index is invalid. ${message}`,
      remediation:
        "Regenerate the follower-history index from the sync command and ensure it stays aligned with the committed CSV artifacts.",
    });
    return issues;
  }

  const referencedCsvRepoPaths = new Set<string>();
  const seenLinkIds = new Set<string>();

  for (const entry of index.entries) {
    if (seenLinkIds.has(entry.linkId)) {
      issues.push({
        level: "error",
        source: indexPath,
        path: "$.entries",
        message: `Follower-history index contains duplicate linkId '${entry.linkId}'.`,
        remediation:
          "Keep one index entry per link id and regenerate the index from the sync command.",
      });
      continue;
    }

    seenLinkIds.add(entry.linkId);

    const repoCsvPath = resolveHistoryRepoPath(entry.csvPath, publicRoot, historyRepoRoot);
    if (!repoCsvPath) {
      issues.push({
        level: "error",
        source: indexPath,
        path: "$.entries",
        message: `Follower-history index entry '${entry.linkId}' points to '${entry.csvPath}', which is outside '${publicRoot}/'.`,
        remediation:
          "Keep follower-history CSV paths under the configured public history root and regenerate the index.",
      });
      continue;
    }

    referencedCsvRepoPaths.add(normalizeRepoPath(repoCsvPath));
    const csvRead = readTextFile(repoCsvPath);
    if (!csvRead.value) {
      issues.push({
        level: "error",
        source: repoCsvPath,
        path: "$",
        message: `Follower-history CSV for '${entry.linkId}' is missing.`,
        remediation:
          "Regenerate the follower-history CSV artifacts so the index only references files that exist on disk.",
      });
      continue;
    }

    let rows: ReturnType<typeof parseFollowerHistoryCsv>;
    try {
      rows = parseFollowerHistoryCsv(csvRead.value);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      issues.push({
        level: "error",
        source: repoCsvPath,
        path: "$",
        message: `Follower-history CSV for '${entry.linkId}' is invalid. ${message}`,
        remediation:
          "Regenerate the follower-history CSV so it uses the locked header and row contract.",
      });
      continue;
    }

    if (rows.length === 0) {
      issues.push({
        level: "error",
        source: repoCsvPath,
        path: "$",
        message: `Follower-history CSV for '${entry.linkId}' has no rows.`,
        remediation: "Append at least one history row before committing the CSV artifact.",
      });
      continue;
    }

    if (rows.some((row) => row.platform !== entry.platform)) {
      issues.push({
        level: "error",
        source: repoCsvPath,
        path: "$.platform",
        message: `Follower-history CSV '${repoCsvPath}' mixes rows from outside the '${entry.platform}' platform.`,
        remediation: "Keep one CSV per platform and move mismatched rows into the correct file.",
      });
    }

    const matchingRows = normalizeFollowerHistoryRows(
      rows.filter((row) => row.linkId === entry.linkId),
    );
    if (matchingRows.length === 0) {
      issues.push({
        level: "error",
        source: repoCsvPath,
        path: "$.linkId",
        message: `Follower-history CSV '${repoCsvPath}' has no rows for indexed link '${entry.linkId}'.`,
        remediation:
          "Regenerate the CSV and index so each indexed link points at a file containing its own history rows.",
      });
      continue;
    }

    const latestRow = matchingRows[matchingRows.length - 1];
    if (
      latestRow.audienceKind !== entry.audienceKind ||
      latestRow.audienceCount !== entry.latestAudienceCount ||
      latestRow.audienceCountRaw !== entry.latestAudienceCountRaw ||
      latestRow.observedAt !== entry.latestObservedAt ||
      latestRow.canonicalUrl !== entry.canonicalUrl ||
      latestRow.handle !== entry.handle
    ) {
      issues.push({
        level: "error",
        source: indexPath,
        path: "$.entries",
        message: `Follower-history index entry '${entry.linkId}' does not match the latest row in '${entry.csvPath}'.`,
        remediation:
          "Regenerate the follower-history index after updating CSV artifacts so latest count, timestamp, URL, and handle fields stay in sync.",
      });
    }
  }

  const historyRootAbsolute = absolutePath(historyRepoRoot);
  if (fs.existsSync(historyRootAbsolute)) {
    for (const directoryEntry of fs.readdirSync(historyRootAbsolute, { withFileTypes: true })) {
      if (!directoryEntry.isFile() || !directoryEntry.name.endsWith(".csv")) {
        continue;
      }

      const repoCsvPath = normalizeRepoPath(
        path.join(historyRepoRoot, directoryEntry.name).replaceAll("\\", "/"),
      );
      if (!referencedCsvRepoPaths.has(repoCsvPath)) {
        issues.push({
          level: "error",
          source: repoCsvPath,
          path: "$",
          message: `Follower-history CSV '${repoCsvPath}' is not referenced by the index.`,
          remediation:
            "Regenerate the follower-history index or remove stale CSV files so file/index parity is preserved.",
        });
      }
    }
  }

  return issues;
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
    const mergedMetadata =
      mergeMetadataWithManualSocialProfileOverrides(metadata, generatedMetadata) ?? {};
    if (!richLinkNeedsPreviewValidation(siteData, rawLink, generatedMetadata)) {
      return;
    }
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

    const remediationBase = `Add a preview image at ${imagePath} (for example a local 'cache/content-images/<hash>.jpg' asset or a remote URL that resolves into ${contentImagesPath}).`;
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
      metadataHandle: isRecord(rawLink.metadata) ? rawLink.metadata.handle : undefined,
    });
    const linkId = toStringOrUndefined(rawLink.id) ?? `links[${index}]`;
    const manualMetadata = isRecord(rawLink.metadata) ? rawLink.metadata : {};
    const generatedMetadata = generatedMetadataByLink[linkId] ?? {};
    const mergedMetadata =
      mergeMetadataWithManualSocialProfileOverrides(manualMetadata, generatedMetadata) ?? {};
    const resolvedSupportedProfile =
      resolveSupportedSocialProfile({
        url,
        icon: toStringOrUndefined(rawLink.icon),
        metadataHandle: mergedMetadata.handle,
      }) ?? supportedProfile;
    if (!resolvedSupportedProfile) {
      return;
    }
    const missingProfileFields = resolveMissingSupportedSocialProfileFields(
      mergedMetadata,
      resolvedSupportedProfile,
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
        `Supported ${resolvedSupportedProfile.platform} profile link '${linkId}' is missing expected social profile metadata: ` +
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
      entry.reason === "metadata_missing" && entry.missingFields && entry.missingFields.length > 0
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

export const run = () => {
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
  const enrichmentMetadataPath = resolveEnrichmentMetadataPath(siteData);
  const generatedMetadataForCoverageRead =
    tryReadJsonFile<GeneratedRichMetadataPayload>(enrichmentMetadataPath);
  const generatedMetadataByLinkForCoverage = generatedMetadataForCoverageRead.value
    ? resolveGeneratedMetadataByLink(generatedMetadataForCoverageRead.value)
    : {};

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

  issues.push(
    ...remoteCachePolicyCoverageIssues({
      profileSource: args.profilePath,
      profileData,
      linksSource: args.linksPath,
      linksData,
      siteData,
      generatedMetadataByLink: generatedMetadataByLinkForCoverage,
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

  const hasRichCandidates = hasRichRenderCandidates(linksData, siteData);
  const hookRichArtifactDecision = resolveHookRichArtifactCheckDecision({
    mode: args.mode,
    changedPathsFile: args.changedPathsFile,
  });

  if (hasRichCandidates && hookRichArtifactDecision.shouldRun) {
    const metadataPath = enrichmentMetadataPath;
    const metadataRead = generatedMetadataForCoverageRead;
    const contentImagesRead = readContentImagesManifest();
    const generatedMetadataByLink = metadataRead.value
      ? resolveGeneratedMetadataByLink(metadataRead.value)
      : {};
    const needsPreviewValidation = hasRichPreviewValidationCandidates(
      linksData,
      siteData,
      generatedMetadataByLink,
    );

    if (needsPreviewValidation && !metadataRead.value) {
      issues.push({
        level: "error",
        source: metadataPath,
        path: "$",
        message:
          "Generated rich metadata is required to validate rich-card preview images, but it could not be loaded.",
        remediation: `Run npm run enrich:rich:strict to regenerate ${metadataPath}. ${`Then rerun npm run validate:data. ${metadataRead.errorMessage ?? ""}`.trim()}`,
      });
    }

    if (needsPreviewValidation && !contentImagesRead.value) {
      issues.push({
        level: "error",
        source: contentImagesRead.path,
        path: "$",
        message:
          "Generated content-image manifest is required to validate rich-card preview images, but it could not be loaded.",
        remediation: `Run npm run images:sync to regenerate ${contentImagesRead.path}. ${`Then rerun npm run validate:data. ${contentImagesRead.errorMessage ?? ""}`.trim()}`,
      });
    }

    if (needsPreviewValidation && metadataRead.value && contentImagesRead.value) {
      issues.push(
        ...richCardPreviewImageIssues(
          args.linksPath,
          linksData,
          siteData,
          generatedMetadataByLink,
          resolveGeneratedContentImagesByUrl(contentImagesRead.value),
          metadataPath,
          contentImagesRead.path,
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

  if (hookRichArtifactDecision.shouldRun) {
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
  }

  issues.push(...followerHistoryArtifactIssues());

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

  if (args.format === "human" && hookRichArtifactDecision.humanNote) {
    console.log(hookRichArtifactDecision.humanNote);
    console.log("");
  }

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

if (import.meta.main) {
  run();
}
