import assert from "node:assert/strict";
import test from "node:test";
import {
  type GeneratedContentImageEntry,
  buildStableContentImagesManifest,
  stabilizeContentImageEntry,
} from "./sync-content-images";

test("preserves content-image updatedAt and persisted status on no-op cache refreshes", () => {
  // Arrange
  const previous: GeneratedContentImageEntry = {
    sourceUrl: "https://example.com/image.jpg",
    resolvedPath: "generated/images/example.jpg",
    status: "fetched",
    etag: '"old"',
    cacheControl: "max-age=60",
    expiresAt: "2026-03-08T10:01:00.000Z",
    contentType: "image/jpeg",
    bytes: 1234,
    updatedAt: "2026-03-08T10:00:00.000Z",
  };

  // Act
  const stabilized = stabilizeContentImageEntry(previous, {
    ...previous,
    status: "cache_fresh",
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

test("preserves content-image manifest generatedAt when stabilized entries are unchanged", () => {
  // Arrange
  const previousEntry: GeneratedContentImageEntry = {
    sourceUrl: "https://example.com/image.jpg",
    resolvedPath: "generated/images/example.jpg",
    status: "fetched",
    contentType: "image/jpeg",
    bytes: 1234,
    updatedAt: "2026-03-08T10:00:00.000Z",
  };

  // Act
  const manifest = buildStableContentImagesManifest({
    previousManifest: {
      generatedAt: "2026-03-08T11:00:00.000Z",
      byUrl: {
        "https://example.com/image.jpg": previousEntry,
      },
    },
    byUrl: {
      "https://example.com/image.jpg": previousEntry,
    },
    generatedAt: "2026-03-08T12:00:00.000Z",
  });

  // Assert
  assert.equal(manifest.generatedAt, "2026-03-08T11:00:00.000Z");
});
