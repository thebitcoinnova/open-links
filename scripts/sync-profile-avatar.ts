import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  type AvatarCheckStatus,
  type ProfileAvatarManifest,
  type ProfileAvatarRuntimeManifest,
  normalizeRuntimeManifest,
  normalizeStableManifest,
  stabilizeProfileAvatarManifest,
} from "./profile-avatar-manifest";
import {
  type RemoteCachePreviousState,
  RemoteCacheStatsCollector,
  computeRemoteCacheExpiresAt,
  createRemoteCacheStatsOutputPath,
  fetchWithRemoteCachePolicy,
  writeRemoteCacheRunSummary,
} from "./shared/remote-cache-fetch";
import { loadRemoteCachePolicyRegistry } from "./shared/remote-cache-policy";

export type {
  AvatarCheckStatus,
  ProfileAvatarManifest,
  ProfileAvatarRuntimeManifest,
} from "./profile-avatar-manifest";
export { stabilizeProfileAvatarManifest } from "./profile-avatar-manifest";

interface ProfilePayload {
  avatar?: unknown;
}

interface AvatarSyncOptions {
  profilePath: string;
  manifestPath: string;
  runtimeManifestPath: string;
  outputDir: string;
  fallbackPath: string;
  force: boolean;
}

const ROOT = process.cwd();
const GENERATED_BASENAME = "profile-avatar";
const DEFAULT_PROFILE_PATH = "data/profile.json";
const DEFAULT_MANIFEST_PATH = "data/cache/profile-avatar.json";
const DEFAULT_RUNTIME_MANIFEST_PATH = "data/cache/profile-avatar.runtime.json";
const DEFAULT_OUTPUT_DIR = "public/cache/profile-avatar";
const DEFAULT_FALLBACK_PATH = "profile-avatar-fallback.svg";
const FETCH_TIMEOUT_MS = 10_000;
const FORCE_ENV = "OPENLINKS_AVATAR_FORCE";

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

const trimToUndefined = (value: string | undefined): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const absolutePath = (relativePath: string): string =>
  path.isAbsolute(relativePath) ? relativePath : path.join(ROOT, relativePath);

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

const ensureDirectoryForFile = (filePath: string) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

const normalizePublicPath = (relativePath: string): string => {
  const normalized = normalizeRelativePath(relativePath);
  return normalized.startsWith("public/") ? normalized.slice("public/".length) : normalized;
};

const resolveManifestAssetAbsolutePath = (resolvedPath: string): string =>
  path.join(ROOT, "public", normalizePublicPath(resolvedPath));

const parseArgs = (): AvatarSyncOptions => {
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
    profilePath: getFlagValue("--profile", DEFAULT_PROFILE_PATH),
    manifestPath: getFlagValue("--manifest", DEFAULT_MANIFEST_PATH),
    runtimeManifestPath: getFlagValue("--runtime-manifest", DEFAULT_RUNTIME_MANIFEST_PATH),
    outputDir: getFlagValue("--output-dir", DEFAULT_OUTPUT_DIR),
    fallbackPath: normalizeRelativePath(getFlagValue("--fallback", DEFAULT_FALLBACK_PATH)),
    force: args.includes("--force") || isTruthy(process.env[FORCE_ENV]),
  };
};

const readStableManifest = (manifestPath: string): ProfileAvatarManifest | null => {
  const parsed = maybeReadJson<unknown>(manifestPath);
  if (!parsed || !isRecord(parsed)) {
    return null;
  }

  if (
    typeof parsed.sourceUrl !== "string" ||
    typeof parsed.resolvedPath !== "string" ||
    typeof parsed.updatedAt !== "string"
  ) {
    return null;
  }

  return normalizeStableManifest({
    sourceUrl: parsed.sourceUrl,
    resolvedPath: parsed.resolvedPath,
    updatedAt: parsed.updatedAt,
    etag: typeof parsed.etag === "string" ? parsed.etag : undefined,
    lastModified: typeof parsed.lastModified === "string" ? parsed.lastModified : undefined,
    contentType: typeof parsed.contentType === "string" ? parsed.contentType : undefined,
    bytes:
      typeof parsed.bytes === "number" && Number.isFinite(parsed.bytes) ? parsed.bytes : undefined,
  });
};

