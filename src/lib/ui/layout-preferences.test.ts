import assert from "node:assert/strict";
import test from "node:test";
import type { SiteData } from "../content/load-content";
import { resolveLayoutPreferences } from "./layout-preferences";

const baseSite = {
  title: "OpenLinks",
  description: "Profile links",
  theme: {
    active: "openlinks",
    available: ["openlinks"],
  },
} as const satisfies SiteData;

test("resolveLayoutPreferences uses the larger default profile avatar scale when unset", () => {
  // Arrange
  const site = baseSite;

  // Act
  const resolved = resolveLayoutPreferences(site);

  // Assert
  assert.equal(resolved.cardStyle, "standard");
  assert.equal(resolved.profileAvatarScale, 1.7);
  assert.equal(resolved.typographyScale, "fixed");
  assert.deepEqual(resolved.profileHeaderAlignment, {
    default: "leading",
    small: "center",
  });
});

test("resolveLayoutPreferences preserves the explicit glassy card style", () => {
  // Arrange
  const site = {
    ...baseSite,
    ui: {
      cardStyle: "glassy",
    },
  } as const satisfies SiteData;

  // Act
  const resolved = resolveLayoutPreferences(site);

  // Assert
  assert.equal(resolved.cardStyle, "glassy");
});

test("resolveLayoutPreferences falls back to standard for invalid card styles", () => {
  // Arrange
  const site = {
    ...baseSite,
    ui: {
      cardStyle: "mirror-shine",
    },
  } as unknown as SiteData;

  // Act
  const resolved = resolveLayoutPreferences(site);

  // Assert
  assert.equal(resolved.cardStyle, "standard");
});

test("resolveLayoutPreferences preserves an explicit profile avatar scale override", () => {
  // Arrange
  const site = {
    ...baseSite,
    ui: {
      profileAvatarScale: 2.4,
      typographyScale: "expressive",
    },
  } as const satisfies SiteData;

  // Act
  const resolved = resolveLayoutPreferences(site);

  // Assert
  assert.equal(resolved.profileAvatarScale, 2.4);
  assert.equal(resolved.typographyScale, "expressive");
});

test("resolveLayoutPreferences applies profile header alignment shorthand to all widths", () => {
  // Arrange
  const site = {
    ...baseSite,
    ui: {
      profileHeaderAlignment: "center",
    },
  } as const satisfies SiteData;

  // Act
  const resolved = resolveLayoutPreferences(site);

  // Assert
  assert.deepEqual(resolved.profileHeaderAlignment, {
    default: "center",
    small: "center",
  });
});

test("resolveLayoutPreferences preserves responsive profile header alignment", () => {
  // Arrange
  const site = {
    ...baseSite,
    ui: {
      profileHeaderAlignment: {
        default: "leading",
        small: "center",
      },
    },
  } as const satisfies SiteData;

  // Act
  const resolved = resolveLayoutPreferences(site);

  // Assert
  assert.deepEqual(resolved.profileHeaderAlignment, {
    default: "leading",
    small: "center",
  });
});

test("resolveLayoutPreferences inherits small profile header alignment from default", () => {
  // Arrange
  const site = {
    ...baseSite,
    ui: {
      profileHeaderAlignment: {
        default: "center",
      },
    },
  } as const satisfies SiteData;

  // Act
  const resolved = resolveLayoutPreferences(site);

  // Assert
  assert.deepEqual(resolved.profileHeaderAlignment, {
    default: "center",
    small: "center",
  });
});
