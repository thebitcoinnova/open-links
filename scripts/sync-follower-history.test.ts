import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import {
  type HistoryRunSnapshotSummary,
  createHistoryRunSummary,
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
