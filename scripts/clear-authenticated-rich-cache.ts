import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  DEFAULT_AUTH_CACHE_PATH,
  loadAuthenticatedCacheRegistry,
} from "./authenticated-extractors/cache";
import type { AuthenticatedCacheEntry } from "./authenticated-extractors/types";

interface CliArgs {
  cachePath: string;
  onlyLink?: string;
  onlyExtractor?: string;
  cacheKey?: string;
  all: boolean;
  dryRun: boolean;
}

interface CacheEntryRecord {
  cacheKey: string;
  entry: AuthenticatedCacheEntry;
}

const ROOT = process.cwd();
const OUTPUT_DIR_RELATIVE = path.join("output", "playwright", "auth-rich-sync");
const AUTH_ASSET_ROOT_RELATIVE = path.join("cache", "rich-authenticated").replaceAll("\\", "/");
const AUTH_ASSET_ROOT_ABSOLUTE = path.join(ROOT, "public", AUTH_ASSET_ROOT_RELATIVE);

const nowIso = (): string => new Date().toISOString();
const fileTimestamp = (): string => nowIso().replaceAll(":", "-");

const absolutePath = (value: string): string =>
  path.isAbsolute(value) ? value : path.join(ROOT, value);

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
    cachePath: getFlagValue("--cache") ?? DEFAULT_AUTH_CACHE_PATH,
    onlyLink: getFlagValue("--only-link"),
    onlyExtractor: getFlagValue("--only-extractor"),
    cacheKey: getFlagValue("--cache-key"),
    all: args.includes("--all"),
    dryRun: args.includes("--dry-run"),
  };
};

const normalizePublicPath = (value: string): string =>
  value
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/^public\//, "")
    .trim();

