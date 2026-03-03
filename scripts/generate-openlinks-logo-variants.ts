import fs from "node:fs";
import path from "node:path";

type GeometryMode = "strict" | "optical";
type WeightMode = "mono" | "l-heavy" | "circle-heavy";
type CapMode = "square" | "round";

interface GeometrySpec {
  xL: number;
  yTop: number;
  yBottom: number;
  xFootEnd: number;
}

interface StrokeSpec {
  circle: number;
  l: number;
}

interface CapSpec {
  linecap: "butt" | "round";
  linejoin: "miter" | "round";
}

interface VariantSpec {
  geometryMode: GeometryMode;
  weightMode: WeightMode;
  capMode: CapMode;
  geometry: GeometrySpec;
  stroke: StrokeSpec;
  cap: CapSpec;
  filename: string;
  label: string;
}

const ROOT = process.cwd();
const VARIANTS_DIR = path.join(ROOT, "public/branding/openlinks-logo");
const COMPARISON_SHEET_PATH = path.join(ROOT, "docs/assets/openlinks-logo-variants.svg");
const CANONICAL_PATH = path.join(VARIANTS_DIR, "openlinks-logo.svg");
const CANONICAL_VARIANT = "ol-mark--strict--mono--square.svg";

const COLOR = "#111111";
const CANVAS_SIZE = 100;
const CIRCLE = { cx: 50, cy: 50, r: 38 };

const GEOMETRIES: Record<GeometryMode, GeometrySpec> = {
  strict: { xL: 12, yTop: 12, yBottom: 88, xFootEnd: 50 },
  optical: { xL: 13, yTop: 12, yBottom: 87, xFootEnd: 49 },
};

const STROKES: Record<WeightMode, StrokeSpec> = {
  mono: { circle: 6, l: 6 },
  "l-heavy": { circle: 5, l: 8 },
  "circle-heavy": { circle: 8, l: 5 },
};

const CAPS: Record<CapMode, CapSpec> = {
  square: { linecap: "butt", linejoin: "miter" },
  round: { linecap: "round", linejoin: "round" },
};

const toRelative = (targetPath: string): string => path.relative(ROOT, targetPath);

const toPathData = (geometry: GeometrySpec): string =>
  `M${geometry.xL} ${geometry.yTop} V${geometry.yBottom} H${geometry.xFootEnd}`;

const listVariants = (): VariantSpec[] => {
  const variants: VariantSpec[] = [];
  const geometryModes: GeometryMode[] = ["strict", "optical"];
  const weightModes: WeightMode[] = ["mono", "l-heavy", "circle-heavy"];
  const capModes: CapMode[] = ["square", "round"];

  for (const geometryMode of geometryModes) {
    for (const weightMode of weightModes) {
      for (const capMode of capModes) {
        variants.push({
          geometryMode,
          weightMode,
          capMode,
          geometry: GEOMETRIES[geometryMode],
          stroke: STROKES[weightMode],
          cap: CAPS[capMode],
          filename: `ol-mark--${geometryMode}--${weightMode}--${capMode}.svg`,
          label: `${geometryMode} / ${weightMode} / ${capMode}`,
        });
      }
    }
  }

  return variants;
};

const ensureStrictGeometry = (variant: VariantSpec): void => {
  if (variant.geometryMode !== "strict") {
    return;
  }

  const expectedLeftTangent = CIRCLE.cx - CIRCLE.r;
  const expectedBottomTangent = CIRCLE.cy + CIRCLE.r;
  const expectedBottomEnd = CIRCLE.cx;

  if (variant.geometry.xL !== expectedLeftTangent) {
    throw new Error(
      `Strict geometry failure (${variant.filename}): xL=${variant.geometry.xL}, expected ${expectedLeftTangent}.`,
    );
  }

  if (variant.geometry.yBottom !== expectedBottomTangent) {
    throw new Error(
      `Strict geometry failure (${variant.filename}): yBottom=${variant.geometry.yBottom}, expected ${expectedBottomTangent}.`,
    );
  }

  if (variant.geometry.xFootEnd !== expectedBottomEnd) {
    throw new Error(
      `Strict geometry failure (${variant.filename}): xFootEnd=${variant.geometry.xFootEnd}, expected ${expectedBottomEnd}.`,
    );
  }
};

const ensureNoClipping = (variant: VariantSpec): void => {
  const circleHalf = variant.stroke.circle / 2;
  const lHalf = variant.stroke.l / 2;

  const minX = Math.min(CIRCLE.cx - CIRCLE.r - circleHalf, variant.geometry.xL - lHalf);
  const maxX = Math.max(CIRCLE.cx + CIRCLE.r + circleHalf, variant.geometry.xFootEnd + lHalf);
  const minY = Math.min(CIRCLE.cy - CIRCLE.r - circleHalf, variant.geometry.yTop - lHalf);
  const maxY = Math.max(CIRCLE.cy + CIRCLE.r + circleHalf, variant.geometry.yBottom + lHalf);

  if (minX < 0 || minY < 0 || maxX > CANVAS_SIZE || maxY > CANVAS_SIZE) {
    throw new Error(
      `Bounds failure (${variant.filename}): minX=${minX}, minY=${minY}, maxX=${maxX}, maxY=${maxY}.`,
    );
  }
};

