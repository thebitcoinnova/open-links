import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import type { AnySchema } from "ajv";
import addFormats from "ajv-formats";
import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import { SOCIAL_PROFILE_METADATA_FIELDS } from "../../src/lib/content/social-profile-fields";
import type { RemoteCacheCheckStatus } from "../shared/remote-cache-contracts";
import type { EnrichmentMetadata, EnrichmentMissingField, EnrichmentRunEntry } from "./types";

import {
  DEFAULT_PUBLIC_CACHE_PATH,
  DEFAULT_PUBLIC_CACHE_RUNTIME_PATH,
  DEFAULT_PUBLIC_CACHE_RUNTIME_SCHEMA_PATH,
  DEFAULT_PUBLIC_CACHE_SCHEMA_PATH,
  type PublicCacheEntry,
  PublicCacheMergeTargetId,
  type PublicCacheMetadata,
  PublicCachePersistenceAction,
  PublicCachePersistenceResult,
  PublicCacheRegistry,
  PublicCacheRuntimeEntry,
  PublicCacheRuntimeRegistry,
  PublicCacheSkippedStableOperation,
  PublicCacheStableEntry,
  PublicCacheStableRegistry,
  ResolvedPublicCacheEntry,
} from "./public-cache-contracts";
import {
  applyPublicCachePersistence,
  arePublicCacheEntriesEqual,
  arePublicCacheMetadataEqual,
  arePublicCacheStableEntriesEqual,
  computePublicCacheExpiresAt,
  hasCacheablePublicMetadata,
  isPublicCacheFresh,
  isPublicCacheIdentityMatch,
  mergePublicCacheMetadataForTarget,
  parseMaxAgeSeconds,
  resolvePublicCacheEntry,
  toIso,
  toStableOnlyEntry,
  writeJsonFile,
  writePublicCacheRegistry,
  writePublicCacheRuntimeRegistry,
  writeRuntimeRegistryFile,
} from "./public-cache-persistence";
import {
  ROOT,
  absolutePath,
  asRecord,
  createEmptyPublicCacheRegistry,
  deriveRegistryUpdatedAt,
  deriveRuntimePath,
  extractMetadataFromRaw,
  formatSchemaErrors,
  hasDefinedMetadataValue,
  hasRuntimeFields,
  loadPublicCacheRegistry,
  loadRuntimeRegistry,
  mergeRuntimeRegistries,
  mergeStableAndRuntimeRegistries,
  normalizeEntry,
  normalizeMetadata,
  normalizePath,
  normalizeRuntimeEntry,
  normalizeRuntimeRegistry,
  normalizeStableEntry,
  normalizeStableRegistry,
  parseStableRegistryFile,
  pickLatestIso,
  readJsonFileOrThrow,
  sortEntries,
  splitRegistry,
  trimToUndefined,
  validateJsonWithSchema,
} from "./public-cache-registry";

export const buildPublicCacheEntry = (input: {
  previous?: PublicCacheEntry;
  linkId: string;
  sourceUrl: string;
  metadata: PublicCacheMetadata;
  updatedAt: string;
  etag?: string;
  lastModified?: string;
  cacheControl?: string;
  expiresAt?: string;
  checkedAt?: string;
  checkStatus?: RemoteCacheCheckStatus;
}): PublicCacheEntry => {
  const previous =
    input.previous && isPublicCacheIdentityMatch(input.previous, input.linkId, input.sourceUrl)
      ? normalizeEntry(input.previous)
      : undefined;
  const nextMetadata = normalizeMetadata(input.metadata);
  const payloadChanged = !previous || !arePublicCacheMetadataEqual(previous.metadata, nextMetadata);

  const entry: PublicCacheEntry = {
    linkId: input.linkId.trim(),
    sourceUrl: input.sourceUrl.trim(),
    capturedAt: previous?.capturedAt ?? input.updatedAt,
    updatedAt: payloadChanged ? input.updatedAt : (previous?.updatedAt ?? input.updatedAt),
    metadata: nextMetadata,
  };

  const etag = trimToUndefined(input.etag) ?? trimToUndefined(previous?.etag);
  if (etag) {
    entry.etag = etag;
  }
  const lastModified =
    trimToUndefined(input.lastModified) ?? trimToUndefined(previous?.lastModified);
  if (lastModified) {
    entry.lastModified = lastModified;
  }
  const cacheControl =
    trimToUndefined(input.cacheControl) ?? trimToUndefined(previous?.cacheControl);
  if (cacheControl) {
    entry.cacheControl = cacheControl;
  }
  const expiresAt = trimToUndefined(input.expiresAt) ?? trimToUndefined(previous?.expiresAt);
  if (expiresAt) {
    entry.expiresAt = expiresAt;
  }

  const checkedAt = trimToUndefined(input.checkedAt) ?? trimToUndefined(previous?.checkedAt);
  if (checkedAt) {
    entry.checkedAt = checkedAt;
  }
  const checkStatus = trimToUndefined(input.checkStatus) ?? trimToUndefined(previous?.checkStatus);
  if (checkStatus) {
    entry.checkStatus = checkStatus as RemoteCacheCheckStatus;
  }

  return entry;
};

