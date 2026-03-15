import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

export type ContentImageSyncStatus =
  | "fetched"
  | "not_modified"
  | "cache_fresh"
  | "cache_on_error"
  | "fallback_on_error";

export interface GeneratedContentImageEntry {
  sourceUrl: string;
  resolvedPath?: string;
  status: ContentImageSyncStatus;
  etag?: string;
  lastModified?: string;
  cacheControl?: string;
  expiresAt?: string;
  contentType?: string;
  bytes?: number;
  warning?: string;
  updatedAt: string;
}

export interface GeneratedContentImagesManifest {
  generatedAt: string;
  byUrl: Record<string, GeneratedContentImageEntry>;
}

interface RichMetadataPayload {
  links?: Record<
    string,
    {
      metadata?: {
        image?: unknown;
        profileImage?: unknown;
        ogImage?: unknown;
        twitterImage?: unknown;
      };
    }
  >;
}

interface LinksPayload {
  links?: Array<{
    id?: unknown;
    type?: unknown;
    metadata?: {
      image?: unknown;
      profileImage?: unknown;
      ogImage?: unknown;
      twitterImage?: unknown;
    };
  }>;
}

interface SitePayload {
  quality?: {
    seo?: {
      socialImageFallback?: unknown;
      defaults?: {
        ogImage?: unknown;
        twitterImage?: unknown;
      };
      overrides?: {
        profile?: {
          ogImage?: unknown;
          twitterImage?: unknown;
        };
      };
    };
  };
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

const parseMaxAgeSeconds = (cacheControl: string | undefined): number | undefined => {
  if (!cacheControl) {
    return undefined;
  }

  for (const directive of cacheControl.split(",")) {
    const normalized = directive.trim().toLowerCase();
    if (!normalized.startsWith("max-age=")) {
      continue;
    }

    const value = normalized.slice("max-age=".length).replaceAll('"', "");
    const seconds = Number.parseInt(value, 10);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds;
    }
  }

  return undefined;
};

const toIso = (value: number): string => new Date(value).toISOString();

const computeExpiresAt = (
  cacheControl: string | undefined,
  dateHeader: string | undefined,
): string | undefined => {
  const maxAgeSeconds = parseMaxAgeSeconds(cacheControl);
  if (maxAgeSeconds === undefined) {
    return undefined;
  }

  const headerDate = dateHeader ? Date.parse(dateHeader) : Number.NaN;
  const baseMs = Number.isFinite(headerDate) ? headerDate : Date.now();
  return toIso(baseMs + maxAgeSeconds * 1000);
};

const isFresh = (expiresAt: string | undefined): boolean => {
  if (!expiresAt) {
    return false;
  }

  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) {
    return false;
  }

  return expiresAtMs > Date.now();
};

