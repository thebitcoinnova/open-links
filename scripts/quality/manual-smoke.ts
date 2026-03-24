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

const escapeForRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const selectorHasDeclaration = (source: string, selector: string, declaration: string): boolean => {
  const pattern = new RegExp(
    `${escapeForRegex(selector)}\\s*\\{[^}]*${escapeForRegex(declaration)}`,
    "su",
  );

  return pattern.test(source);
};

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
  const topUtilityBar = readText(rootDir, "src/components/layout/TopUtilityBar.tsx");
  const profileHeader = readText(rootDir, "src/components/profile/ProfileHeader.tsx");
  const themeToggle = readText(rootDir, "src/components/theme/ThemeToggle.tsx");
  const utilityMenu = readText(rootDir, "src/components/layout/UtilityControlsMenu.tsx");
  const baseCss = readText(rootDir, "src/styles/base.css");
  const responsiveCss = readText(rootDir, "src/styles/responsive.css");
  const utilityMenuAnalysis = analyzeUtilityMenuImplementation(utilityMenu);
  const sharedNonPaymentCardHasActionLabel =
    nonPaymentCardShell.includes("<a") &&
    nonPaymentCardShell.includes("aria-label") &&
    !nonPaymentCardShell.includes("aria-labelledby");
  const simpleCardUsesSharedShell = simpleCard.includes("NonPaymentLinkCardShell");
  const richCardUsesSharedShell = richCard.includes("NonPaymentLinkCardShell");
  const hasMobileTextOverflowContract =
    topUtilityBar.includes('class="utility-brand-text"') &&
    profileHeader.includes('class="profile-contact-item"') &&
    profileHeader.includes('class="profile-contact-key"') &&
    profileHeader.includes('class="profile-contact-value"') &&
    selectorHasDeclaration(baseCss, ".utility-brand-text", "overflow-wrap: anywhere;") &&
    selectorHasDeclaration(baseCss, ".profile-contact-value", "overflow-wrap: anywhere;") &&
    selectorHasDeclaration(baseCss, ".non-payment-card-meta-item", "overflow-wrap: anywhere;") &&
    selectorHasDeclaration(baseCss, ".non-payment-card-source-label", "overflow-wrap: anywhere;");
  const hasCenteredMobileHeaderContract =
    selectorHasDeclaration(baseCss, ".top-utility-bar", "align-items: center;") &&
    selectorHasDeclaration(baseCss, ".utility-title", "display: flex;") &&
    selectorHasDeclaration(baseCss, ".utility-title", "align-items: center;") &&
    selectorHasDeclaration(baseCss, ".utility-title", "min-height: var(--page-target-size);") &&
    selectorHasDeclaration(baseCss, ".utility-brand", "align-items: center;") &&
    !selectorHasDeclaration(
      responsiveCss,
      'body .top-utility-bar[data-sticky-mobile="true"]',
      "align-items: flex-start;",
    ) &&
    !selectorHasDeclaration(responsiveCss, "body .utility-brand", "align-items: flex-start;");

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
        "Utility controls collapse into a responsive controls surface that remains keyboard reachable.",
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
        "Render utility controls inside UtilityControlsMenu with aria-expanded/aria-controls linkage plus either legacy manual close handling or the responsive Kobalte menu contract.",
    },
    {
      id: "mobile-text-overflow",
      label:
        checklistLabels[5] ??
        "Long user-controlled text stays inside shared mobile header, profile, and card containers.",
      status: hasMobileTextOverflowContract ? "pass" : "warn",
      details: hasMobileTextOverflowContract
        ? "Shared utility, profile, and non-payment card text surfaces expose wrap-safe hooks and overflow-wrap contracts."
        : "Shared mobile text-overflow hooks or wrap-safe CSS contracts appear incomplete.",
      remediation:
        "Keep dedicated utility/profile hooks plus wrap-safe overflow handling on shared non-payment text surfaces.",
    },
    {
      id: "mobile-header-alignment",
      label:
        checklistLabels[6] ??
        "Mobile header brand and utility trigger stay vertically centered on the same cross-axis.",
      status: hasCenteredMobileHeaderContract ? "pass" : "warn",
      details: hasCenteredMobileHeaderContract
        ? "Shared utility header keeps a centered title box and avoids mobile flex-start overrides that lift the brand above the menu trigger."
        : "Shared utility header alignment contract is incomplete or mobile overrides still pull the brand off the menu trigger centerline.",
      remediation:
        "Keep the utility bar and brand centered across breakpoints, and give the title container a target-sized centered alignment box.",
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
