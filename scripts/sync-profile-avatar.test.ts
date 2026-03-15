import assert from "node:assert/strict";
import test from "node:test";
import { type ProfileAvatarManifest, stabilizeProfileAvatarManifest } from "./sync-profile-avatar";

test("preserves avatar updatedAt and persisted status on no-op revalidation", () => {
  // Arrange
  const previous: ProfileAvatarManifest = {
    sourceUrl: "https://example.com/avatar.jpg",
    resolvedPath: "cache/profile-avatar/profile-avatar.jpg",
    etag: '"old"',
    lastModified: "Sat, 07 Mar 2026 10:00:00 GMT",
    contentType: "image/jpeg",
    bytes: 4321,
    updatedAt: "2026-03-08T10:00:00.000Z",
  };

  // Act
  const stabilized = stabilizeProfileAvatarManifest(previous, {
    ...previous,
    updatedAt: "2026-03-08T12:00:00.000Z",
  });

  // Assert
  assert.equal(stabilized.updatedAt, "2026-03-08T10:00:00.000Z");
  assert.equal(stabilized.etag, '"old"');
  assert.equal(stabilized.lastModified, "Sat, 07 Mar 2026 10:00:00 GMT");
  assert.equal(stabilized.bytes, 4321);
});
