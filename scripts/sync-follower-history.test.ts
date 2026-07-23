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

const createPublicRegistry = (
  entries: Parameters<typeof resolveSnapshots>[1]["entries"],
): Parameters<typeof resolveSnapshots>[1] => ({
  version: 1,
  updatedAt: "2026-03-12T06:00:00.000Z",
  entries,
});

const createYoutubeLink = (): OpenLink => ({
  id: "youtube",
  label: "YouTube",
  url: "https://www.youtube.com/@example",
  type: "rich",
  icon: "youtube",
  enabled: true,
});

const createSubstackLink = (): OpenLink => ({
  id: "substack",
  label: "Substack",
  url: "https://peter.ryszkiewicz.us/",
  type: "rich",
  icon: "substack",
  enabled: true,
  metadata: {
    handle: "peterryszkiewicz",
  },
});

const createBrightBuildsFacebookLink = (): OpenLink => ({
  id: "bright-builds-facebook",
  label: "Bright Builds LLC",
  url: "https://www.facebook.com/people/Bright-Builds-LLC/61588043858384/",
  type: "rich",
  icon: "facebook",
  enabled: true,
  metadata: {
    title: "Bright Builds LLC",
    profileDescription: "Chicago software engineering, open-source work, and business updates.",
  },
  enrichment: {
    enabled: false,
    authenticatedExtractor: "facebook-auth-browser",
    facebookPageMetrics: {
      enabled: true,
      pageId: "1002804269589824",
    },
  },
});

const createYoutubePublicRegistry = (): Parameters<typeof resolveSnapshots>[1] =>
  createPublicRegistry({
    youtube: {
      linkId: "youtube",
      sourceUrl: "https://www.youtube.com/@example/about",
      capturedAt: "2026-03-12T06:00:00.000Z",
      updatedAt: "2026-03-12T06:00:00.000Z",
      metadata: {
        title: "Example - YouTube",
        description: "Videos from Example.",
        image: "https://yt3.googleusercontent.com/avatar.jpg",
        profileImage: "https://yt3.googleusercontent.com/avatar.jpg",
        sourceLabel: "youtube.com",
        subscribersCount: 9200,
        subscribersCountRaw: "9.2K subscribers",
      },
    },
  });

const createSubstackPublicRegistry = (): Parameters<typeof resolveSnapshots>[1] =>
  createPublicRegistry({
    substack: {
      linkId: "substack",
      sourceUrl: "https://substack.com/@peterryszkiewicz",
      capturedAt: "2026-05-12T12:00:00.000Z",
      updatedAt: "2026-05-12T12:00:00.000Z",
      metadata: {
        title: "Peter Ryszkiewicz",
        description: "I'm an agentic engineer, making things in the AI space.",
        image: "https://substackcdn.com/profile-card.jpg",
        profileImage: "https://substackcdn.com/avatar.jpg",
        handle: "peterryszkiewicz",
        sourceLabel: "peter.ryszkiewicz.us",
        subscribersCount: 15,
        subscribersCountRaw: "15 subscribers",
      },
    },
  });

