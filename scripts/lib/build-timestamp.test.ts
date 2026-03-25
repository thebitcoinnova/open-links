import assert from "node:assert/strict";
import test from "node:test";
import { resolveStableBuildTimestamp } from "./build-timestamp";

test("resolveStableBuildTimestamp prefers an explicit value", () => {
  // Arrange
  const explicitValue = "2026-03-16T12:34:56.000Z";

  // Act
  const timestamp = resolveStableBuildTimestamp({
    explicitValue,
    fallbackNow: () => "2026-03-16T00:00:00.000Z",
  });

  // Assert
  assert.equal(timestamp, explicitValue);
});

test("resolveStableBuildTimestamp uses the fallback clock when no explicit value is present", () => {
  // Arrange
  const fallbackNow = "2026-03-16T00:00:00.000Z";

  // Act
  const timestamp = resolveStableBuildTimestamp({
    fallbackNow: () => fallbackNow,
  });

  // Assert
  assert.equal(timestamp, fallbackNow);
});
