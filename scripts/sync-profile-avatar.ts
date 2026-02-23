import fs from "node:fs";
import path from "node:path";
import process from "node:process";

type AvatarSyncStatus =
  | "fetched"
  | "not_modified"
  | "cache_fresh"
  | "cache_on_error"
  | "fallback_on_error";

interface ProfilePayload {
  avatar?: unknown;
}

interface ProfileAvatarManifest {
  sourceUrl: string;
  resolvedPath: string;
  status: AvatarSyncStatus;
  etag?: string;
  lastModified?: string;
  cacheControl?: string;
  expiresAt?: string;
  updatedAt: string;
  warning?: string;
}

interface AvatarSyncOptions {
  profilePath: string;
  manifestPath: string;
  outputDir: string;
  fallbackPath: string;
  force: boolean;
}

const ROOT = process.cwd();
const GENERATED_BASENAME = "profile-avatar";
const DEFAULT_PROFILE_PATH = "data/profile.json";
const DEFAULT_MANIFEST_PATH = "data/generated/profile-avatar.json";
const DEFAULT_OUTPUT_DIR = "public/generated";
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
  ["image/webp", "webp"]
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
  "webp"
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
  input.replaceAll("\\", "/").replace(/^\.?\//, "").replace(/^\/+/, "").trim();

const parseArgs = (): AvatarSyncOptions => {
  const args = process.argv.slice(2);

  const valueOf = (name: string, fallback: string): string => {
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
    profilePath: valueOf("--profile", DEFAULT_PROFILE_PATH),
    manifestPath: valueOf("--manifest", DEFAULT_MANIFEST_PATH),
    outputDir: valueOf("--output-dir", DEFAULT_OUTPUT_DIR),
    fallbackPath: normalizeRelativePath(valueOf("--fallback", DEFAULT_FALLBACK_PATH)),
    force: args.includes("--force") || isTruthy(process.env[FORCE_ENV])
  };
};

const absolutePath = (relativePath: string): string =>
  path.isAbsolute(relativePath) ? relativePath : path.join(ROOT, relativePath);

const readJson = <T>(relativePath: string): T => {
  const absolute = absolutePath(relativePath);
  return JSON.parse(fs.readFileSync(absolute, "utf8")) as T;
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

const readManifest = (manifestPath: string): ProfileAvatarManifest | null => {
  const absolute = absolutePath(manifestPath);
  if (!fs.existsSync(absolute)) {
    return null;
  }

  try {
    const payload = JSON.parse(fs.readFileSync(absolute, "utf8")) as unknown;
    if (!isRecord(payload)) {
      return null;
    }

    const sourceUrl = typeof payload.sourceUrl === "string" ? payload.sourceUrl : "";
    const resolvedPath = typeof payload.resolvedPath === "string" ? payload.resolvedPath : "";
    const status = typeof payload.status === "string" ? payload.status : "fallback_on_error";
    const updatedAt = typeof payload.updatedAt === "string" ? payload.updatedAt : "";

    if (!sourceUrl || !resolvedPath || !updatedAt) {
      return null;
    }

    const manifest: ProfileAvatarManifest = {
      sourceUrl,
      resolvedPath,
      status: ([
        "fetched",
        "not_modified",
        "cache_fresh",
        "cache_on_error",
        "fallback_on_error"
      ] as const).includes(status as AvatarSyncStatus)
        ? (status as AvatarSyncStatus)
        : "fallback_on_error",
      updatedAt
    };

    if (typeof payload.etag === "string" && payload.etag.trim().length > 0) {
      manifest.etag = payload.etag;
    }
    if (typeof payload.lastModified === "string" && payload.lastModified.trim().length > 0) {
      manifest.lastModified = payload.lastModified;
    }
    if (typeof payload.cacheControl === "string" && payload.cacheControl.trim().length > 0) {
      manifest.cacheControl = payload.cacheControl;
    }
    if (typeof payload.expiresAt === "string" && payload.expiresAt.trim().length > 0) {
      manifest.expiresAt = payload.expiresAt;
    }
    if (typeof payload.warning === "string" && payload.warning.trim().length > 0) {
      manifest.warning = payload.warning;
    }

    return manifest;
  } catch {
    return null;
  }
};

const writeManifest = (manifestPath: string, manifest: ProfileAvatarManifest) => {
  const absolute = absolutePath(manifestPath);
  ensureDirectoryForFile(absolute);
  fs.writeFileSync(absolute, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
};

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

const computeExpiresAt = (cacheControl: string | undefined, dateHeader: string | undefined): string | undefined => {
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
  previousResolvedPath: string | undefined
): string =>
  extensionFromContentType(contentType) ??
  extensionFromUrl(sourceUrl) ??
  extensionFromResolvedPath(previousResolvedPath) ??
  "jpg";

const resolvedPathFromOutputDir = (outputDir: string, fileName: string): string => {
  const normalized = normalizeRelativePath(outputDir).replace(/\/+$/, "");
  const relativeToPublic = normalized.startsWith("public/") ? normalized.slice("public/".length) : normalized;
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

const buildManifest = (
  base: Pick<ProfileAvatarManifest, "sourceUrl" | "resolvedPath" | "status">,
  detail: {
    etag?: string;
    lastModified?: string;
    cacheControl?: string;
    expiresAt?: string;
    warning?: string;
  }
): ProfileAvatarManifest => {
  const manifest: ProfileAvatarManifest = {
    sourceUrl: base.sourceUrl,
    resolvedPath: normalizePublicPath(base.resolvedPath),
    status: base.status,
    updatedAt: new Date().toISOString()
  };

  if (detail.etag) {
    manifest.etag = detail.etag;
  }
  if (detail.lastModified) {
    manifest.lastModified = detail.lastModified;
  }
  if (detail.cacheControl) {
    manifest.cacheControl = detail.cacheControl;
  }
  if (detail.expiresAt) {
    manifest.expiresAt = detail.expiresAt;
  }
  if (detail.warning) {
    manifest.warning = detail.warning;
  }

  return manifest;
};

const logWarning = (message: string) => {
  console.warn(`WARNING [avatar:sync] ${message}`);
};

const run = async () => {
  const options = parseArgs();
  const profile = readJson<ProfilePayload>(options.profilePath);
  const sourceUrlRaw = typeof profile.avatar === "string" ? profile.avatar.trim() : "";
  const sourceUrl = ensureHttpUrl(sourceUrlRaw);
  const manifest = readManifest(options.manifestPath);

  const sourceMatchesCache = !!sourceUrl && manifest?.sourceUrl === sourceUrl;
  const cachedAssetExists =
    sourceMatchesCache && !!manifest && fs.existsSync(resolveManifestAssetAbsolutePath(manifest.resolvedPath));

  const fallbackResolvedPath = normalizePublicPath(options.fallbackPath || DEFAULT_FALLBACK_PATH);
  const fallbackAbsolutePath = resolveManifestAssetAbsolutePath(fallbackResolvedPath);
  const fallbackExists = fs.existsSync(fallbackAbsolutePath);
  const shouldForce = options.force;

  if (!sourceUrl) {
    const warning = sourceUrlRaw
      ? `Avatar URL '${sourceUrlRaw}' is invalid or unsupported (http/https required); using fallback asset '${fallbackResolvedPath}'.`
      : `Avatar URL is missing; using fallback asset '${fallbackResolvedPath}'.`;

    logWarning(warning);
    writeManifest(
      options.manifestPath,
      buildManifest(
        {
          sourceUrl: sourceUrlRaw,
          resolvedPath: fallbackResolvedPath,
          status: "fallback_on_error"
        },
        {
          warning: fallbackExists
            ? warning
            : `${warning} Fallback file is missing at '${fallbackAbsolutePath}'.`
        }
      )
    );
    return;
  }

  if (sourceMatchesCache && cachedAssetExists && !shouldForce && isFresh(manifest.expiresAt)) {
    writeManifest(
      options.manifestPath,
      buildManifest(
        {
          sourceUrl,
          resolvedPath: manifest.resolvedPath,
          status: "cache_fresh"
        },
        {
          etag: manifest.etag,
          lastModified: manifest.lastModified,
          cacheControl: manifest.cacheControl,
          expiresAt: manifest.expiresAt
        }
      )
    );
    console.log(
      `OpenLinks avatar sync: cache is fresh; using '${normalizePublicPath(manifest.resolvedPath)}' without network fetch.`
    );
    return;
  }

  const requestHeaders: Record<string, string> = {
    "user-agent": "open-links-avatar-sync/0.1",
    accept: "image/*,*/*;q=0.8"
  };

  if (!shouldForce && sourceMatchesCache && manifest) {
    if (manifest.etag) {
      requestHeaders["if-none-match"] = manifest.etag;
    }
    if (manifest.lastModified) {
      requestHeaders["if-modified-since"] = manifest.lastModified;
    }
  }

  const fallbackOrCachedManifest = (reason: string) => {
    if (sourceMatchesCache && cachedAssetExists && manifest) {
      const warning = `Avatar fetch failed (${reason}). Reusing cached avatar '${normalizePublicPath(manifest.resolvedPath)}'.`;
      logWarning(warning);
      writeManifest(
        options.manifestPath,
        buildManifest(
          {
            sourceUrl,
            resolvedPath: manifest.resolvedPath,
            status: "cache_on_error"
          },
          {
            etag: manifest.etag,
            lastModified: manifest.lastModified,
            cacheControl: manifest.cacheControl,
            expiresAt: manifest.expiresAt,
            warning
          }
        )
      );
      return;
    }

    const warning = `Avatar fetch failed (${reason}). Using fallback asset '${fallbackResolvedPath}'.`;
    logWarning(warning);
    writeManifest(
      options.manifestPath,
      buildManifest(
        {
          sourceUrl,
          resolvedPath: fallbackResolvedPath,
          status: "fallback_on_error"
        },
        {
          warning: fallbackExists
            ? warning
            : `${warning} Fallback file is missing at '${fallbackAbsolutePath}'.`
        }
      )
    );
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(sourceUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: requestHeaders
    });

    if (response.status === 304) {
      if (!sourceMatchesCache || !cachedAssetExists || !manifest) {
        fallbackOrCachedManifest("received HTTP 304 but no cached avatar is available");
        return;
      }

      const cacheControl = response.headers.get("cache-control") ?? manifest.cacheControl;
      const expiresAt =
        computeExpiresAt(cacheControl ?? undefined, response.headers.get("date") ?? undefined) ??
        manifest.expiresAt;
      const etag = response.headers.get("etag") ?? manifest.etag;
      const lastModified = response.headers.get("last-modified") ?? manifest.lastModified;

      writeManifest(
        options.manifestPath,
        buildManifest(
          {
            sourceUrl,
            resolvedPath: manifest.resolvedPath,
            status: "not_modified"
          },
          {
            etag: etag ?? undefined,
            lastModified: lastModified ?? undefined,
            cacheControl: cacheControl ?? undefined,
            expiresAt
          }
        )
      );

      console.log(
        `OpenLinks avatar sync: remote avatar not modified; using cached '${normalizePublicPath(manifest.resolvedPath)}'.`
      );
      return;
    }

    if (!response.ok) {
      fallbackOrCachedManifest(`received HTTP ${response.status}`);
      return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength === 0) {
      fallbackOrCachedManifest("response body was empty");
      return;
    }

    const extension = resolveExtension(response.headers.get("content-type"), sourceUrl, manifest?.resolvedPath);
    const fileName = `${GENERATED_BASENAME}.${extension}`;
    const absoluteOutputDir = absolutePath(options.outputDir);
    const absoluteOutputFile = path.join(absoluteOutputDir, fileName);
    const resolvedPath = resolvedPathFromOutputDir(options.outputDir, fileName);

    fs.mkdirSync(absoluteOutputDir, { recursive: true });
    fs.writeFileSync(absoluteOutputFile, buffer);
    cleanGeneratedVariants(options.outputDir, fileName);

    const cacheControl = response.headers.get("cache-control") ?? undefined;
    const expiresAt = computeExpiresAt(cacheControl, response.headers.get("date") ?? undefined);
    const etag = response.headers.get("etag") ?? undefined;
    const lastModified = response.headers.get("last-modified") ?? undefined;

    writeManifest(
      options.manifestPath,
      buildManifest(
        {
          sourceUrl,
          resolvedPath,
          status: "fetched"
        },
        {
          etag,
          lastModified,
          cacheControl,
          expiresAt
        }
      )
    );

    console.log(`OpenLinks avatar sync: fetched avatar -> '${normalizePublicPath(resolvedPath)}'.`);
    if (shouldForce) {
      console.log("OpenLinks avatar sync: force refresh was enabled.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fallbackOrCachedManifest(message);
  } finally {
    clearTimeout(timeout);
  }
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Avatar sync failed unexpectedly: ${message}`);
  process.exit(1);
});
