import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import type { OpenLink } from "../src/lib/content/load-content";
import {
  appendFollowerHistoryRows,
  readFollowerHistoryCsvFile,
} from "./follower-history/append-history";
import {
  type HistoryRunSnapshotSummary,
  buildFollowerHistoryIndexEntries,
  createHistoryRunSummary,
  migrateFollowerHistoryCsvLayout,
  resolveFreshPublicRichSyncLinkIds,
  resolvePublicRichSyncFailedLinkIds,
  resolveSnapshots,
  writeHistoryRunSummary,
} from "./sync-follower-history";

const ROOT = process.cwd();

import {
  createBrightBuildsFacebookLink,
  createBrightBuildsFacebookPublicRegistry,
  createPublicRegistry,
  createSubstackLink,
  createSubstackPublicRegistry,
  createXCommunityLink,
  createXCommunityPublicRegistry,
  createXProfileLink,
  createXProfilePublicRegistry,
  createYoutubeLink,
  createYoutubePublicRegistry,
} from "./follower-history/test-fixtures";

test("same-account X renames append to one link-id series without rewriting historical rows", (t) => {
  // Arrange
  const historyRepoRoot = "tmp/tests/follower-history-x-renames/public/history/followers";
  const absoluteHistoryRoot = path.join(ROOT, historyRepoRoot);
  const csvPath = path.join(absoluteHistoryRoot, "x.csv");
  fs.mkdirSync(absoluteHistoryRoot, { recursive: true });
  const historyBefore = [
    "observedAt,linkId,platform,handle,canonicalUrl,audienceKind,audienceCount,audienceCountRaw,source",
    '2025-04-01T10:00:00.000Z,x,x,xstac1,https://x.com/XSTAC1,followers,5581,"5,581 Followers",public-cache',
    '2026-04-01T10:00:00.000Z,x,x,stacinova,https://x.com/StaciNova,followers,6000,"6,000 Followers",public-cache',
    "",
  ].join("\n");
  fs.writeFileSync(csvPath, historyBefore, "utf8");
  t.after(() => {
    fs.rmSync(path.join(ROOT, "tmp/tests/follower-history-x-renames"), {
      recursive: true,
      force: true,
    });
  });

  // Act
  appendFollowerHistoryRows({
    historyRepoRoot,
    linkId: "x",
    rows: [
      {
        observedAt: "2026-07-23T10:00:00.000Z",
        linkId: "x",
        platform: "x",
        handle: "stacingsats",
        canonicalUrl: "https://x.com/StacingSats",
        audienceKind: "followers",
        audienceCount: 6100,
        audienceCountRaw: "6,100 Followers",
        source: "public-cache",
      },
    ],
  });
  const historyAfter = fs.readFileSync(csvPath, "utf8");
  const indexEntries = buildFollowerHistoryIndexEntries(
    [
      {
        id: "x",
        label: "X",
        url: "https://x.com/StacingSats",
        type: "rich",
        icon: "x",
        enabled: true,
      },
    ],
    { historyRepoRoot },
  );

  // Assert
  assert.equal(historyAfter.startsWith(historyBefore.trimEnd()), true);
  assert.equal(readFollowerHistoryCsvFile(`${historyRepoRoot}/x.csv`).length, 3);
  assert.equal(indexEntries.length, 1);
  assert.equal(indexEntries[0]?.linkId, "x");
  assert.equal(indexEntries[0]?.handle, "stacingsats");
  assert.equal(indexEntries[0]?.canonicalUrl, "https://x.com/StacingSats");
  assert.equal(indexEntries[0]?.latestAudienceCount, 6100);
});

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

test("resolveFreshPublicRichSyncLinkIds returns synced and freshly captured unchanged link ids", () => {
  // Arrange
  const summary = {
    entries: [
      { linkId: "medium", status: "synced" as const, reason: "counts_refreshed" },
      { linkId: "x", status: "skipped" as const, reason: "counts_unchanged" },
      { linkId: "youtube", status: "skipped" as const, reason: "subscribers_present" },
      { linkId: "primal", status: "failed" as const, reason: "audience_missing" },
    ],
  };

  // Act
  const freshLinkIds = resolveFreshPublicRichSyncLinkIds(summary);

  // Assert
  assert.deepEqual([...freshLinkIds].sort(), ["medium", "x"]);
});

