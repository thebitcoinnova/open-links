import fs from "node:fs";
import path from "node:path";
import { generateOpenLinksBrandAssets } from "../generate-openlinks-brand-assets";
import {
  type CircleSpec,
  type LGeometry,
  type V2RatioMode,
  distanceFromCenter,
  geometryHeight,
  geometryPoints,
  geometryWidth,
  solveV2Geometry,
} from "../shared/logo-v2-geometry";

export type GeometryMode = "strict" | "optical";
export type WeightMode = "mono" | "l-heavy" | "circle-heavy";
export type CapMode = "square" | "round";
export type V2Family = "two-touch" | "inset" | "three-touch";
export type V2Placement = "centered" | "bottom-left";

export interface V1GeometrySpec {
  xL: number;
  yTop: number;
  yBottom: number;
  xFootEnd: number;
}

export interface StrokeSpec {
  circle: number;
  l: number;
}

export interface CapSpec {
  linecap: "butt" | "round";
  linejoin: "miter" | "round";
}

export interface V1VariantSpec {
  geometryMode: GeometryMode;
  weightMode: WeightMode;
  capMode: CapMode;
  geometry: V1GeometrySpec;
  stroke: StrokeSpec;
  cap: CapSpec;
  filename: string;
  label: string;
}

export interface MarkStyle {
  stroke: StrokeSpec;
  cap: CapSpec;
  color: string;
}

export interface ComparisonCard {
  id: string;
  title: string;
  subtitle: string;
  notes: string[];
  aliasNote?: string;
  geometry: LGeometry;
  style: MarkStyle;
}

export interface V2VariantSpec {
  id: string;
  family: V2Family;
  ratioMode: V2RatioMode;
  placement: V2Placement;
  radiusTarget: number;
  touchModel: string;
  geometry: LGeometry;
  solver: "closed-form" | "numeric";
  solverNotes: string[];
  metrics: {
    width: number;
    height: number;
    centerlineRatio: number;
    outerRatio: number;
    topDistance: number;
    cornerDistance: number;
    endpointDistance: number;
  };
  filename?: string;
  aliasOf?: string;
}

export interface V3WeightPreset {
  stroke: StrokeSpec;
  comparisonLabel: string;
  annotation?: string;
}

export interface V3VariantSpec {
  id: string;
  family: "inset";
  ratioMode: "centerline-2x";
  placement: "centered";
  touchModel: string;
  stroke: StrokeSpec;
  geometry: LGeometry;
  solver: "closed-form" | "numeric";
  solverNotes: string[];
  metrics: {
    width: number;
    height: number;
    centerlineRatio: number;
    outerRatio: number;
    topDistance: number;
    cornerDistance: number;
    endpointDistance: number;
    usableRadius: number;
    insetRadius: number;
  };
  comparisonLabel: string;
  annotation?: string;
  filename: string;
}

export const ROOT = process.cwd();
export const LOGO_ROOT_DIR = path.join(ROOT, "public/branding/openlinks-logo");
export const DOCS_LOGO_ROOT_DIR = path.join(ROOT, "docs/assets/openlinks-logo");
export const LEGACY_COMPARISON_SHEET_PATH = path.join(
  ROOT,
  "docs/assets/openlinks-logo-variants.svg",
);

export const V1_VERSION = "v1";
export const V1_DIR = path.join(LOGO_ROOT_DIR, V1_VERSION);
export const V1_COMPARISON_SHEET_PATH = path.join(
  DOCS_LOGO_ROOT_DIR,
  V1_VERSION,
  "openlinks-logo-variants.svg",
);
export const V1_CANONICAL_VARIANT = "ol-mark--strict--mono--round.svg";
export const TOP_LEVEL_CANONICAL_PATH = path.join(LOGO_ROOT_DIR, "openlinks-logo.svg");

