import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  type ContentImageSiteInput,
  type GeneratedRichMetadataInput,
  collectContentImageSlots,
} from "../src/lib/content/content-image-slots";
import type { ContentImageCliArgs, LinksPayload } from "./content-images/cli-contracts";
import {
  type ContentImageSyncStatus,
  type GeneratedContentImagesManifest,
  type RuntimeGeneratedContentImageEntry,
  type StableGeneratedContentImageEntry,
  areEntryMapsEqual,
  buildStableContentImagesManifest,
  normalizeRuntimeEntry,
  normalizeStableEntry,
  stabilizeContentImageEntry,
} from "./content-images/manifest";
import {
  type ContentImageRunState,
  createContentImageRunSummary,
  processContentImageSlot,
} from "./content-images/sync-pipeline";
import {
  RemoteCacheStatsCollector,
  createRemoteCacheStatsOutputPath,
  writeRemoteCacheRunSummary,
} from "./shared/remote-cache-fetch";
import { loadRemoteCachePolicyRegistry } from "./shared/remote-cache-policy";
export type {
  ContentImageSyncStatus,
  GeneratedContentImagesManifest,
  RuntimeGeneratedContentImageEntry,
  StableGeneratedContentImageEntry,
} from "./content-images/manifest";
export {
  buildStableContentImagesManifest,
  createContentImagePreviousState,
  createContentImagePreviousState as createPreviousState,
  stabilizeContentImageEntry,
} from "./content-images/manifest";

const ROOT = process.cwd();

const DEFAULT_LINKS_PATH = "data/links.json";
const DEFAULT_SITE_PATH = "data/site.json";
const DEFAULT_RICH_METADATA_PATH = "data/generated/rich-metadata.json";
const DEFAULT_MANIFEST_PATH = "data/cache/content-images.json";
const DEFAULT_RUNTIME_MANIFEST_PATH = "data/cache/content-images.runtime.json";
const DEFAULT_OUTPUT_DIR = "public/cache/content-images";
const MAX_IMAGE_BYTES_WARN = 5_000_000;
const FORCE_ENV = "OPENLINKS_IMAGES_FORCE";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isTruthy = (value: string | undefined): boolean => {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
};

const normalizeRelativePath = (input: string): string =>
  input
    .replaceAll("\\", "/")
    .replace(/^\.?\//, "")
    .replace(/^\/+/, "")
    .trim();

const absolutePath = (relativePath: string): string =>
  path.isAbsolute(relativePath) ? relativePath : path.join(ROOT, relativePath);

const ensureDirectoryForFile = (filePath: string) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

const readJson = <T>(relativePath: string): T => {
  const absolute = absolutePath(relativePath);
  return JSON.parse(fs.readFileSync(absolute, "utf8")) as T;
};

const maybeReadJson = <T>(relativePath: string): T | null => {
  const absolute = absolutePath(relativePath);
  if (!fs.existsSync(absolute)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(absolute, "utf8")) as T;
  } catch {
    return null;
  }
};

const trimToUndefined = (value: string | undefined): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseNumber = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseArgs = (): ContentImageCliArgs => {
  const args = process.argv.slice(2);

  const getFlagValue = (name: string, fallback: string): string => {
    const index = args.indexOf(name);
    if (index < 0) {
      return fallback;
    }

    const value = args[index + 1];
    if (typeof value !== "string" || value.startsWith("--")) {
      return fallback;
    }

    return value.trim() || fallback;
  };

  return {
    force: args.includes("--force") || isTruthy(process.env[FORCE_ENV]),
    linksPath: getFlagValue("--links", DEFAULT_LINKS_PATH),
    sitePath: getFlagValue("--site", DEFAULT_SITE_PATH),
    richMetadataPath: getFlagValue("--rich-metadata", DEFAULT_RICH_METADATA_PATH),
    manifestPath: getFlagValue("--manifest", DEFAULT_MANIFEST_PATH),
    runtimeManifestPath: getFlagValue("--runtime-manifest", DEFAULT_RUNTIME_MANIFEST_PATH),
    outputDir: getFlagValue("--output-dir", DEFAULT_OUTPUT_DIR),
    maxBytesWarn: Math.max(
      1024,
      parseNumber(getFlagValue("--max-bytes-warn", String(MAX_IMAGE_BYTES_WARN))) ??
        MAX_IMAGE_BYTES_WARN,
    ),
  };
};

