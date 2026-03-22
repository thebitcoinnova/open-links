import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import {
  DEFAULT_SITE_SOCIAL_PREVIEW_PNG_PATH,
  DEFAULT_SITE_SOCIAL_PREVIEW_SVG_PATH,
  generateSiteSocialPreviewArtifact,
  resolveSiteSocialPreviewSpec,
} from "./generate-site-social-preview";
import { readCanonicalOpenLinksMarkSpec } from "./lib/openlinks-logo";
import { buildSocialPreviewSvg, resolveSocialPreviewFontOptions } from "./lib/social-preview";

const ROOT = process.cwd();
const CANONICAL_LOGO_PATH = path.join(ROOT, "public/branding/openlinks-logo/openlinks-logo.svg");

const readPngDimensions = (buffer: Buffer): { width: number; height: number } => ({
  width: buffer.readUInt32BE(16),
  height: buffer.readUInt32BE(20),
});

const extractRectMetrics = (
  svg: string,
  pattern: RegExp,
): { x: number; y: number; width: number; height: number; radius: number } => {
  const match = svg.match(pattern);
  assert.ok(match?.[1], `Expected SVG rect to match ${pattern}.`);
  return {
    x: Number(match[1]),
    y: Number(match[2]),
    width: Number(match[3]),
    height: Number(match[4]),
    radius: Number(match[5]),
  };
};

const extractTextPosition = (svg: string, pattern: RegExp): { x: number; y: number } => {
  const match = svg.match(pattern);
  assert.ok(match?.[1], `Expected SVG text to match ${pattern}.`);
  return {
    x: Number(match[1]),
    y: Number(match[2]),
  };
};

test("resolveSiteSocialPreviewSpec prefers SEO defaults and emits canonical output paths", () => {
  // Arrange
  const site = {
    title: "Forked Links",
    description: "Fallback site description",
    quality: {
      seo: {
        defaults: {
          title: "OpenLinks",
          description: "Personal, free, open source, version-controlled social links website.",
        },
      },
    },
  };

  // Act
  const spec = resolveSiteSocialPreviewSpec({ site });

  // Assert
  assert.deepEqual(spec, {
    title: "OpenLinks",
    description: "Personal, free, open source, version-controlled social links website.",
    svgOutputPath: DEFAULT_SITE_SOCIAL_PREVIEW_SVG_PATH,
    pngOutputPath: DEFAULT_SITE_SOCIAL_PREVIEW_PNG_PATH,
  });
});

test("generateSiteSocialPreviewArtifact writes a site-level SVG and PNG preview", () => {
  // Arrange
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "open-links-site-social-preview-"));
  const site = {
    title: "Forked Links",
    description: "Fallback site description",
    quality: {
      seo: {
        defaults: {
          title: "OpenLinks",
          description: "Personal, free, open source, version-controlled social links website.",
        },
      },
    },
  };

  try {
    // Act
    const result = generateSiteSocialPreviewArtifact({
      canonicalLogoPath: CANONICAL_LOGO_PATH,
      rootDir,
      site,
    });
    const svg = fs.readFileSync(result.svgOutputPath, "utf8");
    const png = fs.readFileSync(result.pngOutputPath);

    // Assert
    assert.equal(
      path.relative(rootDir, result.svgOutputPath),
      DEFAULT_SITE_SOCIAL_PREVIEW_SVG_PATH,
    );
    assert.equal(
      path.relative(rootDir, result.pngOutputPath),
      DEFAULT_SITE_SOCIAL_PREVIEW_PNG_PATH,
    );
    assert.equal(result.svgStatus, "written");
    assert.equal(result.pngStatus, "written");
    assert.match(svg, /OpenLinks/u);
    assert.match(svg, /Own your links/u);
    assert.match(svg, /version-controlled social links website/u);
    assert.deepEqual(readPngDimensions(png), { width: 1200, height: 630 });
  } finally {
    fs.rmSync(rootDir, { force: true, recursive: true });
  }
});