export const toPublicCacheMetadata = (metadata: EnrichmentMetadata): PublicCacheMetadata => {
  const cacheMetadata: PublicCacheMetadata = {};
  const cacheMetadataRecord = cacheMetadata as Record<string, number | string | undefined>;

  if (typeof metadata.title === "string" && metadata.title.trim().length > 0) {
    cacheMetadata.title = metadata.title.trim();
  }
  if (typeof metadata.description === "string" && metadata.description.trim().length > 0) {
    cacheMetadata.description = metadata.description.trim();
  }
  if (
    typeof metadata.profileDescription === "string" &&
    metadata.profileDescription.trim().length > 0
  ) {
    cacheMetadata.profileDescription = metadata.profileDescription.trim();
  }
  if (typeof metadata.image === "string" && metadata.image.trim().length > 0) {
    cacheMetadata.image = metadata.image.trim();
  }
  if (typeof metadata.ogImage === "string" && metadata.ogImage.trim().length > 0) {
    cacheMetadata.ogImage = metadata.ogImage.trim();
  }
  if (typeof metadata.twitterImage === "string" && metadata.twitterImage.trim().length > 0) {
    cacheMetadata.twitterImage = metadata.twitterImage.trim();
  }
  if (typeof metadata.handle === "string" && metadata.handle.trim().length > 0) {
    cacheMetadata.handle = metadata.handle.trim();
  }
  if (typeof metadata.sourceLabel === "string" && metadata.sourceLabel.trim().length > 0) {
    cacheMetadata.sourceLabel = metadata.sourceLabel.trim();
  }

  for (const field of SOCIAL_PROFILE_METADATA_FIELDS) {
    const value = metadata[field];
    if (typeof value === "number" && Number.isFinite(value)) {
      cacheMetadataRecord[field] = value;
      continue;
    }
    if (typeof value === "string" && value.trim().length > 0) {
      cacheMetadataRecord[field] = value.trim();
    }
  }

  return cacheMetadata;
};

export const toEnrichmentMetadataFromPublicCache = (
  metadata: PublicCacheMetadata,
): EnrichmentMetadata => ({ ...metadata });

export const resolveCachedMetadataMissingFields = (
  metadata: PublicCacheMetadata,
): EnrichmentMissingField[] => {
  const missing: EnrichmentMissingField[] = [];

  if (!metadata.title) {
    missing.push("title");
  }
  if (!metadata.description) {
    missing.push("description");
  }
  if (!metadata.image) {
    missing.push("image");
  }

  return missing;
};

export const resolveCachedEntryStatus = (
  metadata: PublicCacheMetadata,
): {
  status: EnrichmentRunEntry["status"];
  missingFields: EnrichmentMissingField[] | undefined;
} => {
  const missingFields = resolveCachedMetadataMissingFields(metadata);
  return {
    status: missingFields.length === 0 ? "fetched" : "partial",
    missingFields: missingFields.length > 0 ? missingFields : undefined,
  };
};

export const resolvePublicCacheMetadataRegression = (input: {
  previous?: PublicCacheEntry;
  linkId: string;
  sourceUrl: string;
  nextMetadata: PublicCacheMetadata;
}): PublicCacheEntry | null => {
  if (
    !input.previous ||
    !isPublicCacheIdentityMatch(input.previous, input.linkId, input.sourceUrl)
  ) {
    return null;
  }

  const previousStatus = resolveCachedEntryStatus(input.previous.metadata);
  const nextStatus = resolveCachedEntryStatus(input.nextMetadata);
  return previousStatus.status === "fetched" && nextStatus.status !== "fetched"
    ? input.previous
    : null;
};
