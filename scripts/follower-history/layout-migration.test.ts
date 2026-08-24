import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import type { OpenLink } from "../../src/lib/content/load-content";
import {
  buildFollowerHistoryIndexEntries,
  migrateFollowerHistoryCsvLayout,
} from "../sync-follower-history";
import { readFollowerHistoryCsvFile } from "./append-history";

const ROOT = process.cwd();

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
