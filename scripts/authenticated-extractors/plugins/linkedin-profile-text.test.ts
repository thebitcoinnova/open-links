import assert from "node:assert/strict";
import test from "node:test";
import { resolveLinkedinDescription, sanitizeLinkedinDescription } from "./linkedin-profile-text";

test("sanitizes a glued LinkedIn About section label", () => {
  // Arrange
  const rawDescription =
    "AboutTalented software engineer, excited to work on new and challenging problems.";

  // Act
  const sanitized = sanitizeLinkedinDescription(rawDescription);

  // Assert
  assert.equal(
    sanitized,
    "Talented software engineer, excited to work on new and challenging problems.",
  );
});

test("preserves descriptions that legitimately start with About", () => {
  // Arrange
  const rawDescription = "About me and my work building developer tools.";

  // Act
  const sanitized = sanitizeLinkedinDescription(rawDescription);

  // Assert
  assert.equal(sanitized, rawDescription);
});

test("falls back to headline when About text is missing", () => {
  // Arrange
  const input = {
    about: undefined,
    headline: "Lead engineer building data-heavy products.",
    fallbackDescription: undefined,
  };

  // Act
  const description = resolveLinkedinDescription(input);

  // Assert
  assert.equal(description, "Lead engineer building data-heavy products.");
});
