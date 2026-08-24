import { collectContentImageSlots } from "../../src/lib/content/content-image-slots";
import type { OpenLink, SiteData } from "../../src/lib/content/load-content";
import type { GeneratedLinkReferralConfig } from "../../src/lib/content/referral-fields";
import {
  mergeMetadataWithManualSocialProfileOverrides,
  resolveSupportedSocialProfile,
} from "../../src/lib/content/social-profile-fields";
import { buildRichCardViewModel } from "../../src/lib/ui/rich-card-policy";
import {
  DEFAULT_AUTH_CACHE_PATH,
  loadAuthenticatedCacheRegistry,
} from "../authenticated-extractors/cache";
import { resolvePublicEnrichmentStrategy } from "../enrichment/strategy-registry";
import type {
  EnrichmentFailureReason,
  EnrichmentRunEntry,
  EnrichmentRunReport,
} from "../enrichment/types";
import {
  DEFAULT_REMOTE_CACHE_POLICY_LOCAL_PATH,
  DEFAULT_REMOTE_CACHE_POLICY_PATH,
  loadRemoteCachePolicyRegistry,
  resolveRemoteCachePolicyRule,
} from "../shared/remote-cache-policy";
import type { ValidationIssue } from "./rules-contracts";
import {
  DEFAULT_AUTH_CACHE_WARN_AGE_DAYS,
  type GeneratedContentImagesPayload,
  type GeneratedRichMetadataPayload,
} from "./validate-data-contracts";
import {
  isRecord,
  resolvePublicCachePath,
  toStringOrUndefined,
  tryReadJsonFile,
} from "./validate-data-runtime";

export const DEFAULT_ENRICHMENT_FAIL_ON: EnrichmentFailureReason[] = [
  "fetch_failed",
  "metadata_missing",
];

export const isFailureReason = (value: unknown): value is EnrichmentFailureReason =>
  value === "fetch_failed" || value === "metadata_missing";

