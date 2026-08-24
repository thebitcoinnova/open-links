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
  PublicCachePersistenceResult,
  type PublicCacheRegistry,
  type PublicCacheRuntimeEntry,
  type PublicCacheRuntimeRegistry,
  PublicCacheSkippedStableOperation,
  type PublicCacheStableEntry,
  type PublicCacheStableRegistry,
  ResolvedPublicCacheEntry,
} from "./public-cache-contracts";

export const ROOT = process.cwd();

export const absolutePath = (value: string): string =>
  path.isAbsolute(value) ? value : path.join(ROOT, value);

export const deriveRuntimePath = (cachePath: string): string =>
  cachePath.endsWith(".json")
    ? `${cachePath.slice(0, -".json".length)}.runtime.json`
    : `${cachePath}.runtime.json`;

export const normalizePath = (instancePath: string): string => {
  if (!instancePath || instancePath === "/") {
    return "$";
  }
  return `$${instancePath.replaceAll("/", ".")}`;
};

export const formatSchemaErrors = (errors: ErrorObject[] | null | undefined): string => {
  if (!errors || errors.length === 0) {
    return "Unknown schema validation error.";
  }

  return errors
    .map((error) => `${normalizePath(error.instancePath)}: ${error.message ?? "validation issue"}`)
    .join("\n");
};

