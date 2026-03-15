import assert from "node:assert/strict";
import test from "node:test";
import {
  type GeneratedContentImageEntry,
  buildStableContentImagesManifest,
  collectCandidates,
  stabilizeContentImageEntry,
} from "./sync-content-images";

test("preserves content-image updatedAt and persisted status on no-op cache refreshes", () => {
  // Arrange
  const previous: GeneratedContentImageEntry = {
    sourceUrl: "https://example.com/image.jpg",
    resolvedPath: "cache/content-images/example.jpg",
    etag: '"old"',
    lastModified: "Sat, 07 Mar 2026 10:00:00 GMT",
    contentType: "image/jpeg",
    bytes: 1234,
    updatedAt: "2026-03-08T10:00:00.000Z",
  };

  // Act
  const stabilized = stabilizeContentImageEntry(previous, {
    ...previous,
    updatedAt: "2026-03-08T12:00:00.000Z",
  });

  // Assert
  assert.equal(stabilized.updatedAt, "2026-03-08T10:00:00.000Z");
  assert.equal(stabilized.etag, '"old"');
  assert.equal(stabilized.lastModified, "Sat, 07 Mar 2026 10:00:00 GMT");
});

test("preserves content-image manifest generatedAt when stabilized entries are unchanged", () => {
  // Arrange
  const previousEntry: GeneratedContentImageEntry = {
    sourceUrl: "https://example.com/image.jpg",
    resolvedPath: "cache/content-images/example.jpg",
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

test("collects all distinct image roles from manual and generated metadata", () => {
  // Arrange
  const linksPayload = {
    links: [
      {
        id: "substack",
        type: "rich",
        metadata: {
          image: "https://example.com/manual-preview.jpg",
          profileImage: "https://example.com/manual-avatar.jpg",
          ogImage: "https://example.com/manual-og.jpg",
          twitterImage: "https://example.com/manual-twitter.jpg",
        },
      },
    ],
  };
  const generatedMetadata = {
    links: {
      substack: {
        metadata: {
          image: "https://example.com/generated-preview.jpg",
          profileImage: "https://example.com/generated-avatar.jpg",
          ogImage: "https://example.com/generated-og.jpg",
          twitterImage: "https://example.com/generated-twitter.jpg",
        },
      },
    },
  };
  const sitePayload = {
    quality: {
      seo: {
        defaults: {
          ogImage: "https://example.com/site-og.jpg",
          twitterImage: "https://example.com/site-twitter.jpg",
        },
      },
    },
  };

  // Act
  const candidates = collectCandidates(linksPayload, generatedMetadata, sitePayload);

  // Assert
  assert.deepEqual(candidates, [
    "https://example.com/generated-preview.jpg",
    "https://example.com/generated-avatar.jpg",
    "https://example.com/generated-og.jpg",
    "https://example.com/generated-twitter.jpg",
    "https://example.com/manual-preview.jpg",
    "https://example.com/manual-avatar.jpg",
    "https://example.com/manual-og.jpg",
    "https://example.com/manual-twitter.jpg",
    "https://example.com/site-og.jpg",
    "https://example.com/site-twitter.jpg",
  ]);
});
