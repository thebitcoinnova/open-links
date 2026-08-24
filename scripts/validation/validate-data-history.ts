import fs from "node:fs";
import path from "node:path";
import {
  FOLLOWER_HISTORY_PUBLIC_ROOT,
  normalizeFollowerHistoryRows,
  parseFollowerHistoryCsv,
  parseFollowerHistoryIndex,
} from "../../src/lib/analytics/follower-history";
import type { SiteData } from "../../src/lib/content/load-content";
import { resolveAnalyticsPageEnabled } from "../../src/lib/ui/analytics-page-preferences";
import { resolvePublicEnrichmentStrategy } from "../enrichment/strategy-registry";
import type { ValidationIssue } from "./rules-contracts";
import {
  DEFAULT_FOLLOWER_HISTORY_INDEX_PATH,
  DEFAULT_FOLLOWER_HISTORY_REPO_ROOT,
  type FollowerHistoryIndexSummaryPayload,
} from "./validate-data-contracts";
import {
  absolutePath,
  isRecord,
  normalizeRepoPath,
  readTextFile,
  toStringOrUndefined,
  tryReadJsonFile,
} from "./validate-data-runtime";

export const resolveHistoryRepoPath = (
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

type FollowerHistoryIndexEntry = ReturnType<typeof parseFollowerHistoryIndex>["entries"][number];

const followerHistoryEntryIssues = (input: {
  entry: FollowerHistoryIndexEntry;
  historyRepoRoot: string;
  indexPath: string;
  publicRoot: string;
  referencedCsvRepoPaths: Set<string>;
  seenLinkIds: Set<string>;
}): ValidationIssue[] => {
  const { entry, historyRepoRoot, indexPath, publicRoot, referencedCsvRepoPaths, seenLinkIds } =
    input;
  const issues: ValidationIssue[] = [];
  if (seenLinkIds.has(entry.linkId)) {
    issues.push({
      level: "error",
      source: indexPath,
      path: "$.entries",
      message: `Follower-history index contains duplicate linkId '${entry.linkId}'.`,
      remediation:
        "Keep one index entry per link id and regenerate the index from the sync command.",
    });
    return issues;
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
    return issues;
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
    return issues;
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
    return issues;
  }

  if (rows.length === 0) {
    issues.push({
      level: "error",
      source: repoCsvPath,
      path: "$",
      message: `Follower-history CSV for '${entry.linkId}' has no rows.`,
      remediation: "Append at least one history row before committing the CSV artifact.",
    });
    return issues;
  }

  if (rows.some((row) => row.platform !== entry.platform)) {
    issues.push({
      level: "error",
      source: repoCsvPath,
      path: "$.platform",
      message: `Follower-history CSV '${repoCsvPath}' mixes rows from outside the '${entry.platform}' platform.`,
      remediation: "Keep one CSV per link id and move mismatched rows into the correct file.",
    });
  }

  if (rows.some((row) => row.linkId !== entry.linkId)) {
    issues.push({
      level: "error",
      source: repoCsvPath,
      path: "$.linkId",
      message: `Follower-history CSV '${repoCsvPath}' mixes rows from outside the indexed link '${entry.linkId}'.`,
      remediation:
        "Keep one CSV per link id and regenerate follower-history artifacts so each file contains only its own series.",
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
    return issues;
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
  return issues;
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
    issues.push(
      ...followerHistoryEntryIssues({
        entry,
        historyRepoRoot,
        indexPath,
        publicRoot,
        referencedCsvRepoPaths,
        seenLinkIds,
      }),
    );
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

export const ANALYTICS_HISTORY_PUBLIC_TARGET_IDS = new Set([
  "medium-public-feed",
  "primal-public-profile",
  "x-public-community",
  "x-public-oembed",
]);

export const analyticsHistorySetupIssues = (input: {
  linksSource: string;
  linksData: Record<string, unknown>;
  siteData: SiteData;
  indexPath?: string;
}): ValidationIssue[] => {
  if (!resolveAnalyticsPageEnabled(input.siteData)) {
    return [];
  }

  const links = Array.isArray(input.linksData.links) ? input.linksData.links : [];
  const analyticsCapableTargets: Array<{ linkId: string; platform: string }> = [];

  for (const rawLink of links) {
    if (!isRecord(rawLink) || rawLink.enabled === false || rawLink.type !== "rich") {
      continue;
    }

    const linkId = toStringOrUndefined(rawLink.id);
    const url = toStringOrUndefined(rawLink.url);
    const platform = toStringOrUndefined(rawLink.icon) ?? linkId;
    if (!linkId || !url || !platform) {
      continue;
    }

    const metadataHandle =
      isRecord(rawLink.metadata) && typeof rawLink.metadata.handle === "string"
        ? rawLink.metadata.handle
        : undefined;
    const strategy = resolvePublicEnrichmentStrategy({
      url,
      icon: toStringOrUndefined(rawLink.icon),
      metadataHandle,
    });
    if (!ANALYTICS_HISTORY_PUBLIC_TARGET_IDS.has(strategy.id)) {
      continue;
    }

    analyticsCapableTargets.push({ linkId, platform });
  }

  if (analyticsCapableTargets.length === 0) {
    return [];
  }

  const indexPath = input.indexPath ?? DEFAULT_FOLLOWER_HISTORY_INDEX_PATH;
  const indexRead = tryReadJsonFile<FollowerHistoryIndexSummaryPayload>(indexPath);
  if (!indexRead.value) {
    return [];
  }

  let index: ReturnType<typeof parseFollowerHistoryIndex>;
  try {
    index = parseFollowerHistoryIndex(indexRead.value);
  } catch {
    return [];
  }

  const indexedLinkIds = new Set(index.entries.map((entry) => entry.linkId));
  const missingTargets = analyticsCapableTargets.filter(
    (target) => !indexedLinkIds.has(target.linkId),
  );
  if (missingTargets.length === 0) {
    return [];
  }

  const missingLinkIds = [...new Set(missingTargets.map((target) => target.linkId))];
  const syncCommands = missingLinkIds
    .map((linkId) => `bun run public:rich:sync -- --only-link ${linkId}`)
    .join("` then `");

  return [
    {
      level: "warning",
      source: indexPath,
      path: "$.entries",
      message: `Built-in analytics is enabled by default, but analytics-capable links are missing follower-history entries: ${missingLinkIds.join(", ")}.`,
      remediation: `Run \`${syncCommands}\`, then run \`bun run followers:history:sync\` and commit the updated files under public/history/followers/.`,
    },
  ];
};
