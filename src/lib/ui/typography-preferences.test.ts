import assert from "node:assert/strict";
import test from "node:test";
import type { SiteData } from "../content/load-content";
import { resolveTypographyPreferences } from "./typography-preferences";

const baseSite = {
  title: "OpenLinks",
  description: "Profile links",
  theme: {
    active: "openlinks",
    available: ["openlinks"],
  },
} as const satisfies SiteData;

test("resolveTypographyPreferences leaves fixed scale on the shared token baseline", () => {
  // Arrange
  const site = baseSite;

  // Act
  const resolved = resolveTypographyPreferences({
    site,
    activeTheme: "openlinks",
    typographyScale: "fixed",
  });

  // Assert
  assert.deepEqual(resolved.cssVars, {});
  assert.ok(resolved.managedVars.includes("--type-body"));
});

test("resolveTypographyPreferences applies the compact preset below the default baseline", () => {
  // Arrange
  const site = baseSite;

  // Act
  const resolved = resolveTypographyPreferences({
    site,
    activeTheme: "openlinks",
    typographyScale: "compact",
  });

  // Assert
  assert.deepEqual(resolved.cssVars, {
    "--type-title": "clamp(1.66rem, 3.55vw, 2.25rem)",
    "--type-headline": "clamp(1rem, 2.08vw, 1.14rem)",
    "--type-body": "0.98rem",
    "--type-caption": "0.86rem",
    "--type-card-title": "1.01rem",
    "--type-link-title": "0.98rem",
  });
});

test("resolveTypographyPreferences applies the expressive preset above the default baseline", () => {
  // Arrange
  const site = baseSite;

  // Act
  const resolved = resolveTypographyPreferences({
    site,
    activeTheme: "openlinks",
    typographyScale: "expressive",
  });

  // Assert
  assert.deepEqual(resolved.cssVars, {
    "--type-title": "clamp(2.08rem, 4.8vw, 2.95rem)",
    "--type-headline": "clamp(1.22rem, 2.65vw, 1.42rem)",
    "--type-body": "1.11rem",
    "--type-caption": "0.99rem",
    "--type-card-title": "1.18rem",
    "--type-link-title": "1.14rem",
  });
});

test("resolveTypographyPreferences preserves explicit global and theme overrides on fixed scale", () => {
  // Arrange
  const site = {
    ...baseSite,
    ui: {
      typography: {
        global: {
          sizeBody: "1.09rem",
          sizeCaption: "0.96rem",
          sizeCardTitle: "1.14rem",
        },
        themes: {
          openlinks: {
            sizeCaption: "1.01rem",
            sizeLinkTitle: "1.12rem",
          },
        },
      },
    },
  } as const satisfies SiteData;

  // Act
  const resolved = resolveTypographyPreferences({
    site,
    activeTheme: "openlinks",
    typographyScale: "fixed",
  });

  // Assert
  assert.deepEqual(resolved.cssVars, {
    "--type-body": "1.09rem",
    "--type-caption": "1.01rem",
    "--type-card-title": "1.14rem",
    "--type-link-title": "1.12rem",
  });
});