const buildMarkInner = (variant: VariantSpec): string => {
  const pathData = toPathData(variant.geometry);

  return [
    `  <circle cx="${CIRCLE.cx}" cy="${CIRCLE.cy}" r="${CIRCLE.r}" fill="none" stroke="${COLOR}" stroke-width="${variant.stroke.circle}" />`,
    `  <path d="${pathData}" fill="none" stroke="${COLOR}" stroke-width="${variant.stroke.l}" stroke-linecap="${variant.cap.linecap}" stroke-linejoin="${variant.cap.linejoin}" />`,
  ].join("\n");
};

const buildVariantSvg = (variant: VariantSpec): string => {
  const markInner = buildMarkInner(variant);
  const title = `OpenLinks logo mark (${variant.label})`;
  const desc =
    variant.geometryMode === "strict"
      ? "Circle and L use strict tangent geometry."
      : "Circle and L use optical offsets for balance.";

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-labelledby="title desc">`,
    `  <title id="title">${title}</title>`,
    `  <desc id="desc">${desc}</desc>`,
    markInner,
    "</svg>",
    "",
  ].join("\n");
};

const buildComparisonSheet = (variants: VariantSpec[]): string => {
  const columns = 4;
  const rows = Math.ceil(variants.length / columns);
  const cellWidth = 340;
  const cellHeight = 230;
  const margin = 28;
  const width = columns * cellWidth + margin * 2;
  const height = rows * cellHeight + margin * 2;
  const sizeSwatches = [24, 48, 96];

  const cells = variants
    .map((variant, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const originX = margin + column * cellWidth;
      const originY = margin + row * cellHeight;
      const cardX = originX + 12;
      const cardY = originY + 44;
      const cardW = cellWidth - 24;
      const cardH = cellHeight - 56;
      const previewBgX = cardX + 12;
      const previewBgY = cardY + 12;
      const previewBgW = 160;
      const previewBgH = 148;
      const swatchOriginX = previewBgX + previewBgW + 16;
      const swatchOriginY = previewBgY + 2;

      const mainScale = 96 / 100;
      const mainX = previewBgX + 32;
      const mainY = previewBgY + 26;
      const swatches = sizeSwatches
        .map((size, swatchIndex) => {
          const scale = size / 100;
          const iconX = swatchOriginX + (96 - size) / 2;
          const iconY = swatchOriginY + swatchIndex * 46;
          return [
            `    <text x="${swatchOriginX + 102}" y="${iconY + 16}" font-size="12" fill="#4f5968" font-family="'Manrope', 'Segoe UI', sans-serif">${size}px</text>`,
            `    <g transform="translate(${iconX} ${iconY}) scale(${scale})">`,
            buildMarkInner(variant).replace(/^ {2}/gm, "      "),
            "    </g>",
          ].join("\n");
        })
        .join("\n");

      return [
        "  <g>",
        `    <rect x="${originX}" y="${originY}" width="${cellWidth}" height="${cellHeight}" rx="16" fill="#ffffff" stroke="#dce2ec" />`,
        `    <text x="${originX + 18}" y="${originY + 30}" font-size="15" font-weight="700" fill="#161d2b" font-family="'Space Grotesk', 'Avenir Next', sans-serif">${variant.label}</text>`,
        `    <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="10" fill="#f7f9fc" stroke="#e5eaf2" />`,
        `    <rect x="${previewBgX}" y="${previewBgY}" width="${previewBgW}" height="${previewBgH}" rx="8" fill="#ffffff" stroke="#e5eaf2" />`,
        `    <g transform="translate(${mainX} ${mainY}) scale(${mainScale})">`,
        buildMarkInner(variant).replace(/^ {2}/gm, "      "),
        "    </g>",
        swatches,
        "  </g>",
      ].join("\n");
    })
    .join("\n");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`,
    `  <title id="title">OpenLinks logo variant comparison</title>`,
    `  <desc id="desc">Comparison grid for OpenLinks circle-plus-L mark variants across geometry and stroke modes.</desc>`,
    `  <rect width="${width}" height="${height}" fill="#f1f4f9" />`,
    cells,
    "</svg>",
    "",
  ].join("\n");
};

const run = (): void => {
  const variants = listVariants();
  if (variants.length !== 12) {
    throw new Error(`Expected 12 variants but received ${variants.length}.`);
  }

  fs.mkdirSync(VARIANTS_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(COMPARISON_SHEET_PATH), { recursive: true });

  for (const variant of variants) {
    ensureStrictGeometry(variant);
    ensureNoClipping(variant);

    const svg = buildVariantSvg(variant);
    fs.writeFileSync(path.join(VARIANTS_DIR, variant.filename), svg, "utf8");
  }

  const comparisonSheet = buildComparisonSheet(variants);
  fs.writeFileSync(COMPARISON_SHEET_PATH, comparisonSheet, "utf8");

  const canonicalSource = path.join(VARIANTS_DIR, CANONICAL_VARIANT);
  if (!fs.existsSync(canonicalSource)) {
    throw new Error(`Canonical source variant not found: ${toRelative(canonicalSource)}`);
  }

  fs.copyFileSync(canonicalSource, CANONICAL_PATH);

  console.log(`Generated ${variants.length} OpenLinks logo variants.`);
  console.log(`Variants directory: ${toRelative(VARIANTS_DIR)}`);
  console.log(`Comparison sheet: ${toRelative(COMPARISON_SHEET_PATH)}`);
  console.log(`Canonical alias: ${toRelative(CANONICAL_PATH)} -> ${CANONICAL_VARIANT}`);
};

run();
