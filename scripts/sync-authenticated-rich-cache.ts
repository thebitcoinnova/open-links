import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  DEFAULT_AUTH_CACHE_PATH,
  loadAuthenticatedCacheRegistry,
  resolveAuthenticatedCacheKey
} from "./authenticated-extractors/cache";
import {
  DEFAULT_AUTH_EXTRACTORS_POLICY_PATH,
  loadAuthenticatedExtractorsPolicy,
  resolveAuthenticatedExtractorById,
  resolveAuthenticatedExtractorDomainMatch
} from "./authenticated-extractors/policy";
import {
  getAuthenticatedExtractorPlugin,
  validateRegisteredExtractorsAgainstPolicy
} from "./authenticated-extractors/registry";

interface LinkInput {
  id: string;
  label: string;
  url?: string;
  type: "simple" | "rich" | "payment";
  enabled?: boolean;
  enrichment?: {
    enabled?: boolean;
    authenticatedExtractor?: string;
    authenticatedCacheKey?: string;
  };
}

interface LinksPayload {
  links: LinkInput[];
}

interface CliArgs {
  linksPath: string;
  cachePath: string;
  policyPath: string;
  onlyLink?: string;
  onlyExtractor?: string;
  includeDisabled: boolean;
  force: boolean;
}

const ROOT = process.cwd();
const DEFAULT_LINKS_PATH = "data/links.json";
const DEFAULT_PUBLIC_ASSET_DIR_RELATIVE = "cache/rich-authenticated";

const absolutePath = (value: string): string =>
  path.isAbsolute(value) ? value : path.join(ROOT, value);

const readJson = <T>(relativePath: string): T => {
  const absolute = absolutePath(relativePath);
  return JSON.parse(fs.readFileSync(absolute, "utf8")) as T;
};

