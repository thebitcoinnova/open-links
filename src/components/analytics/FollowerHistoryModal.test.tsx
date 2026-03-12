import assert from "node:assert/strict";
import test from "node:test";
import {
  MODE_OPTIONS,
  RANGE_OPTIONS,
  resolveFollowerHistoryModalAriaLabel,
} from "./FollowerHistoryModal";

test("resolveFollowerHistoryModalAriaLabel uses the entry label when available", () => {
  assert.equal(
    resolveFollowerHistoryModalAriaLabel({
      audienceKind: "followers",
      csvPath: "/history/github.csv",
      canonicalUrl: "https://github.com/pRizz",
      handle: "prizz",
      label: "GitHub",
      latestAudienceCount: 90,
      latestAudienceCountRaw: "90 followers",
      latestObservedAt: "2026-03-11T00:00:00Z",
      linkId: "github",
      platform: "github",
    }),
    "GitHub follower history",
  );
});

test("resolveFollowerHistoryModalAriaLabel falls back to Platform", () => {
  assert.equal(resolveFollowerHistoryModalAriaLabel(undefined), "Platform follower history");
});

test("follower history modal range options stay in the expected order", () => {
  assert.deepEqual(
    RANGE_OPTIONS.map((option) => option.value),
    ["30d", "90d", "180d", "all"],
  );
});

test("follower history modal mode options stay in the expected order", () => {
  assert.deepEqual(
    MODE_OPTIONS.map((option) => option.value),
    ["raw", "growth"],
  );
});
