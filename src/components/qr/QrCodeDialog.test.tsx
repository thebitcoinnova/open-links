import assert from "node:assert/strict";
import test from "node:test";
import { resolveQrCodeDialogAriaLabel } from "./QrCodeDialog";

test("resolveQrCodeDialogAriaLabel uses the provided title", () => {
  // Arrange
  const title = "GitHub";

  // Act
  const label = resolveQrCodeDialogAriaLabel(title);

  // Assert
  assert.equal(label, "GitHub QR code");
});

test("resolveQrCodeDialogAriaLabel falls back when the title is blank", () => {
  // Arrange
  const title = "   ";

  // Act
  const label = resolveQrCodeDialogAriaLabel(title);

  // Assert
  assert.equal(label, "QR code");
});
