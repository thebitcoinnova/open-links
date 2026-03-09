import type {
  DensityMode,
  DesktopColumnsMode,
  SiteData,
  TargetSizeMode,
  TypographyScaleMode,
} from "../content/load-content";

export interface LayoutPreferences {
  density: DensityMode;
  desktopColumns: DesktopColumnsMode;
  typographyScale: TypographyScaleMode;
  targetSize: TargetSizeMode;
  profileAvatarScale: number;
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

const profileAvatarScale = (site: SiteData): number => {
  const value = site.ui?.profileAvatarScale;
  if (typeof value === "number" && value > 0 && value <= 4) {
    return value;
  }
  return 1.7;
};

export const resolveLayoutPreferences = (site: SiteData): LayoutPreferences => ({
  density: density(site),
  desktopColumns: desktopColumns(site),
  typographyScale: typographyScale(site),
  targetSize: targetSize(site),
  profileAvatarScale: profileAvatarScale(site),
});
