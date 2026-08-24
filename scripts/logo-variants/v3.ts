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

import type { ComparisonCard, V3VariantSpec } from "./common";
import {
  CIRCLE,
  COLOR,
  TOP_LEVEL_CANONICAL_PATH,
  TOP_LEVEL_V3_ALIAS_PATH,
  V2_RELAXED_TOP_CLEARANCE,
  V3_ARCHIVE_DIR,
  V3_ARCHIVE_MANIFEST_PATH,
  V3_CANONICAL_ID,
  V3_CAP,
  V3_COMPARISON_SHEET_PATH,
  V3_DIR,
  V3_FIXED_FAMILY,
  V3_FIXED_PLACEMENT,
  V3_FIXED_RATIO_MODE,
  V3_INSET_MARGIN,
  V3_MANIFEST_PATH,
  V3_VERSION,
  V3_VERSION_CANONICAL_PATH,
  V3_WEIGHT_PRESETS,
  buildComparisonSheet,
  buildVariantSvg,
  ensureNoClipping,
  toRelative,
} from "./common";
import { serializeGeneratedJson, v3FilenameFromStroke, v3IdFromStroke } from "./v2";
export const validateV3Variant = (variant: V3VariantSpec): void => {
  const ratioTolerance = 1e-3;
  const touchTolerance = 2e-3;

  if (Math.abs(variant.metrics.centerlineRatio - 2) > ratioTolerance) {
    throw new Error(
      `V3 ratio mismatch (${variant.id}): centerline ratio=${variant.metrics.centerlineRatio}`,
    );
  }

  if (Math.abs(variant.metrics.topDistance - variant.metrics.insetRadius) > touchTolerance) {
    throw new Error(`V3 touch mismatch (${variant.id}): top not tangent to inset radius.`);
  }

  if (Math.abs(variant.metrics.cornerDistance - variant.metrics.insetRadius) > touchTolerance) {
    throw new Error(`V3 touch mismatch (${variant.id}): corner not tangent to inset radius.`);
  }

  if (Math.abs(variant.metrics.endpointDistance - variant.metrics.insetRadius) > touchTolerance) {
    throw new Error(`V3 touch mismatch (${variant.id}): endpoint not tangent to inset radius.`);
  }

  ensureNoClipping({
    geometry: variant.geometry,
    style: {
      stroke: variant.stroke,
      cap: V3_CAP,
      color: COLOR,
    },
    filename: variant.filename,
  });
};

export const buildV3Variants = (): V3VariantSpec[] => {
  const variants = V3_WEIGHT_PRESETS.map((preset) => {
    const usableRadius = CIRCLE.r - preset.stroke.circle / 2 - preset.stroke.l / 2;
    const insetRadius = usableRadius - V3_INSET_MARGIN;
    const solved = solveV2Geometry({
      family: V3_FIXED_FAMILY,
      placement: V3_FIXED_PLACEMENT,
      ratioMode: V3_FIXED_RATIO_MODE,
      circle: CIRCLE,
      usableRadius,
      insetRadius,
      strokeWidth: preset.stroke.l,
      relaxedTopClearance: V2_RELAXED_TOP_CLEARANCE,
    });
    const width = geometryWidth(solved.geometry);
    const height = geometryHeight(solved.geometry);
    const topDistance = distanceFromCenter(CIRCLE, geometryPoints(solved.geometry).top);
    const cornerDistance = distanceFromCenter(CIRCLE, geometryPoints(solved.geometry).corner);
    const endpointDistance = distanceFromCenter(CIRCLE, geometryPoints(solved.geometry).endpoint);

    return {
      id: v3IdFromStroke(preset.stroke),
      family: V3_FIXED_FAMILY,
      ratioMode: V3_FIXED_RATIO_MODE,
      placement: V3_FIXED_PLACEMENT,
      touchModel: "top+corner+endpoint tangent",
      stroke: preset.stroke,
      geometry: solved.geometry,
      solver: solved.solver,
      solverNotes: solved.notes,
      metrics: {
        width,
        height,
        centerlineRatio: height / width,
        outerRatio: (height + preset.stroke.l) / (width + preset.stroke.l),
        topDistance,
        cornerDistance,
        endpointDistance,
        usableRadius,
        insetRadius,
      },
      comparisonLabel: preset.comparisonLabel,
      annotation: preset.annotation,
      filename: v3FilenameFromStroke(preset.stroke),
    } satisfies V3VariantSpec;
  });

  if (variants.length !== V3_WEIGHT_PRESETS.length) {
    throw new Error(
      `Expected ${V3_WEIGHT_PRESETS.length} V3 variants but received ${variants.length}.`,
    );
  }

  for (const variant of variants) {
    validateV3Variant(variant);
  }

  return variants;
};

