import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import type { AnySchema } from "ajv";
import addFormats from "ajv-formats";
import type { EnrichmentMetadata } from "../enrichment/types";
import type {
  AuthenticatedCacheEntry,
  AuthenticatedCacheRegistry,
  AuthenticatedCacheValidationIssue,
  AuthenticatedCacheValidationResult,
  ResolvedAuthenticatedCacheEntry
} from "./types";

const ROOT = process.cwd();

export const DEFAULT_AUTH_CACHE_PATH = "data/cache/rich-authenticated-cache.json";
export const DEFAULT_AUTH_CACHE_SCHEMA_PATH = "schema/rich-authenticated-cache.schema.json";

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

const normalizeRegistry = (raw: AuthenticatedCacheRegistry): AuthenticatedCacheRegistry => {
  const entries: Record<string, AuthenticatedCacheEntry> = {};

  for (const [cacheKey, entry] of Object.entries(raw.entries)) {
    entries[cacheKey.trim()] = {
      ...entry,
      extractorId: entry.extractorId.trim(),
      linkId: entry.linkId.trim(),
      sourceUrl: entry.sourceUrl.trim(),
      capturedAt: entry.capturedAt.trim(),
      metadata: {
        ...entry.metadata,
        title: entry.metadata.title.trim(),
        description: entry.metadata.description.trim(),
        image: entry.metadata.image.trim(),
        sourceLabel: entry.metadata.sourceLabel?.trim()
      },
      assets: {
        image: {
          ...entry.assets.image,
          path: entry.assets.image.path.trim(),
          sourceUrl: entry.assets.image.sourceUrl.trim(),
          contentType: entry.assets.image.contentType.trim(),
          sha256: entry.assets.image.sha256.trim().toLowerCase()
        }
      },
      diagnostics: {
        ...entry.diagnostics,
        extractorVersion: entry.diagnostics.extractorVersion.trim(),
        selectorProfile: entry.diagnostics.selectorProfile.trim(),
        capturedFromUrl: entry.diagnostics.capturedFromUrl.trim(),
        placeholderSignals: entry.diagnostics.placeholderSignals.map((value) => value.trim()),
        notes: entry.diagnostics.notes?.map((value) => value.trim())
      }
    };
  }

  return {
    ...raw,
    entries
  };
};

export const loadAuthenticatedCacheRegistry = (options?: {
  cachePath?: string;
  schemaPath?: string;
}): AuthenticatedCacheRegistry => {
  const cachePath = options?.cachePath ?? DEFAULT_AUTH_CACHE_PATH;
  const schemaPath = options?.schemaPath ?? DEFAULT_AUTH_CACHE_SCHEMA_PATH;
  const schema = readJsonFileOrThrow(schemaPath) as AnySchema;
  const registry = readJsonFileOrThrow(cachePath);

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const validate = ajv.compile(schema);
  const valid = validate(registry);
  if (!valid) {
    throw new Error(
      [
        `Invalid authenticated cache registry at ${cachePath}.`,
        "Schema validation errors:",
        formatSchemaErrors(validate.errors)
      ].join("\n")
    );
  }

  return normalizeRegistry(registry as AuthenticatedCacheRegistry);
};

export const resolveAuthenticatedCacheKey = (
  configuredKey: string | undefined,
  linkId: string
): string => {
  const trimmed = configuredKey?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : linkId;
};

const normalizePublicPath = (value: string): string => {
  const normalized = value.replaceAll("\\", "/").replace(/^\/+/, "").trim();
  return normalized.startsWith("public/") ? normalized.slice("public/".length) : normalized;
};

const resolvePublicAssetAbsolutePath = (value: string): string =>
  path.join(ROOT, "public", normalizePublicPath(value));

const toAgeDays = (capturedAt: string): number | undefined => {
  const capturedMs = Date.parse(capturedAt);
  if (!Number.isFinite(capturedMs)) {
    return undefined;
  }

  const diffMs = Date.now() - capturedMs;
  if (diffMs < 0) {
    return 0;
  }

  return diffMs / (24 * 60 * 60 * 1000);
};

const toEnrichmentMetadata = (entry: AuthenticatedCacheEntry): EnrichmentMetadata => ({
  title: entry.metadata.title,
  description: entry.metadata.description,
  image: entry.metadata.image,
  sourceLabel: entry.metadata.sourceLabel
});

export interface ValidateAuthenticatedCacheEntryInput {
  cacheKey: string;
  expectedLinkId: string;
  expectedExtractorId: string;
  expectedUrl: string;
  warnAgeDays: number;
  registry: AuthenticatedCacheRegistry;
}

