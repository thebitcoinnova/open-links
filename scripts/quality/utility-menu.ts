export type UtilityMenuImplementation = "kobalte-popover" | "legacy-manual" | "unknown";

export interface UtilityMenuAnalysis {
  hasAcceptedCloseBehavior: boolean;
  hasDisclosureLinkage: boolean;
  implementation: UtilityMenuImplementation;
  usesKobaltePopoverBehavior: boolean;
  usesLegacyManualBehavior: boolean;
}

const includesAll = (source: string, patterns: string[]): boolean =>
  patterns.every((pattern) => source.includes(pattern));

export const analyzeUtilityMenuImplementation = (source: string): UtilityMenuAnalysis => {
  const hasDisclosureLinkage = includesAll(source, ["aria-expanded", "aria-controls"]);
  const usesLegacyManualBehavior = includesAll(source, ["onFocusOut", "pointerdown", "Escape"]);
  const usesKobaltePopoverBehavior =
    includesAll(source, [
      "@kobalte/core/popover",
      "Popover.Root",
      "Popover.Trigger",
      "Popover.Content",
      "onOpenChange",
      "onCloseAutoFocus",
    ]) ||
    includesAll(source, [
      "Popover.Root",
      "Popover.Trigger",
      "Popover.Content",
      "onOpenChange",
      "onCloseAutoFocus",
    ]);

  const implementation: UtilityMenuImplementation = usesKobaltePopoverBehavior
    ? "kobalte-popover"
    : usesLegacyManualBehavior
      ? "legacy-manual"
      : "unknown";

  return {
    hasAcceptedCloseBehavior: usesLegacyManualBehavior || usesKobaltePopoverBehavior,
    hasDisclosureLinkage,
    implementation,
    usesKobaltePopoverBehavior,
    usesLegacyManualBehavior,
  };
};
