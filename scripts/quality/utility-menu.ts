export type UtilityMenuImplementation =
  | "kobalte-popover"
  | "kobalte-responsive"
  | "legacy-manual"
  | "unknown";

export interface UtilityMenuAnalysis {
  hasAcceptedCloseBehavior: boolean;
  hasDisclosureLinkage: boolean;
  implementation: UtilityMenuImplementation;
  usesKobalteDialogBehavior: boolean;
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
  const usesKobalteDialogBehavior =
    includesAll(source, [
      "@kobalte/core/dialog",
      "Dialog.Root",
      "Dialog.Trigger",
      "Dialog.Content",
      "Dialog.CloseButton",
      "Dialog.Overlay",
      "onOpenChange",
      "onCloseAutoFocus",
    ]) ||
    includesAll(source, [
      "Dialog.Root",
      "Dialog.Trigger",
      "Dialog.Content",
      "Dialog.CloseButton",
      "Dialog.Overlay",
      "onOpenChange",
      "onCloseAutoFocus",
    ]);

  const implementation: UtilityMenuImplementation =
    usesKobaltePopoverBehavior && usesKobalteDialogBehavior
      ? "kobalte-responsive"
      : usesKobaltePopoverBehavior
        ? "kobalte-popover"
        : usesLegacyManualBehavior
          ? "legacy-manual"
          : "unknown";

  return {
    hasAcceptedCloseBehavior:
      usesLegacyManualBehavior || usesKobaltePopoverBehavior || usesKobalteDialogBehavior,
    hasDisclosureLinkage,
    implementation,
    usesKobalteDialogBehavior,
    usesKobaltePopoverBehavior,
    usesLegacyManualBehavior,
  };
};
