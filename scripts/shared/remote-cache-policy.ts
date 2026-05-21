import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import type { AnySchema } from "ajv";
import addFormats from "ajv-formats";
import Ajv2020, { type ErrorObject } from "ajv/dist/2020";

export const DEFAULT_REMOTE_CACHE_POLICY_PATH = "data/policy/remote-cache-policy.json";
export const DEFAULT_REMOTE_CACHE_POLICY_LOCAL_PATH = "data/policy/remote-cache-policy.local.json";
export const DEFAULT_REMOTE_CACHE_POLICY_SCHEMA_PATH = "schema/remote-cache-policy.schema.json";

export const REMOTE_CACHE_PIPELINES = [
  "content_images",
  "profile_avatar",
  "public_rich_metadata",
  "authenticated_asset_images",
] as const;

export const REMOTE_CACHE_CHECK_MODES = ["head_then_get", "conditional_get", "always_get"] as const;

export type RemoteCachePipeline = (typeof REMOTE_CACHE_PIPELINES)[number];
export type RemoteCacheCheckMode = (typeof REMOTE_CACHE_CHECK_MODES)[number];

export interface RemoteCachePolicyRule {
  id: string;
  pipelines: RemoteCachePipeline[];
  domains: string[];
  matchSubdomains: boolean;
  checkMode: RemoteCacheCheckMode;
  summary: string;
  docs: string[];
}

export interface RemoteCachePolicyRegistry {
  $schema?: string;
  version: 1;
  updatedAt: string;
  rules: RemoteCachePolicyRule[];
}

export interface ResolvedRemoteCachePolicyRule {
  host: string;
  matchedDomain: string;
  rule: RemoteCachePolicyRule;
}

const ROOT = process.cwd();

const absolutePath = (value: string): string =>
  path.isAbsolute(value) ? value : path.join(ROOT, value);

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

const maybeReadJsonFile = (relativePath: string): unknown | undefined => {
  const absolute = absolutePath(relativePath);

  if (!fs.existsSync(absolute)) {
    return undefined;
  }

  return readJsonFileOrThrow(relativePath);
};

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

const trimToUndefined = (value: string | undefined): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeRule = (rule: RemoteCachePolicyRule): RemoteCachePolicyRule => ({
  id: rule.id.trim(),
  pipelines: [...new Set(rule.pipelines)].sort() as RemoteCachePipeline[],
  domains: [...new Set(rule.domains.map((domain) => domain.trim().toLowerCase()))].sort(),
  matchSubdomains: rule.matchSubdomains,
  checkMode: rule.checkMode,
  summary: rule.summary.trim(),
  docs: [...new Set(rule.docs.map((doc) => doc.trim()))].sort(),
});

const normalizeRegistry = (registry: RemoteCachePolicyRegistry): RemoteCachePolicyRegistry => ({
  ...registry,
  updatedAt: registry.updatedAt.trim(),
  rules: registry.rules
    .map((rule) => normalizeRule(rule))
    .sort((left, right) => left.id.localeCompare(right.id)),
});

const arraysEqual = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const newestUpdatedAt = (left: string, right: string): string =>
  Date.parse(right) > Date.parse(left) ? right : left;

const mergeRuleOrThrow = (input: {
  baseRule: RemoteCachePolicyRule;
  localRule: RemoteCachePolicyRule;
  localPolicyPath: string;
}): RemoteCachePolicyRule => {
  if (
    !arraysEqual(input.baseRule.pipelines, input.localRule.pipelines) ||
    input.baseRule.matchSubdomains !== input.localRule.matchSubdomains ||
    input.baseRule.checkMode !== input.localRule.checkMode
  ) {
    throw new Error(
      [
        `Invalid local remote cache policy overlay at ${input.localPolicyPath}.`,
        `Rule '${input.localRule.id}' must keep the same pipelines, matchSubdomains, and checkMode as the shared rule before it can extend domains or docs.`,
      ].join(" "),
    );
  }

  return normalizeRule({
    ...input.baseRule,
    domains: [...input.baseRule.domains, ...input.localRule.domains],
    docs: [...input.baseRule.docs, ...input.localRule.docs],
  });
};

