import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import type { AnySchema } from "ajv";
import addFormats from "ajv-formats";
import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import { SOCIAL_PROFILE_METADATA_FIELDS } from "../../src/lib/content/social-profile-fields";
import type { RemoteCacheCheckStatus } from "../shared/remote-cache-contracts";
import type { EnrichmentMetadata, EnrichmentMissingField, EnrichmentRunEntry } from "./types";

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
  membersCount?: number;
  membersCountRaw?: string;
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
