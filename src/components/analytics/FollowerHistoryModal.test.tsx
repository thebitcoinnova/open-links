import assert from "node:assert/strict";
import test from "node:test";
import { resolveFollowerHistoryModalAriaLabel } from "./FollowerHistoryModal";
import {
  FOLLOWER_HISTORY_MODE_OPTIONS,
  FOLLOWER_HISTORY_RANGE_OPTIONS,
} from "./follower-history-controls";

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

test("resolveFollowerHistoryModalAriaLabel reflects member history entries", () => {
  assert.equal(
    resolveFollowerHistoryModalAriaLabel({
      audienceKind: "members",
      csvPath: "/history/x.csv",
      canonicalUrl: "https://x.com/i/communities/1871996451812769951",
      handle: "1871996451812769951",
      label: "PARANOID BITCOIN ANARCHISTS",
      latestAudienceCount: 785,
      latestAudienceCountRaw: "785 Members",
      latestObservedAt: "2026-03-11T00:00:00Z",
      linkId: "x-community",
      platform: "x",
    }),
    "PARANOID BITCOIN ANARCHISTS member history",
  );
});

test("resolveFollowerHistoryModalAriaLabel falls back to Platform", () => {
  assert.equal(resolveFollowerHistoryModalAriaLabel(undefined), "Platform follower history");
});

test("follower history modal range options stay in the expected order", () => {
  assert.deepEqual(
    FOLLOWER_HISTORY_RANGE_OPTIONS.map((option) => option.value),
    ["30d", "90d", "180d", "all"],
  );
});

test("follower history modal mode options stay in the expected order", () => {
  assert.deepEqual(
    FOLLOWER_HISTORY_MODE_OPTIONS.map((option) => option.value),
    ["raw", "growth"],
  );
});
