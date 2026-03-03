import fs from "node:fs";
import path from "node:path";
import {
  type CircleSpec,
  type LGeometry,
  type V2RatioMode,
  distanceFromCenter,
  geometryHeight,
  geometryPoints,
  geometryWidth,
  solveV2Geometry,
} from "./shared/logo-v2-geometry";

type GeometryMode = "strict" | "optical";
type WeightMode = "mono" | "l-heavy" | "circle-heavy";
type CapMode = "square" | "round";
type V2Family = "two-touch" | "inset" | "three-touch";
type V2Placement = "centered" | "bottom-left";

interface V1GeometrySpec {
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

interface V1VariantSpec {
  geometryMode: GeometryMode;
  weightMode: WeightMode;
  capMode: CapMode;
  geometry: V1GeometrySpec;
  stroke: StrokeSpec;
  cap: CapSpec;
  filename: string;
  label: string;
}

interface MarkStyle {
  stroke: StrokeSpec;
  cap: CapSpec;
  color: string;
}

interface ComparisonCard {
  id: string;
  title: string;
  subtitle: string;
  notes: string[];
  aliasNote?: string;
  geometry: LGeometry;
  style: MarkStyle;
}

interface V2VariantSpec {
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

const ROOT = process.cwd();
const LOGO_ROOT_DIR = path.join(ROOT, "public/branding/openlinks-logo");
const DOCS_LOGO_ROOT_DIR = path.join(ROOT, "docs/assets/openlinks-logo");
const LEGACY_COMPARISON_SHEET_PATH = path.join(ROOT, "docs/assets/openlinks-logo-variants.svg");

const V1_VERSION = "v1";
const V1_DIR = path.join(LOGO_ROOT_DIR, V1_VERSION);
const V1_COMPARISON_SHEET_PATH = path.join(
  DOCS_LOGO_ROOT_DIR,
  V1_VERSION,
  "openlinks-logo-variants.svg",
);
const V1_CANONICAL_VARIANT = "ol-mark--strict--mono--round.svg";
const TOP_LEVEL_CANONICAL_PATH = path.join(LOGO_ROOT_DIR, "openlinks-logo.svg");

const V2_VERSION = "v2";
const V2_DIR = path.join(LOGO_ROOT_DIR, V2_VERSION);
const V2_ARCHIVE_DIR = path.join(V2_DIR, "archive");
const V2_LEGACY_COMPARISON_SHEET_PATH = path.join(
  DOCS_LOGO_ROOT_DIR,
  V2_VERSION,
  "openlinks-logo-variants.svg",
);
const V2_ARCHIVE_COMPARISON_SHEET_PATH = path.join(
  DOCS_LOGO_ROOT_DIR,
  V2_VERSION,
  "archive",
  "openlinks-logo-variants.svg",
);
const V2_MANIFEST_PATH = path.join(V2_DIR, "manifest.json");
const V2_ARCHIVE_MANIFEST_PATH = path.join(V2_ARCHIVE_DIR, "manifest.json");
const V2_VERSION_CANONICAL_PATH = path.join(V2_DIR, "openlinks-logo.svg");
const TOP_LEVEL_V2_ALIAS_PATH = path.join(LOGO_ROOT_DIR, "openlinks-logo-v2.svg");
const V2_CANONICAL_ID = "inset--centerline-2x--centered";

const COLOR = "#111111";
const CANVAS_SIZE = 100;
const CIRCLE: CircleSpec = { cx: 50, cy: 50, r: 38 };

const V2_MONO_STYLE: MarkStyle = {
  stroke: { circle: 6, l: 6 },
  cap: { linecap: "round", linejoin: "round" },
  color: COLOR,
};

const V2_USABLE_RADIUS = CIRCLE.r - V2_MONO_STYLE.stroke.circle / 2 - V2_MONO_STYLE.stroke.l / 2;
const V2_INSET_MARGIN = 4;
const V2_INSET_RADIUS = V2_USABLE_RADIUS - V2_INSET_MARGIN;
const V2_RELAXED_TOP_CLEARANCE = 1.25;

const V1_GEOMETRIES: Record<GeometryMode, V1GeometrySpec> = {
  strict: { xL: 12, yTop: 12, yBottom: 88, xFootEnd: 50 },
  optical: { xL: 13, yTop: 12, yBottom: 87, xFootEnd: 49 },
};

const V1_STROKES: Record<WeightMode, StrokeSpec> = {
  mono: { circle: 6, l: 6 },
  "l-heavy": { circle: 5, l: 8 },
  "circle-heavy": { circle: 8, l: 5 },
};

const V1_CAPS: Record<CapMode, CapSpec> = {
  square: { linecap: "butt", linejoin: "miter" },
  round: { linecap: "round", linejoin: "round" },
};

const V2_LABEL_MATRIX: Array<{
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

const toRelative = (targetPath: string): string => path.relative(ROOT, targetPath);

const formatNumber = (value: number): string => {
  const rounded = Number(value.toFixed(4));
  if (Object.is(rounded, -0)) {
    return "0";
  }
  return rounded.toString();
};

const indentLines = (value: string, prefix: string): string =>
  value
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");

const toPathData = (geometry: LGeometry): string =>
  `M${formatNumber(geometry.xL)} ${formatNumber(geometry.yTop)} V${formatNumber(geometry.yBottom)} H${formatNumber(geometry.xFootEnd)}`;

const buildMarkInner = (geometry: LGeometry, style: MarkStyle): string =>
  [
    `<circle cx="${formatNumber(CIRCLE.cx)}" cy="${formatNumber(CIRCLE.cy)}" r="${formatNumber(CIRCLE.r)}" fill="none" stroke="${style.color}" stroke-width="${formatNumber(style.stroke.circle)}" />`,
    `<path d="${toPathData(geometry)}" fill="none" stroke="${style.color}" stroke-width="${formatNumber(style.stroke.l)}" stroke-linecap="${style.cap.linecap}" stroke-linejoin="${style.cap.linejoin}" />`,
  ].join("\n");

const buildVariantSvg = (input: {
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

const ensureNoClipping = (input: {
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

const buildComparisonSheet = (input: {
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

const listV1Variants = (): V1VariantSpec[] => {
  const variants: V1VariantSpec[] = [];
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
          geometry: V1_GEOMETRIES[geometryMode],
          stroke: V1_STROKES[weightMode],
          cap: V1_CAPS[capMode],
          filename: `ol-mark--${geometryMode}--${weightMode}--${capMode}.svg`,
          label: `${geometryMode} / ${weightMode} / ${capMode}`,
        });
      }
    }
  }

  return variants;
};

const ensureV1StrictGeometry = (variant: V1VariantSpec): void => {
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

const removeLegacyTopLevelVariants = (): void => {
  fs.mkdirSync(LOGO_ROOT_DIR, { recursive: true });
  const staleFiles = fs
    .readdirSync(LOGO_ROOT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^ol-mark--.*\.svg$/.test(entry.name))
    .map((entry) => path.join(LOGO_ROOT_DIR, entry.name));

  for (const staleFile of staleFiles) {
    fs.rmSync(staleFile);
  }
};

const generateV1 = (): void => {
  const variants = listV1Variants();
  if (variants.length !== 12) {
    throw new Error(`Expected 12 V1 variants but received ${variants.length}.`);
  }

  removeLegacyTopLevelVariants();
  fs.mkdirSync(V1_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(V1_COMPARISON_SHEET_PATH), { recursive: true });

  for (const variant of variants) {
    ensureV1StrictGeometry(variant);

    const style: MarkStyle = {
      stroke: variant.stroke,
      cap: variant.cap,
      color: COLOR,
    };
    ensureNoClipping({
      geometry: variant.geometry,
      style,
      filename: variant.filename,
    });

    const svg = buildVariantSvg({
      title: `OpenLinks logo mark (${variant.label})`,
      desc:
        variant.geometryMode === "strict"
          ? "Circle and L use strict tangent geometry."
          : "Circle and L use optical offsets for balance.",
      geometry: variant.geometry,
      style,
    });

    fs.writeFileSync(path.join(V1_DIR, variant.filename), svg, "utf8");
  }

  const cards: ComparisonCard[] = variants.map((variant) => ({
    id: variant.filename,
    title: variant.label,
    subtitle: "V1 circle+tangent L",
    notes: [
      `strokes c:${variant.stroke.circle} l:${variant.stroke.l}`,
      `caps ${variant.cap.linecap}/${variant.cap.linejoin}`,
    ],
    geometry: variant.geometry,
    style: {
      stroke: variant.stroke,
      cap: variant.cap,
      color: COLOR,
    },
  }));

  const comparisonSheet = buildComparisonSheet({
    title: "OpenLinks V1 logo variants",
    desc: "V1 comparison grid across strict/optical geometry and stroke permutations.",
    cards,
  });
  fs.writeFileSync(V1_COMPARISON_SHEET_PATH, comparisonSheet, "utf8");

  const canonicalSource = path.join(V1_DIR, V1_CANONICAL_VARIANT);
  if (!fs.existsSync(canonicalSource)) {
    throw new Error(`V1 canonical source not found: ${toRelative(canonicalSource)}`);
  }

  fs.copyFileSync(canonicalSource, path.join(V1_DIR, "openlinks-logo.svg"));

  if (fs.existsSync(LEGACY_COMPARISON_SHEET_PATH)) {
    fs.rmSync(LEGACY_COMPARISON_SHEET_PATH);
  }

  console.log(`Generated ${variants.length} V1 variants at ${toRelative(V1_DIR)}.`);
  console.log(`V1 comparison sheet: ${toRelative(V1_COMPARISON_SHEET_PATH)}`);
  console.log(
    `V1 canonical: ${toRelative(path.join(V1_DIR, "openlinks-logo.svg"))} -> ${V1_CANONICAL_VARIANT}`,
  );
};

const v2IdFromSpec = (spec: {
  family: V2Family;
  ratioMode: V2RatioMode;
  placement: V2Placement;
}): string => `${spec.family}--${spec.ratioMode}--${spec.placement}`;

const v2FilenameFromId = (id: string): string => `ol-mark--v2--${id}.svg`;

const maxGeometryDelta = (left: LGeometry, right: LGeometry): number =>
  Math.max(
    Math.abs(left.xL - right.xL),
    Math.abs(left.yTop - right.yTop),
    Math.abs(left.yBottom - right.yBottom),
    Math.abs(left.xFootEnd - right.xFootEnd),
  );

const dedupeV2Variants = (
  variants: V2VariantSpec[],
): {
  labels: V2VariantSpec[];
  unique: V2VariantSpec[];
} => {
  const canonical = variants.find((variant) => variant.id === V2_CANONICAL_ID);
  if (!canonical) {
    throw new Error(`Canonical V2 label not found: ${V2_CANONICAL_ID}`);
  }

  const ordered = [canonical, ...variants.filter((variant) => variant.id !== V2_CANONICAL_ID)];
  const unique: V2VariantSpec[] = [];

  for (const variant of ordered) {
    const existing = unique.find(
      (entry) => maxGeometryDelta(entry.geometry, variant.geometry) <= 1e-6,
    );
    if (existing) {
      variant.aliasOf = existing.id;
      variant.filename = existing.filename;
      continue;
    }

    variant.filename = v2FilenameFromId(variant.id);
    unique.push(variant);
  }

  return { labels: variants, unique };
};

const validateV2Variant = (variant: V2VariantSpec): void => {
  const points = geometryPoints(variant.geometry);
  const topDistance = distanceFromCenter(CIRCLE, points.top);
  const cornerDistance = distanceFromCenter(CIRCLE, points.corner);
  const endpointDistance = distanceFromCenter(CIRCLE, points.endpoint);
  const ratioTolerance = 1e-3;
  const touchTolerance = 2e-3;

  if (variant.ratioMode === "centerline-2x") {
    if (Math.abs(variant.metrics.centerlineRatio - 2) > ratioTolerance) {
      throw new Error(
        `V2 ratio mismatch (${variant.id}): centerline ratio=${variant.metrics.centerlineRatio}`,
      );
    }
  } else if (Math.abs(variant.metrics.outerRatio - 2) > ratioTolerance) {
    throw new Error(`V2 ratio mismatch (${variant.id}): outer ratio=${variant.metrics.outerRatio}`);
  }

  if (variant.family === "three-touch" && variant.placement === "centered") {
    if (Math.abs(topDistance - variant.radiusTarget) > touchTolerance) {
      throw new Error(`V2 touch mismatch (${variant.id}): top not tangent to target radius.`);
    }
    if (Math.abs(cornerDistance - variant.radiusTarget) > touchTolerance) {
      throw new Error(`V2 touch mismatch (${variant.id}): corner not tangent to target radius.`);
    }
    if (Math.abs(endpointDistance - variant.radiusTarget) > touchTolerance) {
      throw new Error(`V2 touch mismatch (${variant.id}): endpoint not tangent to target radius.`);
    }
  } else if (variant.family === "three-touch" && variant.placement === "bottom-left") {
    if (Math.abs(cornerDistance - variant.radiusTarget) > touchTolerance) {
      throw new Error(
        `V2 relaxed mismatch (${variant.id}): corner must remain tangent to target radius.`,
      );
    }
    if (Math.abs(endpointDistance - variant.radiusTarget) > touchTolerance) {
      throw new Error(
        `V2 relaxed mismatch (${variant.id}): endpoint must remain tangent to target radius.`,
      );
    }
    if (topDistance >= variant.radiusTarget - 1e-4) {
      throw new Error(`V2 relaxed mismatch (${variant.id}): top should be inside target radius.`);
    }
  } else {
    if (Math.abs(topDistance - variant.radiusTarget) > touchTolerance) {
      throw new Error(`V2 two-touch mismatch (${variant.id}): top not tangent.`);
    }
    if (Math.abs(endpointDistance - variant.radiusTarget) > touchTolerance) {
      throw new Error(`V2 two-touch mismatch (${variant.id}): endpoint not tangent.`);
    }
    if (cornerDistance > variant.radiusTarget + touchTolerance) {
      throw new Error(`V2 two-touch mismatch (${variant.id}): corner outside target radius.`);
    }
  }

  ensureNoClipping({
    geometry: variant.geometry,
    style: V2_MONO_STYLE,
    filename: variant.filename ?? variant.id,
  });
};

const buildV2TouchModel = (spec: {
  family: V2Family;
  placement: V2Placement;
}): string => {
  if (spec.family === "three-touch" && spec.placement === "centered") {
    return "top+corner+endpoint tangent";
  }

  if (spec.family === "three-touch" && spec.placement === "bottom-left") {
    return "corner+endpoint tangent; top relaxed";
  }

  return "top+endpoint tangent; corner inside";
};

const buildV2Variants = (): V2VariantSpec[] => {
  const variants: V2VariantSpec[] = [];

  for (const spec of V2_LABEL_MATRIX) {
    const solved = solveV2Geometry({
      family: spec.family,
      placement: spec.placement,
      ratioMode: spec.ratioMode,
      circle: CIRCLE,
      usableRadius: V2_USABLE_RADIUS,
      insetRadius: V2_INSET_RADIUS,
      strokeWidth: V2_MONO_STYLE.stroke.l,
      relaxedTopClearance: V2_RELAXED_TOP_CLEARANCE,
    });

    const width = geometryWidth(solved.geometry);
    const height = geometryHeight(solved.geometry);
    const topDistance = distanceFromCenter(CIRCLE, geometryPoints(solved.geometry).top);
    const cornerDistance = distanceFromCenter(CIRCLE, geometryPoints(solved.geometry).corner);
    const endpointDistance = distanceFromCenter(CIRCLE, geometryPoints(solved.geometry).endpoint);

    variants.push({
      id: v2IdFromSpec(spec),
      family: spec.family,
      ratioMode: spec.ratioMode,
      placement: spec.placement,
      radiusTarget: spec.family === "inset" ? V2_INSET_RADIUS : V2_USABLE_RADIUS,
      touchModel: buildV2TouchModel(spec),
      geometry: solved.geometry,
      solver: solved.solver,
      solverNotes: solved.notes,
      metrics: {
        width,
        height,
        centerlineRatio: height / width,
        outerRatio: (height + V2_MONO_STYLE.stroke.l) / (width + V2_MONO_STYLE.stroke.l),
        topDistance,
        cornerDistance,
        endpointDistance,
      },
    });
  }

  if (variants.length !== 12) {
    throw new Error(`Expected 12 V2 label variants but received ${variants.length}.`);
  }

  for (const variant of variants) {
    validateV2Variant(variant);
  }

  return variants;
};

const serializeV2Variants = (variants: V2VariantSpec[]) =>
  variants.map((variant) => ({
    id: variant.id,
    family: variant.family,
    ratioMode: variant.ratioMode,
    placement: variant.placement,
    touchModel: variant.touchModel,
    radiusTarget: Number(variant.radiusTarget.toFixed(4)),
    solver: variant.solver,
    solverNotes: variant.solverNotes,
    filename: variant.filename,
    aliasOf: variant.aliasOf,
    geometry: {
      xL: Number(variant.geometry.xL.toFixed(6)),
      yTop: Number(variant.geometry.yTop.toFixed(6)),
      yBottom: Number(variant.geometry.yBottom.toFixed(6)),
      xFootEnd: Number(variant.geometry.xFootEnd.toFixed(6)),
    },
    metrics: {
      width: Number(variant.metrics.width.toFixed(6)),
      height: Number(variant.metrics.height.toFixed(6)),
      centerlineRatio: Number(variant.metrics.centerlineRatio.toFixed(6)),
      outerRatio: Number(variant.metrics.outerRatio.toFixed(6)),
      topDistance: Number(variant.metrics.topDistance.toFixed(6)),
      cornerDistance: Number(variant.metrics.cornerDistance.toFixed(6)),
      endpointDistance: Number(variant.metrics.endpointDistance.toFixed(6)),
    },
  }));

const writeActiveV2Manifest = (input: {
  generatedAt: string;
  labels: V2VariantSpec[];
  unique: V2VariantSpec[];
  canonical: V2VariantSpec;
}): void => {
  const archivedUniqueCount = input.unique.filter(
    (variant) => variant.id !== input.canonical.id,
  ).length;
  const manifest = {
    version: `${V2_VERSION}-active`,
    generatedAt: input.generatedAt,
    canonical: {
      id: input.canonical.id,
      file: input.canonical.filename,
      family: input.canonical.family,
      ratioMode: input.canonical.ratioMode,
      placement: input.canonical.placement,
      touchModel: input.canonical.touchModel,
      sourcePath: toRelative(path.join(V2_DIR, input.canonical.filename ?? "")),
    },
    aliases: {
      versionAlias: toRelative(V2_VERSION_CANONICAL_PATH),
      globalPrimary: toRelative(TOP_LEVEL_CANONICAL_PATH),
      globalV2Alias: toRelative(TOP_LEVEL_V2_ALIAS_PATH),
    },
    archive: {
      directory: toRelative(V2_ARCHIVE_DIR),
      manifestPath: toRelative(V2_ARCHIVE_MANIFEST_PATH),
      comparisonSheetPath: toRelative(V2_ARCHIVE_COMPARISON_SHEET_PATH),
    },
    stats: {
      labelCount: input.labels.length,
      uniqueFileCount: input.unique.length,
      archivedUniqueFileCount: archivedUniqueCount,
      aliasCount: input.labels.filter((variant) => variant.aliasOf).length,
    },
  };

  fs.writeFileSync(V2_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
};

const writeArchiveV2Manifest = (input: {
  generatedAt: string;
  labels: V2VariantSpec[];
  unique: V2VariantSpec[];
  canonical: V2VariantSpec;
}): void => {
  const archiveManifest = {
    version: `${V2_VERSION}-archive`,
    generatedAt: input.generatedAt,
    constants: {
      circle: CIRCLE,
      style: {
        stroke: V2_MONO_STYLE.stroke,
        cap: V2_MONO_STYLE.cap,
        color: V2_MONO_STYLE.color,
      },
      usableRadius: V2_USABLE_RADIUS,
      insetMargin: V2_INSET_MARGIN,
      insetRadius: V2_INSET_RADIUS,
      relaxedTopClearance: V2_RELAXED_TOP_CLEARANCE,
    },
    canonical: {
      id: input.canonical.id,
      filename: input.canonical.filename,
    },
    stats: {
      labelCount: input.labels.length,
      uniqueFileCount: input.unique.length,
      archivedUniqueFileCount: input.unique.filter((variant) => variant.id !== input.canonical.id)
        .length,
      aliasCount: input.labels.filter((variant) => variant.aliasOf).length,
    },
    variants: serializeV2Variants(input.labels),
  };

  fs.writeFileSync(
    V2_ARCHIVE_MANIFEST_PATH,
    `${JSON.stringify(archiveManifest, null, 2)}\n`,
    "utf8",
  );
};

const generateV2 = (): void => {
  const generatedAt = new Date().toISOString();
  const labels = buildV2Variants();
  const deduped = dedupeV2Variants(labels);
  const canonical = deduped.labels.find((variant) => variant.id === V2_CANONICAL_ID);
  if (!canonical?.filename) {
    throw new Error(`V2 canonical filename missing for ${V2_CANONICAL_ID}.`);
  }

  fs.rmSync(V2_DIR, { recursive: true, force: true });
  fs.mkdirSync(V2_DIR, { recursive: true });
  fs.mkdirSync(V2_ARCHIVE_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(V2_ARCHIVE_COMPARISON_SHEET_PATH), { recursive: true });

  if (fs.existsSync(V2_LEGACY_COMPARISON_SHEET_PATH)) {
    fs.rmSync(V2_LEGACY_COMPARISON_SHEET_PATH);
  }

  for (const variant of deduped.unique) {
    if (!variant.filename) {
      throw new Error(`V2 unique variant filename missing: ${variant.id}`);
    }

    const svg = buildVariantSvg({
      title: `OpenLinks logo mark V2 (${variant.id})`,
      desc: `Family=${variant.family}; ratio=${variant.ratioMode}; placement=${variant.placement}; touch=${variant.touchModel}.`,
      geometry: variant.geometry,
      style: V2_MONO_STYLE,
    });

    const targetDir = variant.id === canonical.id ? V2_DIR : V2_ARCHIVE_DIR;
    fs.writeFileSync(path.join(targetDir, variant.filename), svg, "utf8");
  }

  const canonicalSource = path.join(V2_DIR, canonical.filename);
  if (!fs.existsSync(canonicalSource)) {
    throw new Error(
      `V2 canonical source not found after generation: ${toRelative(canonicalSource)}`,
    );
  }

  fs.copyFileSync(canonicalSource, V2_VERSION_CANONICAL_PATH);
  fs.copyFileSync(canonicalSource, TOP_LEVEL_CANONICAL_PATH);
  fs.copyFileSync(canonicalSource, TOP_LEVEL_V2_ALIAS_PATH);

  writeActiveV2Manifest({
    generatedAt,
    labels: deduped.labels,
    unique: deduped.unique,
    canonical,
  });
  writeArchiveV2Manifest({
    generatedAt,
    labels: deduped.labels,
    unique: deduped.unique,
    canonical,
  });

  const cards: ComparisonCard[] = deduped.labels.map((variant) => ({
    id: variant.id,
    title: `${variant.family} / ${variant.ratioMode} / ${variant.placement}`,
    subtitle: `touch: ${variant.touchModel}`,
    aliasNote: variant.aliasOf ? `alias of ${variant.aliasOf}` : undefined,
    notes: [
      `centerline H:W = ${variant.metrics.centerlineRatio.toFixed(4)}:1`,
      `outer H:W = ${variant.metrics.outerRatio.toFixed(4)}:1 (${variant.solver})`,
    ],
    geometry: variant.geometry,
    style: V2_MONO_STYLE,
  }));

  const comparisonSheet = buildComparisonSheet({
    title: "OpenLinks V2 logo variants (archive)",
    desc: "Archived V2 non-winning comparison set with ratio/touch metadata and alias annotations.",
    cards,
  });
  fs.writeFileSync(V2_ARCHIVE_COMPARISON_SHEET_PATH, comparisonSheet, "utf8");

  console.log(
    `Generated ${deduped.labels.length} V2 labels (${deduped.unique.length} unique files; canonical=${canonical.id}).`,
  );
  console.log(`V2 active directory: ${toRelative(V2_DIR)}`);
  console.log(`V2 archive directory: ${toRelative(V2_ARCHIVE_DIR)}`);
  console.log(`V2 active manifest: ${toRelative(V2_MANIFEST_PATH)}`);
  console.log(`V2 archive manifest: ${toRelative(V2_ARCHIVE_MANIFEST_PATH)}`);
  console.log(`V2 archive comparison sheet: ${toRelative(V2_ARCHIVE_COMPARISON_SHEET_PATH)}`);
  console.log(
    `Global primary logo: ${toRelative(TOP_LEVEL_CANONICAL_PATH)} -> ${canonical.filename}`,
  );
  console.log(`Global V2 alias: ${toRelative(TOP_LEVEL_V2_ALIAS_PATH)} -> ${canonical.filename}`);
};

const run = (): void => {
  generateV1();
  generateV2();
};

run();
