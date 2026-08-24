import type {
  RemoteCacheCheckStatus,
  RemoteCachePreviousState,
} from "../shared/remote-cache-fetch";

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

const trimToUndefined = (value: string | undefined): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const normalizeStableEntry = (
  entry: StableGeneratedContentImageEntry,
): StableGeneratedContentImageEntry => {
  const normalized: StableGeneratedContentImageEntry = {};
  if (trimToUndefined(entry.resolvedPath))
    normalized.resolvedPath = trimToUndefined(entry.resolvedPath);
  if (trimToUndefined(entry.updatedAt)) normalized.updatedAt = trimToUndefined(entry.updatedAt);
  if (trimToUndefined(entry.contentType))
    normalized.contentType = trimToUndefined(entry.contentType);
  if (typeof entry.bytes === "number" && Number.isFinite(entry.bytes) && entry.bytes >= 0)
    normalized.bytes = entry.bytes;
  return normalized;
};

export const normalizeRuntimeEntry = (
  entry: RuntimeGeneratedContentImageEntry,
): RuntimeGeneratedContentImageEntry => {
  const normalized: RuntimeGeneratedContentImageEntry = { sourceUrl: entry.sourceUrl };
  if (trimToUndefined(entry.etag)) normalized.etag = trimToUndefined(entry.etag);
  if (trimToUndefined(entry.lastModified))
    normalized.lastModified = trimToUndefined(entry.lastModified);
  if (trimToUndefined(entry.checkStatus))
    normalized.checkStatus = trimToUndefined(entry.checkStatus) as ContentImageSyncStatus;
  if (trimToUndefined(entry.cacheControl))
    normalized.cacheControl = trimToUndefined(entry.cacheControl);
  if (trimToUndefined(entry.expiresAt)) normalized.expiresAt = trimToUndefined(entry.expiresAt);
  if (trimToUndefined(entry.checkedAt)) normalized.checkedAt = trimToUndefined(entry.checkedAt);
  if (trimToUndefined(entry.warning)) normalized.warning = trimToUndefined(entry.warning);
  return normalized;
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
  return normalizeStableEntry(
    previousEntry && hasSameStablePayload(previousEntry, normalizedNext)
      ? { ...normalizedNext, updatedAt: previousEntry.updatedAt }
      : normalizedNext,
  );
};

export const areEntryMapsEqual = <TEntry>(
  left: Record<string, TEntry>,
  right: Record<string, TEntry>,
  normalize: (entry: TEntry) => TEntry,
): boolean => {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    JSON.stringify(leftKeys) === JSON.stringify(rightKeys) &&
    leftKeys.every(
      (key) =>
        JSON.stringify(normalize(left[key] as TEntry)) ===
        JSON.stringify(normalize(right[key] as TEntry)),
    )
  );
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

const maybeNormalizeSourceUrl = (value: string | undefined): string | undefined => {
  const maybeTrimmed = trimToUndefined(value);
  if (!maybeTrimmed) return undefined;

  if (!URL.canParse(maybeTrimmed)) return maybeTrimmed;

  const parsed = new URL(maybeTrimmed);
  return parsed.protocol === "http:" || parsed.protocol === "https:"
    ? parsed.toString()
    : maybeTrimmed;
};

export const createContentImagePreviousState = (
  currentSourceUrl: string,
  stableEntry: StableGeneratedContentImageEntry | undefined,
  runtimeEntry: RuntimeGeneratedContentImageEntry | undefined,
): RemoteCachePreviousState | undefined => {
  const maybeNormalizedCurrentSourceUrl = maybeNormalizeSourceUrl(currentSourceUrl);
  const maybeNormalizedPreviousSourceUrl = maybeNormalizeSourceUrl(runtimeEntry?.sourceUrl);
  const maybeMatchingRuntimeEntry =
    maybeNormalizedCurrentSourceUrl &&
    maybeNormalizedPreviousSourceUrl === maybeNormalizedCurrentSourceUrl
      ? runtimeEntry
      : undefined;

  if (!stableEntry && !maybeMatchingRuntimeEntry) return undefined;

  return {
    etag: maybeMatchingRuntimeEntry?.etag,
    lastModified: maybeMatchingRuntimeEntry?.lastModified,
    cacheControl: maybeMatchingRuntimeEntry?.cacheControl,
    expiresAt: maybeMatchingRuntimeEntry?.expiresAt,
    bytes: stableEntry?.bytes,
  };
};
