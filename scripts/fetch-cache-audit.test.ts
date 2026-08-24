import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";

const ROOT = process.cwd();
const SOURCE_ROOTS = ["scripts", "packages", "src"] as const;

type FetchClassification =
  | "cache-backed"
  | "cache-helper"
  | "diagnostic"
  | "runtime"
  | "automation";

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
    file: "scripts/shared/remote-cache-fetch.ts",
    classification: "cache-helper",
    note: "Shared HTTP revalidation helper used by every cache-backed fetch path and governed by the committed remote-cache policy registry.",
  },
  {
    file: "scripts/oneoff/linkedin-metadata-validate.ts",
    classification: "diagnostic",
    note: "One-off LinkedIn validation performs live diagnostic fetches and writes debug artifacts only.",
  },
  {
    file: "scripts/github-actions/comment-pr.mjs",
    classification: "automation",
    note: "GitHub Actions posts PR comments at CI runtime and does not participate in the committed content cache pipeline.",
  },
  {
    file: "scripts/ci/create-pages-deployment.ts",
    classification: "automation",
    note: "Pages deployment creation talks to the GitHub API during CI orchestration and stays outside the committed content cache pipeline.",
  },
  {
    file: "scripts/deploy/plan-pages.ts",
    classification: "automation",
    note: "Deploy planning fetches the live manifest for release automation and does not participate in the committed content cache pipeline.",
  },
  {
    file: "scripts/deploy/verify.ts",
    classification: "automation",
    note: "Deploy verification fetches live deployment targets as release automation and does not participate in the committed content cache pipeline.",
  },
  {
    file: "scripts/deploy/local-aws.ts",
    classification: "automation",
    note: "Local AWS verification reads live build metadata during deploy orchestration and does not generate committed content cache entries.",
  },
  {
    file: "scripts/generate-payment-card-effect-screenshots.ts",
    classification: "automation",
    note: "Payment effect screenshot generation polls its local preview server and does not fetch committed remote content.",
  },
  {
    file: "scripts/generate-payment-card-effect-videos.ts",
    classification: "automation",
    note: "Payment effect video generation polls its local preview server and does not fetch committed remote content.",
  },
  {
    file: "scripts/referrals/import-resolver.ts",
    classification: "automation",
    note: "Referral import resolution follows redirects during an explicit operator workflow and records results in the import plan rather than the rich-content cache.",
  },
  {
    file: "scripts/referrals/terms-policy.ts",
    classification: "automation",
    note: "Referral terms checks inspect official policy pages during an explicit compliance workflow outside rich-content generation.",
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
  {
    file: "src/routes/follower-history-data.ts",
    classification: "runtime",
    note: "The public-site follower-history adapter fetches history assets at runtime in the browser, outside the committed content cache pipeline.",
  },
  {
    file: "src/lib/qr/logo-badges.ts",
    classification: "runtime",
    note: "QR badge composition loads a configured logo in the browser and does not participate in committed content generation.",
  },
  {
    file: "src/lib/vcard/photo-vcard.ts",
    classification: "runtime",
    note: "vCard generation loads a profile photo on demand in the browser and does not participate in committed content generation.",
  },
];

