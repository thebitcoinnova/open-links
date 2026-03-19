import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { analyzeUtilityMenuImplementation } from "./utility-menu";

const ROOT = process.cwd();

test("analyzer accepts the legacy manual utility menu contract", () => {
  // Arrange
  const source = `
    <button aria-expanded={isOpen()} aria-controls={panelId} onFocusOut={handleFocusOut}>
      Menu
    </button>
    window.addEventListener("pointerdown", handlePointerDown);
    if (event.key === "Escape") {
      closeMenu();
    }
  `;

  // Act
  const analysis = analyzeUtilityMenuImplementation(source);

  // Assert
  assert.equal(analysis.hasDisclosureLinkage, true);
  assert.equal(analysis.hasAcceptedCloseBehavior, true);
  assert.equal(analysis.implementation, "legacy-manual");
});

test("analyzer accepts the Kobalte popover utility menu contract", () => {
  // Arrange
  const source = `
    import * as Popover from "@kobalte/core/popover";

    <Popover.Root onOpenChange={setIsOpen}>
      <Popover.Trigger aria-expanded={isOpen()} aria-controls={panelId} />
      <Popover.Content onCloseAutoFocus={handleCloseAutoFocus} />
    </Popover.Root>
  `;

  // Act
  const analysis = analyzeUtilityMenuImplementation(source);

  // Assert
  assert.equal(analysis.hasDisclosureLinkage, true);
  assert.equal(analysis.hasAcceptedCloseBehavior, true);
  assert.equal(analysis.implementation, "kobalte-popover");
});

test("analyzer rejects incomplete utility menu implementations", () => {
  // Arrange
  const source = `
    <Popover.Root>
      <Popover.Trigger aria-expanded={isOpen()} />
      <Popover.Content />
    </Popover.Root>
  `;

  // Act
  const analysis = analyzeUtilityMenuImplementation(source);

  // Assert
  assert.equal(analysis.hasDisclosureLinkage, false);
  assert.equal(analysis.hasAcceptedCloseBehavior, false);
  assert.equal(analysis.implementation, "unknown");
});

test("current UtilityControlsMenu source satisfies the analyzer contract", () => {
  // Arrange
  const utilityMenuPath = path.join(ROOT, "src/components/layout/UtilityControlsMenu.tsx");
  const source = fs.readFileSync(utilityMenuPath, "utf8");

  // Act
  const analysis = analyzeUtilityMenuImplementation(source);

  // Assert
  assert.equal(analysis.hasDisclosureLinkage, true);
  assert.equal(analysis.hasAcceptedCloseBehavior, true);
  assert.equal(analysis.implementation, "kobalte-popover");
});
