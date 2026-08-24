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

import type {
  CapMode,
  ComparisonCard,
  GeometryMode,
  MarkStyle,
  V1VariantSpec,
  WeightMode,
} from "./common";
import {
  CIRCLE,
  COLOR,
  LEGACY_COMPARISON_SHEET_PATH,
  LOGO_ROOT_DIR,
  V1_CANONICAL_VARIANT,
  V1_CAPS,
  V1_COMPARISON_SHEET_PATH,
  V1_DIR,
  V1_GEOMETRIES,
  V1_STROKES,
  buildComparisonSheet,
  buildVariantSvg,
  ensureNoClipping,
  toRelative,
} from "./common";
export const listV1Variants = (): V1VariantSpec[] => {
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

export const ensureV1StrictGeometry = (variant: V1VariantSpec): void => {
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

export const removeLegacyTopLevelVariants = (): void => {
  fs.mkdirSync(LOGO_ROOT_DIR, { recursive: true });
  const staleFiles = fs
    .readdirSync(LOGO_ROOT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^ol-mark--.*\.svg$/.test(entry.name))
    .map((entry) => path.join(LOGO_ROOT_DIR, entry.name));

  for (const staleFile of staleFiles) {
    fs.rmSync(staleFile);
  }
};

export const generateV1 = (): void => {
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
