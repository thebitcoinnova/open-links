import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  DEFAULT_AUTH_CACHE_PATH,
  loadAuthenticatedCacheRegistry,
  resolveAuthenticatedCacheKey,
  validateAuthenticatedCacheEntry,
} from "./authenticated-extractors/cache";
import {
  DEFAULT_AUTH_EXTRACTORS_POLICY_PATH,
  loadAuthenticatedExtractorsPolicy,
  resolveAuthenticatedExtractorById,
  resolveAuthenticatedExtractorDomainMatch,
} from "./authenticated-extractors/policy";
import {
  getAuthenticatedExtractorPlugin,
  validateRegisteredExtractorsAgainstPolicy,
} from "./authenticated-extractors/registry";
import type { AuthFlowSessionReport } from "./authenticated-extractors/types";
import {
  RemoteCacheStatsCollector,
  createRemoteCacheStatsOutputPath,
  writeRemoteCacheRunSummary,
} from "./shared/remote-cache-fetch";
import { loadRemoteCachePolicyRegistry } from "./shared/remote-cache-policy";

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
  onlyMissing: boolean;
}

interface CandidateLink {
  link: LinkInput;
  extractorId: string;
  cacheKey: string;
}

interface SessionArtifact {
  extractorId: string;
  verified: boolean;
  details?: string;
  report?: AuthFlowSessionReport;
}

interface CaptureArtifact {
  linkId: string;
  extractorId: string;
  cacheKey: string;
  status: "captured" | "skipped_valid_cache" | "error";
  details: string;
}

const ROOT = process.cwd();
const DEFAULT_LINKS_PATH = "data/links.json";
const DEFAULT_PUBLIC_ASSET_DIR_RELATIVE = "cache/rich-authenticated";
const OUTPUT_DIR_RELATIVE = path.join("output", "playwright", "auth-rich-sync");
const DEFAULT_WARN_AGE_DAYS = 30;

const absolutePath = (value: string): string =>
  path.isAbsolute(value) ? value : path.join(ROOT, value);

const nowIso = (): string => new Date().toISOString();
const fileTimestamp = (): string => nowIso().replaceAll(":", "-");

const readJson = <T>(relativePath: string): T => {
  const absolute = absolutePath(relativePath);
  return JSON.parse(fs.readFileSync(absolute, "utf8")) as T;
};

