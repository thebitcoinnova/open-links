import fs from "node:fs";
import path from "node:path";
import { resolveBrandIconOptions } from "../../src/lib/icons/brand-icon-options";
import { resolveIconPalette } from "../../src/lib/icons/icon-contrast";
import { KNOWN_SITES } from "../../src/lib/icons/known-sites-data";
import type { QualityDomainResult, QualityIssue, QualitySiteInput } from "./types";

interface RunA11yChecksInput {
  rootDir: string;
  strict: boolean;
  focusContrastStrict: boolean;
  site: QualitySiteInput;
}

const readText = (rootDir: string, relativePath: string): string =>
  fs.readFileSync(path.join(rootDir, relativePath), "utf8");

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const extractCssBlock = (css: string, selector: string): string | undefined => {
  const regex = new RegExp(`${escapeRegex(selector)}\\s*\\{([\\s\\S]*?)\\}`, "m");
  const match = css.match(regex);
  return match?.[1];
};

const parseCssVariables = (cssBlock?: string): Record<string, string> => {
  if (!cssBlock) {
    return {};
  }

  const parsed: Record<string, string> = {};
  const declarationPattern = /--([\w-]+)\s*:\s*([^;]+);/g;

  let match = declarationPattern.exec(cssBlock);
  while (match) {
    parsed[`--${match[1]}`] = match[2].trim();
    match = declarationPattern.exec(cssBlock);
  }

  return parsed;
};

const resolveThemeModeVars = (
  rootDir: string,
  themeId: string,
  mode: "dark" | "light"
): {
  surfacePill: string;
  accent: string;
  textPrimary: string;
  borderSubtle: string;
} => {
  const tokenCss = readText(rootDir, "src/styles/tokens.css");
  const tokenVars = parseCssVariables(extractCssBlock(tokenCss, ":root"));

  const themePath = path.join(rootDir, "src/styles/themes", `${themeId}.css`);
  let themeVars: Record<string, string> = {};

  if (fs.existsSync(themePath)) {
    const themeCss = fs.readFileSync(themePath, "utf8");
    const themeBlock = extractCssBlock(
      themeCss,
      `:root[data-theme=\"${themeId}\"][data-mode=\"${mode}\"]`
    );
    themeVars = parseCssVariables(themeBlock);
  }

  const resolved = {
    ...tokenVars,
    ...themeVars
  };

  return {
    surfacePill: resolved["--surface-pill"] ?? "#1A2232",
    accent: resolved["--accent"] ?? "#50E3C2",
    textPrimary: resolved["--text-primary"] ?? "#F5F7FB",
    borderSubtle: resolved["--border-subtle"] ?? "#64748B"
  };
};

const iconContrastIssues = (
  rootDir: string,
  strict: boolean,
  site: QualitySiteInput
): QualityIssue[] => {
  const issues: QualityIssue[] = [];
  const activeTheme = site.theme?.active ?? "sleek";
  const options = resolveBrandIconOptions(site);

  for (const mode of ["dark", "light"] as const) {
    const vars = resolveThemeModeVars(rootDir, activeTheme, mode);

    for (const knownSite of KNOWN_SITES) {
      const palette = resolveIconPalette({
        themeId: activeTheme,
        colorMode: options.colorMode,
        contrastMode: options.contrastMode,
        minContrastRatio: options.minContrastRatio,
        brandColor: knownSite.brandColor,
        themeSurfacePillColor: vars.surfacePill,
        themeAccentColor: vars.accent,
        themeTextColor: vars.textPrimary,
        themeBorderColor: vars.borderSubtle
      });

      if (palette.resolvedContrastRatio >= options.minContrastRatio) {
        continue;
      }

      issues.push({
        domain: "accessibility",
        level: strict ? "error" : "warning",
        code: "A11Y_ICON_CONTRAST_LOW",
        scope: `${activeTheme}/${mode}/${knownSite.id}`,
        metric: "icon-contrast-ratio",
        actual: palette.resolvedContrastRatio,
        expected: `>= ${options.minContrastRatio}`,
        message:
          `Resolved icon contrast for '${knownSite.id}' is below configured minimum in ${mode} mode.`,
        remediation:
          "Adjust ui.brandIcons policy (contrastMode/minContrastRatio/colorMode) or icon palette tuning to satisfy configured minimum contrast."
      });
    }
  }

  return issues;
};

