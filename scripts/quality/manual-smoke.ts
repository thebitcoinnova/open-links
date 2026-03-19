import fs from "node:fs";
import path from "node:path";
import type { ManualSmokeCheckResult, QualityDomainResult, QualityIssue } from "./types";
import { analyzeUtilityMenuImplementation } from "./utility-menu";

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
  const nonPaymentCardShell = readText(rootDir, "src/components/cards/NonPaymentLinkCardShell.tsx");
  const themeToggle = readText(rootDir, "src/components/theme/ThemeToggle.tsx");
  const utilityMenu = readText(rootDir, "src/components/layout/UtilityControlsMenu.tsx");
  const utilityMenuAnalysis = analyzeUtilityMenuImplementation(utilityMenu);
  const sharedNonPaymentCardHasActionLabel =
    nonPaymentCardShell.includes("<a") &&
    nonPaymentCardShell.includes("aria-label") &&
    !nonPaymentCardShell.includes("aria-labelledby");
  const simpleCardUsesSharedShell = simpleCard.includes("NonPaymentLinkCardShell");
  const richCardUsesSharedShell = richCard.includes("NonPaymentLinkCardShell");

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
      status: simpleCardUsesSharedShell && sharedNonPaymentCardHasActionLabel ? "pass" : "fail",
      details:
        simpleCardUsesSharedShell && sharedNonPaymentCardHasActionLabel
          ? "Simple card delegates to the shared shell with an action-oriented aria-label."
          : "Simple card shared anchor semantics are incomplete.",
      remediation:
        "Ensure simple cards delegate to the shared non-payment shell and keep action-oriented aria-label semantics there.",
    },
    {
      id: "rich-card-action",
      label:
        checklistLabels[3] ??
        "Rich cards expose meaningful action labels and are keyboard activatable.",
      status: richCardUsesSharedShell && sharedNonPaymentCardHasActionLabel ? "pass" : "fail",
      details:
        richCardUsesSharedShell && sharedNonPaymentCardHasActionLabel
          ? "Rich card delegates to the shared shell with an action-oriented aria-label."
          : "Rich card shared anchor semantics are incomplete.",
      remediation:
        "Ensure rich cards delegate to the shared non-payment shell and keep action-oriented destination labeling there.",
    },
    {
      id: "utility-controls-menu",
      label:
        checklistLabels[4] ??
        "Utility controls collapse into a disclosure menu that remains keyboard reachable.",
      status:
        routeIndex.includes("<UtilityControlsMenu") &&
        utilityMenuAnalysis.hasDisclosureLinkage &&
        utilityMenuAnalysis.hasAcceptedCloseBehavior
          ? "pass"
          : "warn",
      details:
        routeIndex.includes("<UtilityControlsMenu") &&
        utilityMenuAnalysis.hasDisclosureLinkage &&
        utilityMenuAnalysis.hasAcceptedCloseBehavior
          ? `Utility controls menu integration, disclosure semantics, and ${utilityMenuAnalysis.implementation} close behavior detected.`
          : "Utility controls menu integration, disclosure semantics, or accepted close behavior appear incomplete.",
      remediation:
        "Render utility controls inside UtilityControlsMenu with aria-expanded/aria-controls linkage plus either legacy manual close handling or the Kobalte popover contract.",
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
