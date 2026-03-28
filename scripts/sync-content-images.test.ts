import assert from "node:assert/strict";
import test from "node:test";
import {
  collectContentImageSlots,
  getLinkContentImageSlotId,
  getSiteSeoContentImageSlotId,
} from "../src/lib/content/content-image-slots";
import {
  type StableGeneratedContentImageEntry,
  buildStableContentImagesManifest,
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
