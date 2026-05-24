import type {
  CardStyleMode,
  DensityMode,
  DesktopColumnsMode,
  ProfileHeaderAlignment,
  SiteData,
  TargetSizeMode,
  TypographyScaleMode,
} from "../content/load-content";

export interface ResolvedProfileHeaderAlignment {
  default: ProfileHeaderAlignment;
  small: ProfileHeaderAlignment;
}

export interface LayoutPreferences {
  density: DensityMode;
  desktopColumns: DesktopColumnsMode;
  typographyScale: TypographyScaleMode;
  targetSize: TargetSizeMode;
  cardStyle: CardStyleMode;
  profileAvatarScale: number;
  profileHeaderAlignment: ResolvedProfileHeaderAlignment;
}

const density = (site: SiteData): DensityMode => {
  const value = site.ui?.density;
  if (value === "compact" || value === "spacious") {
    return value;
  }
  return "medium";
};

const desktopColumns = (site: SiteData): DesktopColumnsMode => {
  const value = site.ui?.desktopColumns;
  return value === "two" ? "two" : "one";
};

const typographyScale = (site: SiteData): TypographyScaleMode => {
  const value = site.ui?.typographyScale;
  if (value === "compact" || value === "expressive") {
    return value;
  }
  return "fixed";
};

const targetSize = (site: SiteData): TargetSizeMode => {
  const value = site.ui?.targetSize;
  if (value === "compact" || value === "large") {
    return value;
  }
  return "comfortable";
};

const cardStyle = (site: SiteData): CardStyleMode => {
  const value = site.ui?.cardStyle;
  return value === "glassy" ? "glassy" : "standard";
};

const profileAvatarScale = (site: SiteData): number => {
  const value = site.ui?.profileAvatarScale;
  if (typeof value === "number" && value > 0 && value <= 4) {
    return value;
  }
  return 1.7;
};

const isProfileHeaderAlignment = (value: unknown): value is ProfileHeaderAlignment =>
  value === "leading" || value === "center";

const profileHeaderAlignment = (site: SiteData): ResolvedProfileHeaderAlignment => {
  const value = site.ui?.profileHeaderAlignment;

  if (isProfileHeaderAlignment(value)) {
    return {
      default: value,
      small: value,
    };
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const configuredAlignment = value as { default?: unknown; small?: unknown };
    const defaultAlignment = isProfileHeaderAlignment(configuredAlignment.default)
      ? configuredAlignment.default
      : "leading";
    const smallAlignment = isProfileHeaderAlignment(configuredAlignment.small)
      ? configuredAlignment.small
      : defaultAlignment;

    return {
      default: defaultAlignment,
      small: smallAlignment,
    };
  }

  return {
    default: "leading",
    small: "center",
  };
};

export const resolveLayoutPreferences = (site: SiteData): LayoutPreferences => ({
  density: density(site),
  desktopColumns: desktopColumns(site),
  typographyScale: typographyScale(site),
  targetSize: targetSize(site),
  cardStyle: cardStyle(site),
  profileAvatarScale: profileAvatarScale(site),
  profileHeaderAlignment: profileHeaderAlignment(site),
});