const PERSISTENCE_CONTRACTS: PersistenceContract[] = [
  {
    file: "scripts/enrich-rich-links-runner.ts",
    requiredSnippets: [
      'from "./enrichment/public-cache-contracts"',
      "remoteCachePolicyRegistry: loadRemoteCachePolicyRegistry(),",
      'new RemoteCacheStatsCollector("enrich-rich-links")',
      "writePublicCacheRegistry(config.publicCachePath, publicCacheRegistry);",
      "writePublicCacheRuntimeRegistry(config.publicCachePath, publicCacheRegistry);",
    ],
  },
  {
    file: "scripts/enrich-rich-links-config.ts",
    requiredSnippets: ["--write-public-cache"],
  },
  {
    file: "scripts/public-rich-sync-capture.ts",
    requiredSnippets: ["PUBLIC_RICH_SYNC_OUTPUT_DIRECTORY"],
  },
  {
    file: "scripts/public-rich-sync-candidates.ts",
    requiredSnippets: ["writePublicCacheRegistry(publicCachePath, registry)"],
  },
  {
    file: "scripts/public-rich-sync-orchestration.ts",
    requiredSnippets: [
      "loadRemoteCachePolicyRegistry();",
      'new RemoteCacheStatsCollector("public-rich-sync")',
      "dependencies.writePublicCache(args.publicCachePath, registry);",
    ],
  },
  {
    file: "scripts/sync-authenticated-rich-cache.ts",
    requiredSnippets: [
      'const DEFAULT_PUBLIC_ASSET_DIR_RELATIVE = "cache/rich-authenticated";',
      "loadRemoteCachePolicyRegistry();",
      'new RemoteCacheStatsCollector("sync-authenticated-rich-cache")',
      "cache.entries[candidate.cacheKey] = {",
      "writeJson(args.cachePath, cache);",
    ],
  },
  {
    file: "scripts/sync-profile-avatar.ts",
    requiredSnippets: [
      'const DEFAULT_MANIFEST_PATH = "data/cache/profile-avatar.json";',
      'const DEFAULT_RUNTIME_MANIFEST_PATH = "data/cache/profile-avatar.runtime.json";',
      'const DEFAULT_OUTPUT_DIR = "public/cache/profile-avatar";',
      "loadRemoteCachePolicyRegistry();",
      'new RemoteCacheStatsCollector("sync-profile-avatar")',
    ],
  },
  {
    file: "scripts/sync-content-images.ts",
    requiredSnippets: [
      'const DEFAULT_MANIFEST_PATH = "data/cache/content-images.json";',
      'const DEFAULT_RUNTIME_MANIFEST_PATH = "data/cache/content-images.runtime.json";',
      'const DEFAULT_OUTPUT_DIR = "public/cache/content-images";',
      "loadRemoteCachePolicyRegistry();",
      'new RemoteCacheStatsCollector("sync-content-images")',
      "writeManifest(args.manifestPath, manifest);",
      "writeManifest(args.runtimeManifestPath, runtimeManifest);",
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
      if (entry.name === "dist") {
        continue;
      }

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

test("shared metadata fetch helper is only used by explicit enrichment and import entrypoints", () => {
  // Arrange
  const expectedCallers = [
    "scripts/bootstrap/linktree.ts",
    "scripts/enrich-rich-links-support.ts",
    "scripts/enrichment/public-link-prepare-steps.ts",
    "scripts/public-rich-sync-capture.ts",
  ];

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

test("cache-backed flows declare remote cache policy wiring in code", () => {
  const policyAwareFiles = [
    "scripts/enrich-rich-links-runner.ts",
    "scripts/public-rich-sync-orchestration.ts",
    "scripts/sync-authenticated-rich-cache.ts",
    "scripts/sync-profile-avatar.ts",
    "scripts/sync-content-images.ts",
  ];

  for (const file of policyAwareFiles) {
    const contents = readRelativeFile(file);
    assert.match(
      contents,
      /loadRemoteCachePolicyRegistry|remoteCachePolicyRegistry/u,
      `${file} is missing remote cache policy wiring.`,
    );
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
  const automationFiles = DIRECT_FETCH_CONTRACTS.filter(
    (contract) => contract.classification === "automation",
  ).map((contract) => contract.file);
  const cacheBackedFiles = DIRECT_FETCH_CONTRACTS.filter(
    (contract) => contract.classification === "cache-backed",
  ).map((contract) => contract.file);

  // Assert
  assert.ok(
    runtimeFiles.every(
      (file) =>
        file.startsWith("packages/studio-") ||
        file.startsWith("src/routes/") ||
        file.startsWith("src/lib/"),
    ),
    "Runtime fetch exemptions must stay confined to Studio or public-route runtime codepaths.",
  );
  assert.ok(
    diagnosticFiles.every((file) => file.startsWith("scripts/oneoff/")),
    "Diagnostic fetch exemptions must stay confined to one-off scripts.",
  );
  assert.ok(
    automationFiles.every(
      (file) =>
        file.startsWith("scripts/github-actions/") ||
        file.startsWith("scripts/ci/") ||
        file.startsWith("scripts/deploy/") ||
        file.startsWith("scripts/referrals/") ||
        file.startsWith("scripts/generate-payment-card-effect-"),
    ),
    "Automation fetch exemptions must stay confined to CI, deploy, or GitHub Actions scripts.",
  );
  assert.ok(
    cacheBackedFiles.every((file) => file.startsWith("scripts/")),
    "Cache-backed direct fetches must stay inside script-driven generation paths.",
  );
});
