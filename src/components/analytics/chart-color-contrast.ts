interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

interface ResolveChartLineColorInput {
  accent: string;
  accentStrong: string;
  background: string;
  textPrimary: string;
}

const HEX_SHORT_LENGTH = 4;
const HEX_LONG_LENGTH = 7;
const DARK_SURFACE_LUMINANCE_THRESHOLD = 0.18;
const MIN_GRAPHIC_CONTRAST_RATIO = 3;
const MIN_DARK_SURFACE_GRAPHIC_CONTRAST_RATIO = 4.5;
const TEXT_BLEND_STEPS = [0.2, 0.35, 0.5, 0.65, 0.8, 1] as const;

const parseHexColor = (value: string): RgbColor | null => {
  const normalized = value.trim().toLowerCase();

  if (!normalized.startsWith("#")) {
    return null;
  }

  if (normalized.length === HEX_SHORT_LENGTH) {
    const [red, green, blue] = normalized.slice(1).split("");
    return {
      red: Number.parseInt(`${red}${red}`, 16),
      green: Number.parseInt(`${green}${green}`, 16),
      blue: Number.parseInt(`${blue}${blue}`, 16),
    };
  }

  if (normalized.length !== HEX_LONG_LENGTH || !/^[0-9a-f]{6}$/.test(normalized.slice(1))) {
    return null;
  }

  return {
    red: Number.parseInt(normalized.slice(1, 3), 16),
    green: Number.parseInt(normalized.slice(3, 5), 16),
    blue: Number.parseInt(normalized.slice(5, 7), 16),
  };
};

const formatHexColor = ({ red, green, blue }: RgbColor): string =>
  `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;

const toLinearChannel = (channel: number): number => {
  const normalized = channel / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
};

const relativeLuminance = (color: RgbColor): number =>
  0.2126 * toLinearChannel(color.red) +
  0.7152 * toLinearChannel(color.green) +
  0.0722 * toLinearChannel(color.blue);

const isDarkSurfaceColor = (color: RgbColor): boolean =>
  relativeLuminance(color) < DARK_SURFACE_LUMINANCE_THRESHOLD;

const contrastRatio = (foreground: RgbColor, background: RgbColor): number => {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};

const mixColorChannel = (base: number, toward: number, amount: number): number =>
  Math.round(base + (toward - base) * amount);

const blendToward = (base: RgbColor, toward: RgbColor, amount: number): RgbColor => ({
  red: mixColorChannel(base.red, toward.red, amount),
  green: mixColorChannel(base.green, toward.green, amount),
  blue: mixColorChannel(base.blue, toward.blue, amount),
});

export const calculateContrastRatio = (foreground: string, background: string): number => {
  const parsedForeground = parseHexColor(foreground);
  const parsedBackground = parseHexColor(background);

  if (!parsedForeground || !parsedBackground) {
    return 0;
  }

  return contrastRatio(parsedForeground, parsedBackground);
};

export const isDarkChartSurface = (background: string): boolean => {
  const parsedBackground = parseHexColor(background);

  if (!parsedBackground) {
    return false;
  }

  return isDarkSurfaceColor(parsedBackground);
};

export const resolveChartLineColor = ({
  accent,
  accentStrong,
  background,
  textPrimary,
}: ResolveChartLineColorInput): string => {
  const parsedBackground = parseHexColor(background);
  const parsedAccent = parseHexColor(accent);
  const parsedAccentStrong = parseHexColor(accentStrong);
  const parsedTextPrimary = parseHexColor(textPrimary);

  if (!parsedBackground) {
    return accentStrong;
  }

  const minimumContrastRatio = isDarkSurfaceColor(parsedBackground)
    ? MIN_DARK_SURFACE_GRAPHIC_CONTRAST_RATIO
    : MIN_GRAPHIC_CONTRAST_RATIO;

  const candidates = [parsedAccentStrong, parsedAccent].filter(
    (color): color is RgbColor => color !== null,
  );
  const bestAccent = candidates.reduce<RgbColor | null>((best, candidate) => {
    if (!best) {
      return candidate;
    }

    return contrastRatio(candidate, parsedBackground) >= contrastRatio(best, parsedBackground)
      ? candidate
      : best;
  }, null);

  if (!bestAccent) {
    return accentStrong;
  }

  if (!parsedTextPrimary) {
    return formatHexColor(bestAccent);
  }

  if (contrastRatio(bestAccent, parsedBackground) >= minimumContrastRatio) {
    return formatHexColor(bestAccent);
  }

  for (const blendStep of TEXT_BLEND_STEPS) {
    const blended = blendToward(bestAccent, parsedTextPrimary, blendStep);

    if (contrastRatio(blended, parsedBackground) >= minimumContrastRatio) {
      return formatHexColor(blended);
    }
  }

  return formatHexColor(parsedTextPrimary);
};