export const readJsonFileOrThrow = (relativePath: string): unknown => {
  const absolute = absolutePath(relativePath);

  if (!fs.existsSync(absolute)) {
    throw new Error(`Required file not found: ${relativePath}`);
  }

  try {
    return JSON.parse(fs.readFileSync(absolute, "utf8")) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in ${relativePath}: ${message}`);
  }
};

export const trimToUndefined = (value: string | undefined): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

export const sortEntries = <T>(entries: Record<string, T>): Record<string, T> =>
  Object.fromEntries(
    Object.entries(entries).sort(([left], [right]) => left.localeCompare(right)),
  ) as Record<string, T>;

export const hasDefinedMetadataValue = (value: unknown): boolean => {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return value !== undefined;
};

export const pickLatestIso = (
  current: string | undefined,
  candidate: string | undefined,
): string | undefined => {
  const currentIso = trimToUndefined(current);
  const candidateIso = trimToUndefined(candidate);

  if (!candidateIso) {
    return currentIso;
  }
  if (!currentIso) {
    return candidateIso;
  }

  const currentMs = Date.parse(currentIso);
  const candidateMs = Date.parse(candidateIso);
  if (!Number.isFinite(candidateMs)) {
    return currentIso;
  }
  if (!Number.isFinite(currentMs)) {
    return candidateIso;
  }

  return candidateMs > currentMs ? candidateIso : currentIso;
};

export const deriveRegistryUpdatedAt = (
  entries: Record<string, Pick<PublicCacheEntry, "updatedAt" | "checkedAt">>,
  fallback?: string,
): string => {
  let latest = trimToUndefined(fallback);

  for (const entry of Object.values(entries)) {
    latest = pickLatestIso(latest, entry.updatedAt);
    latest = pickLatestIso(latest, entry.checkedAt);
  }

  return latest ?? new Date().toISOString();
};

export const validateJsonWithSchema = (
  schemaPath: string,
  payload: unknown,
  failureLabel: string,
): void => {
  const schema = readJsonFileOrThrow(schemaPath) as AnySchema;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const validate = ajv.compile(schema);
  const valid = validate(payload);
  if (!valid) {
    throw new Error(
      [failureLabel, "Schema validation errors:", formatSchemaErrors(validate.errors)].join("\n"),
    );
  }
};

export const normalizeMetadata = (metadata: PublicCacheMetadata): PublicCacheMetadata => {
  const normalized: PublicCacheMetadata = {};
  const normalizedRecord = normalized as Record<string, number | string | undefined>;

  if (trimToUndefined(metadata.title)) normalized.title = trimToUndefined(metadata.title);
  if (trimToUndefined(metadata.description)) {
    normalized.description = trimToUndefined(metadata.description);
  }
  if (trimToUndefined(metadata.profileDescription)) {
    normalized.profileDescription = trimToUndefined(metadata.profileDescription);
  }
  if (trimToUndefined(metadata.image)) normalized.image = trimToUndefined(metadata.image);
  if (trimToUndefined(metadata.ogImage)) normalized.ogImage = trimToUndefined(metadata.ogImage);
  if (trimToUndefined(metadata.twitterImage)) {
    normalized.twitterImage = trimToUndefined(metadata.twitterImage);
  }
  if (trimToUndefined(metadata.handle)) normalized.handle = trimToUndefined(metadata.handle);
  if (trimToUndefined(metadata.sourceLabel)) {
    normalized.sourceLabel = trimToUndefined(metadata.sourceLabel);
  }

  for (const field of SOCIAL_PROFILE_METADATA_FIELDS) {
    const value = metadata[field];
    if (typeof value === "number" && Number.isFinite(value)) {
      normalizedRecord[field] = value;
      continue;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        normalizedRecord[field] = trimmed;
      }
    }
  }

  return normalized;
};

export const normalizeStableEntry = (entry: PublicCacheStableEntry): PublicCacheStableEntry => ({
  linkId: entry.linkId.trim(),
  sourceUrl: entry.sourceUrl.trim(),
  capturedAt: entry.capturedAt.trim(),
  updatedAt: entry.updatedAt.trim(),
  metadata: normalizeMetadata(entry.metadata),
  ...(trimToUndefined(entry.etag) ? { etag: trimToUndefined(entry.etag) } : {}),
  ...(trimToUndefined(entry.lastModified)
    ? { lastModified: trimToUndefined(entry.lastModified) }
    : {}),
});

export const normalizeRuntimeEntry = (entry: PublicCacheRuntimeEntry): PublicCacheRuntimeEntry => {
  const normalized: PublicCacheRuntimeEntry = {};

  if (trimToUndefined(entry.cacheControl)) {
    normalized.cacheControl = trimToUndefined(entry.cacheControl);
  }
  if (trimToUndefined(entry.expiresAt)) {
    normalized.expiresAt = trimToUndefined(entry.expiresAt);
  }
  if (trimToUndefined(entry.checkedAt)) {
    normalized.checkedAt = trimToUndefined(entry.checkedAt);
  }
  if (trimToUndefined(entry.checkStatus)) {
    normalized.checkStatus = trimToUndefined(entry.checkStatus) as RemoteCacheCheckStatus;
  }

  return normalized;
};

export const normalizeEntry = (entry: PublicCacheEntry): PublicCacheEntry => ({
  ...normalizeStableEntry(entry),
  ...normalizeRuntimeEntry(entry),
});

export const hasRuntimeFields = (entry: PublicCacheRuntimeEntry | undefined): boolean => {
  if (!entry) {
    return false;
  }

  return (
    trimToUndefined(entry.cacheControl) !== undefined ||
    trimToUndefined(entry.expiresAt) !== undefined ||
    trimToUndefined(entry.checkedAt) !== undefined ||
    trimToUndefined(entry.checkStatus) !== undefined
  );
};

export const normalizeStableRegistry = (
  raw: PublicCacheStableRegistry,
): PublicCacheStableRegistry => {
  const entries: Record<string, PublicCacheStableEntry> = {};

  for (const [cacheKey, entry] of Object.entries(raw.entries)) {
    entries[cacheKey.trim()] = normalizeStableEntry(entry);
  }

  return {
    version: 1,
    entries: sortEntries(entries),
  };
};

export const normalizeRuntimeRegistry = (
  raw: PublicCacheRuntimeRegistry,
): PublicCacheRuntimeRegistry => {
  const entries: Record<string, PublicCacheRuntimeEntry> = {};

  for (const [cacheKey, entry] of Object.entries(raw.entries)) {
    const normalizedEntry = normalizeRuntimeEntry(entry);
    if (hasRuntimeFields(normalizedEntry)) {
      entries[cacheKey.trim()] = normalizedEntry;
    }
  }

  const sortedEntries = sortEntries(entries);

  return {
    version: 1,
    updatedAt: deriveRegistryUpdatedAt(
      Object.fromEntries(
        Object.entries(sortedEntries).map(([cacheKey, entry]) => [
          cacheKey,
          {
            updatedAt: raw.updatedAt.trim(),
            checkedAt: entry.checkedAt,
          },
        ]),
      ) as Record<string, Pick<PublicCacheEntry, "updatedAt" | "checkedAt">>,
      raw.updatedAt,
    ),
    entries: sortedEntries,
  };
};

export const mergeStableAndRuntimeRegistries = (
  stable: PublicCacheStableRegistry,
  runtime: PublicCacheRuntimeRegistry,
): PublicCacheRegistry => {
  const entries: Record<string, PublicCacheEntry> = {};

  for (const [cacheKey, stableEntry] of Object.entries(stable.entries)) {
    entries[cacheKey] = normalizeEntry({
      ...stableEntry,
      ...(runtime.entries[cacheKey] ?? {}),
    });
  }

  return {
    version: 1,
    updatedAt: deriveRegistryUpdatedAt(entries, runtime.updatedAt),
    entries: sortEntries(entries),
  };
};

export const splitRegistry = (
  registry: PublicCacheRegistry,
): {
  stable: PublicCacheStableRegistry;
  runtime: PublicCacheRuntimeRegistry;
} => {
  const stableEntries: Record<string, PublicCacheStableEntry> = {};
  const runtimeEntries: Record<string, PublicCacheRuntimeEntry> = {};

  for (const [cacheKey, entry] of Object.entries(registry.entries)) {
    const normalizedEntry = normalizeEntry(entry);
    stableEntries[cacheKey.trim()] = normalizeStableEntry(normalizedEntry);

    const runtimeEntry = normalizeRuntimeEntry(normalizedEntry);
    if (hasRuntimeFields(runtimeEntry)) {
      runtimeEntries[cacheKey.trim()] = runtimeEntry;
    }
  }

  return {
    stable: normalizeStableRegistry({
      version: 1,
      entries: stableEntries,
    }),
    runtime: normalizeRuntimeRegistry({
      version: 1,
      updatedAt: deriveRegistryUpdatedAt(registry.entries, registry.updatedAt),
      entries: runtimeEntries,
    }),
  };
};

export const extractMetadataFromRaw = (raw: unknown): PublicCacheMetadata => {
  const metadataRecord = asRecord(raw);
  if (!metadataRecord) {
    return {};
  }

  const metadata: PublicCacheMetadata = {};
  const metadataOutput = metadata as Record<string, number | string | undefined>;

  const maybeTitle = metadataRecord.title;
  if (typeof maybeTitle === "string") {
    metadata.title = maybeTitle;
  }
  const maybeDescription = metadataRecord.description;
  if (typeof maybeDescription === "string") {
    metadata.description = maybeDescription;
  }
  const maybeProfileDescription = metadataRecord.profileDescription;
  if (typeof maybeProfileDescription === "string") {
    metadata.profileDescription = maybeProfileDescription;
  }
  const maybeImage = metadataRecord.image;
  if (typeof maybeImage === "string") {
    metadata.image = maybeImage;
  }
  const maybeOgImage = metadataRecord.ogImage;
  if (typeof maybeOgImage === "string") {
    metadata.ogImage = maybeOgImage;
  }
  const maybeTwitterImage = metadataRecord.twitterImage;
  if (typeof maybeTwitterImage === "string") {
    metadata.twitterImage = maybeTwitterImage;
  }
  const maybeHandle = metadataRecord.handle;
  if (typeof maybeHandle === "string") {
    metadata.handle = maybeHandle;
  }
  const maybeSourceLabel = metadataRecord.sourceLabel;
  if (typeof maybeSourceLabel === "string") {
    metadata.sourceLabel = maybeSourceLabel;
  }

  for (const field of SOCIAL_PROFILE_METADATA_FIELDS) {
    const value = metadataRecord[field];
    if (typeof value === "number" && Number.isFinite(value)) {
      metadataOutput[field] = value;
      continue;
    }
    if (typeof value === "string") {
      metadataOutput[field] = value;
    }
  }

  return metadata;
};

export const parseStableRegistryFile = (
  cachePath: string,
  schemaPath: string,
  runtimeSchemaPath: string,
): {
  stable: PublicCacheStableRegistry;
  legacyRuntime: PublicCacheRuntimeRegistry;
} => {
  const absoluteCachePath = absolutePath(cachePath);

  if (!fs.existsSync(absoluteCachePath)) {
    return {
      stable: {
        version: 1,
        entries: {},
      },
      legacyRuntime: {
        version: 1,
        updatedAt: new Date().toISOString(),
        entries: {},
      },
    };
  }

  const raw = readJsonFileOrThrow(cachePath);
  const rawRegistry = asRecord(raw);
  if (!rawRegistry) {
    throw new Error(`Invalid public cache registry at ${cachePath}: expected an object root.`);
  }

  if (rawRegistry.version !== 1) {
    throw new Error(`Invalid public cache registry at ${cachePath}: expected version=1.`);
  }

  const rawEntries = asRecord(rawRegistry.entries);
  if (!rawEntries) {
    throw new Error(
      `Invalid public cache registry at ${cachePath}: expected an object at $.entries.`,
    );
  }

  const legacyUpdatedAt =
    typeof rawRegistry.updatedAt === "string" ? trimToUndefined(rawRegistry.updatedAt) : undefined;
  const stableEntries: Record<string, PublicCacheStableEntry> = {};
  const legacyRuntimeEntries: Record<string, PublicCacheRuntimeEntry> = {};

  for (const [cacheKey, rawEntryValue] of Object.entries(rawEntries)) {
    const rawEntry = asRecord(rawEntryValue);
    if (!rawEntry) {
      throw new Error(
        `Invalid public cache registry at ${cachePath}: expected an object at $.entries.${cacheKey}.`,
      );
    }

    stableEntries[cacheKey.trim()] = {
      linkId: typeof rawEntry.linkId === "string" ? rawEntry.linkId : "",
      sourceUrl: typeof rawEntry.sourceUrl === "string" ? rawEntry.sourceUrl : "",
      capturedAt: typeof rawEntry.capturedAt === "string" ? rawEntry.capturedAt : "",
      updatedAt: typeof rawEntry.updatedAt === "string" ? rawEntry.updatedAt : "",
      metadata: extractMetadataFromRaw(rawEntry.metadata),
      etag: typeof rawEntry.etag === "string" ? rawEntry.etag : undefined,
      lastModified: typeof rawEntry.lastModified === "string" ? rawEntry.lastModified : undefined,
    };

    const runtimeEntry = normalizeRuntimeEntry({
      cacheControl: typeof rawEntry.cacheControl === "string" ? rawEntry.cacheControl : undefined,
      expiresAt: typeof rawEntry.expiresAt === "string" ? rawEntry.expiresAt : undefined,
      checkedAt:
        typeof rawEntry.checkedAt === "string"
          ? rawEntry.checkedAt
          : (legacyUpdatedAt ??
            (typeof rawEntry.updatedAt === "string" ? rawEntry.updatedAt : undefined)),
      checkStatus:
        typeof rawEntry.checkStatus === "string"
          ? (rawEntry.checkStatus as RemoteCacheCheckStatus)
          : undefined,
    });

    if (hasRuntimeFields(runtimeEntry)) {
      legacyRuntimeEntries[cacheKey.trim()] = runtimeEntry;
    }
  }

  const stable = normalizeStableRegistry({
    version: 1,
    entries: stableEntries,
  });
  const legacyRuntime = normalizeRuntimeRegistry({
    version: 1,
    updatedAt: legacyUpdatedAt ?? deriveRegistryUpdatedAt(stable.entries),
    entries: legacyRuntimeEntries,
  });

  validateJsonWithSchema(schemaPath, stable, `Invalid public cache registry at ${cachePath}.`);
  validateJsonWithSchema(
    runtimeSchemaPath,
    legacyRuntime,
    `Invalid public cache runtime registry derived from ${cachePath}.`,
  );

  return {
    stable,
    legacyRuntime,
  };
};

export const loadRuntimeRegistry = (
  runtimePath: string,
  runtimeSchemaPath: string,
): PublicCacheRuntimeRegistry => {
  const absoluteRuntimePath = absolutePath(runtimePath);

  if (!fs.existsSync(absoluteRuntimePath)) {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      entries: {},
    };
  }

  const runtime = readJsonFileOrThrow(runtimePath);
  validateJsonWithSchema(
    runtimeSchemaPath,
    runtime,
    `Invalid public cache runtime registry at ${runtimePath}.`,
  );

  return normalizeRuntimeRegistry(runtime as PublicCacheRuntimeRegistry);
};

export const mergeRuntimeRegistries = (
  base: PublicCacheRuntimeRegistry,
  overlay: PublicCacheRuntimeRegistry,
): PublicCacheRuntimeRegistry => {
  const entries: Record<string, PublicCacheRuntimeEntry> = {};
  const cacheKeys = new Set([...Object.keys(base.entries), ...Object.keys(overlay.entries)]);

  for (const cacheKey of cacheKeys) {
    const entry = normalizeRuntimeEntry({
      ...(base.entries[cacheKey] ?? {}),
      ...(overlay.entries[cacheKey] ?? {}),
    });

    if (hasRuntimeFields(entry)) {
      entries[cacheKey] = entry;
    }
  }

  return normalizeRuntimeRegistry({
    version: 1,
    updatedAt: pickLatestIso(base.updatedAt, overlay.updatedAt) ?? new Date().toISOString(),
    entries,
  });
};

export const createEmptyPublicCacheRegistry = (
  updatedAt = new Date().toISOString(),
): PublicCacheRegistry => ({
  version: 1,
  updatedAt,
  entries: {},
});

export const loadPublicCacheRegistry = (options?: {
  cachePath?: string;
  schemaPath?: string;
  runtimePath?: string;
  runtimeSchemaPath?: string;
}): PublicCacheRegistry => {
  const cachePath = options?.cachePath ?? DEFAULT_PUBLIC_CACHE_PATH;
  const schemaPath = options?.schemaPath ?? DEFAULT_PUBLIC_CACHE_SCHEMA_PATH;
  const runtimePath = options?.runtimePath ?? deriveRuntimePath(cachePath);
  const runtimeSchemaPath =
    options?.runtimeSchemaPath ??
    (cachePath === DEFAULT_PUBLIC_CACHE_PATH
      ? DEFAULT_PUBLIC_CACHE_RUNTIME_SCHEMA_PATH
      : DEFAULT_PUBLIC_CACHE_RUNTIME_SCHEMA_PATH);

  const { stable, legacyRuntime } = parseStableRegistryFile(
    cachePath,
    schemaPath,
    runtimeSchemaPath,
  );
  const runtimeFromDisk = loadRuntimeRegistry(runtimePath, runtimeSchemaPath);
  const runtime = mergeRuntimeRegistries(legacyRuntime, runtimeFromDisk);

  return mergeStableAndRuntimeRegistries(stable, runtime);
};

export const INSTAGRAM_AUDIENCE_DESCRIPTION_PATTERN =
  /\b(?:\d[\d.,]*|\d+(?:\.\d+)?[KMBkmb])\s+followers?,\s*(?:\d[\d.,]*|\d+(?:\.\d+)?[KMBkmb])\s+following\b/i;

export const prunePublicCacheMetadataForTarget = (input: {
  targetId: PublicCacheMergeTargetId;
  metadata: PublicCacheMetadata;
  audienceMetricsAreAuthoritative?: boolean;
}): PublicCacheMetadata => {
  const metadata = normalizeMetadata(input.metadata);

  if (input.targetId === "x-public-oembed") {
    const {
      membersCount: _membersCount,
      membersCountRaw: _membersCountRaw,
      subscribersCount: _subscribersCount,
      subscribersCountRaw: _subscribersCountRaw,
      ...xProfileMetadata
    } = metadata;
    return xProfileMetadata;
  }

  if (
    input.targetId !== "instagram-public-profile" ||
    !input.audienceMetricsAreAuthoritative ||
    typeof metadata.description !== "string" ||
    !INSTAGRAM_AUDIENCE_DESCRIPTION_PATTERN.test(metadata.description)
  ) {
    return metadata;
  }

  const metadataWithoutStaleDescription = { ...metadata };
  metadataWithoutStaleDescription.description = undefined;
  return metadataWithoutStaleDescription;
};
