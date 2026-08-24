import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { followerHistoryArtifactIssues, resolvePreviewImageAvailability } from "./validate-data";

const ROOT = process.cwd();

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

test("follower-history validation rejects CSVs that mix multiple link ids", (t) => {
  const historyRepoRoot = "public/history/test-follower-history-mixed-links";
  const indexPath = `${historyRepoRoot}/index.json`;
  const csvPath = `${historyRepoRoot}/x.csv`;
  const absoluteDir = path.join(ROOT, historyRepoRoot);
  fs.mkdirSync(absoluteDir, { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, csvPath),
    `${[
      "observedAt,linkId,platform,handle,canonicalUrl,audienceKind,audienceCount,audienceCountRaw,source",
      '"2026-04-01T10:04:05.034Z",x,x,xstac1,https://x.com/XSTAC1,followers,5581,"5,581 Followers",public-cache',
      "2026-04-01T10:06:37.551Z,paranoid-bitcoin-anarchists,x,1871996451812769951,https://x.com/i/communities/1871996451812769951,members,787,787 Members,public-cache",
    ].join("\n")}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(ROOT, indexPath),
    `${JSON.stringify(
      {
        version: 1,
        updatedAt: "2026-04-01T10:06:37.551Z",
        entries: [
          {
            linkId: "x",
            label: "X",
            platform: "x",
            handle: "xstac1",
            canonicalUrl: "https://x.com/XSTAC1",
            audienceKind: "followers",
            csvPath: "history/test-follower-history-mixed-links/x.csv",
            latestAudienceCount: 5581,
            latestAudienceCountRaw: "5,581 Followers",
            latestObservedAt: "2026-04-01T10:04:05.034Z",
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
    publicRoot: "history/test-follower-history-mixed-links",
  });

  assert.equal(issues.length, 1);
  assert.match(issues[0]?.message ?? "", /mixes rows from outside the indexed link 'x'/u);
});
