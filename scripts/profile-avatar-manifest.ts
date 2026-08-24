import type { RemoteCacheCheckStatus } from "./shared/remote-cache-fetch";

export type AvatarCheckStatus = RemoteCacheCheckStatus | "cache_on_error" | "fallback_on_error";

export interface ProfileAvatarManifest {
  sourceUrl: string;
  resolvedPath: string;
  updatedAt: string;
  etag?: string;
  lastModified?: string;
  contentType?: string;
  bytes?: number;
}

export interface ProfileAvatarRuntimeManifest {
  sourceUrl: string;
  checkStatus: AvatarCheckStatus;
  checkedAt: string;
  cacheControl?: string;
  expiresAt?: string;
  warning?: string;
}

const trimToUndefined = (value: string | undefined): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizePublicPath = (value: string): string => {
  const normalized = value
    .replaceAll("\\", "/")
    .replace(/^\.?\//, "")
    .replace(/^\/+/, "")
    .trim();
  return normalized.startsWith("public/") ? normalized.slice("public/".length) : normalized;
};

export const normalizeStableManifest = (manifest: ProfileAvatarManifest): ProfileAvatarManifest => {
  const normalized: ProfileAvatarManifest = {
    sourceUrl: manifest.sourceUrl.trim(),
    resolvedPath: normalizePublicPath(manifest.resolvedPath),
    updatedAt: manifest.updatedAt.trim(),
  };
  if (trimToUndefined(manifest.etag)) normalized.etag = trimToUndefined(manifest.etag);
  if (trimToUndefined(manifest.lastModified))
    normalized.lastModified = trimToUndefined(manifest.lastModified);
  if (trimToUndefined(manifest.contentType))
    normalized.contentType = trimToUndefined(manifest.contentType);
  if (typeof manifest.bytes === "number" && Number.isFinite(manifest.bytes) && manifest.bytes >= 0)
    normalized.bytes = manifest.bytes;
  return normalized;
};

export const normalizeRuntimeManifest = (
  manifest: ProfileAvatarRuntimeManifest,
): ProfileAvatarRuntimeManifest => {
  const normalized: ProfileAvatarRuntimeManifest = {
    sourceUrl: manifest.sourceUrl.trim(),
    checkStatus: manifest.checkStatus,
    checkedAt: manifest.checkedAt.trim(),
  };
  if (trimToUndefined(manifest.cacheControl))
    normalized.cacheControl = trimToUndefined(manifest.cacheControl);
  if (trimToUndefined(manifest.expiresAt))
    normalized.expiresAt = trimToUndefined(manifest.expiresAt);
  if (trimToUndefined(manifest.warning)) normalized.warning = trimToUndefined(manifest.warning);
  return normalized;
};

export const stabilizeProfileAvatarManifest = (
  previousManifest: ProfileAvatarManifest | null,
  nextManifest: ProfileAvatarManifest,
): ProfileAvatarManifest => {
  const hasSameStablePayload =
    previousManifest &&
    previousManifest.sourceUrl === nextManifest.sourceUrl &&
    normalizePublicPath(previousManifest.resolvedPath) ===
      normalizePublicPath(nextManifest.resolvedPath) &&
    previousManifest.etag === nextManifest.etag &&
    previousManifest.lastModified === nextManifest.lastModified &&
    previousManifest.contentType === nextManifest.contentType &&
    previousManifest.bytes === nextManifest.bytes;
  return normalizeStableManifest(
    hasSameStablePayload
      ? { ...nextManifest, updatedAt: previousManifest.updatedAt }
      : nextManifest,
  );
};