const createBrightBuildsFacebookPublicRegistry = (): Parameters<typeof resolveSnapshots>[1] =>
  createPublicRegistry({
    "bright-builds-facebook": {
      linkId: "bright-builds-facebook",
      sourceUrl:
        "https://graph.facebook.com/v24.0/1002804269589824?fields=id%2Cname%2Cfollowers_count%2Cfan_count",
      capturedAt: "2026-05-31T12:00:00.000Z",
      updatedAt: "2026-05-31T12:00:00.000Z",
      metadata: {
        sourceLabel: "facebook.com",
        followersCount: 41,
        followersCountRaw: "41 followers",
      },
    },
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

test("resolveSnapshots skips public-cache audience rows without fresh public sync evidence", () => {
  // Arrange
  const links = [createYoutubeLink()];

  // Act
  const snapshots = resolveSnapshots(
    links,
    createYoutubePublicRegistry(),
    null,
    "2026-03-12T07:00:00.000Z",
    {
      freshPublicAudienceLinkIds: resolveFreshPublicRichSyncLinkIds(undefined),
    },
  );

  // Assert
  assert.deepEqual(snapshots, []);
});

test("resolveSnapshots skips public-cache audience rows when public sync failed", () => {
  // Arrange
  const links = [createYoutubeLink()];
  const failedLinkIds = resolveFreshPublicRichSyncLinkIds({
    entries: [{ linkId: "youtube", status: "failed" as const, reason: "subscribers_missing" }],
  });

  // Act
  const snapshots = resolveSnapshots(
    links,
    createYoutubePublicRegistry(),
    null,
    "2026-03-12T07:00:00.000Z",
    {
      freshPublicAudienceLinkIds: failedLinkIds,
    },
  );

  // Assert
  assert.deepEqual(snapshots, []);
});

test("resolveSnapshots accepts public-cache audience rows after public sync refreshed counts", () => {
  // Arrange
  const links = [createYoutubeLink()];
  const freshLinkIds = resolveFreshPublicRichSyncLinkIds({
    entries: [{ linkId: "youtube", status: "synced" as const, reason: "counts_refreshed" }],
  });

  // Act
  const snapshots = resolveSnapshots(
    links,
    createYoutubePublicRegistry(),
    null,
    "2026-03-12T07:00:00.000Z",
    {
      freshPublicAudienceLinkIds: freshLinkIds,
    },
  );

  // Assert
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0]?.row.linkId, "youtube");
  assert.equal(snapshots[0]?.row.audienceCountRaw, "9.2K subscribers");
  assert.equal(snapshots[0]?.row.source, "public-cache");
});

test("resolveSnapshots accepts public-cache audience rows after fresh unchanged capture", () => {
  // Arrange
  const links = [createYoutubeLink()];
  const freshLinkIds = resolveFreshPublicRichSyncLinkIds({
    entries: [{ linkId: "youtube", status: "skipped" as const, reason: "counts_unchanged" }],
  });

  // Act
  const snapshots = resolveSnapshots(
    links,
    createYoutubePublicRegistry(),
    null,
    "2026-03-12T07:00:00.000Z",
    {
      freshPublicAudienceLinkIds: freshLinkIds,
    },
  );

  // Assert
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0]?.row.audienceCountRaw, "9.2K subscribers");
});

test("resolveSnapshots skips Substack public-cache rows without fresh public sync evidence", () => {
  // Arrange
  const links = [createSubstackLink()];

  // Act
  const snapshots = resolveSnapshots(
    links,
    createSubstackPublicRegistry(),
    null,
    "2026-05-12T13:00:00.000Z",
    {
      freshPublicAudienceLinkIds: resolveFreshPublicRichSyncLinkIds(undefined),
    },
  );

  // Assert
  assert.deepEqual(snapshots, []);
});

test("resolveSnapshots accepts Substack public-cache rows after fresh public sync evidence", () => {
  // Arrange
  const links = [createSubstackLink()];
  const freshLinkIds = resolveFreshPublicRichSyncLinkIds({
    entries: [{ linkId: "substack", status: "synced" as const, reason: "counts_refreshed" }],
  });

  // Act
  const snapshots = resolveSnapshots(
    links,
    createSubstackPublicRegistry(),
    null,
    "2026-05-12T13:00:00.000Z",
    {
      freshPublicAudienceLinkIds: freshLinkIds,
    },
  );

  // Assert
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0]?.row.linkId, "substack");
  assert.equal(snapshots[0]?.row.audienceCountRaw, "15 subscribers");
  assert.equal(snapshots[0]?.row.source, "public-cache");
});

test("resolveSnapshots accepts Substack public-cache rows after fresh unchanged capture", () => {
  // Arrange
  const links = [createSubstackLink()];
  const freshLinkIds = resolveFreshPublicRichSyncLinkIds({
    entries: [{ linkId: "substack", status: "skipped" as const, reason: "counts_unchanged" }],
  });

  // Act
  const snapshots = resolveSnapshots(
    links,
    createSubstackPublicRegistry(),
    null,
    "2026-05-12T13:00:00.000Z",
    {
      freshPublicAudienceLinkIds: freshLinkIds,
    },
  );

  // Assert
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0]?.row.audienceCountRaw, "15 subscribers");
});

