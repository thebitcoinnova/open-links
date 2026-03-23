import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();

const createPerformanceFixture = () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "open-links-quality-test-"));
  const distDir = path.join(tempDir, "dist");
  const assetsDir = path.join(distDir, "assets");
  const dataDir = path.join(tempDir, "data");

  fs.mkdirSync(assetsDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(distDir, "index.html"),
    '<!doctype html><html><head><script type="module" src="/assets/index.js"></script></head><body></body></html>',
    "utf8",
  );
  fs.writeFileSync(path.join(assetsDir, "index.js"), "x".repeat(260), "utf8");
  fs.writeFileSync(
    path.join(dataDir, "site.json"),
    JSON.stringify({
      title: "Fixture",
      description: "Fixture",
      quality: {
        performance: {
          profiles: {
            mobile: {
              totalBytes: { warn: 200, fail: 240 },
              jsBytes: { warn: 200, fail: 240 },
              cssBytes: { warn: 100, fail: 120 },
              htmlBytes: { warn: 120, fail: 140 },
              largestAssetBytes: { warn: 200, fail: 240 },
              minimumScore: { warn: 90, fail: 75 },
            },
            desktop: {
              totalBytes: { warn: 200, fail: 240 },
              jsBytes: { warn: 200, fail: 240 },
              cssBytes: { warn: 100, fail: 120 },
              htmlBytes: { warn: 120, fail: 140 },
              largestAssetBytes: { warn: 200, fail: 240 },
              minimumScore: { warn: 90, fail: 75 },
            },
          },
          routes: ["/"],
        },
      },
    }),
    "utf8",
  );
  fs.writeFileSync(path.join(dataDir, "profile.json"), JSON.stringify({ name: "Fixture" }), "utf8");

  return tempDir;
};

test("warn-only performance flag keeps strict performance-only runs successful", (t) => {
  // Arrange
  const tempDir = createPerformanceFixture();
  t.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // Act
  const result = spawnSync(
    "bun",
    [
      path.join(ROOT, "scripts/quality/run-quality-checks.ts"),
      "--strict",
      "--warn-only-domain",
      "performance",
      "--exclude-domain",
      "seo",
      "--exclude-domain",
      "accessibility",
      "--exclude-domain",
      "manual-smoke",
      "--format",
      "json",
    ],
    {
      cwd: tempDir,
      encoding: "utf8",
    },
  );

  // Assert
  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.success, true);
  assert.equal(payload.errors.length, 0);
  assert.ok(payload.warnings.length > 0);
});

test("strict quality run still fails without warn-only performance mode", (t) => {
  // Arrange
  const tempDir = createPerformanceFixture();
  t.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // Act
  const result = spawnSync(
    "bun",
    [
      path.join(ROOT, "scripts/quality/run-quality-checks.ts"),
      "--strict",
      "--exclude-domain",
      "seo",
      "--exclude-domain",
      "accessibility",
      "--exclude-domain",
      "manual-smoke",
      "--format",
      "json",
    ],
    {
      cwd: tempDir,
      encoding: "utf8",
    },
  );

  // Assert
  assert.equal(result.status, 1);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.success, false);
  assert.ok(payload.errors.length > 0);
});
