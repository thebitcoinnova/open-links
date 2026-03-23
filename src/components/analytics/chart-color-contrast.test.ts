import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateContrastRatio,
  isDarkChartSurface,
  resolveChartLineColor,
} from "./chart-color-contrast";

test("resolveChartLineColor preserves the theme accent when it already clears contrast", () => {
  // Arrange
  const input = {
    accent: "#d56c11",
    accentStrong: "#9e4b00",
    background: "#fff5e8",
    textPrimary: "#2f2217",
  };

  // Act
  const resolved = resolveChartLineColor(input);

  // Assert
  assert.equal(resolved, "#9e4b00");
});

test("resolveChartLineColor lifts low-contrast dark accents to a readable chart stroke", () => {
  // Arrange
  const background = "#101624";
  const input = {
    accent: "#0f2547",
    accentStrong: "#182b42",
    background,
    textPrimary: "#f8fafc",
  };

  // Act
  const resolved = resolveChartLineColor(input);

  // Assert
  assert.notEqual(resolved, "#182b42");
  assert.ok(calculateContrastRatio(resolved, background) >= 4.5);
  assert.ok(
    calculateContrastRatio(resolved, background) > calculateContrastRatio("#182b42", background),
  );
});

test("isDarkChartSurface distinguishes the chart's dark and light surfaces", () => {
  // Arrange
  const darkSurface = "#171d2b";
  const lightSurface = "#fff5e8";

  // Act
  const darkResult = isDarkChartSurface(darkSurface);
  const lightResult = isDarkChartSurface(lightSurface);

  // Assert
  assert.equal(darkResult, true);
  assert.equal(lightResult, false);
});