export const resolveEnrichmentFailOn = (report: EnrichmentRunReport): EnrichmentFailureReason[] => {
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

export const isBlockingEntry = (
  entry: EnrichmentRunEntry,
  failOn: EnrichmentFailureReason[],
): boolean => {
  if (typeof entry.blocking === "boolean") {
    return entry.blocking;
  }
  if (entry.manualFallbackUsed) {
    return false;
  }
  return isFailureReason(entry.reason) && failOn.includes(entry.reason);
};

export const isNonStrictBlockingStalePublicCacheEntry = (entry: EnrichmentRunEntry): boolean =>
  entry.reason === "public_cache" &&
  entry.staleCache === true &&
  entry.status === "fetched" &&
  entry.manualFallbackUsed !== true &&
  (!entry.missingFields || entry.missingFields.length === 0) &&
  (!entry.missingProfileFields || entry.missingProfileFields.length === 0);

export const resolveEnabledByDefault = (site: Record<string, unknown>): boolean => {
  const ui = isRecord(site.ui) ? site.ui : undefined;
  const richCards = ui && isRecord(ui.richCards) ? ui.richCards : undefined;
  const enrichment = richCards && isRecord(richCards.enrichment) ? richCards.enrichment : undefined;
  return typeof enrichment?.enabledByDefault === "boolean" ? enrichment.enabledByDefault : true;
};

export const resolveAuthenticatedCacheConfig = (
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

export const resolveRichRenderMode = (site: Record<string, unknown>): "auto" | "simple" => {
  const ui = isRecord(site.ui) ? site.ui : undefined;
  const richCards = ui && isRecord(ui.richCards) ? ui.richCards : undefined;
  return richCards?.renderMode === "simple" ? "simple" : "auto";
};

export const hasRichRenderCandidates = (
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

export const richLinkNeedsPreviewValidation = (
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

  return viewModel.leadKind === "preview" || viewModel.profilePreview.enabled;
};

export const hasRichPreviewValidationCandidates = (
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

export const hasUrlScheme = (value: string): boolean => /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value);

export const toCanonicalHttpUrl = (value: string): string | null => {
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

export const resolveGeneratedMetadataByLink = (
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

export const resolveGeneratedReferralByLink = (
  payload: GeneratedRichMetadataPayload,
): Record<string, GeneratedLinkReferralConfig> => {
  if (!isRecord(payload) || !isRecord(payload.links)) {
    return {};
  }

  const byLink: Record<string, GeneratedLinkReferralConfig> = {};

  for (const [linkId, value] of Object.entries(payload.links)) {
    if (!isRecord(value) || !isRecord(value.referral)) {
      continue;
    }

    byLink[linkId] = value.referral as GeneratedLinkReferralConfig;
  }

  return byLink;
};

export const resolveGeneratedContentImagesBySlot = (
  payload: GeneratedContentImagesPayload,
): Record<string, { resolvedPath?: string }> => {
  if (!isRecord(payload) || !isRecord(payload.bySlot)) {
    return {};
  }

  const bySlot: Record<string, { resolvedPath?: string }> = {};

  for (const [slotId, value] of Object.entries(payload.bySlot)) {
    if (isRecord(value)) {
      bySlot[slotId] = {
        resolvedPath: typeof value.resolvedPath === "string" ? value.resolvedPath : undefined,
      };
    }
  }

  return bySlot;
};

export interface PublicCacheStablePayload {
  entries?: Record<string, unknown>;
}

export const hasRequiredRichPreviewFields = (
  metadata: Record<string, unknown> | undefined,
): boolean =>
  !!(
    metadata &&
    toStringOrUndefined(metadata.title) &&
    toStringOrUndefined(metadata.description) &&
    toStringOrUndefined(metadata.image)
  );

export const publicAugmentedStableCacheCoverageIssues = (input: {
  linksSource: string;
  linksData: Record<string, unknown>;
  siteData: Record<string, unknown>;
  generatedMetadataByLink: Record<string, Record<string, unknown>>;
  publicCachePath?: string;
}): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const links = Array.isArray(input.linksData.links) ? input.linksData.links : [];
  const publicCachePath = input.publicCachePath ?? resolvePublicCachePath(input.siteData);
  const publicCacheRead = tryReadJsonFile<PublicCacheStablePayload>(publicCachePath);

  if (!publicCacheRead.value) {
    issues.push({
      level: "error",
      source: publicCachePath,
      path: "$",
      message:
        "Committed stable public-cache metadata is required to validate cold-run deploy fallback coverage, but it could not be loaded.",
      remediation: `Restore or regenerate ${publicCachePath}. ${`Then rerun npm run validate:data. ${publicCacheRead.errorMessage ?? ""}`.trim()}`,
    });
    return issues;
  }

  const stableEntries = isRecord(publicCacheRead.value.entries)
    ? publicCacheRead.value.entries
    : {};

  for (const [index, rawLink] of links.entries()) {
    if (!isRecord(rawLink) || rawLink.enabled === false) {
      continue;
    }

    const linkId = toStringOrUndefined(rawLink.id);
    const url = toStringOrUndefined(rawLink.url);
    if (!linkId || !url || rawLink.type !== "rich") {
      continue;
    }

    const strategy = resolvePublicEnrichmentStrategy({
      url,
      icon: toStringOrUndefined(rawLink.icon),
      metadataHandle: isRecord(rawLink.metadata) ? rawLink.metadata.handle : undefined,
    });
    const stableEntry = isRecord(stableEntries[linkId]) ? stableEntries[linkId] : undefined;
    if (
      stableEntry &&
      (toStringOrUndefined(stableEntry.linkId) !== linkId ||
        toStringOrUndefined(stableEntry.sourceUrl) !== strategy.source.sourceUrl)
    ) {
      issues.push({
        level: "error",
        source: publicCachePath,
        path: `$.entries.${linkId}`,
        message: `Public-cache identity for active link '${linkId}' does not match its resolved source URL. Cached metadata from another handle or source must not be reused.`,
        remediation: `For a verified same-account rename, run \`bun run social:profile:rename -- --link-id ${linkId} --new-url ${url}\`, then refresh with \`bun run enrich:rich:strict:write-cache\`. For a replacement account, create a new link ID.`,
      });
      continue;
    }

    if (strategy.branch !== "public_augmented") {
      continue;
    }

    const generatedMetadata = input.generatedMetadataByLink[linkId];
    if (!hasRequiredRichPreviewFields(generatedMetadata)) {
      continue;
    }

    if (stableEntry) {
      continue;
    }

    issues.push({
      level: "error",
      source: publicCachePath,
      path: `$.entries.${linkId}`,
      message: `Rich link '${linkId}' uses public augmentation and has generated metadata, but no committed stable public-cache entry. Cold-run deploys can fail if the next remote fetch is blocked or transiently unavailable.`,
      remediation: `Run \`npm run enrich:rich:strict:write-cache\` to persist the public cache for '${linkId}', commit ${publicCachePath}, then rerun validation/build.`,
    });
  }

  return issues;
};

type RequireRemoteCoverage = (
  pipeline: Parameters<typeof resolveRemoteCachePolicyRule>[0]["pipeline"],
  url: string | undefined,
  source: string,
  fieldPath: string,
) => void;

const createRemoteCoverageCollector = (
  registry: ReturnType<typeof loadRemoteCachePolicyRegistry>,
  issues: ValidationIssue[],
): RequireRemoteCoverage => {
  const seenCoverageKeys = new Set<string>();
  return (pipeline, url, source, fieldPath) => {
    const canonicalUrl = url ? toCanonicalHttpUrl(url) : undefined;
    if (!canonicalUrl) return;

    const coverageKey = `${pipeline}:${canonicalUrl}`;
    if (seenCoverageKeys.has(coverageKey)) return;
    seenCoverageKeys.add(coverageKey);
    if (resolveRemoteCachePolicyRule({ registry, pipeline, url: canonicalUrl })) return;

    issues.push({
      level: "error",
      source,
      path: fieldPath,
      message: `Remote cache policy coverage is missing for pipeline '${pipeline}' and URL '${canonicalUrl}'.`,
      remediation: `Add a matching shared rule to ${DEFAULT_REMOTE_CACHE_POLICY_PATH}, or a fork-only rule to ${DEFAULT_REMOTE_CACHE_POLICY_LOCAL_PATH}, for host '${new URL(canonicalUrl).hostname}', then rerun validation/build.`,
    });
  };
};

const collectRichLinkRemoteCoverage = (
  input: RemoteCachePolicyCoverageInput,
  requireCoverage: RequireRemoteCoverage,
): void => {
  const enabledByDefault = resolveEnabledByDefault(input.siteData);
  const links = Array.isArray(input.linksData.links) ? input.linksData.links : [];
  links.forEach((rawLink, index) => {
    if (!isRecord(rawLink) || rawLink.type !== "rich") return;
    const url = toStringOrUndefined(rawLink.url);
    if (!url) return;
    const enrichment = isRecord(rawLink.enrichment) ? rawLink.enrichment : undefined;
    const enabled =
      typeof enrichment?.enabled === "boolean" ? enrichment.enabled : enabledByDefault;
    if (!enabled) return;
    const icon = toStringOrUndefined(rawLink.icon);
    const metadataHandle = toStringOrUndefined(
      isRecord(rawLink.metadata) ? rawLink.metadata.handle : undefined,
    );
    const supportedProfile = resolveSupportedSocialProfile({
      url,
      icon,
      metadataHandle,
      profileSemantics: enrichment?.profileSemantics,
    });
    if (toStringOrUndefined(enrichment?.authenticatedExtractor)) {
      if (supportedProfile?.platform === "linkedin") {
        requireCoverage("public_rich_metadata", url, input.linksSource, `$.links[${index}].url`);
      }
      return;
    }
    const publicStrategy = resolvePublicEnrichmentStrategy({ url, icon, metadataHandle });
    requireCoverage(
      "public_rich_metadata",
      publicStrategy.source.sourceUrl,
      input.linksSource,
      `$.links[${index}].url`,
    );
  });
};

const collectAuthenticatedAssetRemoteCoverage = (
  siteData: Record<string, unknown>,
  requireCoverage: RequireRemoteCoverage,
  issues: ValidationIssue[],
): void => {
  const { cachePath } = resolveAuthenticatedCacheConfig(siteData);
  try {
    const cacheRegistry = loadAuthenticatedCacheRegistry({ cachePath });
    for (const [cacheKey, entry] of Object.entries(cacheRegistry.entries)) {
      for (const [assetKey, asset] of Object.entries(entry.assets)) {
        if (!asset) continue;
        requireCoverage(
          "authenticated_asset_images",
          asset.sourceUrl,
          cachePath,
          `$.entries.${cacheKey}.assets.${assetKey}.sourceUrl`,
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
};

interface RemoteCachePolicyCoverageInput {
  profileSource: string;
  profileData: Record<string, unknown>;
  linksSource: string;
  linksData: Record<string, unknown>;
  siteData: Record<string, unknown>;
  generatedMetadataByLink: Record<string, Record<string, unknown>>;
}

export const remoteCachePolicyCoverageIssues = (
  input: RemoteCachePolicyCoverageInput,
): ValidationIssue[] => {
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
        remediation: `Restore ${DEFAULT_REMOTE_CACHE_POLICY_PATH}, ensure any optional ${DEFAULT_REMOTE_CACHE_POLICY_LOCAL_PATH} overlay validates against schema/remote-cache-policy.schema.json, then rerun validation.`,
      },
    ];
  }

  const requireCoverage = createRemoteCoverageCollector(registry, issues);

  const avatarUrl = toStringOrUndefined(input.profileData.avatar);
  requireCoverage("profile_avatar", avatarUrl, input.profileSource, "$.avatar");

  const contentImageSlots = collectContentImageSlots({
    linksPayload: input.linksData as { links?: unknown[] },
    generatedRichMetadata: {
      links: Object.fromEntries(
        Object.entries(input.generatedMetadataByLink).map(([linkId, metadata]) => [
          linkId,
          { metadata },
        ]),
      ),
    },
    sitePayload: input.siteData as SiteData,
  });
  for (const slot of contentImageSlots) {
    requireCoverage("content_images", slot.sourceUrl, input.linksSource, "$.links");
  }

  collectRichLinkRemoteCoverage(input, requireCoverage);
  collectAuthenticatedAssetRemoteCoverage(input.siteData, requireCoverage, issues);

  return issues;
};
