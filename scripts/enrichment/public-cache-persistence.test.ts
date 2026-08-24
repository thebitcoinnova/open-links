import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { mergeMetadataWithManualSocialProfileOverrides } from "../../src/lib/content/social-profile-fields";
import {
  applyPublicCachePersistence,
  buildPublicCacheEntry,
  computePublicCacheExpiresAt,
  hasCacheablePublicMetadata,
  isPublicCacheFresh,
  isPublicCacheIdentityMatch,
  loadPublicCacheRegistry,
  mergePublicCacheMetadataForTarget,
  prunePublicCacheMetadataForTarget,
  resolveCachedEntryStatus,
  resolvePublicCacheEntry,
  resolvePublicCacheMetadataRegression,
  toEnrichmentMetadataFromPublicCache,
  toPublicCacheMetadata,
  writePublicCacheRegistry,
  writePublicCacheRuntimeRegistry,
} from "./public-cache";
import type { PublicCacheRegistry } from "./public-cache";

const ROOT = process.cwd();

test("clears runtime freshness when stable cache updates are suppressed", () => {
  // Arrange
  const registry: PublicCacheRegistry = {
    version: 1 as const,
    updatedAt: "2026-03-08T09:00:00.000Z",
    entries: {
      github: {
        linkId: "github",
        sourceUrl: "https://github.com/pRizz",
        capturedAt: "2026-03-07T12:00:00.000Z",
        updatedAt: "2026-03-07T12:05:00.000Z",
        metadata: {
          title: "Peter Ryszkiewicz",
          description: "Open source and experiments.",
          image: "https://avatars.githubusercontent.com/u/1?v=4",
        },
        etag: '"old"',
        cacheControl: "max-age=300",
        expiresAt: "2026-03-08T09:05:00.000Z",
        checkedAt: "2026-03-08T09:00:00.000Z",
      },
    },
  };
  const nextEntry = buildPublicCacheEntry({
    previous: registry.entries.github,
    linkId: "github",
    sourceUrl: "https://github.com/pRizz",
    metadata: {
      title: "Peter Ryszkiewicz",
      description: "Open source, experiments, and projects.",
      image: "https://avatars.githubusercontent.com/u/1?v=4",
    },
    updatedAt: "2026-03-09T10:00:00.000Z",
    etag: '"new"',
    cacheControl: "max-age=600",
    expiresAt: "2026-03-09T10:10:00.000Z",
    checkedAt: "2026-03-09T10:00:00.000Z",
  });

  // Act
  const result = applyPublicCachePersistence({
    registry,
    cacheKey: "github",
    nextEntry,
    allowStableWrite: false,
    updatedAt: "2026-03-09T10:00:00.000Z",
  });

  // Assert
  assert.equal(result.action, "runtime_cleared");
  assert.equal(result.changed, true);
  assert.equal(result.stableWriteSkipped, true);
  assert.equal(result.skippedStableOperation, "upsert");
  assert.equal(registry.entries.github.metadata.description, "Open source and experiments.");
  assert.equal(registry.entries.github.etag, '"old"');
  assert.equal(registry.entries.github.cacheControl, undefined);
  assert.equal(registry.entries.github.expiresAt, undefined);
  assert.equal(registry.entries.github.checkedAt, undefined);
  assert.equal(registry.entries.github.updatedAt, "2026-03-07T12:05:00.000Z");
});