const mergeRegistriesOrThrow = (input: {
  baseRegistry: RemoteCachePolicyRegistry;
  localPolicyPath: string;
  localRegistry: RemoteCachePolicyRegistry;
}): RemoteCachePolicyRegistry => {
  const rulesById = new Map(input.baseRegistry.rules.map((rule) => [rule.id, rule]));

  for (const localRule of input.localRegistry.rules) {
    const maybeBaseRule = rulesById.get(localRule.id);
    if (!maybeBaseRule) {
      rulesById.set(localRule.id, localRule);
      continue;
    }

    rulesById.set(
      localRule.id,
      mergeRuleOrThrow({
        baseRule: maybeBaseRule,
        localPolicyPath: input.localPolicyPath,
        localRule,
      }),
    );
  }

  return normalizeRegistry({
    ...input.baseRegistry,
    updatedAt: newestUpdatedAt(input.baseRegistry.updatedAt, input.localRegistry.updatedAt),
    rules: [...rulesById.values()],
  });
};

export const loadRemoteCachePolicyRegistry = (options?: {
  maybeLocalPolicyPath?: string;
  policyPath?: string;
  schemaPath?: string;
}): RemoteCachePolicyRegistry => {
  const policyPath = options?.policyPath ?? DEFAULT_REMOTE_CACHE_POLICY_PATH;
  const localPolicyPath = options?.maybeLocalPolicyPath ?? DEFAULT_REMOTE_CACHE_POLICY_LOCAL_PATH;
  const schemaPath = options?.schemaPath ?? DEFAULT_REMOTE_CACHE_POLICY_SCHEMA_PATH;
  const schema = readJsonFileOrThrow(schemaPath) as AnySchema;
  const registry = readJsonFileOrThrow(policyPath);
  const maybeLocalRegistry = maybeReadJsonFile(localPolicyPath);

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const validateRegistry = ajv.compile(schema);
  const valid = validateRegistry(registry);
  if (!valid) {
    throw new Error(
      [
        `Invalid remote cache policy registry at ${policyPath}.`,
        "Schema validation errors:",
        formatSchemaErrors(validateRegistry.errors),
      ].join("\n"),
    );
  }

  const baseRegistry = normalizeRegistry(registry as RemoteCachePolicyRegistry);
  if (maybeLocalRegistry === undefined) {
    return baseRegistry;
  }

  const validateLocalRegistry = ajv.compile(schema);
  const localValid = validateLocalRegistry(maybeLocalRegistry);
  if (!localValid) {
    throw new Error(
      [
        `Invalid local remote cache policy overlay at ${localPolicyPath}.`,
        "Schema validation errors:",
        formatSchemaErrors(validateLocalRegistry.errors),
      ].join("\n"),
    );
  }

  return mergeRegistriesOrThrow({
    baseRegistry,
    localPolicyPath,
    localRegistry: normalizeRegistry(maybeLocalRegistry as RemoteCachePolicyRegistry),
  });
};

export const resolveRemoteCachePolicyHostname = (url: string): string => {
  const parsed = new URL(url);
  return parsed.hostname.trim().toLowerCase();
};

const domainMatchesHost = (host: string, domain: string, matchSubdomains: boolean): boolean => {
  if (host === domain) {
    return true;
  }

  if (!matchSubdomains) {
    return false;
  }

  return host.endsWith(`.${domain}`);
};

export const resolveRemoteCachePolicyRule = (input: {
  registry: RemoteCachePolicyRegistry;
  pipeline: RemoteCachePipeline;
  url: string;
}): ResolvedRemoteCachePolicyRule | null => {
  const host = resolveRemoteCachePolicyHostname(input.url);

  for (const rule of input.registry.rules) {
    if (!rule.pipelines.includes(input.pipeline)) {
      continue;
    }

    for (const domain of rule.domains) {
      if (!domainMatchesHost(host, domain, rule.matchSubdomains)) {
        continue;
      }

      return {
        host,
        matchedDomain: domain,
        rule,
      };
    }
  }

  return null;
};

export const resolveRequiredRemoteCachePolicyRule = (input: {
  registry: RemoteCachePolicyRegistry;
  pipeline: RemoteCachePipeline;
  url: string;
}): ResolvedRemoteCachePolicyRule => {
  const resolved = resolveRemoteCachePolicyRule(input);
  if (resolved) {
    return resolved;
  }

  const host = trimToUndefined(
    (() => {
      try {
        return resolveRemoteCachePolicyHostname(input.url);
      } catch {
        return undefined;
      }
    })(),
  );

  throw new Error(
    [
      `Remote cache policy coverage is required for pipeline '${input.pipeline}'.`,
      `No rule matched URL '${input.url}'.`,
      `Resolved host: '${host ?? "unparseable"}'.`,
      `Add a matching shared rule to ${DEFAULT_REMOTE_CACHE_POLICY_PATH}, or a fork-only rule to ${DEFAULT_REMOTE_CACHE_POLICY_LOCAL_PATH}, before running this cache-backed fetch.`,
    ].join(" "),
  );
};
