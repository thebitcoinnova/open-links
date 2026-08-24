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
  type PublicCacheMergeTargetId,
  type PublicCacheMetadata,
  PublicCachePersistenceAction,
  type PublicCachePersistenceResult,
  type PublicCacheRegistry,
  PublicCacheRuntimeEntry,
  type PublicCacheRuntimeRegistry,
  PublicCacheSkippedStableOperation,
  type PublicCacheStableEntry,
  PublicCacheStableRegistry,
  type ResolvedPublicCacheEntry,
} from "./public-cache-contracts";
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
  prunePublicCacheMetadataForTarget,
  readJsonFileOrThrow,
  sortEntries,
  splitRegistry,
  trimToUndefined,
  validateJsonWithSchema,
} from "./public-cache-registry";

export const writeJsonFile = (relativePath: string, payload: unknown): void => {
  const absolute = absolutePath(relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};

export const writeRuntimeRegistryFile = (
  runtimePath: string,
  runtime: PublicCacheRuntimeRegistry,
): void => {
  const absoluteRuntimePath = absolutePath(runtimePath);

  if (Object.keys(runtime.entries).length === 0) {
    if (fs.existsSync(absoluteRuntimePath)) {
      fs.rmSync(absoluteRuntimePath, { force: true });
    }
    return;
  }

  writeJsonFile(runtimePath, runtime);
};

export const toStableOnlyEntry = (entry: PublicCacheEntry): PublicCacheEntry =>
  normalizeStableEntry(normalizeEntry(entry));

export const writePublicCacheRegistry = (
  cachePath: string,
  registry: PublicCacheRegistry,
  options?: {
    runtimePath?: string;
  },
): void => {
  const runtimePath = options?.runtimePath ?? deriveRuntimePath(cachePath);
  const { stable, runtime } = splitRegistry(registry);

  writeJsonFile(cachePath, stable);
  writeRuntimeRegistryFile(runtimePath, runtime);
};

export const writePublicCacheRuntimeRegistry = (
  cachePath: string,
  registry: PublicCacheRegistry,
  options?: {
    runtimePath?: string;
  },
): void => {
  const runtimePath = options?.runtimePath ?? deriveRuntimePath(cachePath);
  const { runtime } = splitRegistry(registry);

  writeRuntimeRegistryFile(runtimePath, runtime);
};

export const parseMaxAgeSeconds = (cacheControl: string | undefined): number | undefined => {
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

export const toIso = (value: number): string => new Date(value).toISOString();

export const computePublicCacheExpiresAt = (
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

export const isPublicCacheFresh = (expiresAt: string | undefined): boolean => {
  if (!expiresAt) {
    return false;
  }

  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) {
    return false;
  }

  return expiresAtMs > Date.now();
};

export const resolvePublicCacheEntry = (
  registry: PublicCacheRegistry,
  cacheKey: string,
  expectedUrl: string,
): ResolvedPublicCacheEntry | null => {
  const entry = registry.entries[cacheKey];
  if (!entry) {
    return null;
  }

  if (!isPublicCacheIdentityMatch(entry, cacheKey, expectedUrl)) {
    return null;
  }

  return {
    cacheKey,
    entry,
    fresh: isPublicCacheFresh(entry.expiresAt),
  };
};

export const isPublicCacheIdentityMatch = (
  entry: Pick<PublicCacheStableEntry, "linkId" | "sourceUrl">,
  linkId: string,
  sourceUrl: string,
): boolean => entry.linkId === linkId.trim() && entry.sourceUrl === sourceUrl.trim();

export const hasCacheablePublicMetadata = (
  metadata: PublicCacheMetadata | EnrichmentMetadata,
): boolean => {
  if (typeof metadata.title === "string" && metadata.title.trim().length > 0) {
    return true;
  }
  if (typeof metadata.description === "string" && metadata.description.trim().length > 0) {
    return true;
  }
  if (typeof metadata.image === "string" && metadata.image.trim().length > 0) {
    return true;
  }

  for (const field of SOCIAL_PROFILE_METADATA_FIELDS) {
    const value = metadata[field];
    if (typeof value === "number" && Number.isFinite(value)) {
      return true;
    }
    if (typeof value === "string" && value.trim().length > 0) {
      return true;
    }
  }

  return false;
};

export const mergePublicCacheMetadataForTarget = (input: {
  targetId: PublicCacheMergeTargetId;
  previous?: PublicCacheMetadata;
  next: PublicCacheMetadata;
}): PublicCacheMetadata => {
  const next = normalizeMetadata(input.next);
  const preservesAudienceMetrics =
    input.targetId === "instagram-public-profile" ||
    input.targetId === "medium-public-feed" ||
    input.targetId === "primal-public-profile" ||
    input.targetId === "x-public-oembed" ||
    input.targetId === "x-public-community";

  if (!input.previous || !preservesAudienceMetrics) {
    return next;
  }

  const merged: PublicCacheMetadata = {
    ...next,
  };
  const mergedRecord = merged as Record<string, number | string | undefined>;
  const previousRecord = input.previous as Record<string, unknown>;
  const previousAudienceMetricsAreAuthoritative = input.targetId === "instagram-public-profile";
  const fieldsToPreserve =
    input.targetId === "x-public-oembed"
      ? ([
          "followersCount",
          "followersCountRaw",
          "followingCount",
          "followingCountRaw",
          "profileDescription",
        ] as const)
      : input.targetId === "x-public-community"
        ? (["membersCount", "membersCountRaw"] as const)
        : (["followersCount", "followersCountRaw", "followingCount", "followingCountRaw"] as const);

  for (const field of fieldsToPreserve) {
    if (!previousAudienceMetricsAreAuthoritative && hasDefinedMetadataValue(mergedRecord[field])) {
      continue;
    }

    const previousValue = previousRecord[field];
    if (typeof previousValue === "number" && Number.isFinite(previousValue)) {
      mergedRecord[field] = previousValue;
      continue;
    }

    if (typeof previousValue === "string" && previousValue.trim().length > 0) {
      mergedRecord[field] = previousValue.trim();
    }
  }

  return prunePublicCacheMetadataForTarget({
    targetId: input.targetId,
    metadata: merged,
    audienceMetricsAreAuthoritative: previousAudienceMetricsAreAuthoritative,
  });
};

export const arePublicCacheMetadataEqual = (
  left: PublicCacheMetadata | undefined,
  right: PublicCacheMetadata | undefined,
): boolean =>
  JSON.stringify(normalizeMetadata(left ?? {})) === JSON.stringify(normalizeMetadata(right ?? {}));

export const arePublicCacheEntriesEqual = (
  left: PublicCacheEntry | undefined,
  right: PublicCacheEntry | undefined,
): boolean => {
  if (!left || !right) {
    return left === right;
  }

  return JSON.stringify(normalizeEntry(left)) === JSON.stringify(normalizeEntry(right));
};

export const arePublicCacheStableEntriesEqual = (
  left: PublicCacheEntry | undefined,
  right: PublicCacheEntry | undefined,
): boolean => {
  if (!left || !right) {
    return left === right;
  }

  return JSON.stringify(normalizeStableEntry(left)) === JSON.stringify(normalizeStableEntry(right));
};

export const applyPublicCachePersistence = (input: {
  registry: PublicCacheRegistry;
  cacheKey: string;
  nextEntry?: PublicCacheEntry;
  allowStableWrite: boolean;
  updatedAt: string;
}): PublicCachePersistenceResult => {
  const existingEntry = input.registry.entries[input.cacheKey];

  if (input.nextEntry) {
    const nextEntry = normalizeEntry(input.nextEntry);
    const stableChanged = !arePublicCacheStableEntriesEqual(existingEntry, nextEntry);

    if (!stableChanged || input.allowStableWrite) {
      if (arePublicCacheEntriesEqual(existingEntry, nextEntry)) {
        return {
          action: "noop",
          changed: false,
          stableWriteSkipped: false,
        };
      }

      input.registry.entries[input.cacheKey] = nextEntry;
      input.registry.updatedAt = input.updatedAt;
      return {
        action: stableChanged ? "stable_updated" : "runtime_updated",
        changed: true,
        stableWriteSkipped: false,
      };
    }

    if (!existingEntry) {
      return {
        action: "noop",
        changed: false,
        stableWriteSkipped: true,
        skippedStableOperation: "upsert",
      };
    }

    const stableEntry = toStableOnlyEntry(existingEntry);
    if (arePublicCacheEntriesEqual(existingEntry, stableEntry)) {
      return {
        action: "noop",
        changed: false,
        stableWriteSkipped: true,
        skippedStableOperation: "upsert",
      };
    }

    input.registry.entries[input.cacheKey] = stableEntry;
    input.registry.updatedAt = input.updatedAt;
    return {
      action: "runtime_cleared",
      changed: true,
      stableWriteSkipped: true,
      skippedStableOperation: "upsert",
    };
  }

  if (!existingEntry) {
    return {
      action: "noop",
      changed: false,
      stableWriteSkipped: false,
    };
  }

  if (input.allowStableWrite) {
    delete input.registry.entries[input.cacheKey];
    input.registry.updatedAt = input.updatedAt;
    return {
      action: "stable_deleted",
      changed: true,
      stableWriteSkipped: false,
    };
  }

  const stableEntry = toStableOnlyEntry(existingEntry);
  if (arePublicCacheEntriesEqual(existingEntry, stableEntry)) {
    return {
      action: "noop",
      changed: false,
      stableWriteSkipped: true,
      skippedStableOperation: "delete",
    };
  }

  input.registry.entries[input.cacheKey] = stableEntry;
  input.registry.updatedAt = input.updatedAt;
  return {
    action: "runtime_cleared",
    changed: true,
    stableWriteSkipped: true,
    skippedStableOperation: "delete",
  };
};