test("resolveSnapshots records followers from mixed X profile metadata", () => {
  // Arrange
  const links = [createXProfileLink()];
  const publicRegistry = createXProfilePublicRegistry({
    followersCount: 5828,
    followersCountRaw: "5,828 Followers",
    membersCount: 1000,
    membersCountRaw: "1K members",
  });

  // Act
  const snapshots = resolveSnapshots(links, publicRegistry, null, "2026-07-23T17:30:00.000Z", {
    freshPublicAudienceLinkIds: new Set(["x"]),
  });

  // Assert
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0]?.row.audienceKind, "followers");
  assert.equal(snapshots[0]?.row.audienceCount, 5828);
  assert.equal(snapshots[0]?.row.source, "public-cache");
});

test("resolveSnapshots ignores a manual member count for an X profile", () => {
  // Arrange
  const links = [
    createXProfileLink({
      metadata: {
        membersCount: 1000,
        membersCountRaw: "1K members",
      },
    }),
  ];
  const publicRegistry = createXProfilePublicRegistry({
    followersCount: 5828,
    followersCountRaw: "5,828 Followers",
  });

  // Act
  const snapshots = resolveSnapshots(links, publicRegistry, null, "2026-07-23T17:30:00.000Z", {
    freshPublicAudienceLinkIds: new Set(["x"]),
  });

  // Assert
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0]?.row.audienceKind, "followers");
  assert.equal(snapshots[0]?.row.audienceCount, 5828);
  assert.equal(snapshots[0]?.row.source, "public-cache");
});

test("resolveSnapshots ignores an authenticated member count for an X profile", () => {
  // Arrange
  const links = [
    createXProfileLink({
      enrichment: {
        authenticatedExtractor: "x-auth-browser",
      },
    }),
  ];
  const publicRegistry = createXProfilePublicRegistry({
    followersCount: 5828,
    followersCountRaw: "5,828 Followers",
  });
  const authenticatedRegistry = {
    entries: {
      x: {
        metadata: {
          membersCount: 1000,
          membersCountRaw: "1K members",
        },
      },
    },
  } as unknown as Parameters<typeof resolveSnapshots>[2];

  // Act
  const snapshots = resolveSnapshots(
    links,
    publicRegistry,
    authenticatedRegistry,
    "2026-07-23T17:30:00.000Z",
    {
      freshPublicAudienceLinkIds: new Set(["x"]),
    },
  );

  // Assert
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0]?.row.audienceKind, "followers");
  assert.equal(snapshots[0]?.row.audienceCount, 5828);
  assert.equal(snapshots[0]?.row.source, "public-cache");
});

test("resolveSnapshots records members from mixed X community metadata", () => {
  // Arrange
  const links = [createXCommunityLink()];
  const publicRegistry = createXCommunityPublicRegistry({
    followersCount: 5828,
    followersCountRaw: "5,828 Followers",
    membersCount: 785,
    membersCountRaw: "785 Members",
  });

  // Act
  const snapshots = resolveSnapshots(links, publicRegistry, null, "2026-07-23T17:30:00.000Z", {
    freshPublicAudienceLinkIds: new Set(["x-community"]),
  });

  // Assert
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0]?.row.audienceKind, "members");
  assert.equal(snapshots[0]?.row.audienceCount, 785);
});

test("resolveSnapshots records followers from mixed Rumble profile metadata", () => {
  // Arrange
  const links: OpenLink[] = [
    {
      id: "rumble",
      label: "Rumble",
      url: "https://rumble.com/user/example",
      type: "rich",
      icon: "rumble",
      enabled: true,
    },
  ];
  const publicRegistry = createPublicRegistry({
    rumble: {
      linkId: "rumble",
      sourceUrl: "https://rumble.com/user/example/about",
      capturedAt: "2026-07-23T17:25:00.000Z",
      updatedAt: "2026-07-23T17:25:00.000Z",
      metadata: {
        followersCount: 12,
        followersCountRaw: "12 Followers",
        membersCount: 999,
        membersCountRaw: "999 members",
      },
    },
  });

  // Act
  const snapshots = resolveSnapshots(links, publicRegistry, null, "2026-07-23T17:30:00.000Z");

  // Assert
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0]?.row.audienceKind, "followers");
  assert.equal(snapshots[0]?.row.audienceCount, 12);
});

test("resolveSnapshots skips known targets that only expose an unexpected metric", () => {
  // Arrange
  const links = [createXProfileLink()];
  const publicRegistry = createXProfilePublicRegistry({
    membersCount: 1000,
    membersCountRaw: "1K members",
  });

  // Act
  const snapshots = resolveSnapshots(links, publicRegistry, null, "2026-07-23T17:30:00.000Z", {
    freshPublicAudienceLinkIds: new Set(["x"]),
  });

  // Assert
  assert.deepEqual(snapshots, []);
});
