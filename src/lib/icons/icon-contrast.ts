import type { BrandIconColorMode, BrandIconContrastMode } from "../content/load-content";

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface ResolveIconPaletteInput {
  themeId?: string;
  colorMode: BrandIconColorMode;
  contrastMode: BrandIconContrastMode;
  minContrastRatio: number;
  brandColor?: string;
  themeSurfacePillColor: string;
  themeAccentColor: string;
  themeTextColor: string;
  themeBorderColor: string;
}

export interface ResolvedIconPalette {
  glyphColor: string;
  chipBackgroundColor: string;
  chipBorderColor: string;
  resolvedContrastRatio: number;
  usedFallback: boolean;
}

const clampChannel = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));

const toHex = (value: number): string => clampChannel(value).toString(16).padStart(2, "0");

const rgbToHex = (color: RgbColor): string =>
  `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`.toUpperCase();

const parseHexColor = (value: string): RgbColor | undefined => {
  const normalized = value.trim();
  if (!normalized.startsWith("#")) {
    return undefined;
  }

  const raw = normalized.slice(1);
  if (raw.length === 3) {
    if (!/^[\da-fA-F]{3}$/.test(raw)) {
      return undefined;
    }

    return {
      r: Number.parseInt(raw[0] + raw[0], 16),
      g: Number.parseInt(raw[1] + raw[1], 16),
      b: Number.parseInt(raw[2] + raw[2], 16),
    };
  }

  if (raw.length !== 6) {
    return undefined;
  }

  if (!/^[\da-fA-F]{6}$/.test(raw)) {
    return undefined;
  }

  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  };
};

const parseRgbColor = (value: string): RgbColor | undefined => {
  const normalized = value.trim();
  if (!normalized.startsWith("rgb")) {
    return undefined;
  }

  const body = normalized.slice(normalized.indexOf("(") + 1, normalized.lastIndexOf(")"));
  if (!body) {
    return undefined;
  }

  const rgbSection = body.split("/")[0].trim();
  const parts = rgbSection.includes(",")
    ? rgbSection.split(",").map((part) => part.trim())
    : rgbSection.split(/\s+/).filter((part) => part.length > 0);

  if (parts.length < 3) {
    return undefined;
  }

  const channels = parts.slice(0, 3).map((part) => Number.parseFloat(part));
  if (channels.some((channel) => Number.isNaN(channel))) {
    return undefined;
  }

  return {
    r: channels[0],
    g: channels[1],
    b: channels[2],
  };
};

const parseCssColor = (value: string): RgbColor | undefined =>
  parseHexColor(value) ?? parseRgbColor(value);

const mix = (base: RgbColor, tint: RgbColor, tintWeight: number): RgbColor => {
  const weight = Math.max(0, Math.min(1, tintWeight));
  return {
    r: base.r * (1 - weight) + tint.r * weight,
    g: base.g * (1 - weight) + tint.g * weight,
    b: base.b * (1 - weight) + tint.b * weight,
  };
};

const blendToward = (color: RgbColor, target: RgbColor, amount: number): RgbColor =>
  mix(color, target, amount);

const luminanceChannel = (value: number): number => {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
};

const relativeLuminance = (color: RgbColor): number =>
  0.2126 * luminanceChannel(color.r) +
  0.7152 * luminanceChannel(color.g) +
  0.0722 * luminanceChannel(color.b);

export const contrastRatio = (left: RgbColor, right: RgbColor): number => {
  const l1 = relativeLuminance(left);
  const l2 = relativeLuminance(right);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

const isSleekTheme = (themeId?: string): boolean => (themeId ?? "").startsWith("sleek");

const resolveMixWeights = (
  themeId?: string,
): {
  themeChipTintWeight: number;
  brandChipTintWeight: number;
  brandBorderTintWeight: number;
} => {
  if (isSleekTheme(themeId)) {
    return {
      themeChipTintWeight: 0.14,
      brandChipTintWeight: 0.16,
      brandBorderTintWeight: 0.2,
    };
  }

  return {
    themeChipTintWeight: 0.26,
    brandChipTintWeight: 0.2,
    brandBorderTintWeight: 0.24,
  };
};

const resolveBestGlyphCandidate = (
  candidates: RgbColor[],
  background: RgbColor,
): { color: RgbColor; ratio: number } => {
  let best = candidates[0];
  let bestRatio = contrastRatio(best, background);

  for (let index = 1; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const ratio = contrastRatio(candidate, background);
    if (ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
  }

  return { color: best, ratio: bestRatio };
};

const improveBackgroundContrast = (
  glyph: RgbColor,
  background: RgbColor,
  minimumRatio: number,
): { background: RgbColor; ratio: number; changed: boolean } => {
  let bestBackground = background;
  let bestRatio = contrastRatio(glyph, background);
  let changed = false;

  if (bestRatio >= minimumRatio) {
    return { background, ratio: bestRatio, changed };
  }

  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };
  const glyphLuminance = relativeLuminance(glyph);
  const backgroundLuminance = relativeLuminance(background);
  const target = glyphLuminance > backgroundLuminance ? black : white;

  for (let step = 1; step <= 18; step += 1) {
    const amount = step * 0.04;
    const candidateBackground = blendToward(background, target, amount);
    const ratio = contrastRatio(glyph, candidateBackground);

    if (ratio > bestRatio) {
      bestBackground = candidateBackground;
      bestRatio = ratio;
      changed = true;
    }

    if (bestRatio >= minimumRatio) {
      break;
    }
  }

  return {
    background: bestBackground,
    ratio: bestRatio,
    changed,
  };
};

const normalizeMinimumRatio = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 3;
  }

  return Math.min(21, Math.max(1, value));
};

