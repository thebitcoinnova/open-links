import type {
  SiteData,
  TypographyOverrides,
  TypographyScaleMode,
  TypographyTransformMode,
} from "../content/load-content";

const TYPOGRAPHY_TO_CSS_VAR = {
  fontDisplay: "--font-display",
  fontBody: "--font-body",
  sizeTitle: "--type-title",
  sizeHeadline: "--type-headline",
  sizeBody: "--type-body",
  sizeCaption: "--type-caption",
  sizeCardTitle: "--type-card-title",
  sizeLinkTitle: "--type-link-title",
  sizeIcon: "--type-icon",
  lineHeightTitle: "--line-height-title",
  lineHeightBody: "--line-height-body",
  lineHeightCardTitle: "--line-height-card-title",
  lineHeightCardDescription: "--line-height-card-description",
  weightCardTitle: "--weight-card-title",
  weightLinkTitle: "--weight-link-title",
  weightIcon: "--weight-icon",
  trackingUtilityTitle: "--tracking-utility-title",
  trackingSectionHeading: "--tracking-section-heading",
  trackingCardSource: "--tracking-card-source",
  trackingIcon: "--tracking-icon",
  transformUtilityTitle: "--transform-utility-title",
  transformSectionHeading: "--transform-section-heading",
  transformContactLabel: "--transform-contact-label",
} as const;

type TypographyOverrideKey = keyof typeof TYPOGRAPHY_TO_CSS_VAR;

const MANAGED_VARS = Object.values(TYPOGRAPHY_TO_CSS_VAR);

const TRANSFORM_KEYS = new Set<TypographyOverrideKey>([
  "transformUtilityTitle",
  "transformSectionHeading",
  "transformContactLabel",
]);

const VALID_TRANSFORMS = new Set<TypographyTransformMode>([
  "none",
  "uppercase",
  "lowercase",
  "capitalize",
]);

const SCALE_PRESETS: Record<TypographyScaleMode, Partial<TypographyOverrides>> = {
  fixed: {},
  compact: {
    sizeTitle: "clamp(1.66rem, 3.55vw, 2.25rem)",
    sizeHeadline: "clamp(1rem, 2.08vw, 1.14rem)",
    sizeBody: "0.98rem",
    sizeCaption: "0.86rem",
    sizeCardTitle: "1.01rem",
    sizeLinkTitle: "0.98rem",
  },
  expressive: {
    sizeTitle: "clamp(2.08rem, 4.8vw, 2.95rem)",
    sizeHeadline: "clamp(1.22rem, 2.65vw, 1.42rem)",
    sizeBody: "1.11rem",
    sizeCaption: "0.99rem",
    sizeCardTitle: "1.18rem",
    sizeLinkTitle: "1.14rem",
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeCssValue = (value: unknown): string | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeTransformValue = (value: unknown): TypographyTransformMode | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!VALID_TRANSFORMS.has(trimmed as TypographyTransformMode)) {
    return undefined;
  }

  return trimmed as TypographyTransformMode;
};

const normalizeTypographyOverrides = (
  overrides: unknown,
): Partial<Record<TypographyOverrideKey, string>> => {
  if (!isRecord(overrides)) {
    return {};
  }

  const normalized: Partial<Record<TypographyOverrideKey, string>> = {};

  for (const key of Object.keys(TYPOGRAPHY_TO_CSS_VAR) as TypographyOverrideKey[]) {
    const rawValue = overrides[key];
    const value = TRANSFORM_KEYS.has(key)
      ? normalizeTransformValue(rawValue)
      : normalizeCssValue(rawValue);

    if (value) {
      normalized[key] = value;
    }
  }

  return normalized;
};

export interface ResolvedTypographyPreferences {
  managedVars: string[];
  cssVars: Record<string, string>;
}

interface ResolveTypographyPreferencesInput {
  site: SiteData;
  activeTheme: string;
  typographyScale: TypographyScaleMode;
}

export const resolveTypographyPreferences = ({
  site,
  activeTheme,
  typographyScale,
}: ResolveTypographyPreferencesInput): ResolvedTypographyPreferences => {
  const presetOverrides = normalizeTypographyOverrides(SCALE_PRESETS[typographyScale]);
  const globalOverrides = normalizeTypographyOverrides(site.ui?.typography?.global);
  const themeOverrides = normalizeTypographyOverrides(site.ui?.typography?.themes?.[activeTheme]);
  const merged = {
    ...presetOverrides,
    ...globalOverrides,
    ...themeOverrides,
  };

  const cssVars: Record<string, string> = {};

  for (const [key, cssVar] of Object.entries(TYPOGRAPHY_TO_CSS_VAR) as Array<
    [TypographyOverrideKey, string]
  >) {
    const value = merged[key];
    if (value) {
      cssVars[cssVar] = value;
    }
  }

  return {
    managedVars: [...MANAGED_VARS],
    cssVars,
  };
};
