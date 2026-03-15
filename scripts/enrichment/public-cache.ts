import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import type { AnySchema } from "ajv";
import addFormats from "ajv-formats";
import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import { SOCIAL_PROFILE_METADATA_FIELDS } from "../../src/lib/content/social-profile-fields";
import type { RemoteCacheCheckStatus } from "../shared/remote-cache-fetch";
import type { EnrichmentMetadata, EnrichmentMissingField, EnrichmentRunEntry } from "./types";

const ROOT = process.cwd();

export const DEFAULT_PUBLIC_CACHE_PATH = "data/cache/rich-public-cache.json";
export const DEFAULT_PUBLIC_CACHE_SCHEMA_PATH = "schema/rich-public-cache.schema.json";
export const DEFAULT_PUBLIC_CACHE_RUNTIME_PATH = "data/cache/rich-public-cache.runtime.json";
export const DEFAULT_PUBLIC_CACHE_RUNTIME_SCHEMA_PATH =
  "schema/rich-public-cache.runtime.schema.json";

export interface PublicCacheMetadata {
  title?: string;
  description?: string;
  profileDescription?: string;
  image?: string;
  ogImage?: string;
  twitterImage?: string;
  profileImage?: string;
  handle?: string;
  followersCount?: number;
  followersCountRaw?: string;
  followingCount?: number;
  followingCountRaw?: string;
  subscribersCount?: number;
  subscribersCountRaw?: string;
  sourceLabel?: string;
}

export interface PublicCacheStableEntry {
  linkId: string;
  sourceUrl: string;
  capturedAt: string;
  updatedAt: string;
  metadata: PublicCacheMetadata;
  etag?: string;
  lastModified?: string;
}

export interface PublicCacheRuntimeEntry {
  cacheControl?: string;
  expiresAt?: string;
  checkedAt?: string;
  checkStatus?: RemoteCacheCheckStatus;
}

export interface PublicCacheEntry extends PublicCacheStableEntry, PublicCacheRuntimeEntry {}

export interface PublicCacheStableRegistry {
  version: 1;
  entries: Record<string, PublicCacheStableEntry>;
}

export interface PublicCacheRuntimeRegistry {
  version: 1;
  updatedAt: string;
  entries: Record<string, PublicCacheRuntimeEntry>;
}

export interface PublicCacheRegistry {
  version: 1;
  updatedAt: string;
  entries: Record<string, PublicCacheEntry>;
}

export type PublicCacheMergeTargetId = string | null;
export type PublicCacheSkippedStableOperation = "upsert" | "delete";
export type PublicCachePersistenceAction =
  | "noop"
  | "runtime_updated"
  | "runtime_cleared"
  | "stable_updated"
  | "stable_deleted";

export interface PublicCachePersistenceResult {
  action: PublicCachePersistenceAction;
  changed: boolean;
  stableWriteSkipped: boolean;
  skippedStableOperation?: PublicCacheSkippedStableOperation;
}

export interface ResolvedPublicCacheEntry {
  cacheKey: string;
  entry: PublicCacheEntry;
  fresh: boolean;
}

const absolutePath = (value: string): string =>
  path.isAbsolute(value) ? value : path.join(ROOT, value);

const deriveRuntimePath = (cachePath: string): string =>
  cachePath.endsWith(".json")
    ? `${cachePath.slice(0, -".json".length)}.runtime.json`
    : `${cachePath}.runtime.json`;

const normalizePath = (instancePath: string): string => {
  if (!instancePath || instancePath === "/") {
    return "$";
  }
  return `$${instancePath.replaceAll("/", ".")}`;
};

const formatSchemaErrors = (errors: ErrorObject[] | null | undefined): string => {
  if (!errors || errors.length === 0) {
    return "Unknown schema validation error.";
  }

  return errors
    .map((error) => `${normalizePath(error.instancePath)}: ${error.message ?? "validation issue"}`)
    .join("\n");
};