export const resolveIconPalette = (input: ResolveIconPaletteInput): ResolvedIconPalette => {
  const parsedSurface = parseCssColor(input.themeSurfacePillColor);
  const parsedAccent = parseCssColor(input.themeAccentColor);
  const parsedText = parseCssColor(input.themeTextColor);
  const parsedBorder = parseCssColor(input.themeBorderColor);
  const parsedBrand = input.brandColor ? parseCssColor(input.brandColor) : undefined;

  if (!parsedSurface || !parsedAccent || !parsedText || !parsedBorder) {
    const fallbackGlyph =
      input.colorMode === "theme" ? { r: 245, g: 247, b: 251 } : { r: 255, g: 255, b: 255 };
    const fallbackBackground = { r: 42, g: 51, b: 71 };
    const fallbackBorder = { r: 73, g: 90, b: 125 };

    return {
      glyphColor: rgbToHex(fallbackGlyph),
      chipBackgroundColor: rgbToHex(fallbackBackground),
      chipBorderColor: rgbToHex(fallbackBorder),
      resolvedContrastRatio: Number(contrastRatio(fallbackGlyph, fallbackBackground).toFixed(2)),
      usedFallback: true,
    };
  }

  const minimumRatio = normalizeMinimumRatio(input.minContrastRatio);
  const { themeChipTintWeight, brandChipTintWeight, brandBorderTintWeight } = resolveMixWeights(
    input.themeId,
  );

  const useBrandChip = input.colorMode === "brand" && parsedBrand;
  const chipBackground = useBrandChip
    ? mix(parsedSurface, parsedBrand, brandChipTintWeight)
    : mix(parsedSurface, parsedAccent, themeChipTintWeight);
  const chipBorderBase = useBrandChip
    ? mix(parsedBorder, parsedBrand, brandBorderTintWeight)
    : parsedBorder;

  const themeGlyph = parsedText;
  const initialGlyph =
    input.contrastMode === "always-theme"
      ? themeGlyph
      : input.contrastMode === "always-brand"
        ? (parsedBrand ?? themeGlyph)
        : input.colorMode === "brand"
          ? (parsedBrand ?? themeGlyph)
          : themeGlyph;

  let glyph = initialGlyph;
  let ratio = contrastRatio(glyph, chipBackground);
  let usedFallback = false;

  if (input.contrastMode === "auto" && ratio < minimumRatio) {
    const fallbackCandidates: RgbColor[] = [
      themeGlyph,
      { r: 255, g: 255, b: 255 },
      { r: 0, g: 0, b: 0 },
    ];

    const best = resolveBestGlyphCandidate(fallbackCandidates, chipBackground);
    if (best.ratio > ratio) {
      glyph = best.color;
      ratio = best.ratio;
      usedFallback = true;
    }
  }

  const backgroundImprovement = improveBackgroundContrast(glyph, chipBackground, minimumRatio);
  const finalBackground = backgroundImprovement.background;
  const finalRatio = backgroundImprovement.ratio;
  if (backgroundImprovement.changed) {
    usedFallback = true;
  }

  const finalBorder = mix(chipBorderBase, glyph, 0.15);

  return {
    glyphColor: rgbToHex(glyph),
    chipBackgroundColor: rgbToHex(finalBackground),
    chipBorderColor: rgbToHex(finalBorder),
    resolvedContrastRatio: Number(finalRatio.toFixed(2)),
    usedFallback,
  };
};
