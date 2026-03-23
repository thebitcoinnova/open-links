import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";
import { runManualSmokeChecks } from "./manual-smoke";

const ROOT = process.cwd();

test("manual smoke detects the shared mobile text-wrap contract", () => {
  // Act
  const { checks } = runManualSmokeChecks({
    rootDir: ROOT,
    checklistLabels: [],
  });
  const check = checks.find((entry) => entry.id === "mobile-text-overflow");

  // Assert
  assert.ok(check);
  assert.equal(check.status, "pass");
});