test("resolveSnapshots skips Substack public-cache rows after stale enrichment fallback only", () => {
  // Arrange
  const links = [createSubstackLink()];
  const staleOnlySummary = {
    entries: [
      {
        linkId: "substack",
        status: "skipped" as const,
        reason: "stale_cache_fallback",
      },
    ],
  };

  // Act
  const snapshots = resolveSnapshots(
    links,
    createSubstackPublicRegistry(),
    null,
    "2026-05-12T13:00:00.000Z",
    {
      freshPublicAudienceLinkIds: resolveFreshPublicRichSyncLinkIds(staleOnlySummary),
    },
  );

  // Assert
  assert.deepEqual(snapshots, []);
});

test("resolveSnapshots skips Facebook Page metrics rows without fresh Graph sync evidence", () => {
  // Arrange
  const links = [createBrightBuildsFacebookLink()];

  // Act
  const snapshots = resolveSnapshots(
    links,
    createBrightBuildsFacebookPublicRegistry(),
    null,
    "2026-05-31T13:00:00.000Z",
    {
      freshPublicAudienceLinkIds: resolveFreshPublicRichSyncLinkIds(undefined),
    },
  );

  // Assert
  assert.deepEqual(snapshots, []);
});

test("resolveSnapshots accepts Facebook Page metrics rows after fresh Graph sync evidence", () => {
  // Arrange
  const links = [createBrightBuildsFacebookLink()];
  const freshLinkIds = resolveFreshPublicRichSyncLinkIds({
    entries: [
      {
        linkId: "bright-builds-facebook",
        status: "synced" as const,
        reason: "counts_refreshed",
      },
    ],
  });

  // Act
  const snapshots = resolveSnapshots(
    links,
    createBrightBuildsFacebookPublicRegistry(),
    null,
    "2026-05-31T13:00:00.000Z",
    {
      freshPublicAudienceLinkIds: freshLinkIds,
    },
  );

  // Assert
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0]?.row.linkId, "bright-builds-facebook");
  assert.equal(snapshots[0]?.row.platform, "facebook");
  assert.equal(snapshots[0]?.row.handle, "bright-builds-llc");
  assert.equal(snapshots[0]?.row.audienceCountRaw, "41 followers");
  assert.equal(snapshots[0]?.row.source, "public-cache");
});

test("resolveSnapshots does not treat Facebook fan_count as follower history", () => {
  // Arrange
  const links = [createBrightBuildsFacebookLink()];
  const fanCountOnlyRegistry = createPublicRegistry({
    "bright-builds-facebook": {
      linkId: "bright-builds-facebook",
      sourceUrl:
        "https://graph.facebook.com/v24.0/1002804269589824?fields=id%2Cname%2Cfollowers_count%2Cfan_count",
      capturedAt: "2026-05-31T12:00:00.000Z",
      updatedAt: "2026-05-31T12:00:00.000Z",
      metadata: {
        sourceLabel: "facebook.com",
        fanCount: 32,
      } as unknown as Parameters<typeof resolveSnapshots>[1]["entries"][string]["metadata"],
    },
  });
  const freshLinkIds = resolveFreshPublicRichSyncLinkIds({
    entries: [
      {
        linkId: "bright-builds-facebook",
        status: "synced" as const,
        reason: "counts_refreshed",
      },
    ],
  });

  // Act
  const snapshots = resolveSnapshots(
    links,
    fanCountOnlyRegistry,
    null,
    "2026-05-31T13:00:00.000Z",
    {
      freshPublicAudienceLinkIds: freshLinkIds,
    },
  );

  // Assert
  assert.deepEqual(snapshots, []);
});