export const V2_VERSION = "v2";
export const V2_DIR = path.join(LOGO_ROOT_DIR, V2_VERSION);
export const V2_ARCHIVE_DIR = path.join(V2_DIR, "archive");
export const V2_LEGACY_COMPARISON_SHEET_PATH = path.join(
  DOCS_LOGO_ROOT_DIR,
  V2_VERSION,
  "openlinks-logo-variants.svg",
);
export const V2_ARCHIVE_COMPARISON_SHEET_PATH = path.join(
  DOCS_LOGO_ROOT_DIR,
  V2_VERSION,
  "archive",
  "openlinks-logo-variants.svg",
);
export const V2_MANIFEST_PATH = path.join(V2_DIR, "manifest.json");
export const V2_ARCHIVE_MANIFEST_PATH = path.join(V2_ARCHIVE_DIR, "manifest.json");
export const V2_VERSION_CANONICAL_PATH = path.join(V2_DIR, "openlinks-logo.svg");
export const TOP_LEVEL_V2_ALIAS_PATH = path.join(LOGO_ROOT_DIR, "openlinks-logo-v2.svg");
export const V2_CANONICAL_ID = "inset--centerline-2x--centered";

export const V3_VERSION = "v3";
export const V3_DIR = path.join(LOGO_ROOT_DIR, V3_VERSION);
export const V3_ARCHIVE_DIR = path.join(V3_DIR, "archive");
export const V3_COMPARISON_SHEET_PATH = path.join(
  DOCS_LOGO_ROOT_DIR,
  V3_VERSION,
  "openlinks-logo-variants.svg",
);
export const V3_MANIFEST_PATH = path.join(V3_DIR, "manifest.json");
export const V3_ARCHIVE_MANIFEST_PATH = path.join(V3_ARCHIVE_DIR, "manifest.json");
export const V3_VERSION_CANONICAL_PATH = path.join(V3_DIR, "openlinks-logo.svg");
export const TOP_LEVEL_V3_ALIAS_PATH = path.join(LOGO_ROOT_DIR, "openlinks-logo-v3.svg");
export const V3_CANONICAL_ID = "inset--centerline-2x--centered--c8.5-l8.5";

export const COLOR = "#111111";
export const CANVAS_SIZE = 100;
export const CIRCLE: CircleSpec = { cx: 50, cy: 50, r: 38 };

export const V2_MONO_STYLE: MarkStyle = {
  stroke: { circle: 6, l: 6 },
  cap: { linecap: "round", linejoin: "round" },
  color: COLOR,
};

export const V2_USABLE_RADIUS =
  CIRCLE.r - V2_MONO_STYLE.stroke.circle / 2 - V2_MONO_STYLE.stroke.l / 2;
export const V2_INSET_MARGIN = 4;
export const V2_INSET_RADIUS = V2_USABLE_RADIUS - V2_INSET_MARGIN;
export const V2_RELAXED_TOP_CLEARANCE = 1.25;
export const V3_FIXED_FAMILY = "inset" as const;
export const V3_FIXED_RATIO_MODE = "centerline-2x" as const;
export const V3_FIXED_PLACEMENT = "centered" as const;
export const V3_INSET_MARGIN = 4;
export const V3_CAP: CapSpec = { linecap: "round", linejoin: "round" };

export const V3_WEIGHT_VALUES = [6, 7, 8, 8.5, 9, 10, 11, 12, 13, 14, 15] as const;

export const V3_WEIGHT_PRESETS: V3WeightPreset[] = V3_WEIGHT_VALUES.map((weight) => {
  const label = Number.isInteger(weight) ? String(weight) : weight.toFixed(1);
  return {
    stroke: { circle: weight, l: weight },
    comparisonLabel: `c${label} / l${label}`,
    annotation:
      weight === 6 ? "baseline reference" : weight === 8.5 ? "selected winner" : undefined,
  };
});

export const V1_GEOMETRIES: Record<GeometryMode, V1GeometrySpec> = {
  strict: { xL: 12, yTop: 12, yBottom: 88, xFootEnd: 50 },
  optical: { xL: 13, yTop: 12, yBottom: 87, xFootEnd: 49 },
};

export const V1_STROKES: Record<WeightMode, StrokeSpec> = {
  mono: { circle: 6, l: 6 },
  "l-heavy": { circle: 5, l: 8 },
  "circle-heavy": { circle: 8, l: 5 },
};

export const V1_CAPS: Record<CapMode, CapSpec> = {
  square: { linecap: "butt", linejoin: "miter" },
  round: { linecap: "round", linejoin: "round" },
};

