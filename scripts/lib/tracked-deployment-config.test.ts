import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  readEffectiveTrackedDeploymentConfig,
  writeDeploymentOverlayConfig,
} from "./tracked-deployment-config";

test("readEffectiveTrackedDeploymentConfig returns shared defaults when no overlay exists", async () => {
  // Arrange
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "open-links-deploy-defaults-"));
  const defaultsPath = path.join(tempDir, "deployment.defaults.json");
  const overlayPath = path.join(tempDir, "deployment.json");
  fs.writeFileSync(
    defaultsPath,
    JSON.stringify(
      {
        enabledTargets: ["aws", "github-pages"],
        primaryTarget: "aws",
        targets: {
          aws: {
            publicOrigin: "https://openlinks.us",
            priceClass: "PriceClass_100",
            resourcePrefix: "open-links",
          },
        },
      },
      null,
      2,
    ),
  );

  try {
    // Act
    const config = await readEffectiveTrackedDeploymentConfig(defaultsPath, overlayPath);

    // Assert
    assert.deepEqual(config.enabledTargets, ["aws", "github-pages"]);
    assert.equal(config.primaryTarget, "aws");
    assert.equal(config.targets.aws?.publicOrigin, "https://openlinks.us");
    assert.equal(config.targets.aws?.resourcePrefix, "open-links");
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

test("readEffectiveTrackedDeploymentConfig merges a fork overlay over shared defaults", async () => {
  // Arrange
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "open-links-deploy-overlay-"));
  const defaultsPath = path.join(tempDir, "deployment.defaults.json");
  const overlayPath = path.join(tempDir, "deployment.json");
  fs.writeFileSync(
    defaultsPath,
    JSON.stringify(
      {
        enabledTargets: ["aws", "github-pages"],
        primaryTarget: "aws",
        targets: {
          aws: {
            publicOrigin: "https://openlinks.us",
            priceClass: "PriceClass_100",
            resourcePrefix: "open-links",
          },
          "github-pages": {},
          render: {},
          railway: {},
        },
      },
      null,
      2,
    ),
  );

  try {
    await writeDeploymentOverlayConfig(
      {
        enabledTargets: ["github-pages"],
        primaryTarget: "github-pages",
        targets: {
          aws: {},
          "github-pages": {
            publicOrigin: "https://links.example.com",
          },
          render: {},
          railway: {},
        },
      },
      overlayPath,
    );

    // Act
    const config = await readEffectiveTrackedDeploymentConfig(defaultsPath, overlayPath);

    // Assert
    assert.deepEqual(config.enabledTargets, ["github-pages"]);
    assert.equal(config.primaryTarget, "github-pages");
    assert.equal(config.targets.aws?.publicOrigin, "https://openlinks.us");
    assert.equal(config.targets.aws?.resourcePrefix, "open-links");
    assert.equal(config.targets["github-pages"]?.publicOrigin, "https://links.example.com");
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});
