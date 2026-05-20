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
  screenshotImages: [
    {
      path: "docs/assets/openlinks-preview.png",
      alt: "OpenLinks desktop preview",
    },
    {
      path: "docs/assets/openlinks-preview-tablet.png",
      alt: "OpenLinks tablet preview",
    },
    {
      path: "docs/assets/openlinks-preview-mobile.png",
      alt: "OpenLinks mobile preview",
    },
  ],
  startMarker: START_MARKER,
  endMarker: END_MARKER,
});

test("updater replaces a single-image screenshot block after the stable README marker", () => {
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
  assert.match(
    updatedContent,
    /!\[OpenLinks desktop preview\]\(docs\/assets\/openlinks-preview\.png\)/u,
  );
  assert.match(
    updatedContent,
    /!\[OpenLinks tablet preview\]\(docs\/assets\/openlinks-preview-tablet\.png\)/u,
  );
  assert.match(
    updatedContent,
    /!\[OpenLinks mobile preview\]\(docs\/assets\/openlinks-preview-mobile\.png\)/u,
  );
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
      `${CURRENT_COPY_ANCHOR}\\n${START_MARKER}\\n!\\[OpenLinks desktop preview\\]\\(docs/assets/openlinks-preview.png\\)\\n\\n!\\[OpenLinks tablet preview\\]\\(docs/assets/openlinks-preview-tablet.png\\)\\n\\n!\\[OpenLinks mobile preview\\]\\(docs/assets/openlinks-preview-mobile.png\\)\\n${END_MARKER}`,
      "u",
    ),
  );
});

test("updater rejects duplicate screenshot marker blocks", () => {
  // Arrange
  const originalContent = [
    "# OpenLinks",
    "",
    ANCHOR_MARKER,
    START_MARKER,
    "![Preview one](docs/assets/one.png)",
    END_MARKER,
    START_MARKER,
    "![Preview two](docs/assets/two.png)",
    END_MARKER,
  ].join("\n");

  // Act / Assert
  assert.throws(
    () => updateReadmeScreenshotBlock(originalContent, createArgs([ANCHOR_MARKER])),
    /README screenshot markers appear multiple times/u,
  );
});

test("updater rejects unbalanced screenshot markers", () => {
  // Arrange
  const originalContent = [
    "# OpenLinks",
    "",
    ANCHOR_MARKER,
    START_MARKER,
    "![Preview](docs/assets/preview.png)",
  ].join("\n");

  // Act / Assert
  assert.throws(
    () => updateReadmeScreenshotBlock(originalContent, createArgs([ANCHOR_MARKER])),
    /README screenshot markers are unbalanced/u,
  );
});