export const V2_LABEL_MATRIX: Array<{
  family: V2Family;
  ratioMode: V2RatioMode;
  placement: V2Placement;
}> = [
  { family: "two-touch", ratioMode: "centerline-2x", placement: "centered" },
  { family: "two-touch", ratioMode: "centerline-2x", placement: "bottom-left" },
  { family: "two-touch", ratioMode: "outer-2x", placement: "centered" },
  { family: "two-touch", ratioMode: "outer-2x", placement: "bottom-left" },
  { family: "inset", ratioMode: "centerline-2x", placement: "centered" },
  { family: "inset", ratioMode: "centerline-2x", placement: "bottom-left" },
  { family: "inset", ratioMode: "outer-2x", placement: "centered" },
  { family: "inset", ratioMode: "outer-2x", placement: "bottom-left" },
  { family: "three-touch", ratioMode: "centerline-2x", placement: "centered" },
  { family: "three-touch", ratioMode: "centerline-2x", placement: "bottom-left" },
  { family: "three-touch", ratioMode: "outer-2x", placement: "centered" },
  { family: "three-touch", ratioMode: "outer-2x", placement: "bottom-left" },
];

export const toRelative = (targetPath: string): string => path.relative(ROOT, targetPath);

export const formatNumber = (value: number): string => {
  const rounded = Number(value.toFixed(4));
  if (Object.is(rounded, -0)) {
    return "0";
  }
  return rounded.toString();
};

export const indentLines = (value: string, prefix: string): string =>
  value
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");

export const toPathData = (geometry: LGeometry): string =>
  `M${formatNumber(geometry.xL)} ${formatNumber(geometry.yTop)} V${formatNumber(geometry.yBottom)} H${formatNumber(geometry.xFootEnd)}`;

export const buildMarkInner = (geometry: LGeometry, style: MarkStyle): string =>
  [
    `<circle cx="${formatNumber(CIRCLE.cx)}" cy="${formatNumber(CIRCLE.cy)}" r="${formatNumber(CIRCLE.r)}" fill="none" stroke="${style.color}" stroke-width="${formatNumber(style.stroke.circle)}" />`,
    `<path d="${toPathData(geometry)}" fill="none" stroke="${style.color}" stroke-width="${formatNumber(style.stroke.l)}" stroke-linecap="${style.cap.linecap}" stroke-linejoin="${style.cap.linejoin}" />`,
  ].join("\n");

export const buildVariantSvg = (input: {
  title: string;
  desc: string;
  geometry: LGeometry;
  style: MarkStyle;
}): string =>
  [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-labelledby="title desc">',
    `  <title id="title">${input.title}</title>`,
    `  <desc id="desc">${input.desc}</desc>`,
    indentLines(buildMarkInner(input.geometry, input.style), "  "),
    "</svg>",
    "",
  ].join("\n");

export const ensureNoClipping = (input: {
  geometry: LGeometry;
  style: MarkStyle;
  filename: string;
}): void => {
  const circleHalf = input.style.stroke.circle / 2;
  const lHalf = input.style.stroke.l / 2;

  const minX = Math.min(CIRCLE.cx - CIRCLE.r - circleHalf, input.geometry.xL - lHalf);
  const maxX = Math.max(CIRCLE.cx + CIRCLE.r + circleHalf, input.geometry.xFootEnd + lHalf);
  const minY = Math.min(CIRCLE.cy - CIRCLE.r - circleHalf, input.geometry.yTop - lHalf);
  const maxY = Math.max(CIRCLE.cy + CIRCLE.r + circleHalf, input.geometry.yBottom + lHalf);

  if (minX < 0 || minY < 0 || maxX > CANVAS_SIZE || maxY > CANVAS_SIZE) {
    throw new Error(
      `Bounds failure (${input.filename}): minX=${minX}, minY=${minY}, maxX=${maxX}, maxY=${maxY}.`,
    );
  }
};

