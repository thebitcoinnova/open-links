import assert from "node:assert/strict";
import test from "node:test";

import { updateReadmeScreenshotBlock } from "./upsert-readme-screenshot";

const START_MARKER = "<!-- OPENLINKS_SCREENSHOT_START -->";
const END_MARKER = "<!-- OPENLINKS_SCREENSHOT_END -->";
const ANCHOR_MARKER = "<!-- OPENLINKS_SCREENSHOT_ANCHOR -->";
const CURRENT_COPY_ANCHOR =
  "This project is developer-first, but that does not mean raw JSON should be your default CRUD surface. For most maintainers, the recommended path is:";

const createArgs = (anchorLines: string[]) => ({
  anchorLines,
  imagePath: "docs/assets/openlinks-preview.png",
  imageAlt: "OpenLinks preview",
  startMarker: START_MARKER,
  endMarker: END_MARKER,
});

test("updater replaces the screenshot block after the stable README marker", () => {
  // Arrange
  const originalContent = [
    "# OpenLinks",
    "",
    CURRENT_COPY_ANCHOR,
    ANCHOR_MARKER,
    START_MARKER,
    "![Old preview](docs/assets/old-preview.png)",
    END_MARKER,
    "",
    "## Why OpenLinks",
  ].join("\n");

  // Act
  const updatedContent = updateReadmeScreenshotBlock(originalContent, createArgs([ANCHOR_MARKER]));

  // Assert
  assert.match(updatedContent, new RegExp(`${ANCHOR_MARKER}\\n${START_MARKER}`, "u"));
  assert.match(updatedContent, /!\[OpenLinks preview\]\(docs\/assets\/openlinks-preview\.png\)/u);
  assert.doesNotMatch(updatedContent, /Old preview/u);
});

test("updater falls back to the current README prose when the stable marker is absent", () => {
  // Arrange
  const originalContent = ["# OpenLinks", "", CURRENT_COPY_ANCHOR, "", "## Why OpenLinks"].join(
    "\n",
  );

  // Act
  const updatedContent = updateReadmeScreenshotBlock(
    originalContent,
    createArgs([ANCHOR_MARKER, CURRENT_COPY_ANCHOR]),
  );

  // Assert
  assert.match(
    updatedContent,
    new RegExp(
      `${CURRENT_COPY_ANCHOR}\\n${START_MARKER}\\n!\\[OpenLinks preview\\]\\(docs/assets/openlinks-preview.png\\)\\n${END_MARKER}`,
      "u",
    ),
  );
});
