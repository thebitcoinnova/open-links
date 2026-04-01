import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import type { EnrichmentRunReport } from "./enrichment/types";
import {
  collectReferralCatalogIssues,
  enrichmentIssues,
  followerHistoryArtifactIssues,
  pathTouchesHookRichArtifactInputs,
  resolveHookRichArtifactCheckDecision,
  resolvePreviewImageAvailability,
} from "./validate-data";

const ROOT = process.cwd();

const writeChangedPathsFile = (relativePath: string, entries: string[]): string => {
  const absolutePath = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${entries.join("\n")}\n`, "utf8");
  return relativePath;
};

const writeJsonFile = (relativePath: string, payload: unknown): string => {
  const absolutePath = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return relativePath;
};

test("hook mode skips generated rich-artifact checks for unrelated staged script paths", (t) => {
  // Arrange
  const changedPathsFile = writeChangedPathsFile("tmp/tests/hook-skip-paths.txt", [
    "scripts/quality/perf.ts",
  ]);
  t.after(() => {
    fs.rmSync(path.join(ROOT, changedPathsFile), { force: true });
  });

  // Act
  const decision = resolveHookRichArtifactCheckDecision({
    mode: "hook",
    changedPathsFile,
  });

  // Assert
  assert.equal(decision.shouldRun, false);
  assert.equal(
    decision.humanNote,
    "Hook mode skipped generated rich-artifact checks because staged paths did not touch rich metadata/image inputs.",
  );
});

test("hook mode enforces generated rich-artifact checks when data links change", (t) => {
  // Arrange
  const changedPathsFile = writeChangedPathsFile("tmp/tests/hook-links-paths.txt", [
    "data/links.json",
  ]);
  t.after(() => {
    fs.rmSync(path.join(ROOT, changedPathsFile), { force: true });
  });

  // Act
  const decision = resolveHookRichArtifactCheckDecision({
    mode: "hook",
    changedPathsFile,
  });

  // Assert
  assert.equal(decision.shouldRun, true);
  assert.equal(decision.humanNote, undefined);
});

test("hook mode enforces generated rich-artifact checks when content-image sync inputs change", (t) => {
  // Arrange
  const changedPathsFile = writeChangedPathsFile("tmp/tests/hook-images-paths.txt", [
    "scripts/sync-content-images.ts",
  ]);
  t.after(() => {
    fs.rmSync(path.join(ROOT, changedPathsFile), { force: true });
  });

  // Act
  const decision = resolveHookRichArtifactCheckDecision({
    mode: "hook",
    changedPathsFile,
  });

  // Assert
  assert.equal(decision.shouldRun, true);
  assert.equal(decision.humanNote, undefined);
});

test("hook mode falls back to full validation when no changed-paths file is provided", () => {
  // Arrange
  const input = {
    mode: "hook" as const,
  };

  // Act
  const decision = resolveHookRichArtifactCheckDecision(input);

  // Assert
  assert.equal(decision.shouldRun, true);
  assert.match(decision.humanNote ?? "", /fell back to full validation/u);
});

test("rich-artifact trigger matcher covers exact and prefix-based hook paths", () => {
  // Arrange
  const exactMatch = "data/cache/content-images.json";
  const prefixMatch = "public/cache/content-images/example.jpg";
  const generatedSeoMatch = "public/generated/seo/social-preview.png";
  const legacyPath = "data/generated/content-images.json";
  const avatarTrigger = "scripts/sync-profile-avatar.ts";
  const socialPreviewTrigger = "scripts/generate-site-social-preview.ts";
  const policyTrigger = "data/policy/remote-cache-policy.json";
  const nonMatch = "scripts/quality/perf.ts";

  // Act
  const exactTriggered = pathTouchesHookRichArtifactInputs(exactMatch);
  const prefixTriggered = pathTouchesHookRichArtifactInputs(prefixMatch);
  const generatedSeoTriggered = pathTouchesHookRichArtifactInputs(generatedSeoMatch);
  const legacyTriggered = pathTouchesHookRichArtifactInputs(legacyPath);
  const avatarTriggered = pathTouchesHookRichArtifactInputs(avatarTrigger);
  const socialPreviewTriggered = pathTouchesHookRichArtifactInputs(socialPreviewTrigger);
  const policyTriggered = pathTouchesHookRichArtifactInputs(policyTrigger);
  const unrelatedTriggered = pathTouchesHookRichArtifactInputs(nonMatch);

  // Assert
  assert.equal(exactTriggered, true);
  assert.equal(prefixTriggered, true);
  assert.equal(generatedSeoTriggered, true);
  assert.equal(legacyTriggered, false);
  assert.equal(avatarTriggered, true);
  assert.equal(socialPreviewTriggered, true);
  assert.equal(policyTriggered, true);
  assert.equal(unrelatedTriggered, false);
});

test("referral catalog validation allows a missing optional local overlay file", (t) => {
  const baseDir = "tmp/tests/referral-catalog-no-overlay";
  const catalogPath = writeJsonFile(`${baseDir}/referral-catalog.json`, {
    $schema: "../../schema/referral-catalog.schema.json",
    version: 1,
    updatedAt: "2026-03-31T10:00:00.000Z",
    families: [
      {
        familyId: "club-orange",
        label: "Club Orange",
        kind: "referral",
        canonicalProgramUrl: "https://www.cluborange.org/signup",
      },
    ],
    offers: [
      {
        offerId: "club-orange-signup",
        familyId: "club-orange",
        label: "Club Orange signup referral",
      },
    ],
    matchers: [
      {
        matcherId: "club-orange-signup-co-path",
        familyId: "club-orange",
        offerId: "club-orange-signup",
        label: "Hosted signup path code",
        explanation: "Uses /co/<code> links.",
        hosts: ["signup.cluborange.org"],
        pathPrefix: "/co/",
      },
    ],
  });

  t.after(() => {
    fs.rmSync(path.join(ROOT, baseDir), { force: true, recursive: true });
  });

  const issues = collectReferralCatalogIssues({
    catalogPath,
    linksData: { links: [] },
    linksSource: "data/links.json",
    localCatalogPath: `${baseDir}/referral-catalog.local.json`,
  });

  assert.deepEqual(issues, []);
});

test("referral catalog validation reports malformed local overlay payloads", (t) => {
  const baseDir = "tmp/tests/referral-catalog-bad-overlay";
  const catalogPath = writeJsonFile(`${baseDir}/referral-catalog.json`, {
    $schema: "../../schema/referral-catalog.schema.json",
    version: 1,
    updatedAt: "2026-03-31T10:00:00.000Z",
    families: [],
    offers: [],
    matchers: [],
  });
  const localCatalogPath = writeJsonFile(`${baseDir}/referral-catalog.local.json`, {
    $schema: "../../schema/referral-catalog.schema.json",
    version: 1,
    updatedAt: "2026-03-31T10:00:00.000Z",
    families: {},
    offers: [],
    matchers: [],
  });

  t.after(() => {
    fs.rmSync(path.join(ROOT, baseDir), { force: true, recursive: true });
  });

  const issues = collectReferralCatalogIssues({
    catalogPath,
    linksData: { links: [] },
    linksSource: "data/links.json",
    localCatalogPath,
  });

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.source, localCatalogPath);
  assert.match(issues[0]?.path ?? "", /\$\.families/u);
  assert.match(issues[0]?.message ?? "", /must be array/u);
});

test("referral catalog validation reports duplicate ids and broken link references", (t) => {
  const baseDir = "tmp/tests/referral-catalog-bad-refs";
  const catalogPath = writeJsonFile(`${baseDir}/referral-catalog.json`, {
    $schema: "../../schema/referral-catalog.schema.json",
    version: 1,
    updatedAt: "2026-03-31T10:00:00.000Z",
    families: [
      {
        familyId: "club-orange",
        label: "Club Orange",
        kind: "referral",
        canonicalProgramUrl: "https://www.cluborange.org/signup",
      },
    ],
    offers: [
      {
        offerId: "club-orange-signup",
        familyId: "missing-family",
        label: "Club Orange signup referral",
      },
    ],
    matchers: [
      {
        matcherId: "club-orange-signup-query-referral",
        familyId: "club-orange",
        offerId: "club-orange-signup",
        label: "Canonical signup referral query",
        explanation: "Uses ?referral=<code> on /signup.",
        hosts: ["www.cluborange.org"],
        pathExact: "/signup",
        requiredQueryKeys: ["referral"],
      },
    ],
  });
  const localCatalogPath = writeJsonFile(`${baseDir}/referral-catalog.local.json`, {
    $schema: "../../schema/referral-catalog.schema.json",
    version: 1,
    updatedAt: "2026-03-31T10:00:00.000Z",
    families: [
      {
        familyId: "club-orange",
        label: "Club Orange override",
        kind: "referral",
        canonicalProgramUrl: "https://fork.example.com/club-orange",
      },
      {
        familyId: "club-orange",
        label: "Club Orange duplicate override",
        kind: "referral",
        canonicalProgramUrl: "https://fork.example.com/club-orange-duplicate",
      },
    ],
    offers: [],
    matchers: [],
  });

  t.after(() => {
    fs.rmSync(path.join(ROOT, baseDir), { force: true, recursive: true });
  });

  const issues = collectReferralCatalogIssues({
    catalogPath,
    linksData: {
      links: [
        {
          id: "cluborange-referral",
          referral: {
            catalogRef: {
              familyId: "club-orange",
              offerId: "club-orange-signup",
              matcherId: "missing-matcher",
            },
          },
        },
      ],
    },
    linksSource: "data/links.json",
    localCatalogPath,
  });

  assert.match(
    issues.map((issue) => `${issue.source} ${issue.path} ${issue.message}`).join("\n"),
    /Duplicate referral catalog family id 'club-orange'/u,
  );
  assert.match(
    issues.map((issue) => `${issue.source} ${issue.path} ${issue.message}`).join("\n"),
    /offer 'club-orange-signup' references unknown familyId 'missing-family'/u,
  );
  assert.match(
    issues.map((issue) => `${issue.source} ${issue.path} ${issue.message}`).join("\n"),
    /references unknown referral catalog matcherId 'missing-matcher'/u,
  );
  assert.match(
    issues.map((issue) => `${issue.source} ${issue.path} ${issue.message}`).join("\n"),
    /mixes familyId 'club-orange' with offerId 'club-orange-signup' from family 'missing-family'/u,
  );
});

test("preview-image availability accepts localized remote slots", () => {
  // Arrange
  const imageCandidate = "https://example.com/preview.jpg";

  // Act
  const availability = resolvePreviewImageAvailability(
    imageCandidate,
    "link:example:image",
    {
      "link:example:image": {
        resolvedPath: "cache/content-images/example.jpg",
      },
    },
    "data/cache/content-images.json",
  );

  // Assert
  assert.deepEqual(availability, { hasImage: true, detail: "" });
});

test("preview-image availability rejects remote images missing a localized slot entry", () => {
  // Arrange
  const imageCandidate = "https://example.com/preview.jpg";

  // Act
  const availability = resolvePreviewImageAvailability(
    imageCandidate,
    "link:example:image",
    {},
    "data/cache/content-images.json",
  );

  // Assert
  assert.equal(availability.hasImage, false);
  assert.match(availability.detail, /not materialized/u);
});

test("follower-history validation accepts matching index and CSV artifacts", (t) => {
  const historyRepoRoot = "public/history/test-follower-history";
  const indexPath = `${historyRepoRoot}/index.json`;
  const csvPath = `${historyRepoRoot}/github.csv`;
  const absoluteDir = path.join(ROOT, historyRepoRoot);
  fs.mkdirSync(absoluteDir, { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, csvPath),
    `${[
      "observedAt,linkId,platform,handle,canonicalUrl,audienceKind,audienceCount,audienceCountRaw,source",
      "2026-03-10T07:00:00.000Z,github,github,prizz,https://github.com/pRizz,followers,90,90 followers,public-cache",
    ].join("\n")}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(ROOT, indexPath),
    `${JSON.stringify(
      {
        version: 1,
        updatedAt: "2026-03-10T07:00:00.000Z",
        entries: [
          {
            linkId: "github",
            label: "GitHub",
            platform: "github",
            handle: "prizz",
            canonicalUrl: "https://github.com/pRizz",
            audienceKind: "followers",
            csvPath: "history/test-follower-history/github.csv",
            latestAudienceCount: 90,
            latestAudienceCountRaw: "90 followers",
            latestObservedAt: "2026-03-10T07:00:00.000Z",
          },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  t.after(() => {
    fs.rmSync(absoluteDir, { recursive: true, force: true });
  });

  const issues = followerHistoryArtifactIssues({
    historyRepoRoot,
    indexPath,
    publicRoot: "history/test-follower-history",
  });

  assert.deepEqual(issues, []);
});

test("follower-history validation reports index drift against the latest CSV row", (t) => {
  const historyRepoRoot = "public/history/test-follower-history-drift";
  const indexPath = `${historyRepoRoot}/index.json`;
  const csvPath = `${historyRepoRoot}/x.csv`;
  const absoluteDir = path.join(ROOT, historyRepoRoot);
  fs.mkdirSync(absoluteDir, { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, csvPath),
    `${[
      "observedAt,linkId,platform,handle,canonicalUrl,audienceKind,audienceCount,audienceCountRaw,source",
      '"2026-03-10T07:00:00.000Z",x,x,pryszkie,https://x.com/pryszkie,followers,1351,"1,351 Followers",public-cache',
    ].join("\n")}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(ROOT, indexPath),
    `${JSON.stringify(
      {
        version: 1,
        updatedAt: "2026-03-10T07:00:00.000Z",
        entries: [
          {
            linkId: "x",
            label: "X",
            platform: "x",
            handle: "pryszkie",
            canonicalUrl: "https://x.com/pryszkie",
            audienceKind: "followers",
            csvPath: "history/test-follower-history-drift/x.csv",
            latestAudienceCount: 1300,
            latestAudienceCountRaw: "1,300 Followers",
            latestObservedAt: "2026-03-10T07:00:00.000Z",
          },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  t.after(() => {
    fs.rmSync(absoluteDir, { recursive: true, force: true });
  });

  const issues = followerHistoryArtifactIssues({
    historyRepoRoot,
    indexPath,
    publicRoot: "history/test-follower-history-drift",
  });

  assert.equal(issues.length, 1);
  assert.match(issues[0]?.message ?? "", /does not match the latest row/u);
});

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
