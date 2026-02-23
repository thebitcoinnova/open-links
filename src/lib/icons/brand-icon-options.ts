import type {
  BrandIconColorMode,
  BrandIconContrastMode,
  BrandIconSizeMode
} from "../content/load-content";

export interface ResolvedBrandIconOptions {
  colorMode: BrandIconColorMode;
  contrastMode: BrandIconContrastMode;
  minContrastRatio: number;
  sizeMode: BrandIconSizeMode;
}

interface BrandIconOptionsSiteLike {
  ui?: {
    brandIcons?: {
      colorMode?: unknown;
      contrastMode?: unknown;
      minContrastRatio?: unknown;
      sizeMode?: unknown;
    };
  };
}

const normalizeColorMode = (value: unknown): BrandIconColorMode => (value === "theme" ? "theme" : "brand");

const normalizeContrastMode = (value: unknown): BrandIconContrastMode => {
  if (value === "always-theme" || value === "always-brand") {
    return value;
  }
  return "auto";
};

const normalizeSizeMode = (value: unknown): BrandIconSizeMode => (value === "normal" ? "normal" : "large");

const normalizeMinContrastRatio = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 3;
  }

  const clamped = Math.min(21, Math.max(1, value));
  return Number(clamped.toFixed(2));
};

export const resolveBrandIconOptions = (site: BrandIconOptionsSiteLike): ResolvedBrandIconOptions => {
  const config = site.ui?.brandIcons;

  return {
    colorMode: normalizeColorMode(config?.colorMode),
    contrastMode: normalizeContrastMode(config?.contrastMode),
    minContrastRatio: normalizeMinContrastRatio(config?.minContrastRatio),
    sizeMode: normalizeSizeMode(config?.sizeMode)
  };
};
