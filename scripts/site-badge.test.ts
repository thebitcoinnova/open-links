import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { buildSiteBadgeSvg, generateSiteBadgeArtifact, resolveSiteBadgeSpec } from "./site-badge";

test("resolveSiteBadgeSpec returns null when badge publishing is disabled", () => {
  // Arrange
  const profile = { name: "Peter Ryszkiewicz" };
  const site = {
    sharing: {
      badge: {
        enabled: false,
      },
    },
  };

  // Act
  const result = resolveSiteBadgeSpec({ profile, site });

  // Assert
  assert.equal(result, null);
});

test("resolveSiteBadgeSpec defaults the badge message from the profile name", () => {
  // Arrange
  const profile = { name: "Peter Ryszkiewicz" };
  const site = {};

  // Act
  const result = resolveSiteBadgeSpec({ profile, site });

  // Assert
  assert.deepEqual(result, {
    color: "#0f766e",
    label: "OpenLinks",
    labelColor: "#111111",
    message: "Peter Ryszkiewicz",
    outputPath: "public/badges/openlinks.svg",
    style: "flat",
  });
});

test("resolveSiteBadgeSpec honors an explicit badge message override", () => {
  // Arrange
  const profile = { name: "Peter Ryszkiewicz" };
  const site = {
    sharing: {
      badge: {
        message: "My OpenLinks",
      },
    },
  };

  // Act
  const result = resolveSiteBadgeSpec({ profile, site });

  // Assert
  assert.equal(result?.message, "My OpenLinks");
});

test("buildSiteBadgeSvg renders a stable OpenLinks badge svg", () => {
  // Arrange
  const spec = {
    color: "#0f766e",
    label: "OpenLinks",
    labelColor: "#111111",
    message: "Peter Ryszkiewicz",
    outputPath: "public/badges/openlinks.svg",
    style: "flat" as const,
  };

  // Act
  const svg = buildSiteBadgeSvg({
    logoDataUrl: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    spec,
  });

  // Assert
  assert.match(svg, /aria-label="OpenLinks: Peter Ryszkiewicz"/u);
  assert.match(svg, /data:image\/svg\+xml;base64,PHN2Zz48L3N2Zz4=/u);
  assert.match(svg, /fill="#111111"/u);
  assert.match(svg, /fill="#0f766e"/u);
});

test("generateSiteBadgeArtifact removes a stale badge file when publishing is disabled", () => {
  // Arrange
  const rootDir = mkdtempSync(path.join(tmpdir(), "open-links-site-badge-"));
  const outputPath = "public/badges/openlinks.svg";
  const absoluteOutputPath = path.join(rootDir, outputPath);
  fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
  writeFileSync(absoluteOutputPath, "<svg>stale</svg>\n", "utf8");

  // Act
  const result = generateSiteBadgeArtifact({
    outputPath,
    profile: { name: "Peter Ryszkiewicz" },
    rootDir,
    site: {
      sharing: {
        badge: {
          enabled: false,
        },
      },
    },
  });

  // Assert
  assert.equal(result.status, "removed");
  assert.equal(fs.existsSync(absoluteOutputPath), false);
});
