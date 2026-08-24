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

import type { ComparisonCard, StrokeSpec, V2Family, V2Placement, V2VariantSpec } from "./common";
import {
  CIRCLE,
  TOP_LEVEL_V2_ALIAS_PATH,
  V2_ARCHIVE_COMPARISON_SHEET_PATH,
  V2_ARCHIVE_DIR,
  V2_ARCHIVE_MANIFEST_PATH,
  V2_CANONICAL_ID,
  V2_DIR,
  V2_INSET_MARGIN,
  V2_INSET_RADIUS,
  V2_LABEL_MATRIX,
  V2_LEGACY_COMPARISON_SHEET_PATH,
  V2_MANIFEST_PATH,
  V2_MONO_STYLE,
  V2_RELAXED_TOP_CLEARANCE,
  V2_USABLE_RADIUS,
  V2_VERSION,
  V2_VERSION_CANONICAL_PATH,
  V3_FIXED_FAMILY,
  V3_FIXED_PLACEMENT,
  V3_FIXED_RATIO_MODE,
  buildComparisonSheet,
  buildVariantSvg,
  ensureNoClipping,
  toRelative,
} from "./common";
export const v2IdFromSpec = (spec: {
  family: V2Family;
  ratioMode: V2RatioMode;
  placement: V2Placement;
}): string => `${spec.family}--${spec.ratioMode}--${spec.placement}`;

export const v2FilenameFromId = (id: string): string => `ol-mark--v2--${id}.svg`;

export const v3IdFromStroke = (stroke: StrokeSpec): string =>
  `${V3_FIXED_FAMILY}--${V3_FIXED_RATIO_MODE}--${V3_FIXED_PLACEMENT}--c${stroke.circle}-l${stroke.l}`;

export const v3FilenameFromStroke = (stroke: StrokeSpec): string =>
  `ol-mark--v3--${v3IdFromStroke(stroke)}.svg`;

export const maxGeometryDelta = (left: LGeometry, right: LGeometry): number =>
  Math.max(
    Math.abs(left.xL - right.xL),
    Math.abs(left.yTop - right.yTop),
    Math.abs(left.yBottom - right.yBottom),
    Math.abs(left.xFootEnd - right.xFootEnd),
  );

export const dedupeV2Variants = (
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

export const validateV2Variant = (variant: V2VariantSpec): void => {
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

export const buildV2TouchModel = (spec: {
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

export const buildV2Variants = (): V2VariantSpec[] => {
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

export const serializeV2Variants = (variants: V2VariantSpec[]) =>
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

export const serializeGeneratedJson = (value: unknown): string =>
  `${JSON.stringify(value, null, 2).replace(
    /"solverNotes": \[\n\s+"([^"\n]+)"\n\s+\]/g,
    '"solverNotes": ["$1"]',
  )}\n`;

export const writeActiveV2Manifest = (input: {
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

  fs.writeFileSync(V2_MANIFEST_PATH, serializeGeneratedJson(manifest), "utf8");
};

export const writeArchiveV2Manifest = (input: {
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

  fs.writeFileSync(V2_ARCHIVE_MANIFEST_PATH, serializeGeneratedJson(archiveManifest), "utf8");
};

export const generateV2 = (): void => {
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
  console.log(`Global V2 alias: ${toRelative(TOP_LEVEL_V2_ALIAS_PATH)} -> ${canonical.filename}`);
};
