import assert from "node:assert/strict";
import test from "node:test";
import {
  collectContentImageSlots,
  getLinkContentImageSlotId,
  getSiteSeoContentImageSlotId,
} from "../src/lib/content/content-image-slots";
import {
  type RuntimeGeneratedContentImageEntry,
  type StableGeneratedContentImageEntry,
  buildStableContentImagesManifest,
  createPreviousState,
  stabilizeContentImageEntry,
} from "./sync-content-images";

test("preserves content-image updatedAt on no-op slot refreshes", () => {
  // Arrange
  const previous: StableGeneratedContentImageEntry = {
    resolvedPath: "cache/content-images/example.jpg",
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
});

test("updates content-image updatedAt when the resolved asset changes", () => {
  // Arrange
  const previous: StableGeneratedContentImageEntry = {
    resolvedPath: "cache/content-images/original.jpg",
    contentType: "image/jpeg",
    bytes: 1234,
    updatedAt: "2026-03-08T10:00:00.000Z",
  };

  // Act
  const stabilized = stabilizeContentImageEntry(previous, {
    resolvedPath: "cache/content-images/changed.jpg",
    contentType: "image/jpeg",
    bytes: 1234,
    updatedAt: "2026-03-08T12:00:00.000Z",
  });

  // Assert
  assert.equal(stabilized.updatedAt, "2026-03-08T12:00:00.000Z");
});

test("preserves content-image manifest generatedAt when stabilized slots are unchanged", () => {
  // Arrange
  const previousEntry: StableGeneratedContentImageEntry = {
    resolvedPath: "cache/content-images/example.jpg",
    contentType: "image/jpeg",
    bytes: 1234,
    updatedAt: "2026-03-08T10:00:00.000Z",
  };

  // Act
  const manifest = buildStableContentImagesManifest({
    previousManifest: {
      generatedAt: "2026-03-08T11:00:00.000Z",
      bySlot: {
        [getLinkContentImageSlotId("example", "image")]: previousEntry,
      },
    },
    bySlot: {
      [getLinkContentImageSlotId("example", "image")]: previousEntry,
    },
    generatedAt: "2026-03-08T12:00:00.000Z",
  });

  // Assert
  assert.equal(manifest.generatedAt, "2026-03-08T11:00:00.000Z");
});

test("reuses prior validators when a slot keeps the same source url", () => {
  // Arrange
  const stableEntry: StableGeneratedContentImageEntry = {
    resolvedPath: "cache/content-images/example.jpg",
    contentType: "image/jpeg",
    bytes: 1234,
    updatedAt: "2026-03-08T10:00:00.000Z",
  };
  const runtimeEntry: RuntimeGeneratedContentImageEntry = {
    sourceUrl: "https://example.com/avatar.jpg",
    etag: '"avatar-etag"',
    lastModified: "Tue, 08 Mar 2026 10:00:00 GMT",
    cacheControl: "max-age=3600",
    expiresAt: "2026-03-08T11:00:00.000Z",
  };

  // Act
  const previousState = createPreviousState(
    "https://example.com/avatar.jpg",
    stableEntry,
    runtimeEntry,
  );

  // Assert
  assert.equal(previousState?.etag, '"avatar-etag"');
  assert.equal(previousState?.lastModified, "Tue, 08 Mar 2026 10:00:00 GMT");
  assert.equal(previousState?.cacheControl, "max-age=3600");
  assert.equal(previousState?.expiresAt, "2026-03-08T11:00:00.000Z");
  assert.equal(previousState?.bytes, 1234);
});

test("drops prior validators when a slot source url changes", () => {
  // Arrange
  const stableEntry: StableGeneratedContentImageEntry = {
    resolvedPath: "cache/content-images/old-avatar.jpg",
    contentType: "image/jpeg",
    bytes: 4321,
    updatedAt: "2026-03-08T10:00:00.000Z",
  };
  const runtimeEntry: RuntimeGeneratedContentImageEntry = {
    sourceUrl: "https://example.com/old-avatar.jpg",
    etag: '"old-avatar-etag"',
    lastModified: "Tue, 08 Mar 2026 10:00:00 GMT",
    cacheControl: "max-age=86400",
    expiresAt: "2026-03-09T10:00:00.000Z",
  };

  // Act
  const previousState = createPreviousState(
    "https://example.com/new-avatar.jpg",
    stableEntry,
    runtimeEntry,
  );

  // Assert
  assert.equal(previousState?.etag, undefined);
  assert.equal(previousState?.lastModified, undefined);
  assert.equal(previousState?.cacheControl, undefined);
  assert.equal(previousState?.expiresAt, undefined);
  assert.equal(previousState?.bytes, 4321);
});

test("collects effective link and site image slots using current metadata precedence", () => {
  // Arrange
  const linksPayload = {
    links: [
      {
        id: "instagram",
        type: "rich",
        url: "https://www.instagram.com/example/",
        metadata: {
          image: "https://example.com/manual-preview.jpg",
          profileImage: "https://example.com/manual-avatar.jpg",
          ogImage: "https://example.com/manual-og.jpg",
        },
      },
    ],
  };
  const generatedMetadata = {
    links: {
      instagram: {
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
        socialImageFallback: "https://example.com/site-fallback.jpg",
        defaults: {
          ogImage: "https://example.com/site-og.jpg",
          twitterImage: "https://example.com/site-twitter.jpg",
        },
      },
    },
  };

  // Act
  const slots = collectContentImageSlots({
    linksPayload,
    generatedRichMetadata: generatedMetadata,
    sitePayload,
  });

  // Assert
  assert.deepEqual(slots, [
    {
      slotId: getLinkContentImageSlotId("instagram", "image"),
      sourceUrl: "https://example.com/generated-preview.jpg",
    },
    {
      slotId: getLinkContentImageSlotId("instagram", "profileImage"),
      sourceUrl: "https://example.com/manual-avatar.jpg",
    },
    {
      slotId: getLinkContentImageSlotId("instagram", "ogImage"),
      sourceUrl: "https://example.com/generated-og.jpg",
    },
    {
      slotId: getLinkContentImageSlotId("instagram", "twitterImage"),
      sourceUrl: "https://example.com/generated-twitter.jpg",
    },
    {
      slotId: getSiteSeoContentImageSlotId("socialImageFallback"),
      sourceUrl: "https://example.com/site-fallback.jpg",
    },
    {
      slotId: getSiteSeoContentImageSlotId("defaults.ogImage"),
      sourceUrl: "https://example.com/site-og.jpg",
    },
    {
      slotId: getSiteSeoContentImageSlotId("defaults.twitterImage"),
      sourceUrl: "https://example.com/site-twitter.jpg",
    },
  ]);
});

test("backfills social profileImage slots by default for non-excluded supported platforms", () => {
  // Arrange
  const linksPayload = {
    links: [
      {
        id: "x",
        type: "rich",
        url: "https://x.com/example",
        metadata: {
          image: "https://example.com/x-avatar.jpg",
        },
      },
    ],
  };

  // Act
  const slots = collectContentImageSlots({
    linksPayload,
    generatedRichMetadata: null,
    sitePayload: {},
  });

  // Assert
  assert.deepEqual(slots, [
    {
      slotId: getLinkContentImageSlotId("x", "image"),
      sourceUrl: "https://example.com/x-avatar.jpg",
    },
    {
      slotId: getLinkContentImageSlotId("x", "profileImage"),
      sourceUrl: "https://example.com/x-avatar.jpg",
    },
  ]);
});

test("does not synthesize social profileImage slots for excluded platforms", () => {
  // Arrange
  const linksPayload = {
    links: [
      {
        id: "substack",
        type: "rich",
        url: "https://peter.ryszkiewicz.us/",
        icon: "substack",
        metadata: {
          handle: "peterryszkiewicz",
          image: "https://example.com/substack-preview.jpg",
        },
      },
    ],
  };

  // Act
  const slots = collectContentImageSlots({
    linksPayload,
    generatedRichMetadata: null,
    sitePayload: {},
  });

  // Assert
  assert.deepEqual(slots, [
    {
      slotId: getLinkContentImageSlotId("substack", "image"),
      sourceUrl: "https://example.com/substack-preview.jpg",
    },
  ]);
});
