import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runPerformanceChecks } from "./perf";
import type { QualitySiteInput } from "./types";

const writeSizedFile = (filePath: string, bytes: number) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, "x".repeat(bytes), "utf8");
};

const createSite = (): QualitySiteInput => ({
  description: "Test site",
  quality: {
    performance: {
      profiles: {
        mobile: {
          totalBytes: { warn: 500, fail: 600 },
          jsBytes: { warn: 220, fail: 260 },
          cssBytes: { warn: 120, fail: 150 },
          htmlBytes: { warn: 260, fail: 320 },
          largestAssetBytes: { warn: 150, fail: 180 },
          minimumScore: { warn: 90, fail: 75 },
        },
        desktop: {
          totalBytes: { warn: 500, fail: 600 },
          jsBytes: { warn: 220, fail: 260 },
          cssBytes: { warn: 120, fail: 150 },
          htmlBytes: { warn: 260, fail: 320 },
          largestAssetBytes: { warn: 150, fail: 180 },
          minimumScore: { warn: 90, fail: 75 },
        },
      },
      routes: ["/"],
    },
  },
  title: "Test site",
});

test("performance checks count only initial route assets referenced by dist/index.html", (t) => {
  // Arrange
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "open-links-perf-test-"));
  const distDir = path.join(tempDir, "dist");
  const assetsDir = path.join(distDir, "assets");
  t.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  fs.mkdirSync(assetsDir, { recursive: true });
  fs.writeFileSync(
    path.join(distDir, "index.html"),
    [
      "<!doctype html>",
      '<html><head><script type="module" src="/open-links/assets/index.js"></script>',
      '<link rel="stylesheet" href="/open-links/assets/app.css">',
      '<link rel="modulepreload" href="/open-links/assets/vendor.js"></head><body></body></html>',
    ].join(""),
    "utf8",
  );
  writeSizedFile(path.join(assetsDir, "index.js"), 120);
  writeSizedFile(path.join(assetsDir, "vendor.js"), 70);
  writeSizedFile(path.join(assetsDir, "app.css"), 40);
  writeSizedFile(path.join(assetsDir, "lazy-chart.js"), 600);

  // Act
  const result = runPerformanceChecks({
    rootDir: tempDir,
    site: createSite(),
    strict: false,
  });

  // Assert
  assert.equal(result.status, "pass");
  assert.deepEqual(result.issues, []);
});

test("strict advisory performance mode keeps fail-tier performance findings as warnings", (t) => {
  // Arrange
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "open-links-perf-test-"));
  const distDir = path.join(tempDir, "dist");
  const assetsDir = path.join(distDir, "assets");
  t.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  fs.mkdirSync(assetsDir, { recursive: true });
  fs.writeFileSync(
    path.join(distDir, "index.html"),
    '<!doctype html><html><head><script type="module" src="/assets/index.js"></script></head><body></body></html>',
    "utf8",
  );
  writeSizedFile(path.join(assetsDir, "index.js"), 260);

  // Act
  const strictResult = runPerformanceChecks({
    rootDir: tempDir,
    site: createSite(),
    strict: true,
  });
  const advisoryResult = runPerformanceChecks({
    advisoryOnly: true,
    rootDir: tempDir,
    site: createSite(),
    strict: true,
  });

  // Assert
  assert.equal(strictResult.status, "fail");
  assert.ok(strictResult.issues.some((issue) => issue.level === "error"));
  assert.equal(advisoryResult.status, "warn");
  assert.ok(advisoryResult.issues.length > 0);
  assert.ok(advisoryResult.issues.every((issue) => issue.level === "warning"));
});