const writeJson = (relativePath: string, payload: unknown) => {
  const absolute = absolutePath(relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};

const writeOutputArtifact = (payload: unknown): string => {
  const absolute = absolutePath(
    path.join(OUTPUT_DIR_RELATIVE, `clear-summary-${fileTimestamp()}.json`),
  );
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return absolute;
};

const makeUsage = (): string =>
  [
    "Usage:",
    "  npm run auth:rich:clear -- --only-link <id> [--dry-run]",
    "  npm run auth:rich:clear -- --only-extractor <id> [--dry-run]",
    "  npm run auth:rich:clear -- --cache-key <key> [--dry-run]",
    "  npm run auth:rich:clear -- --all [--dry-run]",
    "",
    "Options:",
    "  --cache <path>         Override cache manifest path (default data/cache/rich-authenticated-cache.json).",
    "  --only-link <id>       Clear entries with this linkId.",
    "  --only-extractor <id>  Clear entries with this extractorId.",
    "  --cache-key <key>      Clear this exact cache key.",
    "  --all                  Clear all authenticated cache entries.",
    "  --dry-run              Report changes without mutating files.",
  ].join("\n");

const isWithinPath = (targetPath: string, rootPath: string): boolean => {
  const relative = path.relative(rootPath, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const run = () => {
  const startedAt = nowIso();
  const args = parseArgs();

  if (!args.all && !args.onlyLink && !args.onlyExtractor && !args.cacheKey) {
    throw new Error(
      [
        "No selector provided. Provide at least one selector (--only-link, --only-extractor, --cache-key) or use --all.",
        makeUsage(),
      ].join("\n\n"),
    );
  }

  if (args.all && (args.onlyLink || args.onlyExtractor || args.cacheKey)) {
    console.warn(
      "auth:rich:clear warning: --all was provided with selectors; selectors are ignored and all entries will be targeted.",
    );
  }

  const registry = loadAuthenticatedCacheRegistry({
    cachePath: args.cachePath,
  });
  const records: CacheEntryRecord[] = Object.entries(registry.entries).map(([cacheKey, entry]) => ({
    cacheKey,
    entry,
  }));

  const matched = records.filter((record) => {
    if (args.all) {
      return true;
    }
    if (args.cacheKey && record.cacheKey !== args.cacheKey) {
      return false;
    }
    if (args.onlyLink && record.entry.linkId !== args.onlyLink) {
      return false;
    }
    if (args.onlyExtractor && record.entry.extractorId !== args.onlyExtractor) {
      return false;
    }
    return true;
  });

  const matchedKeys = new Set(matched.map((record) => record.cacheKey));
  const remainingEntries = Object.fromEntries(
    records
      .filter((record) => !matchedKeys.has(record.cacheKey))
      .map((record) => [record.cacheKey, record.entry]),
  );

  const removedAssetPaths = new Set(
    matched
      .map((record) => record.entry.assets.image.path)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => normalizePublicPath(value)),
  );
  const stillReferencedAssetPaths = new Set(
    Object.values(remainingEntries).map((entry) => normalizePublicPath(entry.assets.image.path)),
  );

  const deletableAssetPaths = [...removedAssetPaths].filter(
    (assetPath) => !stillReferencedAssetPaths.has(assetPath),
  );

  const removedAssets: string[] = [];
  const missingAssets: string[] = [];
  const skippedUnsafeAssets: string[] = [];

  for (const relativeAssetPath of deletableAssetPaths) {
    const absoluteAssetPath = path.join(ROOT, "public", relativeAssetPath);
    if (!isWithinPath(absoluteAssetPath, AUTH_ASSET_ROOT_ABSOLUTE)) {
      skippedUnsafeAssets.push(relativeAssetPath);
      continue;
    }

    if (!fs.existsSync(absoluteAssetPath)) {
      missingAssets.push(relativeAssetPath);
      continue;
    }

    if (!args.dryRun) {
      fs.rmSync(absoluteAssetPath, { force: true });
    }
    removedAssets.push(relativeAssetPath);
  }

  if (!args.dryRun && matched.length > 0) {
    writeJson(args.cachePath, {
      ...registry,
      updatedAt: nowIso(),
      entries: remainingEntries,
    });
  }

  const artifact = {
    startedAt,
    completedAt: nowIso(),
    dryRun: args.dryRun,
    cachePath: args.cachePath,
    selection: {
      all: args.all,
      onlyLink: args.onlyLink,
      onlyExtractor: args.onlyExtractor,
      cacheKey: args.cacheKey,
    },
    totalEntriesBefore: records.length,
    matchedEntries: matched.map((record) => ({
      cacheKey: record.cacheKey,
      linkId: record.entry.linkId,
      extractorId: record.entry.extractorId,
    })),
    totalEntriesAfter: Object.keys(remainingEntries).length,
    removedAssets,
    missingAssets,
    skippedUnsafeAssets,
    note:
      matched.length === 0
        ? "No entries matched provided selectors."
        : args.dryRun
          ? "Dry run only. No files were changed."
          : "Cache entries and unreferenced assets were removed.",
  };
  const artifactPath = writeOutputArtifact(artifact);

  console.log("");
  console.log(`Authenticated rich cache clear (${args.dryRun ? "dry-run" : "apply"})`);
  console.log(`Cache file: ${args.cachePath}`);
  console.log(`Entries before: ${records.length}`);
  console.log(`Entries matched: ${matched.length}`);
  console.log(`Entries after: ${Object.keys(remainingEntries).length}`);
  console.log(`Assets removed: ${removedAssets.length}`);
  if (missingAssets.length > 0) {
    console.log(`Assets already missing: ${missingAssets.length}`);
  }
  if (skippedUnsafeAssets.length > 0) {
    console.log(
      `Assets skipped (outside public/${AUTH_ASSET_ROOT_RELATIVE}/): ${skippedUnsafeAssets.length}`,
    );
  }
  console.log(`Artifact: ${path.relative(ROOT, artifactPath)}`);

  if (matched.length === 0) {
    console.log("No entries matched selectors. Nothing to clear.");
    return;
  }

  if (args.dryRun) {
    console.log("Dry run complete. Re-run without --dry-run to apply changes.");
    return;
  }

  console.log(
    "Next step: recapture cache with `npm run setup:rich-auth` (or `npm run auth:rich:sync -- --only-link <link-id>`) and commit updated manifest/assets.",
  );
};

try {
  run();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Authenticated rich cache clear failed: ${message}`);
  process.exit(1);
}