const writeJson = (relativePath: string, payload: unknown) => {
  const absolute = absolutePath(relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};

const parseArgs = (): CliArgs => {
  const args = process.argv.slice(2);

  const valueOf = (name: string): string | undefined => {
    const index = args.indexOf(name);
    if (index < 0) {
      return undefined;
    }

    const value = args[index + 1];
    if (typeof value !== "string" || value.startsWith("--")) {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  return {
    linksPath: valueOf("--links") ?? DEFAULT_LINKS_PATH,
    cachePath: valueOf("--cache") ?? DEFAULT_AUTH_CACHE_PATH,
    policyPath: valueOf("--policy") ?? DEFAULT_AUTH_EXTRACTORS_POLICY_PATH,
    onlyLink: valueOf("--only-link"),
    onlyExtractor: valueOf("--only-extractor"),
    includeDisabled: args.includes("--include-disabled"),
    force: args.includes("--force")
  };
};

const run = async () => {
  const args = parseArgs();
  const linksPayload = readJson<LinksPayload>(args.linksPath);
  const policy = loadAuthenticatedExtractorsPolicy({
    policyPath: args.policyPath
  });
  const cache = loadAuthenticatedCacheRegistry({
    cachePath: args.cachePath
  });

  const registryChecks = validateRegisteredExtractorsAgainstPolicy(policy);
  if (registryChecks.missingHandlers.length > 0) {
    throw new Error(
      [
        "Authenticated extractor registry mismatch detected.",
        `Missing policy/handler alignment for: ${registryChecks.missingHandlers.join(", ")}`,
        "Ensure each policy extractor id has a registered code handler and vice versa."
      ].join(" ")
    );
  }

  const candidates = linksPayload.links.filter((link) => {
    if (link.type !== "rich") {
      return false;
    }

    if (!link.url) {
      return false;
    }

    if (!args.includeDisabled && link.enabled === false) {
      return false;
    }

    const extractorId = link.enrichment?.authenticatedExtractor?.trim();
    if (!extractorId) {
      return false;
    }

    if (args.onlyLink && link.id !== args.onlyLink) {
      return false;
    }

    if (args.onlyExtractor && extractorId !== args.onlyExtractor) {
      return false;
    }

    return true;
  });

  if (candidates.length === 0) {
    console.log("No rich links matched authenticated extractor sync filters.");
    console.log("Tip: configure links[].enrichment.authenticatedExtractor and rerun.");
    return;
  }

  const byExtractor = new Map<string, LinkInput[]>();
  for (const link of candidates) {
    const extractorId = link.enrichment?.authenticatedExtractor?.trim();
    if (!extractorId) {
      continue;
    }

    const list = byExtractor.get(extractorId) ?? [];
    list.push(link);
    byExtractor.set(extractorId, list);
  }

  const publicAssetDirAbsolute = absolutePath(path.join("public", DEFAULT_PUBLIC_ASSET_DIR_RELATIVE));
  fs.mkdirSync(publicAssetDirAbsolute, { recursive: true });

  const errors: string[] = [];
  const warnings: string[] = [];
  let capturedCount = 0;
  const touchedCacheKeys: string[] = [];

  for (const [extractorId, links] of byExtractor.entries()) {
    const policyExtractor = resolveAuthenticatedExtractorById(extractorId, policy);
    if (!policyExtractor) {
      errors.push(
        `Link(s) configured extractor '${extractorId}' but no policy entry exists in ${args.policyPath}.`
      );
      continue;
    }

    if (policyExtractor.status === "disabled") {
      errors.push(
        `Extractor '${extractorId}' is disabled in policy. Enable it or remove links[].enrichment.authenticatedExtractor.`
      );
      continue;
    }

    const plugin = getAuthenticatedExtractorPlugin(extractorId);
    if (!plugin) {
      errors.push(`Extractor '${extractorId}' has no registered code plugin handler.`);
      continue;
    }

    const errorCountBeforeDomainChecks = errors.length;
    for (const link of links) {
      const match = resolveAuthenticatedExtractorDomainMatch(link.url ?? "", policyExtractor);
      if (!match) {
        errors.push(
          `Link '${link.id}' URL '${link.url}' does not match extractor '${extractorId}' policy domains (${policyExtractor.domains.join(
            ", "
          )}).`
        );
      }
    }

    if (errors.length > errorCountBeforeDomainChecks) {
      continue;
    }

    const sessionResult = await plugin.ensureSession({
      extractorId,
      targetUrl: links[0]?.url ?? ""
    });

    if (!sessionResult.verified) {
      errors.push(
        `Extractor '${extractorId}' session verification failed. ${sessionResult.details ?? "No details."}`
      );
      continue;
    }

    console.log(
      `Extractor '${extractorId}' session verified. Processing ${links.length} link(s)...`
    );

    for (const link of links) {
      const cacheKey = resolveAuthenticatedCacheKey(link.enrichment?.authenticatedCacheKey, link.id);

      try {
        const result = await plugin.extract({
          extractorId,
          cacheKey,
          linkId: link.id,
          sourceUrl: link.url ?? "",
          force: args.force,
          publicAssetDirAbsolute,
          publicAssetDirRelative: DEFAULT_PUBLIC_ASSET_DIR_RELATIVE
        });

        cache.entries[cacheKey] = {
          extractorId,
          linkId: link.id,
          sourceUrl: link.url ?? "",
          capturedAt: result.capturedAt,
          metadata: result.metadata,
          assets: result.assets,
          diagnostics: result.diagnostics
        };

        capturedCount += 1;
        touchedCacheKeys.push(cacheKey);
        console.log(`- Captured '${link.id}' -> cacheKey='${cacheKey}'`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Extractor '${extractorId}' failed for link '${link.id}': ${message}`);
      }
    }
  }

  cache.updatedAt = new Date().toISOString();
  writeJson(args.cachePath, cache);

  console.log("");
  console.log("Authenticated rich cache sync summary");
  console.log(`Links selected: ${candidates.length}`);
  console.log(`Captured: ${capturedCount}`);
  console.log(`Cache file: ${args.cachePath}`);
  console.log(`Asset directory: public/${DEFAULT_PUBLIC_ASSET_DIR_RELATIVE}`);

  if (touchedCacheKeys.length > 0) {
    console.log(`Updated cache keys: ${touchedCacheKeys.join(", ")}`);
  }

  if (warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (errors.length > 0) {
    console.error("Errors:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }

    console.error(
      "Remediation: resolve errors, rerun `npm run auth:rich:sync`, then commit data/cache/rich-authenticated-cache.json and public/cache/rich-authenticated/* assets."
    );
    process.exit(1);
  }

  console.log(
    "Next step: commit updated cache manifest and assets, then run npm run enrich:rich and npm run build."
  );
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Authenticated rich cache sync failed unexpectedly: ${message}`);
  process.exit(1);
});
