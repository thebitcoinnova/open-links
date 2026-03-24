import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import type { OpenLink } from "../src/lib/content/load-content";
import {
  type HistoryRunSnapshotSummary,
  buildFollowerHistoryIndexEntries,
  createHistoryRunSummary,
  resolvePublicRichSyncFailedLinkIds,
  writeHistoryRunSummary,
} from "./sync-follower-history";

const ROOT = process.cwd();

test("createHistoryRunSummary counts captured snapshots and preserves change metadata", () => {
  const snapshots: HistoryRunSnapshotSummary[] = [
    {
      audienceCount: 90,
      audienceCountRaw: "90 followers",
      audienceKind: "followers",
      csvChanged: true,
      csvPath: "public/history/followers/github.csv",
      handle: "prizz",
      label: "GitHub",
      linkId: "github",
      platform: "github",
      rowCount: 12,
      source: "public-cache",
    },
    {
      audienceCount: 1351,
      audienceCountRaw: "1,351 Followers",
      audienceKind: "followers",
      csvChanged: false,
      csvPath: "public/history/followers/x.csv",
      handle: "pryszkie",
      label: "X",
      linkId: "x",
      platform: "x",
      rowCount: 8,
      source: "authenticated-cache",
    },
  ];

  const summary = createHistoryRunSummary({
    dryRun: false,
    indexChanged: true,
    indexEntryCount: 2,
    observedAt: "2026-03-12T07:00:00.000Z",
    snapshots,
    status: "written",
  });

  assert.equal(summary.snapshotCount, 2);
  assert.equal(summary.indexChanged, true);
  assert.equal(summary.indexEntryCount, 2);
  assert.equal(summary.snapshots[0]?.csvChanged, true);
  assert.equal(summary.snapshots[1]?.source, "authenticated-cache");
});

test("writeHistoryRunSummary creates parent directories and writes pretty JSON", (t) => {
  const summaryPath = "tmp/tests/follower-history-summary/nightly-summary.json";
  const absoluteDir = path.join(ROOT, "tmp/tests/follower-history-summary");

  t.after(() => {
    fs.rmSync(absoluteDir, { recursive: true, force: true });
  });

  writeHistoryRunSummary(
    summaryPath,
    createHistoryRunSummary({
      dryRun: true,
      indexChanged: false,
      indexEntryCount: 0,
      observedAt: "2026-03-12T07:00:00.000Z",
      snapshots: [],
      status: "dry_run",
    }),
  );

  const written = JSON.parse(fs.readFileSync(path.join(ROOT, summaryPath), "utf8")) as {
    dryRun: boolean;
    status: string;
  };

  assert.deepEqual(written, {
    dryRun: true,
    indexChanged: false,
    indexEntryCount: 0,
    observedAt: "2026-03-12T07:00:00.000Z",
    snapshotCount: 0,
    snapshots: [],
    status: "dry_run",
  });
});

test("resolvePublicRichSyncFailedLinkIds returns only failed link ids", () => {
  // Arrange
  const summary = {
    entries: [
      { linkId: "medium", status: "failed" as const, reason: "followers_missing" },
      { linkId: "x", status: "synced" as const, reason: "counts_refreshed" },
      { linkId: "primal", status: "failed" as const, reason: "audience_missing" },
    ],
  };

  // Act
  const failedLinkIds = resolvePublicRichSyncFailedLinkIds(summary);

  // Assert
  assert.deepEqual([...failedLinkIds].sort(), ["medium", "primal"]);
});

test("buildFollowerHistoryIndexEntries keeps existing platform entries from committed CSVs", (t) => {
  // Arrange
  const historyRepoRoot = "tmp/tests/follower-history-index/public/history/followers";
  const absoluteHistoryRoot = path.join(ROOT, historyRepoRoot);
  fs.mkdirSync(absoluteHistoryRoot, { recursive: true });
  fs.writeFileSync(
    path.join(absoluteHistoryRoot, "medium.csv"),
    [
      "observedAt,linkId,platform,handle,canonicalUrl,audienceKind,audienceCount,audienceCountRaw,source",
      "2026-03-23T07:00:00.000Z,medium,medium,peterryszkiewicz,https://medium.com/@peterryszkiewicz,followers,3300,3.3K followers,public-cache",
      "",
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(absoluteHistoryRoot, "x.csv"),
    [
      "observedAt,linkId,platform,handle,canonicalUrl,audienceKind,audienceCount,audienceCountRaw,source",
      "2026-03-24T07:00:00.000Z,x,x,pryszkie,https://x.com/pryszkie,followers,1353,1,353 Followers,public-cache",
      "",
    ]
      .join("\n")
      .replace("1,353 Followers", '"1,353 Followers"'),
    "utf8",
  );

  t.after(() => {
    fs.rmSync(path.join(ROOT, "tmp/tests/follower-history-index"), {
      recursive: true,
      force: true,
    });
  });

  const links: OpenLink[] = [
    {
      id: "medium",
      label: "Medium",
      url: "https://medium.com/@peterryszkiewicz",
      type: "rich",
      icon: "medium",
      enabled: true,
    },
    {
      id: "x",
      label: "X",
      url: "https://x.com/pryszkie",
      type: "rich",
      icon: "x",
      enabled: true,
    },
  ];

  // Act
  const entries = buildFollowerHistoryIndexEntries(links, {
    historyRepoRoot,
  });

  // Assert
  assert.deepEqual(entries, [
    {
      linkId: "medium",
      label: "Medium",
      platform: "medium",
      handle: "peterryszkiewicz",
      canonicalUrl: "https://medium.com/@peterryszkiewicz",
      audienceKind: "followers",
      csvPath: "history/followers/medium.csv",
      latestAudienceCount: 3300,
      latestAudienceCountRaw: "3.3K followers",
      latestObservedAt: "2026-03-23T07:00:00.000Z",
    },
    {
      linkId: "x",
      label: "X",
      platform: "x",
      handle: "pryszkie",
      canonicalUrl: "https://x.com/pryszkie",
      audienceKind: "followers",
      csvPath: "history/followers/x.csv",
      latestAudienceCount: 1353,
      latestAudienceCountRaw: "1,353 Followers",
      latestObservedAt: "2026-03-24T07:00:00.000Z",
    },
  ]);
});
