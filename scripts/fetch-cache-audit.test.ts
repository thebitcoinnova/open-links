import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";

const ROOT = process.cwd();
const SOURCE_ROOTS = ["scripts", "packages", "src"] as const;

type FetchClassification = "cache-backed" | "cache-helper" | "diagnostic" | "runtime";

interface FetchContract {
  file: string;
  classification: FetchClassification;
  note: string;
}

interface PersistenceContract {
  file: string;
  requiredSnippets: string[];
}

const DIRECT_FETCH_CONTRACTS: FetchContract[] = [
  {
    file: "scripts/enrichment/fetch-metadata.ts",
    classification: "cache-helper",
    note: "Shared HTTP metadata fetch helper used only by cache-writing enrichment entrypoints.",
  },
  {
    file: "scripts/sync-profile-avatar.ts",
    classification: "cache-backed",
    note: "Avatar fetches persist through data/generated/profile-avatar.json and public/generated/*.",
  },
  {
    file: "scripts/sync-content-images.ts",
    classification: "cache-backed",
    note: "Rich-card image fetches persist through data/generated/content-images.json and public/generated/images/*.",
  },
  {
    file: "scripts/authenticated-extractors/plugins/linkedin-auth-browser.ts",
    classification: "cache-backed",
    note: "Authenticated extractor image downloads are persisted by sync-authenticated-rich-cache.ts into committed auth cache/assets.",
  },
  {
    file: "scripts/authenticated-extractors/plugins/facebook-auth-browser.ts",
    classification: "cache-backed",
    note: "Authenticated extractor image downloads are persisted by sync-authenticated-rich-cache.ts into committed auth cache/assets.",
  },
  {
    file: "scripts/oneoff/linkedin-metadata-validate.ts",
    classification: "diagnostic",
    note: "One-off LinkedIn validation performs live diagnostic fetches and writes debug artifacts only.",
  },
  {
    file: "packages/studio-web/src/lib/api.ts",
    classification: "runtime",
    note: "Studio web client API requests are runtime traffic, not committed content-generation fetches.",
  },
  {
    file: "packages/studio-worker/src/worker.ts",
    classification: "runtime",
    note: "Studio worker requests the Studio API at runtime, outside the content cache pipeline.",
  },
  {
    file: "packages/studio-api/src/services/turnstile.ts",
    classification: "runtime",
    note: "Turnstile verification is a runtime external API exchange and is intentionally uncached.",
  },
  {
    file: "packages/studio-api/src/services/github-auth.ts",
    classification: "runtime",
    note: "GitHub OAuth token exchange is a runtime external API exchange and is intentionally uncached.",
  },
];

const PERSISTENCE_CONTRACTS: PersistenceContract[] = [
  {
    file: "scripts/enrich-rich-links.ts",
    requiredSnippets: [
      "DEFAULT_PUBLIC_CACHE_PATH,",
      "writePublicCacheRegistry(config.publicCachePath, publicCacheRegistry);",
    ],
  },
  {
    file: "scripts/public-rich-sync.ts",
    requiredSnippets: [
      "PUBLIC_RICH_SYNC_OUTPUT_DIRECTORY",
      "writePublicCacheRegistry(publicCachePath, registry)",
      "dependencies.writePublicCache(args.publicCachePath, registry);",
    ],
  },
  {
    file: "scripts/sync-authenticated-rich-cache.ts",
    requiredSnippets: [
      'const DEFAULT_PUBLIC_ASSET_DIR_RELATIVE = "cache/rich-authenticated";',
      "cache.entries[candidate.cacheKey] = {",
      "writeJson(args.cachePath, cache);",
    ],
  },
  {
    file: "scripts/sync-profile-avatar.ts",
    requiredSnippets: [
      'const DEFAULT_MANIFEST_PATH = "data/generated/profile-avatar.json";',
      "writeManifest(options.manifestPath, stabilizedManifest);",
    ],
  },
  {
    file: "scripts/sync-content-images.ts",
    requiredSnippets: [
      'const DEFAULT_MANIFEST_PATH = "data/generated/content-images.json";',
      "writeManifest(args.manifestPath, manifest);",
    ],
  },
  {
    file: "scripts/oneoff/linkedin-metadata-validate.ts",
    requiredSnippets: ['output",', '"playwright",', '"linkedin-debug",'],
  },
];

