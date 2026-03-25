import assert from "node:assert/strict";
import test from "node:test";
import { getSiteSeoContentImageSlotId } from "../content/content-image-slots";
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
        socialImageFallback: "/generated/seo/social-preview.png",
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
    "https://prizz.github.io/open-links/generated/seo/social-preview.png",
  );
});

test("prefixes local asset paths with the deployment base only once", () => {
  // Arrange
  const candidate = "/open-links/generated/seo/social-preview.png";

  // Act
  const resolved = resolveBaseAwareAssetPath(candidate, "/open-links/");

  // Assert
  assert.equal(resolved, "/open-links/generated/seo/social-preview.png");
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

test("passes site SEO slot context to image resolution", () => {
  // Arrange
  const site = {
    title: "OpenLinks",
    description: "Personal, free, open source, version-controlled social links website.",
    quality: {
      seo: {
        defaults: {
          ogImage: "https://example.com/default-og.jpg",
        },
      },
    },
  };
  const profile = {
    name: "Peter Ryszkiewicz",
    bio: "A curious software engineer.",
  };
  let receivedCandidate = "";
  let receivedSourceField = "";
  let receivedSlotId = "";

  // Act
  resolveSeoMetadata(site, profile, {
    resolveImagePath: (candidate, context) => {
      receivedCandidate = candidate;
      receivedSourceField = context.sourceField ?? "";
      receivedSlotId = context.slotId ?? "";
      return "/cache/content-images/default-og.jpg";
    },
  });

  // Assert
  assert.equal(receivedCandidate, "https://example.com/default-og.jpg");
  assert.equal(receivedSourceField, "defaults.ogImage");
  assert.equal(receivedSlotId, getSiteSeoContentImageSlotId("defaults.ogImage"));
});

test("falls back to the built-in PNG social image when no SEO image is configured", () => {
  // Arrange
  const site = {
    title: "OpenLinks",
    description: "Personal, free, open source, version-controlled social links website.",
  };
  const profile = {
    name: "Peter Ryszkiewicz",
    bio: "A curious software engineer.",
  };

  // Act
  const resolved = resolveSeoMetadata(site, profile, {
    fallbackOrigin: "https://openlinks.us/",
    resolveImagePath: (candidate) => resolveBaseAwareAssetPath(candidate, "/"),
  });

  // Assert
  assert.equal(resolved.metadata.ogImage, "https://openlinks.us/openlinks-social-fallback.png");
  assert.equal(
    resolved.metadata.twitterImage,
    "https://openlinks.us/openlinks-social-fallback.png",
  );
});

test("defaults person pages to profile phrasing when no description fallback is available", () => {
  // Arrange
  const site = {
    title: "OpenLinks",
    description: "",
  };
  const profile = {
    entityType: "person" as const,
    name: "",
    bio: "",
  };

  // Act
  const resolved = resolveSeoMetadata(site, profile, {
    fallbackOrigin: "https://openlinks.us/",
  });

  // Assert
  assert.equal(resolved.metadata.description, "OpenLinks profile");
});

test("defaults organization pages to neutral page phrasing when no description fallback is available", () => {
  // Arrange
  const site = {
    title: "OpenLinks",
    description: "",
  };
  const profile = {
    entityType: "organization" as const,
    name: "",
    bio: "",
  };

  // Act
  const resolved = resolveSeoMetadata(site, profile, {
    fallbackOrigin: "https://openlinks.us/",
  });

  // Assert
  assert.equal(resolved.metadata.description, "OpenLinks page");
});
