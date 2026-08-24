import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import type { EnrichmentRunReport } from "./enrichment/types";
import { enrichmentIssues, publicAugmentedStableCacheCoverageIssues } from "./validate-data";

const ROOT = process.cwd();

const writeJsonFile = (relativePath: string, payload: unknown): string => {
  const absolutePath = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return relativePath;
};
const createEnrichmentReport = (
  overrides: Partial<EnrichmentRunReport["entries"][number]>,
): EnrichmentRunReport => ({
  generatedAt: "2026-03-15T18:42:42.897Z",
  strict: true,
  summary: {
    total: 1,
    fetched: 1,
    partial: 0,
    failed: 0,
    skipped: 0,
  },
  failureMode: "immediate",
  failOn: ["fetch_failed", "metadata_missing"],
  entries: [
    {
      linkId: "instagram",
      url: "https://www.instagram.com/peterryszkiewicz/",
      status: "fetched",
      reason: "public_cache",
      attempts: 2,
      durationMs: 200,
      message: "Public metadata fetch failed; using stale committed public cache metadata.",
      remediation: "Re-run `bun run enrich:rich:strict` later.",
      staleCache: true,
      ...overrides,
    },
  ],
});

test("stale public cache reuse is non-strict-blocking when cached metadata is complete", () => {
  // Arrange
  const report = createEnrichmentReport({});

  // Act
  const issues = enrichmentIssues(
    "data/generated/rich-enrichment-report.json",
    report,
    true,
    false,
    new Set(),
    new Set(),
  );

  // Assert
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.level, "warning");
  assert.equal(issues[0]?.strictBlocking, false);
});

test("stale public cache reuse stays strict-blocking when manual fallback is still required", () => {
  // Arrange
  const report = createEnrichmentReport({
    manualFallbackUsed: true,
    message:
      "Public metadata fetch failed; using stale committed public cache metadata while manual fallback covers missing preview fields.",
  });

  // Act
  const issues = enrichmentIssues(
    "data/generated/rich-enrichment-report.json",
    report,
    true,
    false,
    new Set(),
    new Set(),
  );

  // Assert
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.level, "warning");
  assert.equal(issues[0]?.strictBlocking, undefined);
});

test("stale public cache reuse stays strict-blocking when cached metadata is incomplete", () => {
  // Arrange
  const report = createEnrichmentReport({
    missingFields: ["image"],
    missingProfileFields: ["profileImage"],
  });

  // Act
  const issues = enrichmentIssues(
    "data/generated/rich-enrichment-report.json",
    report,
    true,
    false,
    new Set(),
    new Set(),
  );

  // Assert
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.level, "warning");
  assert.equal(issues[0]?.strictBlocking, undefined);
});

test("same-source metadata regression is advisory and reports the regressed fields", () => {
  // Arrange
  const report = createEnrichmentReport({
    linkId: "altair-tech",
    url: "https://altairtech.io/",
    reason: "metadata_regression",
    message:
      "Current same-source refresh returned incomplete metadata; retained the complete last-known-good public cache entry.",
    missingFields: ["description", "image"],
  });

  // Act
  const issues = enrichmentIssues(
    "data/generated/rich-enrichment-report.json",
    report,
    true,
    false,
    new Set(),
    new Set(),
  );

  // Assert
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.level, "warning");
  assert.match(issues[0]?.message ?? "", /metadata_regression/u);
  assert.match(issues[0]?.message ?? "", /Missing fields: description, image/u);
});

test("blocking enrichment failures remain strict-failing in strict mode", () => {
  // Arrange
  const report = createEnrichmentReport({
    status: "failed",
    reason: "fetch_failed",
    message: "Received HTTP 500.",
    staleCache: undefined,
  });

  // Act
  const issues = enrichmentIssues(
    "data/generated/rich-enrichment-report.json",
    report,
    true,
    false,
    new Set(),
    new Set(),
  );

  // Assert
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.level, "error");
  assert.equal(issues[0]?.strictBlocking, undefined);
});

test("public augmentation coverage reports missing stable public-cache entries", (t) => {
  const baseDir = "tmp/tests/public-cache-coverage-missing";
  const publicCachePath = writeJsonFile(`${baseDir}/rich-public-cache.json`, {
    $schema: "../../schema/rich-public-cache.schema.json",
    version: 1,
    entries: {},
  });

  t.after(() => {
    fs.rmSync(path.join(ROOT, baseDir), { force: true, recursive: true });
  });

  const issues = publicAugmentedStableCacheCoverageIssues({
    linksSource: "data/links.json",
    linksData: {
      links: [
        {
          id: "rumble",
          type: "rich",
          enabled: true,
          url: "https://rumble.com/c/c-7752998",
        },
      ],
    },
    siteData: {},
    generatedMetadataByLink: {
      rumble: {
        title: "The Bitcoin Nova Podcast",
        description: "A complete generated description.",
        image: "https://example.com/rumble.jpg",
      },
    },
    publicCachePath,
  });

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.source, publicCachePath);
  assert.match(issues[0]?.message ?? "", /no committed stable public-cache entry/u);
  assert.match(issues[0]?.remediation ?? "", /enrich:rich:strict:write-cache/u);
});