export const buildComparisonSheet = (input: {
  title: string;
  desc: string;
  cards: ComparisonCard[];
}): string => {
  const columns = 4;
  const rows = Math.ceil(input.cards.length / columns);
  const cellWidth = 360;
  const cellHeight = 258;
  const margin = 28;
  const width = columns * cellWidth + margin * 2;
  const height = rows * cellHeight + margin * 2;
  const sizeSwatches = [24, 48, 96];

  const cells = input.cards
    .map((card, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const originX = margin + column * cellWidth;
      const originY = margin + row * cellHeight;
      const cardX = originX + 12;
      const cardY = originY + 72;
      const cardW = cellWidth - 24;
      const cardH = 128;
      const previewBgX = cardX + 12;
      const previewBgY = cardY + 10;
      const previewBgW = 166;
      const previewBgH = 108;
      const swatchOriginX = previewBgX + previewBgW + 18;
      const swatchOriginY = previewBgY - 1;
      const mainScale = 84 / 100;
      const mainX = previewBgX + 33;
      const mainY = previewBgY + 10;

      const swatches = sizeSwatches
        .map((size, swatchIndex) => {
          const scale = size / 100;
          const iconX = swatchOriginX + (92 - size) / 2;
          const iconY = swatchOriginY + swatchIndex * 36;
          return [
            `    <text x="${formatNumber(swatchOriginX + 98)}" y="${formatNumber(iconY + 13)}" font-size="11" fill="#4f5968" font-family="'Manrope', 'Segoe UI', sans-serif">${size}px</text>`,
            `    <g transform="translate(${formatNumber(iconX)} ${formatNumber(iconY)}) scale(${formatNumber(scale)})">`,
            indentLines(buildMarkInner(card.geometry, card.style), "      "),
            "    </g>",
          ].join("\n");
        })
        .join("\n");

      const noteLines = card.notes
        .slice(0, 2)
        .map((note, noteIndex) => {
          const noteY = originY + 220 + noteIndex * 14;
          return `    <text x="${formatNumber(originX + 18)}" y="${formatNumber(noteY)}" font-size="11" fill="#4f5968" font-family="'Manrope', 'Segoe UI', sans-serif">${note}</text>`;
        })
        .join("\n");

      const aliasLine = card.aliasNote
        ? `    <text x="${formatNumber(originX + 18)}" y="${formatNumber(originY + 64)}" font-size="11" fill="#b25d18" font-family="'Manrope', 'Segoe UI', sans-serif">${card.aliasNote}</text>`
        : "";

      return [
        "  <g>",
        `    <rect x="${formatNumber(originX)}" y="${formatNumber(originY)}" width="${formatNumber(cellWidth)}" height="${formatNumber(cellHeight)}" rx="16" fill="#ffffff" stroke="#dce2ec" />`,
        `    <text x="${formatNumber(originX + 18)}" y="${formatNumber(originY + 31)}" font-size="14" font-weight="700" fill="#161d2b" font-family="'Space Grotesk', 'Avenir Next', sans-serif">${card.title}</text>`,
        `    <text x="${formatNumber(originX + 18)}" y="${formatNumber(originY + 50)}" font-size="12" fill="#304159" font-family="'Manrope', 'Segoe UI', sans-serif">${card.subtitle}</text>`,
        aliasLine,
        `    <rect x="${formatNumber(cardX)}" y="${formatNumber(cardY)}" width="${formatNumber(cardW)}" height="${formatNumber(cardH)}" rx="10" fill="#f7f9fc" stroke="#e5eaf2" />`,
        `    <rect x="${formatNumber(previewBgX)}" y="${formatNumber(previewBgY)}" width="${formatNumber(previewBgW)}" height="${formatNumber(previewBgH)}" rx="8" fill="#ffffff" stroke="#e5eaf2" />`,
        `    <g transform="translate(${formatNumber(mainX)} ${formatNumber(mainY)}) scale(${formatNumber(mainScale)})">`,
        indentLines(buildMarkInner(card.geometry, card.style), "      "),
        "    </g>",
        swatches,
        noteLines,
        "  </g>",
      ]
        .filter((line) => line.length > 0)
        .join("\n");
    })
    .join("\n");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${formatNumber(width)}" height="${formatNumber(height)}" viewBox="0 0 ${formatNumber(width)} ${formatNumber(height)}" role="img" aria-labelledby="title desc">`,
    `  <title id="title">${input.title}</title>`,
    `  <desc id="desc">${input.desc}</desc>`,
    `  <rect width="${formatNumber(width)}" height="${formatNumber(height)}" fill="#f1f4f9" />`,
    cells,
    "</svg>",
    "",
  ].join("\n");
};