const extensionFromContentType = (contentType: string | null): string | undefined => {
  if (!contentType) {
    return undefined;
  }

  const normalized = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return CONTENT_TYPE_EXTENSION_MAP.get(normalized);
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
  contentType: string | null,
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

const writeManifest = (manifestPath: string, manifest: GeneratedContentImagesManifest) => {
  const absolute = absolutePath(manifestPath);
  ensureDirectoryForFile(absolute);
  fs.writeFileSync(absolute, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
};

const readPreviousManifest = (manifestPath: string): GeneratedContentImagesManifest | null => {
  const parsed = maybeReadJson<unknown>(manifestPath);
  if (!parsed || !isRecord(parsed)) {
    return null;
  }

  if (!isRecord(parsed.byUrl)) {
    return null;
  }

  const byUrl: Record<string, GeneratedContentImageEntry> = {};

  for (const [url, rawEntry] of Object.entries(parsed.byUrl)) {
    if (!isRecord(rawEntry)) {
      continue;
    }

    if (
      typeof rawEntry.sourceUrl !== "string" ||
      typeof rawEntry.status !== "string" ||
      typeof rawEntry.updatedAt !== "string"
    ) {
      continue;
    }

    const entry: GeneratedContentImageEntry = {
      sourceUrl: rawEntry.sourceUrl,
      status: (
        ["fetched", "not_modified", "cache_fresh", "cache_on_error", "fallback_on_error"] as const
      ).includes(rawEntry.status as ContentImageSyncStatus)
        ? (rawEntry.status as ContentImageSyncStatus)
        : "fallback_on_error",
      updatedAt: rawEntry.updatedAt,
    };

    if (typeof rawEntry.resolvedPath === "string" && rawEntry.resolvedPath.trim().length > 0) {
      entry.resolvedPath = rawEntry.resolvedPath;
    }
    if (typeof rawEntry.etag === "string" && rawEntry.etag.trim().length > 0) {
      entry.etag = rawEntry.etag;
    }
    if (typeof rawEntry.lastModified === "string" && rawEntry.lastModified.trim().length > 0) {
      entry.lastModified = rawEntry.lastModified;
    }
    if (typeof rawEntry.cacheControl === "string" && rawEntry.cacheControl.trim().length > 0) {
      entry.cacheControl = rawEntry.cacheControl;
    }
    if (typeof rawEntry.expiresAt === "string" && rawEntry.expiresAt.trim().length > 0) {
      entry.expiresAt = rawEntry.expiresAt;
    }
    if (typeof rawEntry.contentType === "string" && rawEntry.contentType.trim().length > 0) {
      entry.contentType = rawEntry.contentType;
    }
    if (
      typeof rawEntry.bytes === "number" &&
      Number.isFinite(rawEntry.bytes) &&
      rawEntry.bytes >= 0
    ) {
      entry.bytes = rawEntry.bytes;
    }
    if (typeof rawEntry.warning === "string" && rawEntry.warning.trim().length > 0) {
      entry.warning = rawEntry.warning;
    }

    byUrl[url] = entry;
  }

  return {
    generatedAt:
      typeof parsed.generatedAt === "string" && parsed.generatedAt.trim().length > 0
        ? parsed.generatedAt
        : new Date(0).toISOString(),
    byUrl,
  };
};

const buildEntry = (
  base: {
    sourceUrl: string;
    status: ContentImageSyncStatus;
    resolvedPath?: string;
  },
  detail: {
    etag?: string;
    lastModified?: string;
    cacheControl?: string;
    expiresAt?: string;
    contentType?: string;
    bytes?: number;
    warning?: string;
  },
): GeneratedContentImageEntry => {
  const entry: GeneratedContentImageEntry = {
    sourceUrl: base.sourceUrl,
    status: base.status,
    updatedAt: new Date().toISOString(),
  };

  if (base.resolvedPath) {
    entry.resolvedPath = normalizePublicPath(base.resolvedPath);
  }
  if (detail.etag) {
    entry.etag = detail.etag;
  }
  if (detail.lastModified) {
    entry.lastModified = detail.lastModified;
  }
  if (detail.cacheControl) {
    entry.cacheControl = detail.cacheControl;
  }
  if (detail.expiresAt) {
    entry.expiresAt = detail.expiresAt;
  }
  if (detail.contentType) {
    entry.contentType = detail.contentType;
  }
  if (typeof detail.bytes === "number" && Number.isFinite(detail.bytes)) {
    entry.bytes = detail.bytes;
  }
  if (detail.warning) {
    entry.warning = detail.warning;
  }

  return entry;
};

const normalizeEntry = (entry: GeneratedContentImageEntry): GeneratedContentImageEntry => {
  const normalized: GeneratedContentImageEntry = {
    sourceUrl: entry.sourceUrl,
    status: entry.status,
    updatedAt: entry.updatedAt,
  };

  if (trimToUndefined(entry.resolvedPath)) {
    normalized.resolvedPath = trimToUndefined(entry.resolvedPath);
  }
  if (trimToUndefined(entry.etag)) {
    normalized.etag = trimToUndefined(entry.etag);
  }
  if (trimToUndefined(entry.lastModified)) {
    normalized.lastModified = trimToUndefined(entry.lastModified);
  }
  if (trimToUndefined(entry.cacheControl)) {
    normalized.cacheControl = trimToUndefined(entry.cacheControl);
  }
  if (trimToUndefined(entry.expiresAt)) {
    normalized.expiresAt = trimToUndefined(entry.expiresAt);
  }
  if (trimToUndefined(entry.contentType)) {
    normalized.contentType = trimToUndefined(entry.contentType);
  }
  if (typeof entry.bytes === "number" && Number.isFinite(entry.bytes)) {
    normalized.bytes = entry.bytes;
  }
  if (trimToUndefined(entry.warning)) {
    normalized.warning = trimToUndefined(entry.warning);
  }

  return normalized;
};

const areEntriesEqual = (
  left: GeneratedContentImageEntry | undefined,
  right: GeneratedContentImageEntry | undefined,
): boolean => {
  if (!left || !right) {
    return left === right;
  }

  return JSON.stringify(normalizeEntry(left)) === JSON.stringify(normalizeEntry(right));
};

const hasSamePayload = (
  left: GeneratedContentImageEntry,
  right: GeneratedContentImageEntry,
): boolean =>
  left.sourceUrl === right.sourceUrl &&
  left.resolvedPath === right.resolvedPath &&
  left.contentType === right.contentType &&
  left.bytes === right.bytes;

export const stabilizeContentImageEntry = (
  previousEntry: GeneratedContentImageEntry | undefined,
  nextEntry: GeneratedContentImageEntry,
): GeneratedContentImageEntry => {
  if (!previousEntry || !hasSamePayload(previousEntry, nextEntry)) {
    return nextEntry;
  }

  const stabilized: GeneratedContentImageEntry = {
    ...nextEntry,
    updatedAt: previousEntry.updatedAt,
  };

  if (nextEntry.status === "cache_fresh" || nextEntry.status === "not_modified") {
    stabilized.status = previousEntry.status;
  }

  return stabilized;
};

const areEntryMapsEqual = (
  left: Record<string, GeneratedContentImageEntry>,
  right: Record<string, GeneratedContentImageEntry>,
): boolean => {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (JSON.stringify(leftKeys) !== JSON.stringify(rightKeys)) {
    return false;
  }

  return leftKeys.every((key) => areEntriesEqual(left[key], right[key]));
};

export const buildStableContentImagesManifest = (input: {
  previousManifest: GeneratedContentImagesManifest | null;
  byUrl: Record<string, GeneratedContentImageEntry>;
  generatedAt: string;
}): GeneratedContentImagesManifest => ({
  generatedAt:
    input.previousManifest && areEntryMapsEqual(input.previousManifest.byUrl, input.byUrl)
      ? input.previousManifest.generatedAt
      : input.generatedAt,
  byUrl: input.byUrl,
});

const mergePreviousEntries = (
  stableEntry: GeneratedContentImageEntry | undefined,
  runtimeEntry: GeneratedContentImageEntry | undefined,
): GeneratedContentImageEntry | undefined => {
  if (!stableEntry && !runtimeEntry) {
    return undefined;
  }

  if (!stableEntry) {
    return runtimeEntry;
  }

  if (!runtimeEntry) {
    return stableEntry;
  }

  return {
    ...stableEntry,
    ...runtimeEntry,
    sourceUrl: runtimeEntry.sourceUrl,
    status: runtimeEntry.status,
    updatedAt: runtimeEntry.updatedAt,
    resolvedPath: stableEntry.resolvedPath ?? runtimeEntry.resolvedPath,
  };
};

const toStableEntry = (
  entry: GeneratedContentImageEntry | undefined,
): GeneratedContentImageEntry | undefined => {
  if (!entry?.resolvedPath) {
    return undefined;
  }

  const stableEntry: GeneratedContentImageEntry = {
    sourceUrl: entry.sourceUrl,
    resolvedPath: entry.resolvedPath,
    status: entry.status,
    updatedAt: entry.updatedAt,
  };

  if (entry.contentType) {
    stableEntry.contentType = entry.contentType;
  }
  if (typeof entry.bytes === "number" && Number.isFinite(entry.bytes)) {
    stableEntry.bytes = entry.bytes;
  }
  if (entry.warning) {
    stableEntry.warning = entry.warning;
  }

  return stableEntry;
};

const buildRuntimeManifest = (input: {
  generatedAt: string;
  byUrl: Record<string, GeneratedContentImageEntry>;
}): GeneratedContentImagesManifest => ({
  generatedAt: input.generatedAt,
  byUrl: input.byUrl,
});

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
  if (status === "not_modified") {
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

export const collectCandidates = (
  linksPayload: LinksPayload,
  generatedRichMetadata: RichMetadataPayload | null,
  sitePayload: SitePayload,
): string[] => {
  const candidates = new Set<string>();
  const links = Array.isArray(linksPayload.links) ? linksPayload.links : [];
  const generatedLinks = isRecord(generatedRichMetadata?.links) ? generatedRichMetadata.links : {};

  for (const link of links) {
    if (!isRecord(link)) {
      continue;
    }

    const linkId = typeof link.id === "string" ? link.id : undefined;
    const generatedMetadata =
      linkId && isRecord(generatedLinks[linkId]) && isRecord(generatedLinks[linkId].metadata)
        ? generatedLinks[linkId].metadata
        : undefined;
    const manualMetadata = isRecord(link.metadata) ? link.metadata : undefined;

    const candidateValues = [
      generatedMetadata?.image,
      generatedMetadata?.profileImage,
      generatedMetadata?.ogImage,
      generatedMetadata?.twitterImage,
      manualMetadata?.image,
      manualMetadata?.profileImage,
      manualMetadata?.ogImage,
      manualMetadata?.twitterImage,
    ];

    for (const candidateValue of candidateValues) {
      if (typeof candidateValue === "string" && candidateValue.trim().length > 0) {
        candidates.add(candidateValue.trim());
      }
    }
  }

  const seo = sitePayload.quality?.seo;
  const seoValues: unknown[] = [
    seo?.socialImageFallback,
    seo?.defaults?.ogImage,
    seo?.defaults?.twitterImage,
    seo?.overrides?.profile?.ogImage,
    seo?.overrides?.profile?.twitterImage,
  ];

  for (const value of seoValues) {
    if (typeof value === "string" && value.trim().length > 0) {
      candidates.add(value.trim());
    }
  }

  return [...candidates];
};

const listReferencedResolvedPaths = (manifest: GeneratedContentImagesManifest): Set<string> => {
  const paths = new Set<string>();

  for (const entry of Object.values(manifest.byUrl)) {
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
  const sitePayload = readJson<SitePayload>(args.sitePath);
  const generatedRichMetadata = maybeReadJson<RichMetadataPayload>(args.richMetadataPath);
  const previousManifest = readPreviousManifest(args.manifestPath);
  const previousRuntimeManifest = readPreviousManifest(args.runtimeManifestPath);

  const candidates = collectCandidates(linksPayload, generatedRichMetadata, sitePayload);
  const nextByUrl: Record<string, GeneratedContentImageEntry> = {};
  const nextRuntimeByUrl: Record<string, GeneratedContentImageEntry> = {};
  const summary = createRunSummary();

  fs.mkdirSync(absolutePath(args.outputDir), { recursive: true });

  for (const candidate of candidates) {
    if (!hasUrlScheme(candidate)) {
      continue;
    }

    const httpUrl = toCanonicalHttpUrl(candidate);
    const candidateKey = httpUrl ?? candidate;
    const previousStableEntry = previousManifest?.byUrl[candidateKey];
    const previousRuntimeEntry = previousRuntimeManifest?.byUrl[candidateKey];
    const previousEntry = mergePreviousEntries(previousStableEntry, previousRuntimeEntry);
    const cachedPath = previousEntry?.resolvedPath;
    const cachedAssetExists =
      typeof cachedPath === "string" &&
      cachedPath.length > 0 &&
      fs.existsSync(resolveManifestAssetAbsolutePath(cachedPath));

    const persistEntries = (
      runtimeEntry: GeneratedContentImageEntry,
      maybeStableSource: GeneratedContentImageEntry | undefined = runtimeEntry,
    ) => {
      const stableEntry = toStableEntry(maybeStableSource);
      if (stableEntry) {
        nextByUrl[candidateKey] = stabilizeContentImageEntry(previousStableEntry, stableEntry);
      }
      nextRuntimeByUrl[candidateKey] = runtimeEntry;
    };

    if (!httpUrl) {
      const warning = `Unsupported non-http image URL '${candidate}'. Runtime will use local fallback behavior.`;
      logWarning(warning);
      nextRuntimeByUrl[candidateKey] = buildEntry(
        {
          sourceUrl: candidate,
          status: "fallback_on_error",
        },
        {
          warning,
        },
      );
      recordRunStatus(summary, "fallback_on_error");
      continue;
    }

    if (!args.force && previousEntry && cachedAssetExists && isFresh(previousEntry.expiresAt)) {
      const runtimeEntry = buildEntry(
        {
          sourceUrl: httpUrl,
          resolvedPath: previousEntry.resolvedPath,
          status: "cache_fresh",
        },
        {
          etag: previousEntry.etag,
          lastModified: previousEntry.lastModified,
          cacheControl: previousEntry.cacheControl,
          expiresAt: previousEntry.expiresAt,
          contentType: previousEntry.contentType,
          bytes: previousEntry.bytes,
        },
      );
      persistEntries(runtimeEntry, previousStableEntry ?? previousEntry);
      recordRunStatus(summary, "cache_fresh");
      console.log(`OpenLinks content image sync: cache is fresh for '${httpUrl}'.`);
      continue;
    }

    const headers: Record<string, string> = {
      "user-agent": "open-links-content-image-sync/0.1",
      accept: "image/*,*/*;q=0.8",
    };

    if (!args.force && previousEntry) {
      if (previousEntry.etag) {
        headers["if-none-match"] = previousEntry.etag;
      }
      if (previousEntry.lastModified) {
        headers["if-modified-since"] = previousEntry.lastModified;
      }
    }

    const fallbackFromError = (reason: string) => {
      if (previousEntry && cachedAssetExists && previousEntry.resolvedPath) {
        const warning = `Image fetch failed (${reason}) for '${httpUrl}'. Reusing cached '${normalizePublicPath(
          previousEntry.resolvedPath,
        )}'.`;
        logWarning(warning);
        const runtimeEntry = buildEntry(
          {
            sourceUrl: httpUrl,
            resolvedPath: previousEntry.resolvedPath,
            status: "cache_on_error",
          },
          {
            etag: previousEntry.etag,
            lastModified: previousEntry.lastModified,
            cacheControl: previousEntry.cacheControl,
            expiresAt: previousEntry.expiresAt,
            contentType: previousEntry.contentType,
            bytes: previousEntry.bytes,
            warning,
          },
        );
        persistEntries(runtimeEntry, previousStableEntry ?? previousEntry);
        recordRunStatus(summary, "cache_on_error");
        return;
      }

      const warning = `Image fetch failed (${reason}) for '${httpUrl}'. Runtime will use local fallback behavior.`;
      logWarning(warning);
      nextRuntimeByUrl[candidateKey] = buildEntry(
        {
          sourceUrl: httpUrl,
          status: "fallback_on_error",
        },
        {
          warning,
        },
      );
      recordRunStatus(summary, "fallback_on_error");
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(httpUrl, {
        method: "GET",
        redirect: "follow",
        headers,
        signal: controller.signal,
      });

      if (response.status === 304) {
        if (!previousEntry || !cachedAssetExists || !previousEntry.resolvedPath) {
          fallbackFromError("received HTTP 304 but no cached asset exists");
          continue;
        }

        const cacheControl = response.headers.get("cache-control") ?? previousEntry.cacheControl;
        const expiresAt =
          computeExpiresAt(cacheControl ?? undefined, response.headers.get("date") ?? undefined) ??
          previousEntry.expiresAt;
        const etag = response.headers.get("etag") ?? previousEntry.etag;
        const lastModified = response.headers.get("last-modified") ?? previousEntry.lastModified;

        const runtimeEntry = buildEntry(
          {
            sourceUrl: httpUrl,
            resolvedPath: previousEntry.resolvedPath,
            status: "not_modified",
          },
          {
            etag: etag ?? undefined,
            lastModified: lastModified ?? undefined,
            cacheControl: cacheControl ?? undefined,
            expiresAt,
            contentType: previousEntry.contentType,
            bytes: previousEntry.bytes,
          },
        );
        persistEntries(runtimeEntry, previousStableEntry ?? previousEntry);
        recordRunStatus(summary, "not_modified");
        console.log(`OpenLinks content image sync: not modified '${httpUrl}'.`);
        continue;
      }

      if (!response.ok) {
        fallbackFromError(`received HTTP ${response.status}`);
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength === 0) {
        fallbackFromError("response body was empty");
        continue;
      }

      const hash = toContentHash(buffer);
      const extension = resolveExtension(
        response.headers.get("content-type"),
        httpUrl,
        previousEntry?.resolvedPath,
      );
      const fileName = `${hash}.${extension}`;
      const absoluteOutputFile = path.join(absolutePath(args.outputDir), fileName);
      const resolvedPath = resolvedPathFromOutputDir(args.outputDir, fileName);

      fs.writeFileSync(absoluteOutputFile, buffer);

      const contentType = response.headers.get("content-type") ?? undefined;
      const cacheControl = response.headers.get("cache-control") ?? undefined;
      const expiresAt = computeExpiresAt(cacheControl, response.headers.get("date") ?? undefined);
      const etag = response.headers.get("etag") ?? undefined;
      const lastModified = response.headers.get("last-modified") ?? undefined;
      const warnings: string[] = [];

      if (contentType && !contentType.toLowerCase().startsWith("image/")) {
        warnings.push(`Fetched '${httpUrl}' with non-image content-type '${contentType}'.`);
      }

      if (buffer.byteLength > args.maxBytesWarn) {
        warnings.push(
          `Fetched '${httpUrl}' exceeds warn threshold (${buffer.byteLength} bytes > ${args.maxBytesWarn}).`,
        );
      }

      for (const warning of warnings) {
        logWarning(warning);
      }

      const runtimeEntry = buildEntry(
        {
          sourceUrl: httpUrl,
          resolvedPath,
          status: "fetched",
        },
        {
          etag,
          lastModified,
          cacheControl,
          expiresAt,
          contentType,
          bytes: buffer.byteLength,
          warning: warnings.length > 0 ? warnings.join(" ") : undefined,
        },
      );
      persistEntries(runtimeEntry);
      recordRunStatus(summary, "fetched");

      console.log(
        `OpenLinks content image sync: fetched '${httpUrl}' -> '${normalizePublicPath(resolvedPath)}'.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fallbackFromError(message);
    } finally {
      clearTimeout(timeout);
    }
  }

  const generatedAt = new Date().toISOString();
  const manifest = buildStableContentImagesManifest({
    previousManifest,
    byUrl: nextByUrl,
    generatedAt,
  });
  const runtimeManifest = buildRuntimeManifest({
    generatedAt,
    byUrl: nextRuntimeByUrl,
  });

  const keepPaths = listReferencedResolvedPaths(manifest);
  garbageCollectOutput(args.outputDir, keepPaths);

  if (!previousManifest || JSON.stringify(previousManifest) !== JSON.stringify(manifest)) {
    writeManifest(args.manifestPath, manifest);
  }
  if (
    !previousRuntimeManifest ||
    JSON.stringify(previousRuntimeManifest) !== JSON.stringify(runtimeManifest)
  ) {
    writeManifest(args.runtimeManifestPath, runtimeManifest);
  }

  const summaryOutput = {
    totalCandidates: candidates.length,
    trackedUrls: Object.keys(manifest.byUrl).length,
    fetched: summary.fetched,
    notModified: summary.notModified,
    cacheFresh: summary.cacheFresh,
    cacheOnError: summary.cacheOnError,
    fallbackOnError: summary.fallbackOnError,
  };

  console.log("OpenLinks content image sync summary");
  console.log(`Candidates: ${summaryOutput.totalCandidates}`);
  console.log(`Tracked URL entries: ${summaryOutput.trackedUrls}`);
  console.log(
    `Statuses: fetched=${summaryOutput.fetched}, not_modified=${summaryOutput.notModified}, cache_fresh=${summaryOutput.cacheFresh}, cache_on_error=${summaryOutput.cacheOnError}, fallback_on_error=${summaryOutput.fallbackOnError}`,
  );
  console.log(`Manifest: ${args.manifestPath}`);
  console.log(`Runtime manifest: ${args.runtimeManifestPath}`);
  console.log(`Output directory: ${args.outputDir}`);
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
