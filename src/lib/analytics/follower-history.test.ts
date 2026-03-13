import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFollowerHistoryAccessibleSummary,
  buildFollowerHistoryAvailabilityMap,
  buildFollowerHistoryCsvPublicPath,
  buildFollowerHistoryPoints,
  describeFollowerHistoryRange,
  filterFollowerHistoryRows,
  parseCompactAudienceCount,
  parseFollowerHistoryCsv,
  parseFollowerHistoryIndex,
  resolveFollowerHistoryPrimaryAudience,
  serializeFollowerHistoryCsv,
} from "./follower-history";

test("primary audience resolution prefers subscribers and falls back to followers", () => {
  assert.deepEqual(
    resolveFollowerHistoryPrimaryAudience({
      subscribersCount: 11,
      subscribersCountRaw: "11 subscribers",
      followersCount: 1351,
      followersCountRaw: "1,351 Followers",
    }),
    {
      audienceKind: "subscribers",
      audienceCount: 11,
      audienceCountRaw: "11 subscribers",
    },
  );

  assert.deepEqual(
    resolveFollowerHistoryPrimaryAudience({
      followersCountRaw: "1.4K Followers",
    }),
    {
      audienceKind: "followers",
      audienceCount: 1400,
      audienceCountRaw: "1.4K Followers",
    },
  );

  assert.equal(resolveFollowerHistoryPrimaryAudience({}), null);
});

test("compact audience parsing supports commas and metric suffixes", () => {
  assert.equal(parseCompactAudienceCount("1,351 Followers"), 1351);
  assert.equal(parseCompactAudienceCount("3.3K followers"), 3300);
  assert.equal(parseCompactAudienceCount("2M subscribers"), 2_000_000);
  assert.equal(parseCompactAudienceCount(""), undefined);
});

test("follower history CSV round-trips rows with quoted raw text", () => {
  const csv = serializeFollowerHistoryCsv([
    {
      observedAt: "2026-03-10T07:00:00.000Z",
      linkId: "x",
      platform: "x",
      handle: "pryszkie",
      canonicalUrl: "https://x.com/pryszkie",
      audienceKind: "followers",
      audienceCount: 1351,
      audienceCountRaw: "1,351 Followers",
      source: "public-cache",
    },
  ]);

  assert.match(csv, /"1,351 Followers"/u);
  assert.deepEqual(parseFollowerHistoryCsv(csv), [
    {
      observedAt: "2026-03-10T07:00:00.000Z",
      linkId: "x",
      platform: "x",
      handle: "pryszkie",
      canonicalUrl: "https://x.com/pryszkie",
      audienceKind: "followers",
      audienceCount: 1351,
      audienceCountRaw: "1,351 Followers",
      source: "public-cache",
    },
  ]);
});

test("follower history filtering and point-building preserve sorted time series", () => {
  const rows = [
    {
      observedAt: "2026-01-01T07:00:00.000Z",
      linkId: "github",
      platform: "github",
      handle: "prizz",
      canonicalUrl: "https://github.com/pRizz",
      audienceKind: "followers",
      audienceCount: 80,
      audienceCountRaw: "80 followers",
      source: "public-cache",
    },
    {
      observedAt: "2026-03-08T07:00:00.000Z",
      linkId: "github",
      platform: "github",
      handle: "prizz",
      canonicalUrl: "https://github.com/pRizz",
      audienceKind: "followers",
      audienceCount: 90,
      audienceCountRaw: "90 followers",
      source: "public-cache",
    },
    {
      observedAt: "2026-03-10T07:00:00.000Z",
      linkId: "github",
      platform: "github",
      handle: "prizz",
      canonicalUrl: "https://github.com/pRizz",
      audienceKind: "followers",
      audienceCount: 90,
      audienceCountRaw: "90 followers",
      source: "public-cache",
    },
  ] as const;

  assert.equal(
    filterFollowerHistoryRows(rows, "30d", new Date("2026-03-10T08:00:00.000Z")).length,
    2,
  );
  assert.equal(
    filterFollowerHistoryRows(rows, "all", new Date("2026-03-10T08:00:00.000Z")).length,
    3,
  );

  assert.deepEqual(
    buildFollowerHistoryPoints(rows, "growth").map((point) => point.value),
    [0, 10, 0],
  );
  assert.deepEqual(
    buildFollowerHistoryPoints(rows, "raw").map((point) => point.value),
    [80, 90, 90],
  );
});

test("index parsing and availability maps stay keyed by link id", () => {
  const index = parseFollowerHistoryIndex({
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
        csvPath: buildFollowerHistoryCsvPublicPath("github"),
        latestAudienceCount: 90,
        latestAudienceCountRaw: "90 followers",
        latestObservedAt: "2026-03-10T07:00:00.000Z",
      },
    ],
  });

  const availability = buildFollowerHistoryAvailabilityMap(index);
  assert.equal(availability.get("github")?.platform, "github");
  assert.equal(availability.get("github")?.csvPath, "history/followers/github.csv");
});

test("range descriptions use friendly copy for analytics summaries", () => {
  assert.equal(describeFollowerHistoryRange("30d"), "30 days");
  assert.equal(describeFollowerHistoryRange("all"), "all available history");
});

test("accessible history summaries describe latest count and change over time", () => {
  const rows = [
    {
      observedAt: "2026-03-01T07:00:00.000Z",
      linkId: "github",
      platform: "github",
      handle: "prizz",
      canonicalUrl: "https://github.com/pRizz",
      audienceKind: "followers",
      audienceCount: 80,
      audienceCountRaw: "80 followers",
      source: "public-cache",
    },
    {
      observedAt: "2026-03-10T07:00:00.000Z",
      linkId: "github",
      platform: "github",
      handle: "prizz",
      canonicalUrl: "https://github.com/pRizz",
      audienceKind: "followers",
      audienceCount: 90,
      audienceCountRaw: "90 followers",
      source: "public-cache",
    },
  ] as const;

  assert.equal(
    buildFollowerHistoryAccessibleSummary({
      audienceKind: "followers",
      label: "GitHub",
      rangeDescription: "30 days",
      rows,
    }),
    "GitHub followers history for 30 days. Latest count 90 followers. up 10 from 80 followers on Mar 1, 2026 to 90 followers on Mar 10, 2026.",
  );
});
