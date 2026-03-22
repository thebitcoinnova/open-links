import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import {
  DEFAULT_OPENLINKS_SOCIAL_FALLBACK_PNG_PATH,
  DEFAULT_OPENLINKS_SOCIAL_FALLBACK_SVG_PATH,
  generateOpenLinksSocialFallbackAssets,
} from "./generate-openlinks-brand-assets";

const ROOT = process.cwd();
const CANONICAL_LOGO_PATH = path.join(ROOT, "public/branding/openlinks-logo/openlinks-logo.svg");

const readPngDimensions = (buffer: Buffer): { width: number; height: number } => ({
  width: buffer.readUInt32BE(16),
  height: buffer.readUInt32BE(20),
});

test("generateOpenLinksSocialFallbackAssets writes a stable fallback SVG and PNG", () => {
  // Arrange
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "open-links-social-fallback-"));

  try {
    // Act
    const first = generateOpenLinksSocialFallbackAssets({
      canonicalLogoPath: CANONICAL_LOGO_PATH,
      quiet: true,
      rootDir,
    });
    const second = generateOpenLinksSocialFallbackAssets({
      canonicalLogoPath: CANONICAL_LOGO_PATH,
      quiet: true,
      rootDir,
    });
    const svg = fs.readFileSync(first.svgOutputPath, "utf8");
    const png = fs.readFileSync(first.pngOutputPath);

    // Assert
    assert.equal(
      path.relative(rootDir, first.svgOutputPath),
      DEFAULT_OPENLINKS_SOCIAL_FALLBACK_SVG_PATH,
    );
    assert.equal(
      path.relative(rootDir, first.pngOutputPath),
      DEFAULT_OPENLINKS_SOCIAL_FALLBACK_PNG_PATH,
    );
    assert.equal(first.svgStatus, "written");
    assert.equal(first.pngStatus, "written");
    assert.equal(second.svgStatus, "unchanged");
    assert.equal(second.pngStatus, "unchanged");
    assert.match(svg, /width="1200" height="630"/u);
    assert.match(svg, /OpenLinks/u);
    assert.match(svg, /Own your links/u);
    assert.match(svg, /<rect x="96" y="98" width="248" height="34" rx="17"/u);
    assert.match(svg, /<rect x="0" y="-22" width="295" height="33" rx="17"/u);
    assert.equal(svg.includes('dominant-baseline="middle"'), false);
    assert.deepEqual(readPngDimensions(png), { width: 1200, height: 630 });
  } finally {
    fs.rmSync(rootDir, { force: true, recursive: true });
  }
});
