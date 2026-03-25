import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

test("loads embedded code when imported from a non-repo working directory", async () => {
  // Arrange
  const originalCwd = process.cwd();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "embedded-code-loader-"));
  const moduleUrl = `${pathToFileURL(path.join(originalCwd, "scripts/shared/embedded-code-loader.ts")).href}?cwd-test`;

  try {
    process.chdir(tempDir);
    const module = (await import(moduleUrl)) as {
      loadEmbeddedCode: (relativePath: string) => string;
    };

    // Act
    const snippet = module.loadEmbeddedCode("browser/facebook/inspect-auth-flow.js");

    // Assert
    assert.match(snippet, /document|window|location/u);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