export const serializeV3Variants = (variants: V3VariantSpec[]) =>
  variants.map((variant) => ({
    id: variant.id,
    family: variant.family,
    ratioMode: variant.ratioMode,
    placement: variant.placement,
    touchModel: variant.touchModel,
    comparisonLabel: variant.comparisonLabel,
    annotation: variant.annotation,
    filename: variant.filename,
    stroke: variant.stroke,
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
      usableRadius: Number(variant.metrics.usableRadius.toFixed(6)),
      insetRadius: Number(variant.metrics.insetRadius.toFixed(6)),
    },
    solver: variant.solver,
    solverNotes: variant.solverNotes,
  }));

export const writeActiveV3Manifest = (input: {
  generatedAt: string;
  variants: V3VariantSpec[];
  canonical: V3VariantSpec;
}): void => {
  const manifest = {
    version: `${V3_VERSION}-active`,
    generatedAt: input.generatedAt,
    canonical: {
      id: input.canonical.id,
      file: input.canonical.filename,
      family: input.canonical.family,
      ratioMode: input.canonical.ratioMode,
      placement: input.canonical.placement,
      touchModel: input.canonical.touchModel,
      stroke: input.canonical.stroke,
      sourcePath: toRelative(path.join(V3_DIR, input.canonical.filename)),
    },
    aliases: {
      versionAlias: toRelative(V3_VERSION_CANONICAL_PATH),
      globalPrimary: toRelative(TOP_LEVEL_CANONICAL_PATH),
      globalV3Alias: toRelative(TOP_LEVEL_V3_ALIAS_PATH),
    },
    archive: {
      directory: toRelative(V3_ARCHIVE_DIR),
      manifestPath: toRelative(V3_ARCHIVE_MANIFEST_PATH),
    },
    comparisonSheetPath: toRelative(V3_COMPARISON_SHEET_PATH),
    stats: {
      labelCount: input.variants.length,
      uniqueFileCount: input.variants.length,
      archivedUniqueFileCount: input.variants.length - 1,
      baselineCount: input.variants.filter((variant) => variant.annotation === "baseline reference")
        .length,
    },
  };

  fs.writeFileSync(V3_MANIFEST_PATH, serializeGeneratedJson(manifest), "utf8");
};

export const writeArchiveV3Manifest = (input: {
  generatedAt: string;
  variants: V3VariantSpec[];
  canonical: V3VariantSpec;
}): void => {
  const archiveManifest = {
    version: `${V3_VERSION}-archive`,
    generatedAt: input.generatedAt,
    constants: {
      circle: CIRCLE,
      cap: V3_CAP,
      color: COLOR,
      insetMargin: V3_INSET_MARGIN,
      family: V3_FIXED_FAMILY,
      ratioMode: V3_FIXED_RATIO_MODE,
      placement: V3_FIXED_PLACEMENT,
    },
    canonical: {
      id: input.canonical.id,
      filename: input.canonical.filename,
      stroke: input.canonical.stroke,
    },
    comparisonSheetPath: toRelative(V3_COMPARISON_SHEET_PATH),
    stats: {
      variantCount: input.variants.length,
      archivedVariantCount: input.variants.length - 1,
    },
    variants: serializeV3Variants(input.variants),
  };

  fs.writeFileSync(V3_ARCHIVE_MANIFEST_PATH, serializeGeneratedJson(archiveManifest), "utf8");
};

