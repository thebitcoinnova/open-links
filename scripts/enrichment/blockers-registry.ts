import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import type { AnySchema } from "ajv";
import addFormats from "ajv-formats";

export type RichEnrichmentBlockerStatus = "blocked" | "monitoring" | "resolved";
export type RichEnrichmentBlockerScope = "direct_fetch";
export type RichEnrichmentBlockerReasonCategory =
  | "authwall"
  | "bot_protection"
  | "challenge"
  | "unknown";

export interface RichEnrichmentBlocker {
  id: string;
  status: RichEnrichmentBlockerStatus;
  scope: RichEnrichmentBlockerScope;
  domains: string[];
  matchSubdomains: boolean;
  reasonCategory: RichEnrichmentBlockerReasonCategory;
  lastVerifiedAt: string;
  summary: string;
  remediation: string[];
  plannedSupportNote?: string;
  docs: string[];
}

export interface RichEnrichmentBlockersRegistry {
  version: 1;
  updatedAt: string;
  blockers: RichEnrichmentBlocker[];
}

export interface KnownBlockerMatch {
  blocker: RichEnrichmentBlocker;
  host: string;
  matchedDomain: string;
}

const ROOT = process.cwd();
export const DEFAULT_BLOCKERS_REGISTRY_PATH = "data/policy/rich-enrichment-blockers.json";
export const DEFAULT_BLOCKERS_SCHEMA_PATH = "schema/rich-enrichment-blockers.schema.json";

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

const normalizeRegistry = (raw: RichEnrichmentBlockersRegistry): RichEnrichmentBlockersRegistry => ({
  ...raw,
  blockers: raw.blockers.map((blocker) => ({
    ...blocker,
    domains: blocker.domains.map((domain) => domain.trim().toLowerCase())
  }))
});

export const loadRichEnrichmentBlockersRegistry = (options?: {
  registryPath?: string;
  schemaPath?: string;
}): RichEnrichmentBlockersRegistry => {
  const registryPath = options?.registryPath ?? DEFAULT_BLOCKERS_REGISTRY_PATH;
  const schemaPath = options?.schemaPath ?? DEFAULT_BLOCKERS_SCHEMA_PATH;
  const schema = readJsonFileOrThrow(schemaPath) as AnySchema;
  const registry = readJsonFileOrThrow(registryPath);

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const validate = ajv.compile(schema);
  const valid = validate(registry);
  if (!valid) {
    throw new Error(
      [
        `Invalid blockers registry at ${registryPath}.`,
        "Schema validation errors:",
        formatSchemaErrors(validate.errors)
      ].join("\n")
    );
  }

  return normalizeRegistry(registry as RichEnrichmentBlockersRegistry);
};

const toHost = (url: string): string | null => {
  try {
    return new URL(url).hostname.trim().toLowerCase();
  } catch {
    return null;
  }
};

const matchesDomain = (host: string, domain: string, matchSubdomains: boolean): boolean =>
  host === domain || (matchSubdomains && host.endsWith(`.${domain}`));

export const resolveKnownBlockerMatch = (
  url: string,
  registry: RichEnrichmentBlockersRegistry,
  scope: RichEnrichmentBlockerScope = "direct_fetch"
): KnownBlockerMatch | null => {
  const host = toHost(url);
  if (!host) {
    return null;
  }

  let bestMatch: KnownBlockerMatch | null = null;

  for (const blocker of registry.blockers) {
    if (blocker.status !== "blocked" || blocker.scope !== scope) {
      continue;
    }

    for (const domain of blocker.domains) {
      if (!matchesDomain(host, domain, blocker.matchSubdomains)) {
        continue;
      }

      if (!bestMatch || domain.length > bestMatch.matchedDomain.length) {
        bestMatch = {
          blocker,
          host,
          matchedDomain: domain
        };
      }
    }
  }

  return bestMatch;
};
