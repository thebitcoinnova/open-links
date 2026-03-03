import type { BrandIconSizeMode, DensityMode, ModePolicy, SiteData } from "../content/load-content";

export type UiMode = "dark" | "light";

const STORAGE_KEY = "open-links-mode";

const normalizeModePolicy = (value: unknown): ModePolicy => {
  if (value === "static-dark" || value === "static-light") {
    return value;
  }
  return "dark-toggle";
};

const normalizeStoredMode = (value: unknown): UiMode | null => {
  if (value === "dark" || value === "light") {
    return value;
  }
  return null;
};

const readStoredMode = (): UiMode | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return normalizeStoredMode(window.localStorage.getItem(STORAGE_KEY));
};

export const resolveModePolicy = (site: SiteData): ModePolicy =>
  normalizeModePolicy(site.ui?.modePolicy);

export const resolveInitialMode = (policy: ModePolicy): UiMode => {
  if (policy === "static-dark") return "dark";
  if (policy === "static-light") return "light";
  return readStoredMode() ?? "dark";
};

export const canToggleMode = (policy: ModePolicy): boolean => policy === "dark-toggle";

export const persistModePreference = (policy: ModePolicy, mode: UiMode): void => {
  if (!canToggleMode(policy) || typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, mode);
};

const normalizeDensity = (value: unknown): DensityMode => {
  if (value === "compact" || value === "spacious") {
    return value;
  }
  return "medium";
};

interface ApplyThemeOptions {
  themeId: string;
  mode: UiMode;
  policy: ModePolicy;
  density?: DensityMode;
  brandIconSizeMode?: BrandIconSizeMode;
}

export interface ApplyTypographyOptions {
  managedVars: string[];
  cssVars: Record<string, string>;
}

export const applyThemeState = ({
  themeId,
  mode,
  policy,
  density,
  brandIconSizeMode,
}: ApplyThemeOptions): void => {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.dataset.theme = themeId;
  root.dataset.mode = mode;
  root.dataset.modePolicy = policy;
  root.dataset.density = normalizeDensity(density);
  root.dataset.brandIconSize = brandIconSizeMode === "normal" ? "normal" : "large";
  root.style.colorScheme = mode;
};

export const applyTypographyState = ({ managedVars, cssVars }: ApplyTypographyOptions): void => {
  if (typeof document === "undefined") {
    return;
  }

  const rootStyle = document.documentElement.style;

  for (const variable of managedVars) {
    rootStyle.removeProperty(variable);
  }

  for (const [variable, value] of Object.entries(cssVars)) {
    rootStyle.setProperty(variable, value);
  }
};
