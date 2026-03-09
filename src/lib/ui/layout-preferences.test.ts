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
  assert.equal(resolved.profileAvatarScale, 1.7);
  assert.equal(resolved.typographyScale, "fixed");
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
