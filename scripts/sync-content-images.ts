import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  type ContentImageSiteInput,
  type GeneratedRichMetadataInput,
  collectContentImageSlots,
} from "../src/lib/content/content-image-slots";
import {
  type RemoteCacheCheckStatus,
  type RemoteCachePreviousState,
  RemoteCacheStatsCollector,
  computeRemoteCacheExpiresAt,
  createRemoteCacheStatsOutputPath,
  fetchWithRemoteCachePolicy,
  writeRemoteCacheRunSummary,
} from "./shared/remote-cache-fetch";
import { loadRemoteCachePolicyRegistry } from "./shared/remote-cache-policy";

export type ContentImageSyncStatus =
  | RemoteCacheCheckStatus
  | "cache_on_error"
  | "fallback_on_error";

export interface StableGeneratedContentImageEntry {
  resolvedPath?: string;
  updatedAt?: string;
  contentType?: string;
  bytes?: number;
}

export interface RuntimeGeneratedContentImageEntry {
  sourceUrl: string;
  etag?: string;
  lastModified?: string;
  checkStatus?: ContentImageSyncStatus;
  cacheControl?: string;
  expiresAt?: string;
  checkedAt?: string;
  warning?: string;
}

export interface GeneratedContentImagesManifest<TEntry> {
  generatedAt: string;
  bySlot: Record<string, TEntry>;
}

interface LinksPayload {
  links?: unknown[];
}

interface CliArgs {
  force: boolean;
  linksPath: string;
  sitePath: string;
  richMetadataPath: string;
  manifestPath: string;
  runtimeManifestPath: string;
  outputDir: string;
  maxBytesWarn: number;
}

const ROOT = process.cwd();

const DEFAULT_LINKS_PATH = "data/links.json";
const DEFAULT_SITE_PATH = "data/site.json";
const DEFAULT_RICH_METADATA_PATH = "data/generated/rich-metadata.json";
const DEFAULT_MANIFEST_PATH = "data/cache/content-images.json";
const DEFAULT_RUNTIME_MANIFEST_PATH = "data/cache/content-images.runtime.json";
const DEFAULT_OUTPUT_DIR = "public/cache/content-images";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_IMAGE_BYTES_WARN = 5_000_000;
const FORCE_ENV = "OPENLINKS_IMAGES_FORCE";

const CONTENT_TYPE_EXTENSION_MAP = new Map<string, string>([
  ["image/avif", "avif"],
  ["image/bmp", "bmp"],
  ["image/gif", "gif"],
  ["image/vnd.microsoft.icon", "ico"],
  ["image/x-icon", "ico"],
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/png", "png"],
  ["image/svg+xml", "svg"],
  ["image/tiff", "tiff"],
  ["image/webp", "webp"],
]);

const KNOWN_IMAGE_EXTENSIONS = new Set([
  "avif",
  "bmp",
  "gif",
  "ico",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "tif",
  "tiff",
  "webp",
]);

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

