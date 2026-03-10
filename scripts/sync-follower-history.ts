import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  type FollowerHistoryIndexEntry,
  type FollowerHistoryRow,
  type FollowerHistorySource,
  buildFollowerHistoryCsvPublicPath,
  normalizeFollowerHistoryRows,
  resolveFollowerHistoryPrimaryAudience,
} from "../src/lib/analytics/follower-history";
import type { OpenLink } from "../src/lib/content/load-content";
import { mergeMetadataWithManualSocialProfileOverrides } from "../src/lib/content/social-profile-fields";
import { resolveLinkHandle } from "../src/lib/identity/handle-resolver";
import {
  DEFAULT_AUTH_CACHE_PATH,
  loadAuthenticatedCacheRegistry,
  resolveAuthenticatedCacheKey,
} from "./authenticated-extractors/cache";
import { DEFAULT_PUBLIC_CACHE_PATH, loadPublicCacheRegistry } from "./enrichment/public-cache";
import {
  appendFollowerHistoryRows,
  buildFollowerHistoryCsvRepoPath,
  readFollowerHistoryCsvFile,
  writeFollowerHistoryIndex,
} from "./follower-history/append-history";

interface CliArgs {
  authCachePath: string;
  dryRun: boolean;
  linksPath: string;
  observedAt?: string;
  publicCachePath: string;
}

interface LinksPayload {
  links: OpenLink[];
}

interface HistorySnapshot {
  label: string;
  platform: string;
  row: FollowerHistoryRow;
}

const ROOT = process.cwd();

const absolutePath = (value: string): string =>
  path.isAbsolute(value) ? value : path.join(ROOT, value);

const readJson = <T>(relativePath: string): T =>
  JSON.parse(fs.readFileSync(absolutePath(relativePath), "utf8")) as T;

const trimToUndefined = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const readOptionalAuthenticatedCache = (cachePath: string) => {
  try {
    return loadAuthenticatedCacheRegistry({ cachePath });
  } catch {
    return null;
  }
};

const resolveArgs = (argv = process.argv.slice(2)): CliArgs => {
  const getFlagValue = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    if (index < 0) {
      return undefined;
    }

    const value = argv[index + 1];
    if (typeof value !== "string" || value.startsWith("--")) {
      return undefined;
    }

    return value;
  };

  return {
    authCachePath: getFlagValue("--auth-cache") ?? DEFAULT_AUTH_CACHE_PATH,
    dryRun: argv.includes("--dry-run"),
    linksPath: getFlagValue("--links") ?? "data/links.json",
    observedAt: getFlagValue("--observed-at"),
    publicCachePath: getFlagValue("--public-cache") ?? DEFAULT_PUBLIC_CACHE_PATH,
  };
};

const resolveSourceAndMetadata = (
  link: OpenLink,
  publicRegistry: ReturnType<typeof loadPublicCacheRegistry>,
  authenticatedRegistry: ReturnType<typeof readOptionalAuthenticatedCache>,
): { metadata: Record<string, unknown>; source: FollowerHistorySource } => {
  const publicMetadata = publicRegistry.entries[link.id]?.metadata;
  const maybeAuthCacheKey = link.enrichment?.authenticatedExtractor
    ? resolveAuthenticatedCacheKey(link.enrichment.authenticatedCacheKey, link.id)
    : undefined;
  const authenticatedMetadata = maybeAuthCacheKey
    ? authenticatedRegistry?.entries[maybeAuthCacheKey]?.metadata
    : undefined;
  const manualMetadata = (link.metadata ?? {}) as Record<string, unknown>;
  const authenticatedMetadataRecord = authenticatedMetadata as Record<string, unknown> | undefined;
  const publicMetadataRecord = publicMetadata as Record<string, unknown> | undefined;

  const manualAudience = resolveFollowerHistoryPrimaryAudience(manualMetadata);
  if (manualAudience) {
    return {
      metadata:
        mergeMetadataWithManualSocialProfileOverrides(
          manualMetadata,
          authenticatedMetadataRecord,
        ) ??
        mergeMetadataWithManualSocialProfileOverrides(manualMetadata, publicMetadataRecord) ??
        manualMetadata,
      source: "manual",
    };
  }

  if (authenticatedMetadata) {
    return {
      metadata:
        mergeMetadataWithManualSocialProfileOverrides(
          manualMetadata,
          authenticatedMetadataRecord,
        ) ?? manualMetadata,
      source: "authenticated-cache",
    };
  }

  return {
    metadata:
      mergeMetadataWithManualSocialProfileOverrides(manualMetadata, publicMetadataRecord) ??
      manualMetadata,
    source: "public-cache",
  };
};

