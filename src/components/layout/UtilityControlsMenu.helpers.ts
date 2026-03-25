import type { UiMode } from "../../lib/theme/mode-controller";

type UtilityControlsMenuNavigationItem = "analytics" | "home";

export type UtilityControlsMenuRowKey = "analytics" | "home" | "testing-gallery" | "theme";

export interface UtilityControlsMenuRowData {
  href?: string;
  isCurrent?: boolean;
  key: UtilityControlsMenuRowKey;
  kind: "button" | "link";
  label: string;
}

export interface ResolveUtilityControlsMenuRowsOptions {
  activeNavigationItem?: UtilityControlsMenuNavigationItem;
  analyticsHref?: string;
  analyticsLabel?: string;
  canToggleMode: boolean;
  homeHref?: string;
  homeLabel?: string;
  mode: UiMode;
  testingGalleryHref?: string;
  testingGalleryLabel?: string;
}

export const resolveUtilityControlsMenuTriggerAriaLabel = (isOpen: boolean, label: string) =>
  `${isOpen ? "Close" : "Open"} ${label}`;

export const resolveUtilityControlsMenuThemeActionLabel = (mode: UiMode) =>
  `Switch to ${mode === "dark" ? "light" : "dark"} mode`;

export const resolveUtilityControlsMenuRows = (
  options: ResolveUtilityControlsMenuRowsOptions,
): UtilityControlsMenuRowData[] => {
  const rows: UtilityControlsMenuRowData[] = [];

  if (options.homeHref) {
    rows.push({
      href: options.homeHref,
      isCurrent: options.activeNavigationItem === "home",
      key: "home",
      kind: "link",
      label: options.homeLabel ?? "Home",
    });
  }

  if (options.analyticsHref) {
    rows.push({
      href: options.analyticsHref,
      isCurrent: options.activeNavigationItem === "analytics",
      key: "analytics",
      kind: "link",
      label: options.analyticsLabel ?? "Analytics",
    });
  }

  if (options.testingGalleryHref) {
    rows.push({
      href: options.testingGalleryHref,
      key: "testing-gallery",
      kind: "link",
      label: options.testingGalleryLabel ?? "Tip card sparks",
    });
  }

  if (options.canToggleMode) {
    rows.push({
      key: "theme",
      kind: "button",
      label: resolveUtilityControlsMenuThemeActionLabel(options.mode),
    });
  }

  return rows;
};