test("updates only runtime fields when revalidation succeeds without stable metadata drift", () => {
  // Arrange
  const registry: PublicCacheRegistry = {
    version: 1 as const,
    updatedAt: "2026-03-08T09:00:00.000Z",
    entries: {
      github: {
        linkId: "github",
        sourceUrl: "https://github.com/pRizz",
        capturedAt: "2026-03-07T12:00:00.000Z",
        updatedAt: "2026-03-07T12:05:00.000Z",
        metadata: {
          title: "Peter Ryszkiewicz",
          description: "Open source and experiments.",
          image: "https://avatars.githubusercontent.com/u/1?v=4",
        },
        etag: '"old"',
        cacheControl: "max-age=300",
        expiresAt: "2026-03-08T09:05:00.000Z",
        checkedAt: "2026-03-08T09:00:00.000Z",
      },
    },
  };
  const nextEntry = buildPublicCacheEntry({
    previous: registry.entries.github,
    linkId: "github",
    sourceUrl: "https://github.com/pRizz",
    metadata: registry.entries.github.metadata,
    updatedAt: "2026-03-09T10:00:00.000Z",
    cacheControl: "max-age=900",
    expiresAt: "2026-03-09T10:15:00.000Z",
    checkedAt: "2026-03-09T10:00:00.000Z",
    checkStatus: "get_not_modified",
  });

  // Act
  const result = applyPublicCachePersistence({
    registry,
    cacheKey: "github",
    nextEntry,
    allowStableWrite: false,
    updatedAt: "2026-03-09T10:00:00.000Z",
  });

  // Assert
  assert.equal(result.action, "runtime_updated");
  assert.equal(result.changed, true);
  assert.equal(result.stableWriteSkipped, false);
  assert.equal(registry.entries.github.metadata.description, "Open source and experiments.");
  assert.equal(registry.entries.github.updatedAt, "2026-03-07T12:05:00.000Z");
  assert.equal(registry.entries.github.etag, '"old"');
  assert.equal(registry.entries.github.lastModified, undefined);
  assert.equal(registry.entries.github.cacheControl, "max-age=900");
  assert.equal(registry.entries.github.expiresAt, "2026-03-09T10:15:00.000Z");
  assert.equal(registry.entries.github.checkedAt, "2026-03-09T10:00:00.000Z");
  assert.equal(registry.entries.github.checkStatus, "get_not_modified");
});

test("applies stable public cache updates when explicit writes are enabled", () => {
  // Arrange
  const registry: PublicCacheRegistry = {
    version: 1 as const,
    updatedAt: "2026-03-08T09:00:00.000Z",
    entries: {
      github: {
        linkId: "github",
        sourceUrl: "https://github.com/pRizz",
        capturedAt: "2026-03-07T12:00:00.000Z",
        updatedAt: "2026-03-07T12:05:00.000Z",
        metadata: {
          title: "Peter Ryszkiewicz",
          description: "Open source and experiments.",
          image: "https://avatars.githubusercontent.com/u/1?v=4",
        },
        etag: '"old"',
        cacheControl: "max-age=300",
        expiresAt: "2026-03-08T09:05:00.000Z",
        checkedAt: "2026-03-08T09:00:00.000Z",
      },
    },
  };
  const nextEntry = buildPublicCacheEntry({
    previous: registry.entries.github,
    linkId: "github",
    sourceUrl: "https://github.com/pRizz",
    metadata: {
      title: "Peter Ryszkiewicz",
      description: "Open source, experiments, and projects.",
      image: "https://avatars.githubusercontent.com/u/1?v=4",
    },
    updatedAt: "2026-03-09T10:00:00.000Z",
    etag: '"new"',
    cacheControl: "max-age=600",
    expiresAt: "2026-03-09T10:10:00.000Z",
    checkedAt: "2026-03-09T10:00:00.000Z",
  });

  // Act
  const result = applyPublicCachePersistence({
    registry,
    cacheKey: "github",
    nextEntry,
    allowStableWrite: true,
    updatedAt: "2026-03-09T10:00:00.000Z",
  });

  // Assert
  assert.equal(result.action, "stable_updated");
  assert.equal(result.changed, true);
  assert.equal(result.stableWriteSkipped, false);
  assert.equal(
    registry.entries.github.metadata.description,
    "Open source, experiments, and projects.",
  );
  assert.equal(registry.entries.github.updatedAt, "2026-03-09T10:00:00.000Z");
  assert.equal(registry.entries.github.etag, '"new"');
  assert.equal(registry.entries.github.expiresAt, "2026-03-09T10:10:00.000Z");
});