const normalizePublicPath = (relativePath: string): string => {
  const normalized = normalizeRelativePath(relativePath);
  return normalized.startsWith("public/") ? normalized.slice("public/".length) : normalized;
};

const resolvedPathFromOutputDir = (outputDir: string, fileName: string): string => {
  const normalized = normalizeRelativePath(outputDir).replace(/\/+$/, "");
  const relativeToPublic = normalized.startsWith("public/")
    ? normalized.slice("public/".length)
    : normalized;
  return [relativeToPublic, fileName].filter(Boolean).join("/");
};

const readPreviousStableManifest = (
  manifestPath: string,
): GeneratedContentImagesManifest<StableGeneratedContentImageEntry> | null => {
  const parsed = maybeReadJson<unknown>(manifestPath);
  if (!parsed || !isRecord(parsed) || !isRecord(parsed.bySlot)) {
    return null;
  }

  const bySlot: Record<string, StableGeneratedContentImageEntry> = {};

  for (const [slotId, rawEntry] of Object.entries(parsed.bySlot)) {
    if (!isRecord(rawEntry)) {
      continue;
    }

    bySlot[slotId] = normalizeStableEntry({
      resolvedPath: typeof rawEntry.resolvedPath === "string" ? rawEntry.resolvedPath : undefined,
      updatedAt: typeof rawEntry.updatedAt === "string" ? rawEntry.updatedAt : undefined,
      contentType: typeof rawEntry.contentType === "string" ? rawEntry.contentType : undefined,
      bytes:
        typeof rawEntry.bytes === "number" && Number.isFinite(rawEntry.bytes)
          ? rawEntry.bytes
          : undefined,
    });
  }

  return {
    generatedAt:
      typeof parsed.generatedAt === "string" && parsed.generatedAt.trim().length > 0
        ? parsed.generatedAt
        : new Date(0).toISOString(),
    bySlot,
  };
};

const readPreviousRuntimeManifest = (
  manifestPath: string,
): GeneratedContentImagesManifest<RuntimeGeneratedContentImageEntry> | null => {
  const parsed = maybeReadJson<unknown>(manifestPath);
  if (!parsed || !isRecord(parsed) || !isRecord(parsed.bySlot)) {
    return null;
  }

  const bySlot: Record<string, RuntimeGeneratedContentImageEntry> = {};

  for (const [slotId, rawEntry] of Object.entries(parsed.bySlot)) {
    if (!isRecord(rawEntry) || typeof rawEntry.sourceUrl !== "string") {
      continue;
    }

    bySlot[slotId] = normalizeRuntimeEntry({
      sourceUrl: rawEntry.sourceUrl,
      etag: typeof rawEntry.etag === "string" ? rawEntry.etag : undefined,
      lastModified: typeof rawEntry.lastModified === "string" ? rawEntry.lastModified : undefined,
      checkStatus:
        typeof rawEntry.checkStatus === "string"
          ? (rawEntry.checkStatus as ContentImageSyncStatus)
          : undefined,
      cacheControl: typeof rawEntry.cacheControl === "string" ? rawEntry.cacheControl : undefined,
      expiresAt: typeof rawEntry.expiresAt === "string" ? rawEntry.expiresAt : undefined,
      checkedAt: typeof rawEntry.checkedAt === "string" ? rawEntry.checkedAt : undefined,
      warning: typeof rawEntry.warning === "string" ? rawEntry.warning : undefined,
    });
  }

  return {
    generatedAt:
      typeof parsed.generatedAt === "string" && parsed.generatedAt.trim().length > 0
        ? parsed.generatedAt
        : new Date(0).toISOString(),
    bySlot,
  };
};