export const runA11yChecks = ({
  rootDir,
  strict,
  focusContrastStrict,
  site
}: RunA11yChecksInput): QualityDomainResult => {
  const issues: QualityIssue[] = [];

  const routeIndex = readText(rootDir, "src/routes/index.tsx");
  const simpleCard = readText(rootDir, "src/components/cards/SimpleLinkCard.tsx");
  const richCard = readText(rootDir, "src/components/cards/RichLinkCard.tsx");
  const utilityBar = readText(rootDir, "src/components/layout/TopUtilityBar.tsx");
  const utilityMenu = readText(rootDir, "src/components/layout/UtilityControlsMenu.tsx");
  const themeToggle = readText(rootDir, "src/components/theme/ThemeToggle.tsx");
  const styles = readText(rootDir, "src/styles/base.css");
  const tokens = readText(rootDir, "src/styles/tokens.css");

  if (!routeIndex.includes("<main")) {
    issues.push({
      domain: "accessibility",
      level: "error",
      code: "A11Y_MAIN_LANDMARK_MISSING",
      scope: "src/routes/index.tsx",
      message: "Main landmark is missing from root page layout.",
      remediation: "Render the primary content container as a <main> landmark."
    });
  }

  if (!simpleCard.includes("aria-label")) {
    issues.push({
      domain: "accessibility",
      level: "error",
      code: "A11Y_SIMPLE_CARD_LABEL_MISSING",
      scope: "src/components/cards/SimpleLinkCard.tsx",
      message: "Simple link card anchor is missing explicit accessible labeling.",
      remediation: "Add aria-label/labelled-by semantics describing destination and action."
    });
  }

  if (!simpleCard.includes("aria-describedby")) {
    issues.push({
      domain: "accessibility",
      level: "warning",
      code: "A11Y_SIMPLE_CARD_DESCRIPTION_MISSING",
      scope: "src/components/cards/SimpleLinkCard.tsx",
      message: "Simple link cards are missing aria-describedby semantics.",
      remediation: "Add aria-describedby for destination/context detail text on simple cards."
    });
  }

  if (!richCard.includes("aria-label")) {
    issues.push({
      domain: "accessibility",
      level: "error",
      code: "A11Y_RICH_CARD_LABEL_MISSING",
      scope: "src/components/cards/RichLinkCard.tsx",
      message: "Rich link card anchor is missing explicit accessible labeling.",
      remediation: "Add aria-label/labelled-by semantics describing rich card destination."
    });
  }

  if (!richCard.includes("aria-describedby")) {
    issues.push({
      domain: "accessibility",
      level: "warning",
      code: "A11Y_RICH_CARD_DESCRIPTION_MISSING",
      scope: "src/components/cards/RichLinkCard.tsx",
      message: "Rich link cards are missing aria-describedby semantics.",
      remediation: "Add aria-describedby pointing to rich-card description/source content."
    });
  }

  if (!utilityBar.includes('role="group"') || !utilityBar.includes("aria-label")) {
    issues.push({
      domain: "accessibility",
      level: "error",
      code: "A11Y_UTILITY_GROUP_SEMANTICS_MISSING",
      scope: "src/components/layout/TopUtilityBar.tsx",
      message: "Top utility controls lack role/group labeling semantics.",
      remediation: "Expose utility controls inside a labeled group so screen readers announce control context."
    });
  }

  if (!utilityMenu.includes("aria-expanded") || !utilityMenu.includes("aria-controls")) {
    issues.push({
      domain: "accessibility",
      level: "error",
      code: "A11Y_UTILITY_MENU_DISCLOSURE_MISSING",
      scope: "src/components/layout/UtilityControlsMenu.tsx",
      message: "Utility controls menu is missing disclosure linkage semantics.",
      remediation: "Expose utility controls with aria-expanded state and aria-controls panel linkage."
    });
  }

  if (
    !utilityMenu.includes("onFocusOut") ||
    !utilityMenu.includes("pointerdown") ||
    !utilityMenu.includes("Escape")
  ) {
    issues.push({
      domain: "accessibility",
      level: "warning",
      code: "A11Y_UTILITY_MENU_CLOSE_BEHAVIOR_WEAK",
      scope: "src/components/layout/UtilityControlsMenu.tsx",
      message: "Utility controls menu is missing one or more expected close interactions.",
      remediation: "Support close-on-Escape, outside pointer interactions, and focus leaving the menu surface."
    });
  }

  if (!themeToggle.includes("aria-label") || !themeToggle.includes("aria-pressed")) {
    issues.push({
      domain: "accessibility",
      level: "error",
      code: "A11Y_TOGGLE_SEMANTICS_MISSING",
      scope: "src/components/theme/ThemeToggle.tsx",
      message: "Theme toggle requires aria-label and aria-pressed semantics.",
      remediation: "Keep theme toggle state and action messaging explicit for assistive technologies."
    });
  }

  const focusSelectors = [
    ".simple-link-card:focus-visible",
    ".rich-link-card:focus-visible",
    ".theme-toggle:focus-visible",
    ".utility-menu-button:focus-visible"
  ];

  focusSelectors.forEach((selector) => {
    if (!styles.includes(selector)) {
      issues.push({
        domain: "accessibility",
        level: strict && focusContrastStrict ? "error" : "warning",
        code: "A11Y_FOCUS_STYLE_MISSING",
        scope: selector,
        message: `Missing focus-visible styling for selector '${selector}'.`,
        remediation: "Add clear focus-visible styling (border/outline/shadow) so keyboard users can track focus."
      });
    }
  });

  if (!styles.includes(":focus-visible")) {
    issues.push({
      domain: "accessibility",
      level: strict && focusContrastStrict ? "error" : "warning",
      code: "A11Y_GLOBAL_FOCUS_MISSING",
      scope: "src/styles/base.css",
      message: "Global :focus-visible style is missing.",
      remediation: "Define a global :focus-visible baseline to improve keyboard focus discoverability."
    });
  }

  if (!tokens.includes("--shadow-focus")) {
    issues.push({
      domain: "accessibility",
      level: strict && focusContrastStrict ? "error" : "warning",
      code: "A11Y_FOCUS_TOKEN_MISSING",
      scope: "src/styles/tokens.css",
      message: "Focus-shadow token is missing from token palette.",
      remediation: "Define --shadow-focus token so focus states remain consistent across themes."
    });
  }

  issues.push(...iconContrastIssues(rootDir, strict, site));

  const hasError = issues.some((issue) => issue.level === "error");
  const hasWarning = issues.some((issue) => issue.level === "warning");

  return {
    domain: "accessibility",
    status: hasError ? "fail" : hasWarning ? "warn" : "pass",
    summary: hasError
      ? "Accessibility checks found blocking issues."
      : hasWarning
        ? "Accessibility checks passed with warnings."
        : "Accessibility checks passed.",
    issues
  };
};