const parseArgs = (): CliArgs => {
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

const normalizePublicPath = (relativePath: string): string => {
  const normalized = normalizeRelativePath(relativePath);
  return normalized.startsWith("public/") ? normalized.slice("public/".length) : normalized;
};

const resolveManifestAssetAbsolutePath = (resolvedPath: string): string =>
  path.join(ROOT, "public", normalizePublicPath(resolvedPath));

const extensionFromContentType = (contentType: string | undefined): string | undefined => {
  if (!contentType) {
    return undefined;
  }

  return CONTENT_TYPE_EXTENSION_MAP.get(contentType.split(";")[0]?.trim().toLowerCase() ?? "");
};

const extensionFromUrl = (sourceUrl: string): string | undefined => {
  try {
    const parsed = new URL(sourceUrl);
    const raw = path.posix.extname(parsed.pathname).replace(".", "").toLowerCase();
    if (!raw) {
      return undefined;
    }

    const normalized = raw === "jpeg" ? "jpg" : raw;
    return KNOWN_IMAGE_EXTENSIONS.has(normalized) ? normalized : undefined;
  } catch {
    return undefined;
  }
};

const extensionFromResolvedPath = (resolvedPath: string | undefined): string | undefined => {
  if (!resolvedPath) {
    return undefined;
  }

  const raw = path.posix.extname(resolvedPath).replace(".", "").toLowerCase();
  if (!raw) {
    return undefined;
  }

  const normalized = raw === "jpeg" ? "jpg" : raw;
  return KNOWN_IMAGE_EXTENSIONS.has(normalized) ? normalized : undefined;
};

const resolveExtension = (
  contentType: string | undefined,
  sourceUrl: string,
  previousResolvedPath: string | undefined,
): string =>
  extensionFromContentType(contentType) ??
  extensionFromUrl(sourceUrl) ??
  extensionFromResolvedPath(previousResolvedPath) ??
  "jpg";

const toContentHash = (buffer: Buffer): string =>
  crypto.createHash("sha256").update(buffer).digest("hex");

const resolvedPathFromOutputDir = (outputDir: string, fileName: string): string => {
  const normalized = normalizeRelativePath(outputDir).replace(/\/+$/, "");
  const relativeToPublic = normalized.startsWith("public/")
    ? normalized.slice("public/".length)
    : normalized;
  return [relativeToPublic, fileName].filter(Boolean).join("/");
};

const normalizeStableEntry = (
  entry: StableGeneratedContentImageEntry,
): StableGeneratedContentImageEntry => {
  const normalized: StableGeneratedContentImageEntry = {};

  if (trimToUndefined(entry.resolvedPath)) {
    normalized.resolvedPath = trimToUndefined(entry.resolvedPath);
  }
  if (trimToUndefined(entry.updatedAt)) {
    normalized.updatedAt = trimToUndefined(entry.updatedAt);
  }
  if (trimToUndefined(entry.contentType)) {
    normalized.contentType = trimToUndefined(entry.contentType);
  }
  if (typeof entry.bytes === "number" && Number.isFinite(entry.bytes) && entry.bytes >= 0) {
    normalized.bytes = entry.bytes;
  }

  return normalized;
};

const normalizeRuntimeEntry = (
  entry: RuntimeGeneratedContentImageEntry,
): RuntimeGeneratedContentImageEntry => {
  const normalized: RuntimeGeneratedContentImageEntry = {
    sourceUrl: entry.sourceUrl,
  };

  if (trimToUndefined(entry.etag)) {
    normalized.etag = trimToUndefined(entry.etag);
  }
  if (trimToUndefined(entry.lastModified)) {
    normalized.lastModified = trimToUndefined(entry.lastModified);
  }
  if (trimToUndefined(entry.checkStatus)) {
    normalized.checkStatus = trimToUndefined(entry.checkStatus) as ContentImageSyncStatus;
  }
  if (trimToUndefined(entry.cacheControl)) {
    normalized.cacheControl = trimToUndefined(entry.cacheControl);
  }
  if (trimToUndefined(entry.expiresAt)) {
    normalized.expiresAt = trimToUndefined(entry.expiresAt);
  }
  if (trimToUndefined(entry.checkedAt)) {
    normalized.checkedAt = trimToUndefined(entry.checkedAt);
  }
  if (trimToUndefined(entry.warning)) {
    normalized.warning = trimToUndefined(entry.warning);
  }

  return normalized;
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

const hasSameStablePayload = (
  left: StableGeneratedContentImageEntry,
  right: StableGeneratedContentImageEntry,
): boolean =>
  left.resolvedPath === right.resolvedPath &&
  left.contentType === right.contentType &&
  left.bytes === right.bytes;

export const stabilizeContentImageEntry = (
  previousEntry: StableGeneratedContentImageEntry | undefined,
  nextEntry: StableGeneratedContentImageEntry,
): StableGeneratedContentImageEntry => {
  const normalizedNext = normalizeStableEntry(nextEntry);
  if (!previousEntry || !hasSameStablePayload(previousEntry, normalizedNext)) {
    return normalizedNext;
  }

  return normalizeStableEntry({
    ...normalizedNext,
    updatedAt: previousEntry.updatedAt,
  });
};

const areEntriesEqual = <TEntry>(
  left: TEntry | undefined,
  right: TEntry | undefined,
  normalize: (entry: TEntry) => TEntry,
): boolean => {
  if (!left || !right) {
    return left === right;
  }

  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
};

const areEntryMapsEqual = <TEntry>(
  left: Record<string, TEntry>,
  right: Record<string, TEntry>,
  normalize: (entry: TEntry) => TEntry,
): boolean => {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (JSON.stringify(leftKeys) !== JSON.stringify(rightKeys)) {
    return false;
  }

  return leftKeys.every((key) => areEntriesEqual(left[key], right[key], normalize));
};

export const buildStableContentImagesManifest = (input: {
  previousManifest: GeneratedContentImagesManifest<StableGeneratedContentImageEntry> | null;
  bySlot: Record<string, StableGeneratedContentImageEntry>;
  generatedAt: string;
}): GeneratedContentImagesManifest<StableGeneratedContentImageEntry> => ({
  generatedAt:
    input.previousManifest &&
    areEntryMapsEqual(input.previousManifest.bySlot, input.bySlot, normalizeStableEntry)
      ? input.previousManifest.generatedAt
      : input.generatedAt,
  bySlot: input.bySlot,
});

const normalizeSourceUrl = (value: string | undefined): string | undefined => {
  const trimmed = trimToUndefined(value);
  if (!trimmed) {
    return undefined;
  }

  return toCanonicalHttpUrl(trimmed) ?? trimmed;
};

export const createPreviousState = (
  currentSourceUrl: string,
  stableEntry: StableGeneratedContentImageEntry | undefined,
  runtimeEntry: RuntimeGeneratedContentImageEntry | undefined,
): RemoteCachePreviousState | undefined => {
  const normalizedCurrentSourceUrl = normalizeSourceUrl(currentSourceUrl);
  const normalizedPreviousSourceUrl = normalizeSourceUrl(runtimeEntry?.sourceUrl);
  const matchingRuntimeEntry =
    normalizedCurrentSourceUrl && normalizedPreviousSourceUrl === normalizedCurrentSourceUrl
      ? runtimeEntry
      : undefined;

  if (!stableEntry && !matchingRuntimeEntry) {
    return undefined;
  }

  return {
    etag: matchingRuntimeEntry?.etag,
    lastModified: matchingRuntimeEntry?.lastModified,
    cacheControl: matchingRuntimeEntry?.cacheControl,
    expiresAt: matchingRuntimeEntry?.expiresAt,
    bytes: stableEntry?.bytes,
  };
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

const logWarning = (message: string) => {
  console.warn(`WARNING [images:sync] ${message}`);
};

const createRunSummary = () => ({
  fetched: 0,
  notModified: 0,
  cacheFresh: 0,
  cacheOnError: 0,
  fallbackOnError: 0,
});

const recordRunStatus = (
  summary: ReturnType<typeof createRunSummary>,
  status: ContentImageSyncStatus,
) => {
  if (status === "fetched") {
    summary.fetched += 1;
    return;
  }
  if (status === "get_not_modified" || status === "head_unchanged") {
    summary.notModified += 1;
    return;
  }
  if (status === "cache_fresh") {
    summary.cacheFresh += 1;
    return;
  }
  if (status === "cache_on_error") {
    summary.cacheOnError += 1;
    return;
  }
  summary.fallbackOnError += 1;
};

const buildRuntimeEntry = (input: {
  sourceUrl: string;
  etag?: string;
  lastModified?: string;
  checkStatus: ContentImageSyncStatus;
  checkedAt: string;
  cacheControl?: string;
  expiresAt?: string;
  warning?: string;
}): RuntimeGeneratedContentImageEntry =>
  normalizeRuntimeEntry({
    sourceUrl: input.sourceUrl,
    etag: input.etag,
    lastModified: input.lastModified,
    checkStatus: input.checkStatus,
    checkedAt: input.checkedAt,
    cacheControl: input.cacheControl,
    expiresAt: input.expiresAt,
    warning: input.warning,
  });

const buildStableEntry = (input: {
  resolvedPath: string;
  updatedAt: string;
  contentType?: string;
  bytes?: number;
}): StableGeneratedContentImageEntry =>
  normalizeStableEntry({
    resolvedPath: input.resolvedPath,
    updatedAt: input.updatedAt,
    contentType: input.contentType,
    bytes: input.bytes,
  });

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
  const summary = createRunSummary();

  fs.mkdirSync(absolutePath(args.outputDir), { recursive: true });

  for (const slot of slots) {
    const candidate = slot.sourceUrl;
    if (!hasUrlScheme(candidate)) {
      continue;
    }

    const httpUrl = toCanonicalHttpUrl(candidate);
    const previousStableEntry = previousManifest?.bySlot[slot.slotId];
    const previousRuntimeEntry = previousRuntimeManifest?.bySlot[slot.slotId];
    const cachedAssetExists =
      !!previousStableEntry?.resolvedPath &&
      fs.existsSync(resolveManifestAssetAbsolutePath(previousStableEntry.resolvedPath));

    if (!httpUrl) {
      const warning = `Unsupported non-http image URL '${candidate}'. Runtime will use local fallback behavior.`;
      logWarning(warning);
      nextRuntimeBySlot[slot.slotId] = buildRuntimeEntry({
        sourceUrl: candidate,
        checkStatus: "fallback_on_error",
        checkedAt: new Date().toISOString(),
        warning,
      });
      recordRunStatus(summary, "fallback_on_error");
      continue;
    }

    const result = await fetchWithRemoteCachePolicy({
      url: httpUrl,
      pipeline: "content_images",
      policyRegistry: remoteCachePolicyRegistry,
      timeoutMs: FETCH_TIMEOUT_MS,
      headers: {
        accept: "image/*,*/*;q=0.8",
      },
      userAgent: "open-links-content-image-sync/0.1",
      bodyType: "buffer",
      previous: createPreviousState(httpUrl, previousStableEntry, previousRuntimeEntry),
      cacheValueAvailable: cachedAssetExists,
      force: args.force,
      statsCollector: remoteCacheStats,
    });

    const writeStableAndRuntime = (input: {
      stable?: StableGeneratedContentImageEntry;
      runtime: RuntimeGeneratedContentImageEntry;
    }) => {
      if (input.stable) {
        nextBySlot[slot.slotId] = stabilizeContentImageEntry(previousStableEntry, input.stable);
      }
      nextRuntimeBySlot[slot.slotId] = input.runtime;
    };

    if (result.kind === "fetched") {
      const buffer = result.body as Buffer;
      const hash = toContentHash(buffer);
      const extension = resolveExtension(
        result.headers.contentType,
        httpUrl,
        previousStableEntry?.resolvedPath,
      );
      const fileName = `${hash}.${extension}`;
      const absoluteOutputFile = path.join(absolutePath(args.outputDir), fileName);
      const resolvedPath = resolvedPathFromOutputDir(args.outputDir, fileName);

      fs.writeFileSync(absoluteOutputFile, buffer);

      const warning =
        result.bytesFetched > args.maxBytesWarn
          ? `Image '${httpUrl}' is ${result.bytesFetched} bytes, exceeding max-bytes-warn=${args.maxBytesWarn}.`
          : undefined;
      if (warning) {
        logWarning(warning);
      }

      writeStableAndRuntime({
        stable: buildStableEntry({
          resolvedPath,
          updatedAt: result.checkedAt,
          contentType: result.headers.contentType,
          bytes: result.bytesFetched,
        }),
        runtime: buildRuntimeEntry({
          sourceUrl: httpUrl,
          etag: result.headers.etag,
          lastModified: result.headers.lastModified,
          checkStatus: "fetched",
          checkedAt: result.checkedAt,
          cacheControl: result.headers.cacheControl,
          expiresAt: computeRemoteCacheExpiresAt(
            result.headers.cacheControl,
            result.headers.responseDate,
          ),
          warning,
        }),
      });
      recordRunStatus(summary, "fetched");
      console.log(
        `OpenLinks content image sync: fetched '${httpUrl}' -> '${normalizePublicPath(resolvedPath)}'.`,
      );
      continue;
    }

    if (
      (result.kind === "not_modified" || result.kind === "cache_fresh") &&
      previousStableEntry?.resolvedPath &&
      cachedAssetExists
    ) {
      writeStableAndRuntime({
        stable: buildStableEntry({
          resolvedPath: previousStableEntry.resolvedPath,
          updatedAt: result.checkedAt,
          contentType: previousStableEntry.contentType,
          bytes: previousStableEntry.bytes,
        }),
        runtime: buildRuntimeEntry({
          sourceUrl: httpUrl,
          etag: result.headers.etag ?? previousRuntimeEntry?.etag,
          lastModified: result.headers.lastModified ?? previousRuntimeEntry?.lastModified,
          checkStatus: result.checkStatus,
          checkedAt: result.checkedAt,
          cacheControl: result.headers.cacheControl ?? previousRuntimeEntry?.cacheControl,
          expiresAt:
            computeRemoteCacheExpiresAt(result.headers.cacheControl, result.headers.responseDate) ??
            previousRuntimeEntry?.expiresAt,
        }),
      });
      recordRunStatus(summary, result.checkStatus);
      if (result.kind === "cache_fresh") {
        console.log(`OpenLinks content image sync: cache is fresh for '${httpUrl}'.`);
      } else {
        console.log(`OpenLinks content image sync: not modified '${httpUrl}'.`);
      }
      continue;
    }

    if (previousStableEntry?.resolvedPath && cachedAssetExists) {
      const warning = `Image fetch failed (${
        result.kind === "error" ? result.error : result.kind
      }) for '${httpUrl}'. Reusing cached '${normalizePublicPath(previousStableEntry.resolvedPath)}'.`;
      logWarning(warning);
      writeStableAndRuntime({
        stable: previousStableEntry,
        runtime: buildRuntimeEntry({
          sourceUrl: httpUrl,
          etag: previousRuntimeEntry?.etag,
          lastModified: previousRuntimeEntry?.lastModified,
          checkStatus: "cache_on_error",
          checkedAt: new Date().toISOString(),
          cacheControl: previousRuntimeEntry?.cacheControl,
          expiresAt: previousRuntimeEntry?.expiresAt,
          warning,
        }),
      });
      recordRunStatus(summary, "cache_on_error");
      continue;
    }

    const warning = `Image fetch failed (${
      result.kind === "error" ? result.error : result.kind
    }) for '${httpUrl}'. Runtime will use local fallback behavior.`;
    logWarning(warning);
    nextRuntimeBySlot[slot.slotId] = buildRuntimeEntry({
      sourceUrl: httpUrl,
      checkStatus: "fallback_on_error",
      checkedAt: new Date().toISOString(),
      warning,
    });
    recordRunStatus(summary, "fallback_on_error");
  }

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