test("resolveSnapshots supplements authenticated metadata with public-cache Facebook audience", () => {
  // Arrange
  const links = [createBrightBuildsFacebookLink()];
  const authenticatedRegistry = {
    entries: {
      "bright-builds-facebook": {
        metadata: {
          title: "Bright Builds LLC on Facebook",
          description: "Profile and updates from Bright Builds LLC on Facebook.",
          image: "cache/rich-authenticated/bright-builds.jpg",
          profileImage: "cache/rich-authenticated/bright-builds.jpg",
          sourceLabel: "facebook.com",
        },
      },
    },
  } as unknown as Parameters<typeof resolveSnapshots>[2];
  const freshLinkIds = resolveFreshPublicRichSyncLinkIds({
    entries: [
      {
        linkId: "bright-builds-facebook",
        status: "skipped" as const,
        reason: "counts_unchanged",
      },
    ],
  });

  // Act
  const snapshots = resolveSnapshots(
    links,
    createBrightBuildsFacebookPublicRegistry(),
    authenticatedRegistry,
    "2026-05-31T13:00:00.000Z",
    {
      freshPublicAudienceLinkIds: freshLinkIds,
    },
  );

  // Assert
  assert.deepEqual(
    snapshots.map((snapshot) => ({
      linkId: snapshot.row.linkId,
      source: snapshot.row.source,
      audienceCountRaw: snapshot.row.audienceCountRaw,
    })),
    [
      {
        linkId: "bright-builds-facebook",
        source: "public-cache",
        audienceCountRaw: "41 followers",
      },
    ],
  );
});

