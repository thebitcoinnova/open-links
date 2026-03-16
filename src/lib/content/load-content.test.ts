import assert from "node:assert/strict";
import test from "node:test";
import { resolveContentImageResolvedPathForSlot } from "./content-image-slots";

test("resolves remote candidates through slot-keyed content images", () => {
  // Arrange
  const generatedBySlot = {
    "link:github:image": {
      resolvedPath: "cache/content-images/github-preview.jpg",
    },
  };

  // Act
  const resolved = resolveContentImageResolvedPathForSlot({
    candidate: "https://example.com/github-preview.jpg",
    slotId: "link:github:image",
    generatedBySlot,
  });

  // Assert
  assert.equal(resolved, "cache/content-images/github-preview.jpg");
});

test("returns undefined for remote candidates when the slot is missing", () => {
  // Arrange
  const generatedBySlot = {};

  // Act
  const resolved = resolveContentImageResolvedPathForSlot({
    candidate: "https://example.com/github-preview.jpg",
    slotId: "link:github:image",
    generatedBySlot,
  });

  // Assert
  assert.equal(resolved, undefined);
});

test("preserves local asset candidates without requiring a slot lookup", () => {
  // Arrange
  const generatedBySlot = {};

  // Act
  const resolved = resolveContentImageResolvedPathForSlot({
    candidate: "/cache/content-images/github-preview.jpg",
    generatedBySlot,
  });

  // Assert
  assert.equal(resolved, "/cache/content-images/github-preview.jpg");
});