test("resolveSocialPreviewFontOptions pins the social-preview renderer to bundled fonts", () => {
  // Arrange
  const options = resolveSocialPreviewFontOptions();

  // Assert
  assert.equal(options.loadSystemFonts, false);
  assert.deepEqual(
    options.fontFiles?.map((entry) => path.basename(entry)),
    ["SpaceGrotesk-wght.ttf", "Manrope-wght.ttf"],
  );
  for (const fontFile of options.fontFiles ?? []) {
    assert.equal(fs.existsSync(fontFile), true);
  }
});

test("buildSocialPreviewSvg sizes eyebrow and footer pills from measured label bounds", () => {
  // Arrange
  const markSpec = readCanonicalOpenLinksMarkSpec(ROOT, CANONICAL_LOGO_PATH);
  const defaultSvg = buildSocialPreviewSvg({
    title: "OpenLinks",
    description: "Personal, free, open source, version-controlled social links website.",
    footer: "STATIC / OPEN SOURCE / YOURS",
    eyebrow: "OPEN SOURCE LINKS",
    markSpec,
  });
  const compactSvg = buildSocialPreviewSvg({
    title: "OpenLinks",
    description: "Personal, free, open source, version-controlled social links website.",
    footer: "STATIC",
    eyebrow: "OSS",
    markSpec,
  });

  // Act
  const defaultEyebrow = extractRectMetrics(
    defaultSvg,
    /<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)" rx="([^"]+)" fill="#f5f7fb"/u,
  );
  const compactEyebrow = extractRectMetrics(
    compactSvg,
    /<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)" rx="([^"]+)" fill="#f5f7fb"/u,
  );
  const defaultFooter = extractRectMetrics(
    defaultSvg,
    /<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)" rx="([^"]+)" fill="#09111b"/u,
  );
  const compactFooter = extractRectMetrics(
    compactSvg,
    /<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)" rx="([^"]+)" fill="#09111b"/u,
  );
  const eyebrowText = extractTextPosition(
    defaultSvg,
    /<text x="([^"]+)" y="([^"]+)"[^>]*>OPEN SOURCE LINKS<\/text>/u,
  );
  const footerText = extractTextPosition(
    defaultSvg,
    /<text x="([^"]+)" y="([^"]+)"[^>]*>STATIC \/ OPEN SOURCE \/ YOURS<\/text>/u,
  );

  // Assert
  assert.deepEqual(defaultEyebrow, {
    x: 96,
    y: 98,
    width: 248,
    height: 34,
    radius: 17,
  });
  assert.deepEqual(defaultFooter, {
    x: 0,
    y: -22,
    width: 295,
    height: 33,
    radius: 17,
  });
  assert.ok(
    defaultEyebrow.width > 214,
    "Expected the eyebrow pill to expand beyond the old fixed width.",
  );
  assert.ok(
    defaultEyebrow.width > compactEyebrow.width,
    "Expected a longer eyebrow label to produce a wider pill.",
  );
  assert.ok(
    defaultFooter.width > compactFooter.width,
    "Expected a longer footer label to produce a wider pill.",
  );
  assert.equal(defaultSvg.includes('dominant-baseline="middle"'), false);
  assert.deepEqual(defaultEyebrow.x, compactEyebrow.x);
  assert.deepEqual(defaultEyebrow.y, compactEyebrow.y);
  assert.deepEqual(defaultFooter.x, compactFooter.x);
  assert.deepEqual(defaultFooter.y, compactFooter.y);
  assert.ok(Math.abs(eyebrowText.x - 120.98) < 0.01);
  assert.ok(Math.abs(eyebrowText.y - 120.42) < 0.01);
  assert.ok(Math.abs(footerText.x - 19.24) < 0.01);
  assert.ok(Math.abs(footerText.y - -2) < 0.01);
});
