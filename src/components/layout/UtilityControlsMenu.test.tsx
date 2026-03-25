import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveUtilityControlsMenuRows,
  resolveUtilityControlsMenuThemeActionLabel,
  resolveUtilityControlsMenuTriggerAriaLabel,
} from "./UtilityControlsMenu.helpers";

test("utility controls menu trigger label reflects the next toggle action", () => {
  // Arrange
  const closedLabel = resolveUtilityControlsMenuTriggerAriaLabel(false, "controls menu");
  const openLabel = resolveUtilityControlsMenuTriggerAriaLabel(true, "controls menu");

  // Act
  const labels = [closedLabel, openLabel];

  // Assert
  assert.deepEqual(labels, ["Open controls menu", "Close controls menu"]);
});

test("utility controls menu theme action label reflects the next mode", () => {
  // Arrange
  const darkModeLabel = resolveUtilityControlsMenuThemeActionLabel("dark");
  const lightModeLabel = resolveUtilityControlsMenuThemeActionLabel("light");

  // Act
  const labels = [darkModeLabel, lightModeLabel];

  // Assert
  assert.deepEqual(labels, ["Switch to light mode", "Switch to dark mode"]);
});

test("utility controls menu rows stay in flat order and mark the active destination", () => {
  // Arrange
  const rows = resolveUtilityControlsMenuRows({
    activeNavigationItem: "analytics",
    analyticsHref: "/analytics",
    analyticsLabel: "Analytics",
    canToggleMode: true,
    homeHref: "/",
    homeLabel: "Home",
    mode: "dark",
    testingGalleryHref: "/spark/tip-cards",
    testingGalleryLabel: "Tip card sparks",
  });

  // Act
  const orderedRows = rows.map((row) => ({
    isCurrent: row.isCurrent ?? false,
    key: row.key,
    kind: row.kind,
    label: row.label,
  }));

  // Assert
  assert.deepEqual(orderedRows, [
    { isCurrent: false, key: "home", kind: "link", label: "Home" },
    { isCurrent: true, key: "analytics", kind: "link", label: "Analytics" },
    { isCurrent: false, key: "testing-gallery", kind: "link", label: "Tip card sparks" },
    { isCurrent: false, key: "theme", kind: "button", label: "Switch to light mode" },
  ]);
});

test("utility controls menu omits unavailable rows", () => {
  // Arrange
  const rows = resolveUtilityControlsMenuRows({
    analyticsHref: undefined,
    canToggleMode: false,
    homeHref: "/",
    mode: "light",
    testingGalleryHref: undefined,
  });

  // Act
  const rowKeys = rows.map((row) => row.key);

  // Assert
  assert.deepEqual(rowKeys, ["home"]);
});
