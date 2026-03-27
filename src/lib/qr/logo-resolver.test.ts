import assert from "node:assert/strict";
import test from "node:test";
import type { OpenLink } from "../content/load-content";
import { resolveQrLogo } from "./logo-resolver";

const decodeSvgDataUrl = (value: string): string => {
  const prefix = "data:image/svg+xml;charset=utf-8,";

  assert.ok(value.startsWith(prefix));
  return decodeURIComponent(value.slice(prefix.length));
};

test("profile QR logos use the resolved profile avatar", () => {
  // Act
  const resolved = resolveQrLogo({
    kind: "profile",
    avatarUrl: "/cache/profile-avatar/profile-avatar.jpg",
    siteLogoUrl: "/branding/openlinks-logo/openlinks-logo.svg",
  });

  // Assert
  assert.ok(resolved.logoUrl);
  assert.match(String(resolved.logoUrl), /^data:image\/svg\+xml/u);
  const svg = decodeSvgDataUrl(String(resolved.logoUrl));
  assert.match(svg, /\/cache\/profile-avatar\/profile-avatar\.jpg/u);
  assert.match(svg, /\/branding\/openlinks-logo\/openlinks-logo\.svg/u);
  assert.equal(resolved.logoSize, 0.24);
});

test("profile QR logos fall back to the avatar when no site logo resolves", () => {
  // Act
  const resolved = resolveQrLogo({
    kind: "profile",
    avatarUrl: "/cache/profile-avatar/profile-avatar.jpg",
  });

  // Assert
  assert.equal(resolved.logoUrl, "/cache/profile-avatar/profile-avatar.jpg");
});

test("link QR logos prefer normalized profile images for profile-style links", () => {
  // Arrange
  const link = {
    id: "github",
    label: "GitHub",
    type: "rich",
    icon: "github",
    url: "https://github.com/pRizz",
    metadata: {
      image: "/cache/content-images/github-preview.jpg",
      profileImage: "/cache/content-images/github-avatar.jpg",
    },
  } satisfies OpenLink;

  // Act
  const resolved = resolveQrLogo({
    kind: "link",
    link,
  });

  // Assert
  assert.ok(resolved.logoUrl);
  assert.match(String(resolved.logoUrl), /^data:image\/svg\+xml/u);
  const svg = decodeSvgDataUrl(String(resolved.logoUrl));
  assert.match(svg, /\/cache\/content-images\/github-avatar\.jpg/u);
  assert.match(svg, /#181717/u);
});

test("link QR logos compose preview images with site badges for non-profile rich links", () => {
  // Arrange
  const link = {
    id: "article",
    label: "Article",
    type: "rich",
    icon: "facebook",
    url: "https://example.com/articles/1",
    metadata: {
      image: "/cache/content-images/article-preview.jpg",
    },
  } satisfies OpenLink;

  // Act
  const resolved = resolveQrLogo({
    kind: "link",
    link,
  });

  // Assert
  assert.ok(resolved.logoUrl);
  assert.match(String(resolved.logoUrl), /^data:image\/svg\+xml/u);
  const svg = decodeSvgDataUrl(String(resolved.logoUrl));
  assert.match(svg, /\/cache\/content-images\/article-preview\.jpg/u);
  assert.match(svg, /#1877F2/u);
});

test("link QR logos keep plain preview images when no site identity resolves", () => {
  // Arrange
  const link = {
    id: "article",
    label: "Article",
    type: "rich",
    url: "https://example.com/articles/1",
    metadata: {
      image: "/cache/content-images/article-preview.jpg",
    },
  } satisfies OpenLink;

  // Act
  const resolved = resolveQrLogo({
    kind: "link",
    link,
  });

  // Assert
  assert.equal(resolved.logoUrl, "/cache/content-images/article-preview.jpg");
});

test("link QR logos fall back to known-site badges when no local image resolves", () => {
  // Arrange
  const link = {
    id: "github",
    label: "GitHub",
    type: "simple",
    icon: "github",
    url: "https://github.com/pRizz",
  } satisfies OpenLink;

  // Act
  const resolved = resolveQrLogo({
    kind: "link",
    link,
  });

  // Assert
  assert.ok(resolved.logoUrl);
  assert.match(String(resolved.logoUrl), /^data:image\/svg\+xml/u);

  const svg = decodeSvgDataUrl(String(resolved.logoUrl));
  assert.match(svg, /#181717/u);
});

test("link QR logos stay empty for generic links without a local or known-site identity", () => {
  // Arrange
  const link = {
    id: "generic",
    label: "Generic",
    type: "simple",
    url: "https://example.com/about",
  } satisfies OpenLink;

  // Act
  const resolved = resolveQrLogo({
    kind: "link",
    link,
  });

  // Assert
  assert.equal(resolved.logoUrl, undefined);
});