const readJsonFileOrThrow = (relativePath: string): unknown => {
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

const trimToUndefined = (value: string | undefined): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const sortEntries = <T>(entries: Record<string, T>): Record<string, T> =>
  Object.fromEntries(
    Object.entries(entries).sort(([left], [right]) => left.localeCompare(right)),
  ) as Record<string, T>;

const hasDefinedMetadataValue = (value: unknown): boolean => {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return value !== undefined;
};

const pickLatestIso = (
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

const deriveRegistryUpdatedAt = (
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

const validateJsonWithSchema = (
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

const normalizeMetadata = (metadata: PublicCacheMetadata): PublicCacheMetadata => {
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

const normalizeStableEntry = (entry: PublicCacheStableEntry): PublicCacheStableEntry => ({
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

const normalizeRuntimeEntry = (entry: PublicCacheRuntimeEntry): PublicCacheRuntimeEntry => {
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

const normalizeEntry = (entry: PublicCacheEntry): PublicCacheEntry => ({
  ...normalizeStableEntry(entry),
  ...normalizeRuntimeEntry(entry),
});

const hasRuntimeFields = (entry: PublicCacheRuntimeEntry | undefined): boolean => {
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

const normalizeStableRegistry = (raw: PublicCacheStableRegistry): PublicCacheStableRegistry => {
  const entries: Record<string, PublicCacheStableEntry> = {};

  for (const [cacheKey, entry] of Object.entries(raw.entries)) {
    entries[cacheKey.trim()] = normalizeStableEntry(entry);
  }

  return {
    version: 1,
    entries: sortEntries(entries),
  };
};

const normalizeRuntimeRegistry = (raw: PublicCacheRuntimeRegistry): PublicCacheRuntimeRegistry => {
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

const mergeStableAndRuntimeRegistries = (
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

const splitRegistry = (
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

const extractMetadataFromRaw = (raw: unknown): PublicCacheMetadata => {
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

const parseStableRegistryFile = (
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

const loadRuntimeRegistry = (
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

const mergeRuntimeRegistries = (
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

const writeJsonFile = (relativePath: string, payload: unknown): void => {
  const absolute = absolutePath(relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};

const writeRuntimeRegistryFile = (
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

const toStableOnlyEntry = (entry: PublicCacheEntry): PublicCacheEntry =>
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

  if (entry.sourceUrl !== expectedUrl || entry.linkId !== cacheKey) {
    return null;
  }

  return {
    cacheKey,
    entry,
    fresh: isPublicCacheFresh(entry.expiresAt),
  };
};

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
    input.targetId === "medium-public-feed" ||
    input.targetId === "primal-public-profile" ||
    input.targetId === "x-public-oembed";

  if (!input.previous || !preservesAudienceMetrics) {
    return next;
  }

  const merged: PublicCacheMetadata = {
    ...next,
  };
  const mergedRecord = merged as Record<string, number | string | undefined>;
  const previousRecord = input.previous as Record<string, unknown>;
  const fieldsToPreserve =
    input.targetId === "x-public-oembed"
      ? ([
          "followersCount",
          "followersCountRaw",
          "followingCount",
          "followingCountRaw",
          "profileDescription",
        ] as const)
      : (["followersCount", "followersCountRaw", "followingCount", "followingCountRaw"] as const);

  for (const field of fieldsToPreserve) {
    if (hasDefinedMetadataValue(mergedRecord[field])) {
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

  return normalizeMetadata(merged);
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
  const previous = input.previous ? normalizeEntry(input.previous) : undefined;
  const nextMetadata = normalizeMetadata(input.metadata);
  const payloadChanged =
    !previous ||
    previous.linkId !== input.linkId.trim() ||
    previous.sourceUrl !== input.sourceUrl.trim() ||
    !arePublicCacheMetadataEqual(previous.metadata, nextMetadata);

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
