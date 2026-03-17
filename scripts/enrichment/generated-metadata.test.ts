import assert from "node:assert/strict";
import test from "node:test";
import {
  areGeneratedRichMetadataEqual,
  buildStableGeneratedRichMetadata,
  stabilizeGeneratedRichMetadataEntry,
} from "./generated-metadata";
import type { GeneratedRichMetadata } from "./types";

test("preserves link enrichedAt when generated metadata payload is unchanged", () => {
  // Arrange
  const previous = {
    metadata: {
      title: "OpenLinks",
      description: "Example profile",
      image: "https://example.com/avatar.jpg",
      enrichmentStatus: "fetched",
      enrichmentReason: "metadata_complete",
      enrichedAt: "2026-03-16T20:00:00.000Z",
    },
  } satisfies GeneratedRichMetadata["links"][string];

  // Act
  const stabilized = stabilizeGeneratedRichMetadataEntry(previous, {
    metadata: {
      ...previous.metadata,
      enrichedAt: "2026-03-16T21:00:00.000Z",
    },
  });

  // Assert
  assert.equal(stabilized.metadata.enrichedAt, "2026-03-16T20:00:00.000Z");
});

test("updates link enrichedAt when generated metadata payload changes", () => {
  // Arrange
  const previous = {
    metadata: {
      title: "OpenLinks",
      description: "Example profile",
      image: "https://example.com/avatar.jpg",
      enrichmentStatus: "fetched",
      enrichmentReason: "metadata_complete",
      enrichedAt: "2026-03-16T20:00:00.000Z",
    },
  } satisfies GeneratedRichMetadata["links"][string];

  // Act
  const stabilized = stabilizeGeneratedRichMetadataEntry(previous, {
    metadata: {
      ...previous.metadata,
      description: "Updated profile",
      enrichedAt: "2026-03-16T21:00:00.000Z",
    },
  });

  // Assert
  assert.equal(stabilized.metadata.enrichedAt, "2026-03-16T21:00:00.000Z");
});

test("preserves manifest generatedAt when stabilized generated metadata is unchanged", () => {
  // Arrange
  const previous: GeneratedRichMetadata = {
    generatedAt: "2026-03-16T20:00:00.000Z",
    links: {
      github: {
        metadata: {
          title: "GitHub",
          description: "Code hosting",
          image: "https://example.com/github.jpg",
          enrichmentStatus: "fetched",
          enrichmentReason: "metadata_complete",
          enrichedAt: "2026-03-16T20:00:00.000Z",
        },
      },
    },
  };

  // Act
  const manifest = buildStableGeneratedRichMetadata({
    previousManifest: previous,
    links: {
      github: {
        metadata: {
          ...previous.links.github.metadata,
          enrichedAt: "2026-03-16T21:00:00.000Z",
        },
      },
    },
    generatedAt: "2026-03-16T21:00:00.000Z",
  });

  // Assert
  assert.equal(manifest.generatedAt, "2026-03-16T20:00:00.000Z");
  assert.equal(areGeneratedRichMetadataEqual(previous, manifest), true);
});
