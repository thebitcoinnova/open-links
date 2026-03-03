import fs from "node:fs";
import path from "node:path";
import type { ManualSmokeCheckResult, QualityDomainResult, QualityIssue } from "./types";

interface RunManualSmokeInput {
  rootDir: string;
  checklistLabels: string[];
}

const readText = (rootDir: string, relativePath: string): string =>
  fs.readFileSync(path.join(rootDir, relativePath), "utf8");

export const runManualSmokeChecks = ({
  rootDir,
  checklistLabels,
}: RunManualSmokeInput): {
  domainResult: QualityDomainResult;
  checks: ManualSmokeCheckResult[];
} => {
  const routeIndex = readText(rootDir, "src/routes/index.tsx");
  const simpleCard = readText(rootDir, "src/components/cards/SimpleLinkCard.tsx");
  const richCard = readText(rootDir, "src/components/cards/RichLinkCard.tsx");
  const themeToggle = readText(rootDir, "src/components/theme/ThemeToggle.tsx");
  const utilityMenu = readText(rootDir, "src/components/layout/UtilityControlsMenu.tsx");

  const checks: ManualSmokeCheckResult[] = [
    {
      id: "keyboard-main",
      label:
        checklistLabels[0] ??
        "Keyboard navigation reaches utility controls, profile, and first links in a predictable order.",
      status: routeIndex.includes("<main") ? "pass" : "warn",
      details: routeIndex.includes("<main")
        ? "Main landmark detected."
        : "Main landmark not found in route layout.",
      remediation: "Render primary page content inside a <main> element.",
    },
    {
      id: "toggle-label",
      label: checklistLabels[1] ?? "Theme toggle announces state/action for screen readers.",
      status: themeToggle.includes("aria-label") ? "pass" : "warn",
      details: themeToggle.includes("aria-label")
        ? "Theme toggle contains aria-label semantics."
        : "Theme toggle lacks explicit aria-label semantics.",
      remediation: "Set an aria-label that reflects dark/light toggle action.",
    },
    {
      id: "simple-card-action",
      label:
        checklistLabels[2] ??
        "Simple cards expose meaningful action labels and are keyboard activatable.",
      status: simpleCard.includes("<a") && simpleCard.includes("aria-label") ? "pass" : "fail",
      details:
        simpleCard.includes("<a") && simpleCard.includes("aria-label")
          ? "Simple card anchor and aria-label detected."
          : "Simple card anchor/label semantics are incomplete.",
      remediation:
        "Ensure simple cards are anchors with explicit action-oriented accessible naming.",
    },
    {
      id: "rich-card-action",
      label:
        checklistLabels[3] ??
        "Rich cards expose meaningful action labels and are keyboard activatable.",
      status: richCard.includes("<a") && richCard.includes("aria-label") ? "pass" : "fail",
      details:
        richCard.includes("<a") && richCard.includes("aria-label")
          ? "Rich card anchor and aria-label detected."
          : "Rich card anchor/label semantics are incomplete.",
      remediation: "Ensure rich cards are anchors with explicit destination labeling.",
    },
    {
      id: "utility-controls-menu",
      label:
        checklistLabels[4] ??
        "Utility controls collapse into a disclosure menu that remains keyboard reachable.",
      status:
        routeIndex.includes("<UtilityControlsMenu") &&
        utilityMenu.includes("aria-expanded") &&
        utilityMenu.includes("aria-controls")
          ? "pass"
          : "warn",
      details:
        routeIndex.includes("<UtilityControlsMenu") &&
        utilityMenu.includes("aria-expanded") &&
        utilityMenu.includes("aria-controls")
          ? "Utility controls menu integration and disclosure semantics detected."
          : "Utility controls menu integration/disclosure semantics appear incomplete.",
      remediation:
        "Render utility controls inside UtilityControlsMenu with aria-expanded and aria-controls linkage.",
    },
  ];

  const issues: QualityIssue[] = checks
    .filter((check) => check.status !== "pass")
    .map((check) => ({
      domain: "manual-smoke",
      level: check.status === "fail" ? "error" : "warning",
      code: "MANUAL_SMOKE_INCOMPLETE",
      scope: check.id,
      message: check.details,
      remediation: check.remediation ?? "Review accessibility smoke checklist.",
    }));

  const status = issues.length > 0 ? "warn" : "pass";

  return {
    domainResult: {
      domain: "manual-smoke",
      status,
      summary:
        status === "pass"
          ? "Manual smoke checklist signals are satisfied."
          : "Manual smoke checklist has follow-up items.",
      issues,
    },
    checks,
  };
};
