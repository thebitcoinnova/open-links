import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runPublicBuildCleanup } from "./clean-public-build-artifacts";

test("removes OS junk and legacy generated assets while preserving current cache assets", () => {
  // Arrange
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "openlinks-public-clean-"));
  const publicDir = path.join(workspace, "public");

  fs.mkdirSync(path.join(publicDir, "branding/openlinks-logo/v3"), { recursive: true });
  fs.mkdirSync(path.join(publicDir, "cache/content-images"), { recursive: true });
  fs.mkdirSync(path.join(publicDir, "generated/images"), { recursive: true });
  fs.mkdirSync(path.join(publicDir, "generated/seo"), { recursive: true });

  fs.writeFileSync(path.join(publicDir, "branding/openlinks-logo/v3/.DS_Store"), "junk");
  fs.writeFileSync(path.join(publicDir, "cache/.DS_Store"), "junk");
  fs.writeFileSync(path.join(publicDir, "generated/.gitkeep"), "");
  fs.writeFileSync(path.join(publicDir, "generated/images/example.jpg"), "legacy");
  fs.writeFileSync(path.join(publicDir, "generated/profile-avatar.jpg"), "legacy");
  fs.writeFileSync(path.join(publicDir, "generated/seo/social-preview.png"), "current");
  fs.writeFileSync(path.join(publicDir, "cache/content-images/example.jpg"), "current");

  try {
    // Act
    const removed = runPublicBuildCleanup(publicDir);

    // Assert
    assert.deepEqual(
      removed.map((entry) => path.relative(publicDir, entry)),
      [
        "branding/openlinks-logo/v3/.DS_Store",
        "cache/.DS_Store",
        "generated/images",
        "generated/profile-avatar.jpg",
      ],
    );
    assert.equal(fs.existsSync(path.join(publicDir, "generated/.gitkeep")), true);
    assert.equal(fs.existsSync(path.join(publicDir, "generated/images")), false);
    assert.equal(fs.existsSync(path.join(publicDir, "generated/profile-avatar.jpg")), false);
    assert.equal(fs.existsSync(path.join(publicDir, "generated/seo/social-preview.png")), true);
    assert.equal(fs.existsSync(path.join(publicDir, "cache/content-images/example.jpg")), true);
  } finally {
    fs.rmSync(workspace, { force: true, recursive: true });
  }
});