const writeManifest = <TEntry>(
  manifestPath: string,
  manifest: GeneratedContentImagesManifest<TEntry>,
) => {
  const absolute = absolutePath(manifestPath);
  ensureDirectoryForFile(absolute);
  fs.writeFileSync(absolute, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
};

const listReferencedResolvedPaths = (
  manifest: GeneratedContentImagesManifest<StableGeneratedContentImageEntry>,
): Set<string> => {
  const paths = new Set<string>();

  for (const entry of Object.values(manifest.bySlot)) {
    if (typeof entry.resolvedPath === "string" && entry.resolvedPath.trim().length > 0) {
      paths.add(normalizePublicPath(entry.resolvedPath));
    }
  }

  return paths;
};

const garbageCollectOutput = (outputDir: string, keepPaths: Set<string>) => {
  const absoluteOutputDir = absolutePath(outputDir);
  if (!fs.existsSync(absoluteOutputDir)) {
    return;
  }

  for (const fileName of fs.readdirSync(absoluteOutputDir)) {
    const absoluteFilePath = path.join(absoluteOutputDir, fileName);
    const relativeResolvedPath = normalizePublicPath(
      resolvedPathFromOutputDir(outputDir, fileName),
    );
    if (keepPaths.has(relativeResolvedPath)) {
      continue;
    }

    if (fs.statSync(absoluteFilePath).isFile()) {
      fs.rmSync(absoluteFilePath, { force: true });
    }
  }
};

const run = async () => {
  const args = parseArgs();
  const linksPayload = readJson<LinksPayload>(args.linksPath);
  const sitePayload = readJson<ContentImageSiteInput>(args.sitePath);
  const generatedRichMetadata = maybeReadJson<GeneratedRichMetadataInput>(args.richMetadataPath);
  const previousManifest = readPreviousStableManifest(args.manifestPath);
  const previousRuntimeManifest = readPreviousRuntimeManifest(args.runtimeManifestPath);
  const remoteCachePolicyRegistry = loadRemoteCachePolicyRegistry();
  const remoteCacheStats = new RemoteCacheStatsCollector("sync-content-images");

  const slots = collectContentImageSlots({
    linksPayload,
    generatedRichMetadata,
    sitePayload,
  });
  const nextBySlot: Record<string, StableGeneratedContentImageEntry> = {};
  const nextRuntimeBySlot: Record<string, RuntimeGeneratedContentImageEntry> = {};
  const summary = createContentImageRunSummary();
  const state: ContentImageRunState = {
    args,
    previousManifest,
    previousRuntimeManifest,
    remoteCachePolicyRegistry,
    remoteCacheStats,
    nextBySlot,
    nextRuntimeBySlot,
    summary,
  };

  fs.mkdirSync(absolutePath(args.outputDir), { recursive: true });

  for (const slot of slots) await processContentImageSlot(slot, state);

  const manifest = buildStableContentImagesManifest({
    previousManifest,
    bySlot: nextBySlot,
    generatedAt: new Date().toISOString(),
  });
  const runtimeManifest: GeneratedContentImagesManifest<RuntimeGeneratedContentImageEntry> = {
    generatedAt: new Date().toISOString(),
    bySlot: nextRuntimeBySlot,
  };

  const keepPaths = listReferencedResolvedPaths(manifest);
  garbageCollectOutput(args.outputDir, keepPaths);

  if (
    !previousManifest ||
    !areEntryMapsEqual(previousManifest.bySlot, manifest.bySlot, normalizeStableEntry)
  ) {
    writeManifest(args.manifestPath, manifest);
  }

  if (
    !previousRuntimeManifest ||
    previousRuntimeManifest.generatedAt !== runtimeManifest.generatedAt ||
    !areEntryMapsEqual(
      previousRuntimeManifest.bySlot,
      runtimeManifest.bySlot,
      normalizeRuntimeEntry,
    )
  ) {
    writeManifest(args.runtimeManifestPath, runtimeManifest);
  }

  const remoteCacheStatsPath = createRemoteCacheStatsOutputPath("sync-content-images");
  writeRemoteCacheRunSummary(remoteCacheStatsPath, remoteCacheStats);

  console.log("OpenLinks content image sync summary");
  console.log(`Candidates: ${slots.length}`);
  console.log(`Tracked slot entries: ${Object.keys(manifest.bySlot).length}`);
  console.log(
    `Statuses: fetched=${summary.fetched}, not_modified=${summary.notModified}, cache_fresh=${summary.cacheFresh}, cache_on_error=${summary.cacheOnError}, fallback_on_error=${summary.fallbackOnError}`,
  );
  console.log(`Manifest: ${args.manifestPath}`);
  console.log(`Runtime manifest: ${args.runtimeManifestPath}`);
  console.log(`Output dir: ${args.outputDir}`);
  console.log(`Remote cache stats: ${remoteCacheStatsPath}`);
  if (args.force) {
    console.log("OpenLinks content image sync: force refresh was enabled.");
  }
};

if (import.meta.main) {
  run().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Content image sync failed unexpectedly: ${message}`);
    process.exit(1);
  });
}
