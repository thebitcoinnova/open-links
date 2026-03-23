import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_QR_BACKGROUND_COLOR,
  DEFAULT_QR_FOREGROUND_COLOR,
  resolveQrThemeColors,
} from "./theme-colors";

test("resolveQrThemeColors keeps explicit colors over theme defaults", () => {
  // Arrange
  const readCssVariable = (name: string, fallback: string) =>
    name === "--text-primary" ? "#f5f7fb" : fallback;

  // Act
  const colors = resolveQrThemeColors({
    foregroundColor: "#123456",
    backgroundColor: "#abcdef",
    readCssVariable,
  });

  // Assert
  assert.deepEqual(colors, {
    foregroundColor: "#123456",
    backgroundColor: "#abcdef",
  });
});

test("resolveQrThemeColors uses theme variables when explicit colors are omitted", () => {
  // Arrange
  const readCssVariable = (name: string, fallback: string) => {
    if (name === "--text-primary") {
      return "#f8fafc";
    }

    if (name === "--surface-panel") {
      return "#101625";
    }

    return fallback;
  };

  // Act
  const colors = resolveQrThemeColors({
    readCssVariable,
  });

  // Assert
  assert.deepEqual(colors, {
    foregroundColor: "#f8fafc",
    backgroundColor: "#101625",
  });
});

test("resolveQrThemeColors falls back to hardcoded colors when theme variables are unavailable", () => {
  // Arrange
  const readCssVariable = () => "";

  // Act
  const colors = resolveQrThemeColors({
    readCssVariable,
  });

  // Assert
  assert.deepEqual(colors, {
    foregroundColor: DEFAULT_QR_FOREGROUND_COLOR,
    backgroundColor: DEFAULT_QR_BACKGROUND_COLOR,
  });
});