const readRuntimeManifest = (manifestPath: string): ProfileAvatarRuntimeManifest | null => {
  const parsed = maybeReadJson<unknown>(manifestPath);
  if (!parsed || !isRecord(parsed)) {
    return null;
  }

  if (
    typeof parsed.sourceUrl !== "string" ||
    typeof parsed.checkStatus !== "string" ||
    typeof parsed.checkedAt !== "string"
  ) {
    return null;
  }

  return normalizeRuntimeManifest({
    sourceUrl: parsed.sourceUrl,
    checkStatus: parsed.checkStatus as AvatarCheckStatus,
    checkedAt: parsed.checkedAt,
    cacheControl: typeof parsed.cacheControl === "string" ? parsed.cacheControl : undefined,
    expiresAt: typeof parsed.expiresAt === "string" ? parsed.expiresAt : undefined,
    warning: typeof parsed.warning === "string" ? parsed.warning : undefined,
  });
};

const writeJson = (relativePath: string, payload: unknown) => {
  const absolute = absolutePath(relativePath);
  ensureDirectoryForFile(absolute);
  fs.writeFileSync(absolute, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};

const areStableManifestsEqual = (
  left: ProfileAvatarManifest | null,
  right: ProfileAvatarManifest,
): boolean => {
  if (!left) {
    return false;
  }

  return (
    JSON.stringify(normalizeStableManifest(left)) === JSON.stringify(normalizeStableManifest(right))
  );
};

const areRuntimeManifestsEqual = (
  left: ProfileAvatarRuntimeManifest | null,
  right: ProfileAvatarRuntimeManifest,
): boolean => {
  if (!left) {
    return false;
  }

  return (
    JSON.stringify(normalizeRuntimeManifest(left)) ===
    JSON.stringify(normalizeRuntimeManifest(right))
  );
};

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

const resolvedPathFromOutputDir = (outputDir: string, fileName: string): string => {
  const normalized = normalizeRelativePath(outputDir).replace(/\/+$/, "");
  const relativeToPublic = normalized.startsWith("public/")
    ? normalized.slice("public/".length)
    : normalized;
  return [relativeToPublic, fileName].filter(Boolean).join("/");
};

const cleanGeneratedVariants = (outputDir: string, keepFileName: string) => {
  const absoluteOutputDir = absolutePath(outputDir);
  if (!fs.existsSync(absoluteOutputDir)) {
    return;
  }

  for (const fileName of fs.readdirSync(absoluteOutputDir)) {
    if (!fileName.startsWith(`${GENERATED_BASENAME}.`)) {
      continue;
    }
    if (fileName === keepFileName) {
      continue;
    }
    fs.rmSync(path.join(absoluteOutputDir, fileName), { force: true });
  }
};

const ensureHttpUrl = (raw: string): string | null => {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
};

const writeStableManifestIfChanged = (
  manifestPath: string,
  previous: ProfileAvatarManifest | null,
  next: ProfileAvatarManifest,
) => {
  const stabilized = stabilizeProfileAvatarManifest(previous, next);
  if (!areStableManifestsEqual(previous, stabilized)) {
    writeJson(manifestPath, stabilized);
  }
};

const writeRuntimeManifestIfChanged = (
  manifestPath: string,
  previous: ProfileAvatarRuntimeManifest | null,
  next: ProfileAvatarRuntimeManifest,
) => {
  const normalized = normalizeRuntimeManifest(next);
  if (!areRuntimeManifestsEqual(previous, normalized)) {
    writeJson(manifestPath, normalized);
  }
};

const logWarning = (message: string) => {
  console.warn(`WARNING [avatar:sync] ${message}`);
};

type AvatarFetchResult = Awaited<ReturnType<typeof fetchWithRemoteCachePolicy>>;
type AvatarRunContext = {
  options: AvatarSyncOptions;
  sourceUrlRaw: string;
  sourceUrl: string | null;
  stableManifest: ProfileAvatarManifest | null;
  runtimeManifest: ProfileAvatarRuntimeManifest | null;
  fallbackResolvedPath: string;
  fallbackAbsolutePath: string;
  fallbackExists: boolean;
  previousSourceMatches: boolean;
  cachedAssetExists: boolean;
  checkedAt: string;
  remoteCacheStats: RemoteCacheStatsCollector;
  remoteCachePolicyRegistry: ReturnType<typeof loadRemoteCachePolicyRegistry>;
};

const writeAvatarStats = (remoteCacheStats: RemoteCacheStatsCollector) => {
  const statsPath = createRemoteCacheStatsOutputPath("sync-profile-avatar");
  writeRemoteCacheRunSummary(statsPath, remoteCacheStats);
  console.log(`OpenLinks avatar sync: remote cache stats -> '${statsPath}'.`);
};

const writeFallbackAvatar = (context: AvatarRunContext, warning: string) => {
  logWarning(warning);
  writeStableManifestIfChanged(context.options.manifestPath, context.stableManifest, {
    sourceUrl: context.sourceUrl ?? context.sourceUrlRaw,
    resolvedPath: context.fallbackResolvedPath,
    updatedAt: context.checkedAt,
  });
  writeRuntimeManifestIfChanged(context.options.runtimeManifestPath, context.runtimeManifest, {
    sourceUrl: context.sourceUrl ?? context.sourceUrlRaw,
    checkStatus: "fallback_on_error",
    checkedAt: context.checkedAt,
    warning: context.fallbackExists
      ? warning
      : `${warning} Fallback file is missing at '${context.fallbackAbsolutePath}'.`,
  });
  writeAvatarStats(context.remoteCacheStats);
};

const handleMissingAvatarSource = (context: AvatarRunContext): boolean => {
  if (context.sourceUrl) return false;
  const warning = context.sourceUrlRaw
    ? `Avatar URL '${context.sourceUrlRaw}' is invalid or unsupported (http/https required); using fallback asset '${context.fallbackResolvedPath}'.`
    : `Avatar URL is missing; using fallback asset '${context.fallbackResolvedPath}'.`;
  writeFallbackAvatar(context, warning);
  return true;
};

const buildPreviousAvatarState = (
  context: AvatarRunContext,
): RemoteCachePreviousState | undefined =>
  context.previousSourceMatches
    ? {
        etag: context.stableManifest?.etag,
        lastModified: context.stableManifest?.lastModified,
        cacheControl: context.runtimeManifest?.cacheControl,
        expiresAt: context.runtimeManifest?.expiresAt,
        bytes: context.stableManifest?.bytes,
      }
    : undefined;

const handleFetchedAvatar = (
  context: AvatarRunContext & { sourceUrl: string },
  result: Extract<AvatarFetchResult, { kind: "fetched" }>,
) => {
  const extension = resolveExtension(
    result.headers.contentType,
    context.sourceUrl,
    context.stableManifest?.resolvedPath,
  );
  const fileName = `${GENERATED_BASENAME}.${extension}`;
  const absoluteOutputDir = absolutePath(context.options.outputDir);
  const resolvedPath = resolvedPathFromOutputDir(context.options.outputDir, fileName);
  fs.mkdirSync(absoluteOutputDir, { recursive: true });
  fs.writeFileSync(path.join(absoluteOutputDir, fileName), result.body as Buffer);
  cleanGeneratedVariants(context.options.outputDir, fileName);
  writeStableManifestIfChanged(context.options.manifestPath, context.stableManifest, {
    sourceUrl: context.sourceUrl,
    resolvedPath,
    updatedAt: context.checkedAt,
    etag: result.headers.etag,
    lastModified: result.headers.lastModified,
    contentType: result.headers.contentType,
    bytes: result.bytesFetched,
  });
  writeRuntimeManifestIfChanged(context.options.runtimeManifestPath, context.runtimeManifest, {
    sourceUrl: context.sourceUrl,
    checkStatus: "fetched",
    checkedAt: result.checkedAt,
    cacheControl: result.headers.cacheControl,
    expiresAt: computeRemoteCacheExpiresAt(
      result.headers.cacheControl,
      result.headers.responseDate,
    ),
  });
  console.log(`OpenLinks avatar sync: fetched avatar -> '${normalizePublicPath(resolvedPath)}'.`);
  if (context.options.force) console.log("OpenLinks avatar sync: force refresh was enabled.");
  writeAvatarStats(context.remoteCacheStats);
};

const handleRevalidatedAvatar = (
  context: AvatarRunContext & { sourceUrl: string },
  previousState: RemoteCachePreviousState | undefined,
  result: AvatarFetchResult,
): boolean => {
  if (
    (result.kind !== "not_modified" && result.kind !== "cache_fresh") ||
    !context.previousSourceMatches ||
    !context.cachedAssetExists ||
    !context.stableManifest
  )
    return false;
  writeStableManifestIfChanged(context.options.manifestPath, context.stableManifest, {
    ...context.stableManifest,
    sourceUrl: context.sourceUrl,
    updatedAt: context.checkedAt,
    etag: result.headers.etag ?? previousState?.etag,
    lastModified: result.headers.lastModified ?? previousState?.lastModified,
  });
  writeRuntimeManifestIfChanged(context.options.runtimeManifestPath, context.runtimeManifest, {
    sourceUrl: context.sourceUrl,
    checkStatus: result.checkStatus,
    checkedAt: result.checkedAt,
    cacheControl: result.headers.cacheControl ?? context.runtimeManifest?.cacheControl,
    expiresAt:
      computeRemoteCacheExpiresAt(result.headers.cacheControl, result.headers.responseDate) ??
      context.runtimeManifest?.expiresAt,
  });
  console.log(
    result.kind === "cache_fresh"
      ? `OpenLinks avatar sync: cache is fresh; using '${normalizePublicPath(context.stableManifest.resolvedPath)}' without network fetch.`
      : `OpenLinks avatar sync: remote avatar not modified; using cached '${normalizePublicPath(context.stableManifest.resolvedPath)}'.`,
  );
  writeAvatarStats(context.remoteCacheStats);
  return true;
};

const handleFailedAvatar = (
  context: AvatarRunContext & { sourceUrl: string },
  result: AvatarFetchResult,
) => {
  const failure = result.kind === "error" ? result.error : result.kind;
  if (context.previousSourceMatches && context.cachedAssetExists && context.stableManifest) {
    const warning = `Avatar fetch failed (${failure}). Reusing cached avatar '${normalizePublicPath(context.stableManifest.resolvedPath)}'.`;
    logWarning(warning);
    writeRuntimeManifestIfChanged(context.options.runtimeManifestPath, context.runtimeManifest, {
      sourceUrl: context.sourceUrl,
      checkStatus: "cache_on_error",
      checkedAt: context.checkedAt,
      cacheControl: context.runtimeManifest?.cacheControl,
      expiresAt: context.runtimeManifest?.expiresAt,
      warning,
    });
    writeAvatarStats(context.remoteCacheStats);
    return;
  }
  writeFallbackAvatar(
    context,
    `Avatar fetch failed (${failure}). Using fallback asset '${context.fallbackResolvedPath}'.`,
  );
};

const createAvatarRunContext = (): AvatarRunContext => {
  const options = parseArgs();
  const profile = readJson<ProfilePayload>(options.profilePath);
  const sourceUrlRaw = typeof profile.avatar === "string" ? profile.avatar.trim() : "";
  const sourceUrl = ensureHttpUrl(sourceUrlRaw);
  const stableManifest = readStableManifest(options.manifestPath);
  const runtimeManifest = readRuntimeManifest(options.runtimeManifestPath);
  const remoteCachePolicyRegistry = loadRemoteCachePolicyRegistry();
  const fallbackResolvedPath = normalizePublicPath(options.fallbackPath || DEFAULT_FALLBACK_PATH);
  const previousSourceMatches = Boolean(sourceUrl && stableManifest?.sourceUrl === sourceUrl);
  return {
    options,
    sourceUrlRaw,
    sourceUrl,
    stableManifest,
    runtimeManifest,
    fallbackResolvedPath,
    fallbackAbsolutePath: resolveManifestAssetAbsolutePath(fallbackResolvedPath),
    fallbackExists: fs.existsSync(resolveManifestAssetAbsolutePath(fallbackResolvedPath)),
    previousSourceMatches,
    cachedAssetExists:
      previousSourceMatches &&
      !!stableManifest &&
      fs.existsSync(resolveManifestAssetAbsolutePath(stableManifest.resolvedPath)),
    checkedAt: new Date().toISOString(),
    remoteCacheStats: new RemoteCacheStatsCollector("sync-profile-avatar"),
    remoteCachePolicyRegistry,
  };
};

const run = async () => {
  const context = createAvatarRunContext();
  if (handleMissingAvatarSource(context) || !context.sourceUrl) return;
  const sourceContext = { ...context, sourceUrl: context.sourceUrl };
  const previousState = buildPreviousAvatarState(sourceContext);
  const result = await fetchWithRemoteCachePolicy({
    url: sourceContext.sourceUrl,
    pipeline: "profile_avatar",
    policyRegistry: sourceContext.remoteCachePolicyRegistry,
    timeoutMs: FETCH_TIMEOUT_MS,
    headers: { accept: "image/*,*/*;q=0.8" },
    userAgent: "open-links-avatar-sync/0.1",
    bodyType: "buffer",
    previous: previousState,
    cacheValueAvailable: sourceContext.cachedAssetExists,
    force: sourceContext.options.force,
    statsCollector: sourceContext.remoteCacheStats,
  });
  if (result.kind === "fetched") {
    handleFetchedAvatar(sourceContext, result);
    return;
  }
  if (handleRevalidatedAvatar(sourceContext, previousState, result)) return;
  handleFailedAvatar(sourceContext, result);
};

if (import.meta.main) {
  run().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Avatar sync failed unexpectedly: ${message}`);
    process.exit(1);
  });
}