test("public augmentation coverage accepts committed stable public-cache entries", (t) => {
  const baseDir = "tmp/tests/public-cache-coverage-present";
  const publicCachePath = writeJsonFile(`${baseDir}/rich-public-cache.json`, {
    $schema: "../../schema/rich-public-cache.schema.json",
    version: 1,
    entries: {
      rumble: {
        linkId: "rumble",
        sourceUrl: "https://rumble.com/c/c-7752998/about",
        capturedAt: "2026-04-01T09:24:36.440Z",
        updatedAt: "2026-04-01T09:24:36.440Z",
        metadata: {
          title: "The Bitcoin Nova Podcast",
          description: "A complete generated description.",
          image: "https://example.com/rumble.jpg",
        },
      },
    },
  });

  t.after(() => {
    fs.rmSync(path.join(ROOT, baseDir), { force: true, recursive: true });
  });

  const issues = publicAugmentedStableCacheCoverageIssues({
    linksSource: "data/links.json",
    linksData: {
      links: [
        {
          id: "rumble",
          type: "rich",
          enabled: true,
          url: "https://rumble.com/c/c-7752998",
        },
      ],
    },
    siteData: {},
    generatedMetadataByLink: {
      rumble: {
        title: "The Bitcoin Nova Podcast",
        description: "A complete generated description.",
        image: "https://example.com/rumble.jpg",
      },
    },
    publicCachePath,
  });

  assert.deepEqual(issues, []);
});

test("public cache coverage rejects a source identity left behind by a handle rename", (t) => {
  // Arrange
  const baseDir = "tmp/tests/public-cache-identity-mismatch";
  const publicCachePath = writeJsonFile(`${baseDir}/rich-public-cache.json`, {
    $schema: "../../schema/rich-public-cache.schema.json",
    version: 1,
    entries: {
      x: {
        linkId: "x",
        sourceUrl:
          "https://publish.twitter.com/oembed?url=https%3A%2F%2Ftwitter.com%2FStaciNova&omit_script=true&hide_thread=true&dnt=true",
        capturedAt: "2026-07-17T00:00:00.000Z",
        updatedAt: "2026-07-17T00:00:00.000Z",
        metadata: {
          title: "@StaciNova on X",
          description: "Posts and updates from @StaciNova on X.",
          image: "https://unavatar.io/x/StaciNova",
        },
      },
    },
  });

  t.after(() => {
    fs.rmSync(path.join(ROOT, baseDir), { force: true, recursive: true });
  });

  // Act
  const issues = publicAugmentedStableCacheCoverageIssues({
    linksSource: "data/links.json",
    linksData: {
      links: [
        {
          id: "x",
          type: "rich",
          icon: "x",
          enabled: true,
          url: "https://x.com/StacingSats",
        },
      ],
    },
    siteData: {},
    generatedMetadataByLink: {},
    publicCachePath,
  });

  // Assert
  assert.equal(issues.length, 1);
  assert.match(issues[0]?.message ?? "", /does not match its resolved source URL/u);
  assert.match(issues[0]?.remediation ?? "", /social:profile:rename/u);
  assert.match(issues[0]?.remediation ?? "", /new link ID/u);
});

test("public cache identity uses the configured handle for custom-domain profiles", (t) => {
  // Arrange
  const baseDir = "tmp/tests/public-cache-custom-domain-identity";
  const publicCachePath = writeJsonFile(`${baseDir}/rich-public-cache.json`, {
    $schema: "../../schema/rich-public-cache.schema.json",
    version: 1,
    entries: {
      substack: {
        linkId: "substack",
        sourceUrl: "https://substack.com/@peterryszkiewicz",
        capturedAt: "2026-07-17T00:00:00.000Z",
        updatedAt: "2026-07-17T00:00:00.000Z",
        metadata: {
          title: "Peter Ryszkiewicz",
          description: "Agentic engineering and Bitcoin.",
          image: "https://substackcdn.com/profile.jpg",
        },
      },
    },
  });

  t.after(() => {
    fs.rmSync(path.join(ROOT, baseDir), { force: true, recursive: true });
  });

  // Act
  const issues = publicAugmentedStableCacheCoverageIssues({
    linksSource: "data/links.json",
    linksData: {
      links: [
        {
          id: "substack",
          type: "rich",
          icon: "substack",
          enabled: true,
          url: "https://peter.ryszkiewicz.us/",
          metadata: {
            handle: "peterryszkiewicz",
          },
        },
      ],
    },
    siteData: {},
    generatedMetadataByLink: {
      substack: {
        title: "Peter Ryszkiewicz",
        description: "Agentic engineering and Bitcoin.",
        image: "https://substackcdn.com/profile.jpg",
      },
    },
    publicCachePath,
  });

  // Assert
  assert.deepEqual(issues, []);
});