test("resolveSnapshots keeps manual and authenticated snapshots without public sync evidence", () => {
  // Arrange
  const links: OpenLink[] = [
    {
      id: "manual-youtube",
      label: "Manual YouTube",
      url: "https://www.youtube.com/@manual",
      type: "rich",
      icon: "youtube",
      enabled: true,
      metadata: {
        subscribersCount: 1200,
        subscribersCountRaw: "1.2K subscribers",
      },
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      url: "https://www.linkedin.com/in/example/",
      type: "rich",
      icon: "linkedin",
      enabled: true,
      enrichment: {
        authenticatedExtractor: "linkedin-auth-browser",
      },
    },
  ];
  const authenticatedRegistry = {
    entries: {
      linkedin: {
        metadata: {
          followersCount: 90,
          followersCountRaw: "90 followers",
        },
      },
    },
  } as unknown as Parameters<typeof resolveSnapshots>[2];

  // Act
  const snapshots = resolveSnapshots(
    links,
    createPublicRegistry({}),
    authenticatedRegistry,
    "2026-03-12T07:00:00.000Z",
    {
      freshPublicAudienceLinkIds: resolveFreshPublicRichSyncLinkIds(undefined),
    },
  );

  // Assert
  assert.deepEqual(
    snapshots.map((snapshot) => ({
      linkId: snapshot.row.linkId,
      source: snapshot.row.source,
      audienceCountRaw: snapshot.row.audienceCountRaw,
    })),
    [
      {
        linkId: "manual-youtube",
        source: "manual",
        audienceCountRaw: "1.2K subscribers",
      },
      {
        linkId: "linkedin",
        source: "authenticated-cache",
        audienceCountRaw: "90 followers",
      },
    ],
  );
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

test("migrateFollowerHistoryCsvLayout splits mixed platform history into per-link files", (t) => {
  const historyRepoRoot = "tmp/tests/follower-history-migration/public/history/followers";
  const absoluteHistoryRoot = path.join(ROOT, historyRepoRoot);
  fs.mkdirSync(absoluteHistoryRoot, { recursive: true });
  fs.writeFileSync(
    path.join(absoluteHistoryRoot, "x.csv"),
    [
      "observedAt,linkId,platform,handle,canonicalUrl,audienceKind,audienceCount,audienceCountRaw,source",
      '"2026-04-01T10:04:05.034Z",x,x,xstac1,https://x.com/XSTAC1,followers,5581,"5,581 Followers",public-cache',
      "2026-04-01T10:06:37.551Z,paranoid-bitcoin-anarchists,x,1871996451812769951,https://x.com/i/communities/1871996451812769951,members,787,787 Members,public-cache",
      "",
    ].join("\n"),
    "utf8",
  );

  t.after(() => {
    fs.rmSync(path.join(ROOT, "tmp/tests/follower-history-migration"), {
      recursive: true,
      force: true,
    });
  });

  const links: OpenLink[] = [
    {
      id: "x",
      label: "X",
      url: "https://x.com/XSTAC1",
      type: "rich",
      icon: "x",
      enabled: true,
    },
    {
      id: "paranoid-bitcoin-anarchists",
      label: "Paranoid Bitcoin Anarchists",
      url: "https://x.com/i/communities/1871996451812769951",
      type: "rich",
      icon: "x",
      enabled: true,
    },
  ];

  const changed = migrateFollowerHistoryCsvLayout(links, { historyRepoRoot });
  const xRows = readFollowerHistoryCsvFile(`${historyRepoRoot}/x.csv`);
  const communityRows = readFollowerHistoryCsvFile(
    `${historyRepoRoot}/paranoid-bitcoin-anarchists.csv`,
  );

  assert.equal(changed, true);
  assert.equal(xRows.length, 1);
  assert.equal(xRows[0]?.linkId, "x");
  assert.equal(communityRows.length, 1);
  assert.equal(communityRows[0]?.linkId, "paranoid-bitcoin-anarchists");
});

test("buildFollowerHistoryIndexEntries keeps separate entries for links that share a platform", (t) => {
  const historyRepoRoot = "tmp/tests/follower-history-shared-platform/public/history/followers";
  const absoluteHistoryRoot = path.join(ROOT, historyRepoRoot);
  fs.mkdirSync(absoluteHistoryRoot, { recursive: true });
  fs.writeFileSync(
    path.join(absoluteHistoryRoot, "x.csv"),
    [
      "observedAt,linkId,platform,handle,canonicalUrl,audienceKind,audienceCount,audienceCountRaw,source",
      '"2026-04-01T10:06:37.551Z",x,x,xstac1,https://x.com/XSTAC1,followers,5581,"5,581 Followers",public-cache',
      "",
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(absoluteHistoryRoot, "paranoid-bitcoin-anarchists.csv"),
    [
      "observedAt,linkId,platform,handle,canonicalUrl,audienceKind,audienceCount,audienceCountRaw,source",
      "2026-04-01T10:06:37.551Z,paranoid-bitcoin-anarchists,x,1871996451812769951,https://x.com/i/communities/1871996451812769951,members,787,787 Members,public-cache",
      "",
    ].join("\n"),
    "utf8",
  );

  t.after(() => {
    fs.rmSync(path.join(ROOT, "tmp/tests/follower-history-shared-platform"), {
      recursive: true,
      force: true,
    });
  });

  const links: OpenLink[] = [
    {
      id: "x",
      label: "X",
      url: "https://x.com/XSTAC1",
      type: "rich",
      icon: "x",
      enabled: true,
    },
    {
      id: "paranoid-bitcoin-anarchists",
      label: "Paranoid Bitcoin Anarchists",
      url: "https://x.com/i/communities/1871996451812769951",
      type: "rich",
      icon: "x",
      enabled: true,
    },
  ];

  const entries = buildFollowerHistoryIndexEntries(links, { historyRepoRoot });

  assert.deepEqual(entries, [
    {
      linkId: "paranoid-bitcoin-anarchists",
      label: "Paranoid Bitcoin Anarchists",
      platform: "x",
      handle: "1871996451812769951",
      canonicalUrl: "https://x.com/i/communities/1871996451812769951",
      audienceKind: "members",
      csvPath: "history/followers/paranoid-bitcoin-anarchists.csv",
      latestAudienceCount: 787,
      latestAudienceCountRaw: "787 Members",
      latestObservedAt: "2026-04-01T10:06:37.551Z",
    },
    {
      linkId: "x",
      label: "X",
      platform: "x",
      handle: "xstac1",
      canonicalUrl: "https://x.com/XSTAC1",
      audienceKind: "followers",
      csvPath: "history/followers/x.csv",
      latestAudienceCount: 5581,
      latestAudienceCountRaw: "5,581 Followers",
      latestObservedAt: "2026-04-01T10:06:37.551Z",
    },
  ]);
});