test("clears runtime freshness when non-cacheable results do not persist stable deletions", () => {
  // Arrange
  const registry: PublicCacheRegistry = {
    version: 1 as const,
    updatedAt: "2026-03-08T09:00:00.000Z",
    entries: {
      github: {
        linkId: "github",
        sourceUrl: "https://github.com/pRizz",
        capturedAt: "2026-03-07T12:00:00.000Z",
        updatedAt: "2026-03-07T12:05:00.000Z",
        metadata: {
          title: "Peter Ryszkiewicz",
          description: "Open source and experiments.",
          image: "https://avatars.githubusercontent.com/u/1?v=4",
        },
        etag: '"old"',
        cacheControl: "max-age=300",
        expiresAt: "2026-03-08T09:05:00.000Z",
        checkedAt: "2026-03-08T09:00:00.000Z",
      },
    },
  };

  // Act
  const result = applyPublicCachePersistence({
    registry,
    cacheKey: "github",
    allowStableWrite: false,
    updatedAt: "2026-03-09T10:00:00.000Z",
  });

  // Assert
  assert.equal(result.action, "runtime_cleared");
  assert.equal(result.changed, true);
  assert.equal(result.stableWriteSkipped, true);
  assert.equal(result.skippedStableOperation, "delete");
  assert.equal(registry.entries.github.metadata.title, "Peter Ryszkiewicz");
  assert.equal(registry.entries.github.etag, '"old"');
  assert.equal(registry.entries.github.expiresAt, undefined);
  assert.equal(registry.entries.github.checkedAt, undefined);
});

test("computes freshness from cache-control and classifies cached metadata completeness", () => {
  // Arrange
  const expiresAt = computePublicCacheExpiresAt(
    "public, max-age=120",
    new Date(Date.now()).toUTCString(),
  );

  // Act
  const fresh = isPublicCacheFresh(expiresAt);
  const fullStatus = resolveCachedEntryStatus({
    title: "Title",
    description: "Description",
    image: "https://example.com/preview.jpg",
  });
  const partialStatus = resolveCachedEntryStatus({
    title: "Title",
    image: "https://example.com/preview.jpg",
  });

  // Assert
  assert.equal(fresh, true);
  assert.deepEqual(fullStatus, {
    status: "fetched",
    missingFields: undefined,
  });
  assert.deepEqual(partialStatus, {
    status: "partial",
    missingFields: ["description"],
  });
});

test("preserves public cache timestamps when only revalidation headers change", () => {
  // Arrange
  const previous = {
    linkId: "github",
    sourceUrl: "https://github.com/pRizz",
    capturedAt: "2026-03-07T12:00:00.000Z",
    updatedAt: "2026-03-07T13:00:00.000Z",
    metadata: {
      title: "pRizz - Overview",
      description: "Open source and experiments.",
      image: "https://avatars.githubusercontent.com/u/1?v=4",
    },
    etag: '"old"',
    cacheControl: "max-age=60",
    expiresAt: "2026-03-07T13:01:00.000Z",
    checkedAt: "2026-03-07T13:01:00.000Z",
  };

  // Act
  const next = buildPublicCacheEntry({
    previous,
    linkId: "github",
    sourceUrl: "https://github.com/pRizz",
    metadata: previous.metadata,
    updatedAt: "2026-03-08T12:00:00.000Z",
    etag: '"new"',
    cacheControl: "max-age=300",
    expiresAt: "2026-03-08T12:05:00.000Z",
    checkedAt: "2026-03-08T12:00:00.000Z",
  });

  // Assert
  assert.equal(next.capturedAt, "2026-03-07T12:00:00.000Z");
  assert.equal(next.updatedAt, "2026-03-07T13:00:00.000Z");
  assert.equal(next.etag, '"new"');
  assert.equal(next.cacheControl, "max-age=300");
  assert.equal(next.expiresAt, "2026-03-08T12:05:00.000Z");
  assert.equal(next.checkedAt, "2026-03-08T12:00:00.000Z");
});

test("preserves capturedAt and bumps updatedAt when public cache metadata changes", () => {
  // Arrange
  const previous = {
    linkId: "github",
    sourceUrl: "https://github.com/pRizz",
    capturedAt: "2026-03-07T12:00:00.000Z",
    updatedAt: "2026-03-07T13:00:00.000Z",
    metadata: {
      title: "pRizz - Overview",
      description: "Open source and experiments.",
      image: "https://avatars.githubusercontent.com/u/1?v=4",
    },
  };

  // Act
  const next = buildPublicCacheEntry({
    previous,
    linkId: "github",
    sourceUrl: "https://github.com/pRizz",
    metadata: {
      ...previous.metadata,
      description: "Open source, experiments, and projects.",
    },
    updatedAt: "2026-03-08T12:00:00.000Z",
  });

  // Assert
  assert.equal(next.capturedAt, "2026-03-07T12:00:00.000Z");
  assert.equal(next.updatedAt, "2026-03-08T12:00:00.000Z");
  assert.equal(next.metadata.description, "Open source, experiments, and projects.");
});
