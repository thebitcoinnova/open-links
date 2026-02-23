import type { SiteData } from "../content/load-content";

export interface ThemeDefinition {
  id: string;
  label: string;
  intensity: "mild" | "strong";
}

const ALL_THEMES: ThemeDefinition[] = [
  { id: "sleek", label: "Sleek Blue", intensity: "mild" },
  { id: "sleek-emerald", label: "Sleek Emerald", intensity: "mild" },
  { id: "sleek-mono", label: "Sleek Mono", intensity: "mild" },
  { id: "midnight", label: "Midnight", intensity: "mild" },
  { id: "daybreak", label: "Daybreak", intensity: "mild" },
  { id: "neutral", label: "Neutral", intensity: "mild" },
  { id: "editorial", label: "Editorial", intensity: "strong" },
  { id: "futuristic", label: "Futuristic", intensity: "strong" },
  { id: "humanist", label: "Humanist", intensity: "strong" }
];

const REGISTRY = new Map(ALL_THEMES.map((theme) => [theme.id, theme]));

const normalizeAvailableThemes = (site: SiteData): string[] => {
  const available = site.theme?.available ?? [];
  const valid = available.filter((themeId) => REGISTRY.has(themeId));

  if (valid.length > 0) {
    return [...new Set(valid)];
  }

  return ["sleek", "daybreak"];
};

export interface ThemeSelection {
  active: string;
  available: string[];
  activeDefinition: ThemeDefinition;
}

export const resolveThemeSelection = (site: SiteData): ThemeSelection => {
  const available = normalizeAvailableThemes(site);
  const requestedActive = site.theme?.active;
  const active = requestedActive && available.includes(requestedActive) ? requestedActive : available[0];
  const activeDefinition = REGISTRY.get(active) ?? REGISTRY.get("sleek")!;

  return {
    active,
    available,
    activeDefinition
  };
};

export const getThemeDefinition = (themeId: string): ThemeDefinition | undefined => REGISTRY.get(themeId);