const resolveSnapshots = (
  links: readonly OpenLink[],
  publicRegistry: ReturnType<typeof loadPublicCacheRegistry>,
  authenticatedRegistry: ReturnType<typeof readOptionalAuthenticatedCache>,
  observedAt: string,
): HistorySnapshot[] =>
  links.flatMap((link) => {
    if (link.enabled === false || link.type === "payment") {
      return [];
    }

    const handle = resolveLinkHandle({
      icon: link.icon,
      metadataHandle: link.metadata?.handle,
      url: link.url,
    }).handle;
    const platform = trimToUndefined(link.icon) ?? trimToUndefined(link.id);
    const canonicalUrl = trimToUndefined(link.url);
    if (!platform || !canonicalUrl) {
      return [];
    }

    const { metadata, source } = resolveSourceAndMetadata(
      link,
      publicRegistry,
      authenticatedRegistry,
    );
    const primaryAudience = resolveFollowerHistoryPrimaryAudience(
      metadata as Parameters<typeof resolveFollowerHistoryPrimaryAudience>[0],
    );

    if (!primaryAudience) {
      return [];
    }

    return [
      {
        label: link.label,
        platform,
        row: {
          observedAt,
          linkId: link.id,
          platform,
          handle: handle ?? "",
          canonicalUrl,
          audienceKind: primaryAudience.audienceKind,
          audienceCount: primaryAudience.audienceCount,
          audienceCountRaw: primaryAudience.audienceCountRaw,
          source,
        },
      },
    ];
  });

const buildIndexEntries = (snapshots: readonly HistorySnapshot[]): FollowerHistoryIndexEntry[] =>
  snapshots
    .map((snapshot) => {
      const rows = normalizeFollowerHistoryRows(
        readFollowerHistoryCsvFile(buildFollowerHistoryCsvRepoPath(snapshot.platform)),
      );
      const latest = rows[rows.length - 1];
      if (!latest) {
        return null;
      }

      return {
        linkId: latest.linkId,
        label: snapshot.label,
        platform: latest.platform,
        handle: latest.handle,
        canonicalUrl: latest.canonicalUrl,
        audienceKind: latest.audienceKind,
        csvPath: buildFollowerHistoryCsvPublicPath(latest.platform),
        latestAudienceCount: latest.audienceCount,
        latestAudienceCountRaw: latest.audienceCountRaw,
        latestObservedAt: latest.observedAt,
      } satisfies FollowerHistoryIndexEntry;
    })
    .filter((entry): entry is FollowerHistoryIndexEntry => entry !== null)
    .sort((left, right) => left.platform.localeCompare(right.platform));

export const run = (args = resolveArgs()) => {
  const observedAt = args.observedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(observedAt))) {
    throw new Error(`Invalid observedAt timestamp '${observedAt}'.`);
  }

  const linksPayload = readJson<LinksPayload>(args.linksPath);
  const publicRegistry = loadPublicCacheRegistry({ cachePath: args.publicCachePath });
  const authenticatedRegistry = readOptionalAuthenticatedCache(args.authCachePath);
  const snapshots = resolveSnapshots(
    linksPayload.links,
    publicRegistry,
    authenticatedRegistry,
    observedAt,
  );

  if (snapshots.length === 0) {
    console.log("No follower-history snapshots were eligible for capture.");
    return;
  }

  if (args.dryRun) {
    console.log(`Dry run: ${snapshots.length} follower-history snapshot(s) ready.`);
    for (const snapshot of snapshots) {
      console.log(
        [
          snapshot.platform,
          snapshot.row.linkId,
          snapshot.row.audienceKind,
          snapshot.row.audienceCountRaw,
          snapshot.row.source,
        ].join(" | "),
      );
    }
    return;
  }

  for (const snapshot of snapshots) {
    appendFollowerHistoryRows({
      platform: snapshot.platform,
      rows: [snapshot.row],
    });
  }

  const indexEntries = buildIndexEntries(snapshots);
  writeFollowerHistoryIndex(indexEntries, observedAt);

  console.log(`Wrote ${snapshots.length} follower-history snapshot(s) at ${observedAt}.`);
  for (const entry of indexEntries) {
    console.log(
      `${entry.platform}: ${entry.latestAudienceCountRaw} -> ${entry.csvPath} (${entry.linkId})`,
    );
  }
};

run();
