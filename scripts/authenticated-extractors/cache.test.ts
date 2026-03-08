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
  const relativeAssetPath = "cache/rich-authenticated/test-facebook-profile-image.jpg";
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
      facebook: {
        extractorId: "facebook-auth-browser",
        linkId: "facebook",
        sourceUrl: "https://www.facebook.com/peter.ryszkiewicz",
        capturedAt: "2026-03-07T00:00:00.000Z",
        metadata: {
          title: "Peter Ryszkiewicz on Facebook",
          description: "Profile and updates from Peter Ryszkiewicz on Facebook.",
          image: relativeAssetPath,
          sourceLabel: "facebook.com",
        },
        assets: {
          image: {
            path: relativeAssetPath,
            sourceUrl: "https://example.com/facebook-avatar.jpg",
            contentType: "image/jpeg",
            bytes: 4,
            sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          },
        },
        diagnostics: {
          extractorVersion: "2026-03-07.1",
          selectorProfile: "facebook-profile-auth-v5",
          placeholderSignals: [],
          capturedFromUrl: "https://www.facebook.com/peter.ryszkiewicz",
          notes: ["cacheKey=facebook"],
        },
      },
    },
  };

  // Act
  const result = validateAuthenticatedCacheEntry({
    cacheKey: "facebook",
    expectedLinkId: "facebook",
    expectedExtractorId: "facebook-auth-browser",
    expectedUrl: "https://www.facebook.com/peter.ryszkiewicz",
    warnAgeDays: 30,
    registry,
  });

  // Assert
  assert.equal(result.valid, true);
  assert.equal(result.metadata?.image, relativeAssetPath);
  assert.equal(result.metadata?.profileImage, relativeAssetPath);
  assert.equal(
    result.issues.some((issue) =>
      issue.message.includes("missing expected facebook profile fields"),
    ),
    false,
  );
});
