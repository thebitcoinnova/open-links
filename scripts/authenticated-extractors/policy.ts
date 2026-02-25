import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import type { AnySchema } from "ajv";
import addFormats from "ajv-formats";
import type {
  AuthenticatedExtractorPolicyEntry,
  AuthenticatedExtractorsPolicyRegistry
} from "./types";

const ROOT = process.cwd();

export const DEFAULT_AUTH_EXTRACTORS_POLICY_PATH = "data/policy/rich-authenticated-extractors.json";
export const DEFAULT_AUTH_EXTRACTORS_SCHEMA_PATH = "schema/rich-authenticated-extractors.schema.json";

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

const normalizeRegistry = (
  raw: AuthenticatedExtractorsPolicyRegistry
): AuthenticatedExtractorsPolicyRegistry => ({
  ...raw,
  extractors: raw.extractors.map((extractor) => ({
    ...extractor,
    domains: extractor.domains.map((domain) => domain.trim().toLowerCase())
  }))
});

export const loadAuthenticatedExtractorsPolicy = (options?: {
  policyPath?: string;
  schemaPath?: string;
}): AuthenticatedExtractorsPolicyRegistry => {
  const policyPath = options?.policyPath ?? DEFAULT_AUTH_EXTRACTORS_POLICY_PATH;
  const schemaPath = options?.schemaPath ?? DEFAULT_AUTH_EXTRACTORS_SCHEMA_PATH;
  const schema = readJsonFileOrThrow(schemaPath) as AnySchema;
  const registry = readJsonFileOrThrow(policyPath);

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const validate = ajv.compile(schema);
  const valid = validate(registry);
  if (!valid) {
    throw new Error(
      [
        `Invalid authenticated extractors policy at ${policyPath}.`,
        "Schema validation errors:",
        formatSchemaErrors(validate.errors)
      ].join("\n")
    );
  }

  return normalizeRegistry(registry as AuthenticatedExtractorsPolicyRegistry);
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

export const resolveAuthenticatedExtractorById = (
  extractorId: string,
  registry: AuthenticatedExtractorsPolicyRegistry
): AuthenticatedExtractorPolicyEntry | null => {
  const normalized = extractorId.trim();
  if (!normalized) {
    return null;
  }

  return registry.extractors.find((extractor) => extractor.id === normalized) ?? null;
};

export interface AuthenticatedExtractorDomainMatch {
  extractor: AuthenticatedExtractorPolicyEntry;
  host: string;
  matchedDomain: string;
}

export const resolveAuthenticatedExtractorDomainMatch = (
  url: string,
  extractor: AuthenticatedExtractorPolicyEntry
): AuthenticatedExtractorDomainMatch | null => {
  const host = toHost(url);
  if (!host) {
    return null;
  }

  let matchedDomain: string | null = null;
  for (const domain of extractor.domains) {
    if (!matchesDomain(host, domain, extractor.matchSubdomains)) {
      continue;
    }

    if (!matchedDomain || domain.length > matchedDomain.length) {
      matchedDomain = domain;
    }
  }

  if (!matchedDomain) {
    return null;
  }

  return {
    extractor,
    host,
    matchedDomain
  };
};
