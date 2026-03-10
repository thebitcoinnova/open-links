import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import {
  appendFollowerHistoryRows,
  buildFollowerHistoryCsvRepoPath,
  readFollowerHistoryCsvFile,
  writeFollowerHistoryIndex,
} from "./append-history";

const ROOT = process.cwd();

test("appendFollowerHistoryRows creates and appends rows without rewriting columns", (t) => {
  const historyRepoRoot = "tmp/tests/follower-history";
  const csvPath = buildFollowerHistoryCsvRepoPath("tmp-platform", {
    historyRepoRoot,
  });
  const absoluteCsvPath = path.join(ROOT, csvPath);
  const absoluteDir = path.dirname(absoluteCsvPath);

  t.after(() => {
    fs.rmSync(absoluteDir, { recursive: true, force: true });
  });

  const first = appendFollowerHistoryRows({
    historyRepoRoot,
    platform: "tmp-platform",
    rows: [
      {
        observedAt: "2026-03-10T07:00:00.000Z",
        linkId: "tmp-platform",
        platform: "tmp-platform",
        handle: "tmp",
        canonicalUrl: "https://example.com/tmp",
        audienceKind: "followers",
        audienceCount: 10,
        audienceCountRaw: "10 followers",
        source: "public-cache",
      },
    ],
  });

  const second = appendFollowerHistoryRows({
    historyRepoRoot,
    platform: "tmp-platform",
    rows: [
      {
        observedAt: "2026-03-11T07:00:00.000Z",
        linkId: "tmp-platform",
        platform: "tmp-platform",
        handle: "tmp",
        canonicalUrl: "https://example.com/tmp",
        audienceKind: "followers",
        audienceCount: 10,
        audienceCountRaw: "10 followers",
        source: "public-cache",
      },
    ],
  });

  assert.equal(first.changed, true);
  assert.equal(second.changed, true);
  assert.equal(readFollowerHistoryCsvFile(csvPath).length, 2);
  assert.equal(second.rows[1]?.observedAt, "2026-03-11T07:00:00.000Z");
});

test("writeFollowerHistoryIndex writes sorted public entries", (t) => {
  const historyRepoRoot = "tmp/tests/follower-history-index";
  const absoluteDir = path.join(ROOT, historyRepoRoot);
  const indexPath = path.join(absoluteDir, "index.json");

  t.after(() => {
    fs.rmSync(absoluteDir, { recursive: true, force: true });
  });

  const changed = writeFollowerHistoryIndex(
    [
      {
        linkId: "x",
        label: "X",
        platform: "x",
        handle: "pryszkie",
        canonicalUrl: "https://x.com/pryszkie",
        audienceKind: "followers",
        csvPath: "history/followers/x.csv",
        latestAudienceCount: 1351,
        latestAudienceCountRaw: "1,351 Followers",
        latestObservedAt: "2026-03-10T07:00:00.000Z",
      },
      {
        linkId: "github",
        label: "GitHub",
        platform: "github",
        handle: "prizz",
        canonicalUrl: "https://github.com/pRizz",
        audienceKind: "followers",
        csvPath: "history/followers/github.csv",
        latestAudienceCount: 90,
        latestAudienceCountRaw: "90 followers",
        latestObservedAt: "2026-03-10T07:00:00.000Z",
      },
    ],
    "2026-03-10T07:00:00.000Z",
    {
      indexRepoPath: `${historyRepoRoot}/index.json`,
    },
  );

  const index = JSON.parse(fs.readFileSync(indexPath, "utf8")) as {
    entries: Array<{ platform: string }>;
  };

  assert.equal(changed, true);
  assert.deepEqual(
    index.entries.map((entry) => entry.platform),
    ["github", "x"],
  );
});
