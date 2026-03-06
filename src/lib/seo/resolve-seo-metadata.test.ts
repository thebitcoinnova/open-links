import assert from "node:assert/strict";
import test from "node:test";
import {
  isPlaceholderExampleUrl,
  resolveBaseAwareAssetPath,
  resolveSeoMetadata,
} from "./resolve-seo-metadata";

test("keeps the GitHub Pages project path when site.baseUrl is root", () => {
  // Arrange
  const site = {
    title: "OpenLinks",
    description: "Personal, free, open source, version-controlled social links website.",
    baseUrl: "/",
    quality: {
      seo: {
        canonicalBaseUrl: "https://prizz.github.io/open-links/",
        socialImageFallback: "/openlinks-social-fallback.svg",
        defaults: {
          title: "OpenLinks",
          description: "Personal, free, open source, version-controlled social links website.",
        },
      },
    },
  };
  const profile = {
    name: "Peter Ryszkiewicz",
    bio: "A curious software engineer.",
  };

  // Act
  const resolved = resolveSeoMetadata(site, profile, {
    resolveImagePath: (candidate) => resolveBaseAwareAssetPath(candidate, "/open-links/"),
  });

  // Assert
  assert.equal(resolved.metadata.canonical, "https://prizz.github.io/open-links/");
  assert.equal(resolved.metadata.ogUrl, "https://prizz.github.io/open-links/");
  assert.equal(
    resolved.metadata.ogImage,
    "https://prizz.github.io/open-links/openlinks-social-fallback.svg",
  );
});

test("prefixes local asset paths with the deployment base only once", () => {
  // Arrange
  const candidate = "/open-links/openlinks-social-fallback.svg";

  // Act
  const resolved = resolveBaseAwareAssetPath(candidate, "/open-links/");

  // Assert
  assert.equal(resolved, "/open-links/openlinks-social-fallback.svg");
});

test("detects placeholder example hosts", () => {
  // Arrange
  const placeholderUrl = "https://placeholder.example/";
  const deployedUrl = "https://prizz.github.io/open-links/";

  // Act
  const placeholderDetected = isPlaceholderExampleUrl(placeholderUrl);
  const deployedDetected = isPlaceholderExampleUrl(deployedUrl);

  // Assert
  assert.equal(placeholderDetected, true);
  assert.equal(deployedDetected, false);
});