const readRelativeFile = (relativePath: string): string =>
  fs.readFileSync(path.join(ROOT, relativePath), "utf8");

const listSourceFiles = (relativeDir: string): string[] => {
  const absoluteDir = path.join(ROOT, relativeDir);
  if (!fs.existsSync(absoluteDir)) {
    return [];
  }

  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absoluteEntry = path.join(absoluteDir, entry.name);
    const relativeEntry = path.relative(ROOT, absoluteEntry).replaceAll(path.sep, "/");

    if (entry.isDirectory()) {
      files.push(...listSourceFiles(relativeEntry));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (relativeEntry.includes(".test.") || relativeEntry.endsWith(".d.ts")) {
      continue;
    }

    files.push(relativeEntry);
  }

  return files;
};

const findFilesMatching = (pattern: RegExp): string[] => {
  const matches: string[] = [];

  for (const relativeRoot of SOURCE_ROOTS) {
    for (const file of listSourceFiles(relativeRoot)) {
      if (pattern.test(readRelativeFile(file))) {
        matches.push(file);
      }
    }
  }

  return matches.sort();
};

const directFetchFiles = (): string[] => findFilesMatching(/\bfetch\(/);

const fetchMetadataCallers = (): string[] =>
  findFilesMatching(/\bfetchMetadata\(/).filter(
    (file) => file !== "scripts/enrichment/fetch-metadata.ts",
  );

test("inventories every direct fetch callsite so new uncached fetches require an explicit contract", () => {
  // Arrange
  const expectedFiles = DIRECT_FETCH_CONTRACTS.map((contract) => contract.file).sort();

  // Act
  const actualFiles = directFetchFiles();

  // Assert
  assert.deepEqual(actualFiles, expectedFiles);
});

test("shared metadata fetch helper is only used by cache-writing enrichment entrypoints", () => {
  // Arrange
  const expectedCallers = ["scripts/enrich-rich-links.ts", "scripts/public-rich-sync.ts"];

  // Act
  const actualCallers = fetchMetadataCallers();

  // Assert
  assert.deepEqual(actualCallers, expectedCallers);
});

test("cache-backed fetch flows and explicit exemptions declare their persistence path in code", () => {
  for (const contract of PERSISTENCE_CONTRACTS) {
    // Arrange
    const contents = readRelativeFile(contract.file);

    for (const snippet of contract.requiredSnippets) {
      // Act / Assert
      assert.match(
        contents,
        new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        `${contract.file} is missing required audit snippet: ${snippet}`,
      );
    }
  }
});

test("direct fetch classifications keep runtime and diagnostics out of the committed cache contract", () => {
  // Arrange
  const runtimeFiles = DIRECT_FETCH_CONTRACTS.filter(
    (contract) => contract.classification === "runtime",
  ).map((contract) => contract.file);
  const diagnosticFiles = DIRECT_FETCH_CONTRACTS.filter(
    (contract) => contract.classification === "diagnostic",
  ).map((contract) => contract.file);
  const cacheBackedFiles = DIRECT_FETCH_CONTRACTS.filter(
    (contract) => contract.classification === "cache-backed",
  ).map((contract) => contract.file);

  // Assert
  assert.ok(
    runtimeFiles.every((file) => file.startsWith("packages/studio-")),
    "Runtime fetch exemptions must stay confined to Studio runtime codepaths.",
  );
  assert.ok(
    diagnosticFiles.every((file) => file.startsWith("scripts/oneoff/")),
    "Diagnostic fetch exemptions must stay confined to one-off scripts.",
  );
  assert.ok(
    cacheBackedFiles.every((file) => file.startsWith("scripts/")),
    "Cache-backed direct fetches must stay inside script-driven generation paths.",
  );
});
