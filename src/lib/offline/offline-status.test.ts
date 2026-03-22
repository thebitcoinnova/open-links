import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAvailableOfflineResource,
  buildUnavailableOfflineResource,
  resolveAnalyticsOverviewMessage,
  resolveFollowerHistoryEmptyStateMessage,
} from "./offline-status";

test("offline status helpers build stable resource wrappers", () => {
  // Arrange
  const available = buildAvailableOfflineResource(["history"]);
  const unavailable = buildUnavailableOfflineResource("network");

  // Assert
  assert.deepEqual(available, { status: "available", value: ["history"] });
  assert.deepEqual(unavailable, { reason: "network", status: "unavailable" });
});

test("analytics overview explains uncached offline history distinctly", () => {
  // Arrange
  const message = resolveAnalyticsOverviewMessage({
    connectivity: "offline",
    entryCount: 0,
    status: "unavailable",
    unavailableReason: "network",
  });

  // Assert
  assert.equal(
    message,
    "Follower history is unavailable offline until analytics has been loaded online once.",
  );
});

test("analytics overview preserves the published-empty state", () => {
  // Arrange
  const message = resolveAnalyticsOverviewMessage({
    connectivity: "online",
    entryCount: 0,
    status: "available",
  });

  // Assert
  assert.equal(message, "No public follower history is published yet.");
});

test("chart empty state explains uncached offline history distinctly", () => {
  // Arrange
  const message = resolveFollowerHistoryEmptyStateMessage({
    connectivity: "offline",
    status: "unavailable",
    unavailableReason: "network",
  });

  // Assert
  assert.equal(
    message,
    "History is unavailable offline until this chart has been loaded online once.",
  );
});

test("chart empty state keeps the normal empty copy for available data", () => {
  // Arrange
  const message = resolveFollowerHistoryEmptyStateMessage({
    connectivity: "online",
    status: "available",
  });

  // Assert
  assert.equal(message, "No history in this range yet.");
});