export const validateAuthenticatedCacheEntry = (
  input: ValidateAuthenticatedCacheEntryInput
): AuthenticatedCacheValidationResult => {
  const issues: AuthenticatedCacheValidationIssue[] = [];
  const rawEntry = input.registry.entries[input.cacheKey];

  if (!rawEntry) {
    issues.push({
      level: "error",
      message: `Authenticated cache entry '${input.cacheKey}' is missing.`,
      remediation: `Run npm run setup:rich-auth (or npm run auth:rich:sync -- --only-link ${input.expectedLinkId}) and commit updated cache/assets.`
    });

    return {
      valid: false,
      issues
    };
  }

  if (rawEntry.extractorId !== input.expectedExtractorId) {
    issues.push({
      level: "error",
      message: `Cache entry '${input.cacheKey}' extractorId '${rawEntry.extractorId}' does not match expected '${input.expectedExtractorId}'.`,
      remediation: `Run npm run setup:rich-auth (or refresh with extractor '${input.expectedExtractorId}' for link '${input.expectedLinkId}').`
    });
  }

  if (rawEntry.linkId !== input.expectedLinkId) {
    issues.push({
      level: "error",
      message: `Cache entry '${input.cacheKey}' linkId '${rawEntry.linkId}' does not match expected '${input.expectedLinkId}'.`,
      remediation: `Fix links[].enrichment.authenticatedCacheKey or run npm run setup:rich-auth to regenerate the cache entry for '${input.expectedLinkId}'.`
    });
  }

  const metadata = rawEntry.metadata;
  if (!metadata.title || !metadata.description || !metadata.image) {
    issues.push({
      level: "error",
      message: `Cache entry '${input.cacheKey}' is missing required metadata title/description/image fields.`,
      remediation: `Run npm run setup:rich-auth (or re-run authenticated capture for '${input.expectedLinkId}') so full metadata is cached.`
    });
  }

  const imageAssetPath = rawEntry.assets.image.path;
  const imageMetadataPath = metadata.image;
  if (normalizePublicPath(imageAssetPath) !== normalizePublicPath(imageMetadataPath)) {
    issues.push({
      level: "error",
      message: `Cache entry '${input.cacheKey}' metadata.image does not match assets.image.path.`,
      remediation: "Keep metadata.image and assets.image.path aligned to the same committed local asset path."
    });
  }

  const imageAbsolutePath = resolvePublicAssetAbsolutePath(imageAssetPath);
  if (!fs.existsSync(imageAbsolutePath)) {
    issues.push({
      level: "error",
      message: `Cache entry '${input.cacheKey}' image asset is missing at '${path.relative(ROOT, imageAbsolutePath)}'.`,
      remediation: `Run npm run setup:rich-auth (or npm run auth:rich:sync -- --only-link ${input.expectedLinkId}) and commit generated assets under public/cache/rich-authenticated/.`
    });
  }

  const cachedSourceHost = (() => {
    try {
      return new URL(rawEntry.sourceUrl).hostname;
    } catch {
      return null;
    }
  })();
  const expectedHost = (() => {
    try {
      return new URL(input.expectedUrl).hostname;
    } catch {
      return null;
    }
  })();

  if (cachedSourceHost && expectedHost && cachedSourceHost !== expectedHost) {
    issues.push({
      level: "warning",
      message: `Cache entry '${input.cacheKey}' source host '${cachedSourceHost}' differs from link host '${expectedHost}'.`,
      remediation: "Confirm this is intentional or recapture metadata for the current link URL."
    });
  }

  const ageDays = toAgeDays(rawEntry.capturedAt);
  const stale =
    Number.isFinite(input.warnAgeDays) && input.warnAgeDays > 0 && typeof ageDays === "number"
      ? ageDays > input.warnAgeDays
      : false;

  if (stale && typeof ageDays === "number") {
    issues.push({
      level: "warning",
      message: `Authenticated cache entry '${input.cacheKey}' is stale (${ageDays.toFixed(1)} days old; warn threshold ${input.warnAgeDays} days).`,
      remediation: `Refresh cache with npm run setup:rich-auth (or npm run auth:rich:sync -- --only-link ${input.expectedLinkId}).`
    });
  }

  const entry: ResolvedAuthenticatedCacheEntry = {
    cacheKey: input.cacheKey,
    entry: rawEntry,
    stale,
    ageDays
  };

  return {
    valid: issues.every((issue) => issue.level !== "error"),
    entry,
    issues,
    metadata: toEnrichmentMetadata(rawEntry)
  };
};
