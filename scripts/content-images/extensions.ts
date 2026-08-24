import path from "node:path";

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
const maybeExtensionFromPath = (value: string): string | undefined => {
  const raw = path.posix.extname(value).replace(".", "").toLowerCase();
  if (!raw) return undefined;
  const normalized = raw === "jpeg" ? "jpg" : raw;
  return KNOWN_IMAGE_EXTENSIONS.has(normalized) ? normalized : undefined;
};
export const resolveContentImageExtension = (
  contentType: string | undefined,
  sourceUrl: string,
  previousResolvedPath: string | undefined,
): string => {
  const fromContentType = contentType
    ? CONTENT_TYPE_EXTENSION_MAP.get(contentType.split(";")[0]?.trim().toLowerCase() ?? "")
    : undefined;
  let fromUrl: string | undefined;
  try {
    fromUrl = maybeExtensionFromPath(new URL(sourceUrl).pathname);
  } catch {
    fromUrl = undefined;
  }
  return (
    fromContentType ??
    fromUrl ??
    (previousResolvedPath ? maybeExtensionFromPath(previousResolvedPath) : undefined) ??
    "jpg"
  );
};
