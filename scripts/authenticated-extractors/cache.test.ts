import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { validateAuthenticatedCacheEntry } from "./cache";
import type { AuthenticatedCacheRegistry } from "./types";

const ROOT = process.cwd();

test("cache validation backfills profile image for supported avatar-first platforms", (t) => {
  // Arrange
  const relativeAssetPath = "cache/rich-authenticated/test-x-profile-image.jpg";
  const absoluteAssetPath = path.join(ROOT, "public", relativeAssetPath);
  fs.mkdirSync(path.dirname(absoluteAssetPath), { recursive: true });
  fs.writeFileSync(absoluteAssetPath, "test", "utf8");
  t.after(() => {
    if (fs.existsSync(absoluteAssetPath)) {
      fs.unlinkSync(absoluteAssetPath);
    }
  });

  const registry: AuthenticatedCacheRegistry = {
    version: 1,
    updatedAt: "2026-03-07T00:00:00.000Z",
    entries: {
      x: {
        extractorId: "x-auth-browser",
        linkId: "x",
        sourceUrl: "https://x.com/pryszkie",
        capturedAt: "2026-03-07T00:00:00.000Z",
        metadata: {
          title: "@pryszkie on X",
          description: "Posts and updates from @pryszkie on X.",
          image: relativeAssetPath,
          sourceLabel: "x.com",
        },
        assets: {
          image: {
            path: relativeAssetPath,
            sourceUrl: "https://unavatar.io/x/pryszkie",
            contentType: "image/jpeg",
            bytes: 4,
            sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          },
        },
        diagnostics: {
          extractorVersion: "2026-03-07.1",
          selectorProfile: "x-oembed-unavatar-v1",
          placeholderSignals: [],
          capturedFromUrl: "https://twitter.com/pryszkie",
          notes: ["cacheKey=x"],
        },
      },
    },
  };

  // Act
  const result = validateAuthenticatedCacheEntry({
    cacheKey: "x",
    expectedLinkId: "x",
    expectedExtractorId: "x-auth-browser",
    expectedUrl: "https://x.com/pryszkie",
    warnAgeDays: 30,
    registry,
  });

  // Assert
  assert.equal(result.valid, true);
  assert.equal(result.metadata?.image, relativeAssetPath);
  assert.equal(result.metadata?.profileImage, relativeAssetPath);
  assert.equal(
    result.issues.some((issue) => issue.message.includes("missing expected x profile fields")),
    false,
  );
});