const writeJson = (relativePath: string, payload: unknown) => {
  const absolute = absolutePath(relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};

const writeOutputArtifact = (payload: unknown): string => {
  const absolute = absolutePath(path.join(OUTPUT_DIR_RELATIVE, `summary-${fileTimestamp()}.json`));
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return absolute;
};

const parseArgs = (): CliArgs => {
  const args = process.argv.slice(2);

  const getFlagValue = (name: string): string | undefined => {
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
    linksPath: getFlagValue("--links") ?? DEFAULT_LINKS_PATH,
    cachePath: getFlagValue("--cache") ?? DEFAULT_AUTH_CACHE_PATH,
    policyPath: getFlagValue("--policy") ?? DEFAULT_AUTH_EXTRACTORS_POLICY_PATH,
    onlyLink: getFlagValue("--only-link"),
    onlyExtractor: getFlagValue("--only-extractor"),
    includeDisabled: args.includes("--include-disabled"),
    force: args.includes("--force"),
    onlyMissing: args.includes("--only-missing"),
  };
};

const run = async () => {
  const startedAt = nowIso();
  const args = parseArgs();
  const linksPayload = readJson<LinksPayload>(args.linksPath);
  const policy = loadAuthenticatedExtractorsPolicy({
    policyPath: args.policyPath,
  });
  const remoteCachePolicyRegistry = loadRemoteCachePolicyRegistry();
  const remoteCacheStats = new RemoteCacheStatsCollector("sync-authenticated-rich-cache");
  const cache = loadAuthenticatedCacheRegistry({
    cachePath: args.cachePath,
  });

  const registryChecks = validateRegisteredExtractorsAgainstPolicy(policy);
  if (registryChecks.missingHandlers.length > 0) {
    throw new Error(
      [
        "Authenticated extractor registry mismatch detected.",
        `Missing policy/handler alignment for: ${registryChecks.missingHandlers.join(", ")}`,
        "Ensure each policy extractor id has a registered code handler and vice versa.",
      ].join(" "),
    );
  }

  const candidates: CandidateLink[] = linksPayload.links
    .filter((link) => {
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
    })
    .map((link) => ({
      link,
      extractorId: link.enrichment?.authenticatedExtractor?.trim() ?? "",
      cacheKey: resolveAuthenticatedCacheKey(link.enrichment?.authenticatedCacheKey, link.id),
    }));

  const warnings: string[] = [];
  const errors: string[] = [];
  const sessionChecks: SessionArtifact[] = [];
  const captures: CaptureArtifact[] = [];
  const skippedValidCacheKeys: string[] = [];
  const forcedRefreshCacheKeys: string[] = [];
  let cacheMutated = false;
  const onlyMissingSkipMode = args.onlyMissing && !args.force;
  const runMode = args.onlyMissing
    ? args.force
      ? "only-missing-force-refresh"
      : "only-missing"
    : "full";

  if (args.onlyMissing) {
    if (args.force) {
      console.log(
        "Authenticated rich cache sync mode: --only-missing with --force (valid cache entries for selected links will be refreshed).",
      );
    } else {
      console.log(
        "Authenticated rich cache sync mode: --only-missing (idempotent; valid cache entries are skipped).",
      );
    }
  } else {
    console.log("Authenticated rich cache sync mode: full (selected links are re-captured).");
  }

  if (candidates.length === 0) {
    const artifactPath = writeOutputArtifact({
      startedAt,
      completedAt: nowIso(),
      mode: runMode,
      args,
      selectedLinks: [],
      warnings,
      errors,
      sessionChecks,
      captures,
      note: "No rich links matched authenticated extractor sync filters.",
    });

    console.log("No rich links matched authenticated extractor sync filters.");
    console.log("Tip: configure links[].enrichment.authenticatedExtractor and rerun.");
    console.log(`Artifact: ${path.relative(ROOT, artifactPath)}`);
    return;
  }

  const selectedCandidates: CandidateLink[] = [];

  if (args.onlyMissing) {
    for (const candidate of candidates) {
      const validation = validateAuthenticatedCacheEntry({
        cacheKey: candidate.cacheKey,
        expectedLinkId: candidate.link.id,
        expectedExtractorId: candidate.extractorId,
        expectedUrl: candidate.link.url ?? "",
        warnAgeDays: DEFAULT_WARN_AGE_DAYS,
        registry: cache,
      });

      const hasErrors = validation.issues.some((issue) => issue.level === "error");
      const hasValidEntry = !hasErrors && validation.valid && validation.metadata;

      if (hasValidEntry && onlyMissingSkipMode) {
        skippedValidCacheKeys.push(candidate.cacheKey);
        captures.push({
          linkId: candidate.link.id,
          extractorId: candidate.extractorId,
          cacheKey: candidate.cacheKey,
          status: "skipped_valid_cache",
          details: "Existing authenticated cache entry is valid; skipping due to --only-missing.",
        });
        continue;
      }

      if (hasValidEntry && args.force) {
        forcedRefreshCacheKeys.push(candidate.cacheKey);
      }

      selectedCandidates.push(candidate);
    }
  } else {
    selectedCandidates.push(...candidates);
  }

  const byExtractor = new Map<string, CandidateLink[]>();
  for (const candidate of selectedCandidates) {
    const list = byExtractor.get(candidate.extractorId) ?? [];
    list.push(candidate);
    byExtractor.set(candidate.extractorId, list);
  }

  const publicAssetDirAbsolute = absolutePath(
    path.join("public", DEFAULT_PUBLIC_ASSET_DIR_RELATIVE),
  );
  fs.mkdirSync(publicAssetDirAbsolute, { recursive: true });

  let capturedCount = 0;
  const touchedCacheKeys: string[] = [];

  for (const [extractorId, extractorCandidates] of byExtractor.entries()) {
    const policyExtractor = resolveAuthenticatedExtractorById(extractorId, policy);
    if (!policyExtractor) {
      errors.push(
        `Link(s) configured extractor '${extractorId}' but no policy entry exists in ${args.policyPath}.`,
      );
      continue;
    }

    if (policyExtractor.status === "disabled") {
      errors.push(
        `Extractor '${extractorId}' is disabled in policy. Enable it or remove links[].enrichment.authenticatedExtractor.`,
      );
      continue;
    }

    const plugin = getAuthenticatedExtractorPlugin(extractorId);
    if (!plugin) {
      errors.push(`Extractor '${extractorId}' has no registered code plugin handler.`);
      continue;
    }

    const errorCountBeforeDomainChecks = errors.length;
    for (const candidate of extractorCandidates) {
      const match = resolveAuthenticatedExtractorDomainMatch(
        candidate.link.url ?? "",
        policyExtractor,
      );
      if (!match) {
        errors.push(
          `Link '${candidate.link.id}' URL '${candidate.link.url}' does not match extractor '${extractorId}' policy domains (${policyExtractor.domains.join(
            ", ",
          )}).`,
        );
      }
    }

    if (errors.length > errorCountBeforeDomainChecks) {
      continue;
    }

    try {
      const sessionResult = await plugin.ensureSession({
        extractorId,
        targetUrl: extractorCandidates[0]?.link.url ?? "",
      });

      sessionChecks.push({
        extractorId,
        verified: sessionResult.verified,
        details: sessionResult.details,
        report: sessionResult.report,
      });

      if (!sessionResult.verified) {
        errors.push(
          `Extractor '${extractorId}' session verification failed. ${sessionResult.details ?? "No details."}`,
        );
        continue;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Extractor '${extractorId}' session initialization failed: ${message}`);
      sessionChecks.push({
        extractorId,
        verified: false,
        details: message,
      });
      continue;
    }

    console.log(
      `Extractor '${extractorId}' session verified. Processing ${extractorCandidates.length} link(s)...`,
    );

    for (const candidate of extractorCandidates) {
      try {
        const result = await plugin.extract({
          extractorId,
          cacheKey: candidate.cacheKey,
          linkId: candidate.link.id,
          sourceUrl: candidate.link.url ?? "",
          force: args.force,
          publicAssetDirAbsolute,
          publicAssetDirRelative: DEFAULT_PUBLIC_ASSET_DIR_RELATIVE,
          remoteCachePolicyRegistry,
          remoteCacheStats,
        });

        cache.entries[candidate.cacheKey] = {
          extractorId,
          linkId: candidate.link.id,
          sourceUrl: candidate.link.url ?? "",
          capturedAt: result.capturedAt,
          metadata: result.metadata,
          assets: result.assets,
          diagnostics: result.diagnostics,
        };

        cacheMutated = true;
        capturedCount += 1;
        touchedCacheKeys.push(candidate.cacheKey);
        captures.push({
          linkId: candidate.link.id,
          extractorId,
          cacheKey: candidate.cacheKey,
          status: "captured",
          details: `Captured metadata and assets (${result.metadata.image}).`,
        });
        console.log(`- Captured '${candidate.link.id}' -> cacheKey='${candidate.cacheKey}'`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(
          `Extractor '${extractorId}' failed for link '${candidate.link.id}': ${message}`,
        );
        captures.push({
          linkId: candidate.link.id,
          extractorId,
          cacheKey: candidate.cacheKey,
          status: "error",
          details: message,
        });
      }
    }
  }

  if (cacheMutated) {
    cache.updatedAt = nowIso();
    writeJson(args.cachePath, cache);
  }

  const remoteCacheStatsPath = createRemoteCacheStatsOutputPath("sync-authenticated-rich-cache");
  writeRemoteCacheRunSummary(remoteCacheStatsPath, remoteCacheStats);

  const artifactPayload = {
    startedAt,
    completedAt: nowIso(),
    mode: runMode,
    args,
    selectedLinks: candidates.map((candidate) => ({
      linkId: candidate.link.id,
      url: candidate.link.url,
      extractorId: candidate.extractorId,
      cacheKey: candidate.cacheKey,
    })),
    processedLinks: selectedCandidates.map((candidate) => ({
      linkId: candidate.link.id,
      extractorId: candidate.extractorId,
      cacheKey: candidate.cacheKey,
    })),
    skippedValidCacheKeys,
    forcedRefreshCacheKeys,
    cachePath: args.cachePath,
    cacheWritten: cacheMutated,
    assetDirectory: `public/${DEFAULT_PUBLIC_ASSET_DIR_RELATIVE}`,
    sessionChecks,
    captures,
    warnings,
    errors,
  };

  const artifactPath = writeOutputArtifact(artifactPayload);

  console.log("");
  console.log("Authenticated rich cache sync summary");
  console.log(`Links selected: ${candidates.length}`);
  if (args.onlyMissing) {
    console.log(`Skipped valid cache entries: ${skippedValidCacheKeys.length}`);
    if (args.force) {
      console.log(`Force-refreshed valid cache entries: ${forcedRefreshCacheKeys.length}`);
    }
  }
  console.log(`Links processed: ${selectedCandidates.length}`);
  console.log(`Captured: ${capturedCount}`);
  console.log(`Cache file: ${args.cachePath}`);
  console.log(`Asset directory: public/${DEFAULT_PUBLIC_ASSET_DIR_RELATIVE}`);
  console.log(`Artifact: ${path.relative(ROOT, artifactPath)}`);
  console.log(`Remote cache stats: ${remoteCacheStatsPath}`);

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
      "Remediation: resolve errors, run `npm run setup:rich-auth` (or `npm run auth:rich:sync`), then commit data/cache/rich-authenticated-cache.json and public/cache/rich-authenticated/* assets.",
    );
    process.exit(1);
  }

  if (args.onlyMissing && selectedCandidates.length === 0) {
    console.log(
      "No missing/invalid authenticated cache entries detected. Setup is already complete and idempotent.",
    );
  }

  console.log(
    "Next step: commit updated cache manifest/assets (if changed), then run npm run enrich:rich and npm run build.",
  );
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Authenticated rich cache sync failed unexpectedly: ${message}`);
  process.exit(1);
});
