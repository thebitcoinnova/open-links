import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import type { AnySchema } from "ajv";
import addFormats from "ajv-formats";
import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import { SOCIAL_PROFILE_METADATA_FIELDS } from "../../src/lib/content/social-profile-fields";
import type { EnrichmentMetadata, EnrichmentMissingField, EnrichmentRunEntry } from "./types";

const ROOT = process.cwd();

export const DEFAULT_PUBLIC_CACHE_PATH = "data/cache/rich-public-cache.json";
export const DEFAULT_PUBLIC_CACHE_SCHEMA_PATH = "schema/rich-public-cache.schema.json";

export interface PublicCacheMetadata {
  title?: string;
  description?: string;
  image?: string;
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

export interface PublicCacheEntry {
  linkId: string;
  sourceUrl: string;
  capturedAt: string;
  updatedAt: string;
  metadata: PublicCacheMetadata;
  etag?: string;
  lastModified?: string;
  cacheControl?: string;
  expiresAt?: string;
}

export interface PublicCacheRegistry {
  version: 1;
  updatedAt: string;
  entries: Record<string, PublicCacheEntry>;
}

export type PublicCacheMergeTargetId = string | null;

export interface ResolvedPublicCacheEntry {
  cacheKey: string;
  entry: PublicCacheEntry;
  fresh: boolean;
}

const absolutePath = (value: string): string =>
  path.isAbsolute(value) ? value : path.join(ROOT, value);

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

const hasDefinedMetadataValue = (value: unknown): boolean => {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return value !== undefined;
};

const normalizeMetadata = (metadata: PublicCacheMetadata): PublicCacheMetadata => {
  const normalized: PublicCacheMetadata = {};
  const normalizedRecord = normalized as Record<string, number | string | undefined>;

  if (trimToUndefined(metadata.title)) normalized.title = trimToUndefined(metadata.title);
  if (trimToUndefined(metadata.description)) {
    normalized.description = trimToUndefined(metadata.description);
  }
  if (trimToUndefined(metadata.image)) normalized.image = trimToUndefined(metadata.image);
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

const normalizeRegistry = (raw: PublicCacheRegistry): PublicCacheRegistry => {
  const entries: Record<string, PublicCacheEntry> = {};

  for (const [cacheKey, entry] of Object.entries(raw.entries)) {
    entries[cacheKey.trim()] = {
      linkId: entry.linkId.trim(),
      sourceUrl: entry.sourceUrl.trim(),
      capturedAt: entry.capturedAt.trim(),
      updatedAt: entry.updatedAt.trim(),
      metadata: normalizeMetadata(entry.metadata),
      etag: trimToUndefined(entry.etag),
      lastModified: trimToUndefined(entry.lastModified),
      cacheControl: trimToUndefined(entry.cacheControl),
      expiresAt: trimToUndefined(entry.expiresAt),
    };
  }

  return {
    version: 1,
    updatedAt: raw.updatedAt.trim(),
    entries,
  };
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
}): PublicCacheRegistry => {
  const cachePath = options?.cachePath ?? DEFAULT_PUBLIC_CACHE_PATH;
  const schemaPath = options?.schemaPath ?? DEFAULT_PUBLIC_CACHE_SCHEMA_PATH;
  const schema = readJsonFileOrThrow(schemaPath) as AnySchema;
  const absoluteCachePath = absolutePath(cachePath);

  if (!fs.existsSync(absoluteCachePath)) {
    return createEmptyPublicCacheRegistry();
  }

  const registry = readJsonFileOrThrow(cachePath);
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const validate = ajv.compile(schema);
  const valid = validate(registry);
  if (!valid) {
    throw new Error(
      [
        `Invalid public cache registry at ${cachePath}.`,
        "Schema validation errors:",
        formatSchemaErrors(validate.errors),
      ].join("\n"),
    );
  }

  return normalizeRegistry(registry as PublicCacheRegistry);
};

export const writePublicCacheRegistry = (
  cachePath: string,
  registry: PublicCacheRegistry,
): void => {
  const absolute = absolutePath(cachePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
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
    input.targetId === "medium-public-feed" || input.targetId === "x-public-oembed";

  if (!input.previous || !preservesAudienceMetrics) {
    return next;
  }

  const merged: PublicCacheMetadata = {
    ...next,
  };
  const mergedRecord = merged as Record<string, number | string | undefined>;
  const previousRecord = input.previous as Record<string, unknown>;
  const fieldsToPreserve = [
    "followersCount",
    "followersCountRaw",
    "followingCount",
    "followingCountRaw",
  ] as const;

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

export const toPublicCacheMetadata = (metadata: EnrichmentMetadata): PublicCacheMetadata => {
  const cacheMetadata: PublicCacheMetadata = {};
  const cacheMetadataRecord = cacheMetadata as Record<string, number | string | undefined>;

  if (typeof metadata.title === "string" && metadata.title.trim().length > 0) {
    cacheMetadata.title = metadata.title.trim();
  }
  if (typeof metadata.description === "string" && metadata.description.trim().length > 0) {
    cacheMetadata.description = metadata.description.trim();
  }
  if (typeof metadata.image === "string" && metadata.image.trim().length > 0) {
    cacheMetadata.image = metadata.image.trim();
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
