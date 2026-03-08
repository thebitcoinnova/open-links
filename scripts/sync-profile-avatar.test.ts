import assert from "node:assert/strict";
import test from "node:test";
import { type ProfileAvatarManifest, stabilizeProfileAvatarManifest } from "./sync-profile-avatar";

test("preserves avatar updatedAt and persisted status on no-op revalidation", () => {
  // Arrange
  const previous: ProfileAvatarManifest = {
    sourceUrl: "https://example.com/avatar.jpg",
    resolvedPath: "generated/profile-avatar.jpg",
    status: "fetched",
    etag: '"old"',
    cacheControl: "max-age=60",
    expiresAt: "2026-03-08T10:01:00.000Z",
    updatedAt: "2026-03-08T10:00:00.000Z",
  };

  // Act
  const stabilized = stabilizeProfileAvatarManifest(previous, {
    ...previous,
    status: "not_modified",
    etag: '"new"',
    cacheControl: "max-age=300",
    expiresAt: "2026-03-08T12:05:00.000Z",
    updatedAt: "2026-03-08T12:00:00.000Z",
  });

  // Assert
  assert.equal(stabilized.updatedAt, "2026-03-08T10:00:00.000Z");
  assert.equal(stabilized.status, "fetched");
  assert.equal(stabilized.etag, '"new"');
  assert.equal(stabilized.cacheControl, "max-age=300");
  assert.equal(stabilized.expiresAt, "2026-03-08T12:05:00.000Z");
});
