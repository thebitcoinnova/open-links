import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { mergeMetadataWithManualSocialProfileOverrides } from "../../src/lib/content/social-profile-fields";
import {
  computePublicCacheExpiresAt,
  hasCacheablePublicMetadata,
  isPublicCacheFresh,
  loadPublicCacheRegistry,
  resolveCachedEntryStatus,
  toEnrichmentMetadataFromPublicCache,
  toPublicCacheMetadata,
  writePublicCacheRegistry,
} from "./public-cache";

const ROOT = process.cwd();

test("loads a missing public cache manifest as an empty registry", () => {
  // Arrange
  const cachePath = "tmp/tests/does-not-exist-public-cache.json";

  // Act
  const registry = loadPublicCacheRegistry({ cachePath });

  // Assert
  assert.equal(registry.version, 1);
  assert.deepEqual(registry.entries, {});
});

test("round-trips a public cache manifest through disk with normalized metadata", (t) => {
  // Arrange
  const cachePath = "tmp/tests/rich-public-cache.json";
  const absoluteCachePath = path.join(ROOT, cachePath);
  t.after(() => {
    if (fs.existsSync(absoluteCachePath)) {
      fs.rmSync(absoluteCachePath, { force: true });
    }
  });

  writePublicCacheRegistry(cachePath, {
    version: 1,
    updatedAt: "2026-03-07T12:00:00.000Z",
    entries: {
      github: {
        linkId: "github",
        sourceUrl: "https://github.com/pRizz",
        capturedAt: "2026-03-07T12:00:00.000Z",
        updatedAt: "2026-03-07T12:05:00.000Z",
        metadata: {
          title: "  Peter Ryszkiewicz  ",
          description: "  Open source and experiments. ",
          image: "https://avatars.githubusercontent.com/u/1?v=4",
          sourceLabel: " github.com ",
          followersCount: 90,
          followersCountRaw: " 90 followers ",
        },
        etag: ' "abc" ',
        cacheControl: " max-age=300 ",
      },
    },
  });

  // Act
  const registry = loadPublicCacheRegistry({ cachePath });

  // Assert
  assert.deepEqual(registry.entries.github?.metadata, {
    title: "Peter Ryszkiewicz",
    description: "Open source and experiments.",
    image: "https://avatars.githubusercontent.com/u/1?v=4",
    sourceLabel: "github.com",
    followersCount: 90,
    followersCountRaw: "90 followers",
  });
  assert.equal(registry.entries.github?.etag, '"abc"');
  assert.equal(registry.entries.github?.cacheControl, "max-age=300");
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

test("public cache metadata remains lower precedence than manual overrides", () => {
  // Arrange
  const cached = toEnrichmentMetadataFromPublicCache(
    toPublicCacheMetadata({
      title: "Generated title",
      description: "Generated description",
      image: "https://example.com/generated.jpg",
      profileImage: "https://example.com/generated-avatar.jpg",
      followersCount: 24,
      followersCountRaw: "24 followers",
    }),
  );

  // Act
  const merged = mergeMetadataWithManualSocialProfileOverrides(
    {
      profileImage: "https://example.com/manual-avatar.jpg",
      followersCount: 12,
      followersCountRaw: "12 followers",
    },
    cached,
  );

  // Assert
  assert.deepEqual(merged, {
    title: "Generated title",
    description: "Generated description",
    image: "https://example.com/generated.jpg",
    profileImage: "https://example.com/manual-avatar.jpg",
    followersCount: 12,
    followersCountRaw: "12 followers",
  });
});

test("ignores source-label-only payloads when deciding whether metadata is cacheable", () => {
  // Arrange
  const metadata = {
    sourceLabel: "example.com",
  };

  // Act
  const cacheable = hasCacheablePublicMetadata(metadata);

  // Assert
  assert.equal(cacheable, false);
});
