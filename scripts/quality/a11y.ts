import fs from "node:fs";
import path from "node:path";
import type { QualityDomainResult, QualityIssue } from "./types";

interface RunA11yChecksInput {
  rootDir: string;
  strict: boolean;
  focusContrastStrict: boolean;
}

const readText = (rootDir: string, relativePath: string): string =>
  fs.readFileSync(path.join(rootDir, relativePath), "utf8");

export const runA11yChecks = ({
  rootDir,
  strict,
  focusContrastStrict
}: RunA11yChecksInput): QualityDomainResult => {
  const issues: QualityIssue[] = [];

  const routeIndex = readText(rootDir, "src/routes/index.tsx");
  const simpleCard = readText(rootDir, "src/components/cards/SimpleLinkCard.tsx");
  const richCard = readText(rootDir, "src/components/cards/RichLinkCard.tsx");
  const utilityBar = readText(rootDir, "src/components/layout/TopUtilityBar.tsx");
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
    ".theme-toggle:focus-visible"
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