export const generateV3 = (): void => {
  const generatedAt = new Date().toISOString();
  const variants = buildV3Variants();
  const canonical = variants.find((variant) => variant.id === V3_CANONICAL_ID);
  if (!canonical) {
    throw new Error(`Canonical V3 label not found: ${V3_CANONICAL_ID}`);
  }

  fs.rmSync(V3_DIR, { recursive: true, force: true });
  fs.mkdirSync(V3_DIR, { recursive: true });
  fs.mkdirSync(V3_ARCHIVE_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(V3_COMPARISON_SHEET_PATH), { recursive: true });

  for (const variant of variants) {
    const svg = buildVariantSvg({
      title: `OpenLinks logo mark V3 (${variant.comparisonLabel})`,
      desc: `Family=${variant.family}; ratio=${variant.ratioMode}; placement=${variant.placement}; stroke circle=${variant.stroke.circle}; stroke l=${variant.stroke.l}.`,
      geometry: variant.geometry,
      style: {
        stroke: variant.stroke,
        cap: V3_CAP,
        color: COLOR,
      },
    });

    const targetDir = variant.id === canonical.id ? V3_DIR : V3_ARCHIVE_DIR;
    fs.writeFileSync(path.join(targetDir, variant.filename), svg, "utf8");
  }

  const canonicalSource = path.join(V3_DIR, canonical.filename);
  if (!fs.existsSync(canonicalSource)) {
    throw new Error(
      `V3 canonical source not found after generation: ${toRelative(canonicalSource)}`,
    );
  }

  fs.copyFileSync(canonicalSource, V3_VERSION_CANONICAL_PATH);
  fs.copyFileSync(canonicalSource, TOP_LEVEL_CANONICAL_PATH);
  fs.copyFileSync(canonicalSource, TOP_LEVEL_V3_ALIAS_PATH);

  writeActiveV3Manifest({
    generatedAt,
    variants,
    canonical,
  });
  writeArchiveV3Manifest({
    generatedAt,
    variants,
    canonical,
  });

  const cards: ComparisonCard[] = variants.map((variant) => ({
    id: variant.id,
    title: variant.comparisonLabel,
    subtitle: "V3 inset / centerline-2x / centered",
    aliasNote: variant.annotation,
    notes: [
      `strokes c:${variant.stroke.circle} l:${variant.stroke.l}`,
      `usable r:${variant.metrics.usableRadius.toFixed(1)} inset r:${variant.metrics.insetRadius.toFixed(1)}`,
    ],
    geometry: variant.geometry,
    style: {
      stroke: variant.stroke,
      cap: V3_CAP,
      color: COLOR,
    },
  }));

  const comparisonSheet = buildComparisonSheet({
    title: "OpenLinks V3 logo thickness variants",
    desc: "V3 comparison grid for thicker equal-weight stroke candidates using the inset centered geometry family.",
    cards,
  });
  fs.writeFileSync(V3_COMPARISON_SHEET_PATH, comparisonSheet, "utf8");

  console.log(
    `Generated ${variants.length} V3 variants (canonical=${canonical.id}) at ${toRelative(V3_DIR)}.`,
  );
  console.log(`V3 archive directory: ${toRelative(V3_ARCHIVE_DIR)}`);
  console.log(`V3 active manifest: ${toRelative(V3_MANIFEST_PATH)}`);
  console.log(`V3 archive manifest: ${toRelative(V3_ARCHIVE_MANIFEST_PATH)}`);
  console.log(`V3 comparison sheet: ${toRelative(V3_COMPARISON_SHEET_PATH)}`);
  console.log(
    `Global primary logo: ${toRelative(TOP_LEVEL_CANONICAL_PATH)} -> ${canonical.filename}`,
  );
  console.log(`Global V3 alias: ${toRelative(TOP_LEVEL_V3_ALIAS_PATH)} -> ${canonical.filename}`);
};
