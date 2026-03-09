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

test("cache validation accepts explicit authenticated asset roles when local image provenance is preserved", (t) => {
  // Arrange
  const imagePath = "cache/rich-authenticated/test-linkedin-preview.jpg";
  const profilePath = "cache/rich-authenticated/test-linkedin-avatar.jpg";
  const ogPath = "cache/rich-authenticated/test-linkedin-og.jpg";
  const twitterPath = "cache/rich-authenticated/test-linkedin-twitter.jpg";
  const relativePaths = [imagePath, profilePath, ogPath, twitterPath];

  for (const relativePath of relativePaths) {
    const absolutePath = path.join(ROOT, "public", relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, "test", "utf8");
  }

  t.after(() => {
    for (const relativePath of relativePaths) {
      const absolutePath = path.join(ROOT, "public", relativePath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    }
  });

  const registry: AuthenticatedCacheRegistry = {
    version: 1,
    updatedAt: "2026-03-09T00:00:00.000Z",
    entries: {
      linkedin: {
        extractorId: "linkedin-auth-browser",
        linkId: "linkedin",
        sourceUrl: "https://www.linkedin.com/in/peter-ryszkiewicz/",
        capturedAt: "2026-03-09T00:00:00.000Z",
        metadata: {
          title: "Peter Ryszkiewicz | LinkedIn",
          description:
            "Talented software engineer, excited to work on new and challenging problems.",
          image: imagePath,
          profileImage: profilePath,
          ogImage: ogPath,
          twitterImage: twitterPath,
          sourceLabel: "linkedin.com",
        },
        assets: {
          image: {
            path: imagePath,
            sourceUrl: "https://example.com/linkedin-preview.jpg",
            contentType: "image/jpeg",
            bytes: 4,
            sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          },
          profileImage: {
            path: profilePath,
            sourceUrl: "https://example.com/linkedin-avatar.jpg",
            contentType: "image/jpeg",
            bytes: 4,
            sha256: "1123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          },
          ogImage: {
            path: ogPath,
            sourceUrl: "https://example.com/linkedin-og.jpg",
            contentType: "image/jpeg",
            bytes: 4,
            sha256: "2123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          },
          twitterImage: {
            path: twitterPath,
            sourceUrl: "https://example.com/linkedin-twitter.jpg",
            contentType: "image/jpeg",
            bytes: 4,
            sha256: "3123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          },
        },
        diagnostics: {
          extractorVersion: "2026-03-09.1",
          selectorProfile: "linkedin-profile-v1",
          placeholderSignals: [],
          capturedFromUrl: "https://www.linkedin.com/in/peter-ryszkiewicz/",
        },
      },
    },
  };

  // Act
  const result = validateAuthenticatedCacheEntry({
    cacheKey: "linkedin",
    expectedLinkId: "linkedin",
    expectedExtractorId: "linkedin-auth-browser",
    expectedUrl: "https://www.linkedin.com/in/peter-ryszkiewicz/",
    warnAgeDays: 30,
    registry,
  });

  // Assert
  assert.equal(result.valid, true);
  assert.equal(result.metadata?.image, imagePath);
  assert.equal(result.metadata?.profileImage, profilePath);
  assert.equal(result.metadata?.ogImage, ogPath);
  assert.equal(result.metadata?.twitterImage, twitterPath);
});
