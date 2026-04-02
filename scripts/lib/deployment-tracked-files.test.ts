import assert from "node:assert/strict";
import test from "node:test";
import {
  parseTrackedDeploymentConfig,
  resolveDeploymentState,
} from "../../src/lib/deployment-config";
import { buildReadmeDeployRowsFromState } from "./deployment-tracked-files";

test("buildReadmeDeployRowsFromState renders pages-primary topology rows", () => {
  // Arrange
  const state = resolveDeploymentState({
    repositorySlug: "someone/open-links-fork",
    trackedConfig: parseTrackedDeploymentConfig({
      enabledTargets: ["github-pages"],
      primaryTarget: "github-pages",
    }),
  });

  // Act
  const rows = buildReadmeDeployRowsFromState(state);

  // Assert
  assert.deepEqual(rows, [
    {
      additionalUrls: "none",
      evidence: "deploy-production.yml -> Deploy GitHub Pages",
      primaryUrl: "https://someone.github.io/open-links-fork",
      status: "active",
      target: "github-pages",
    },
  ]);
});

test("buildReadmeDeployRowsFromState renders aws-primary topology rows with pages canonicalized to aws", () => {
  // Arrange
  const state = resolveDeploymentState({
    repositorySlug: "someone/open-links-fork",
    trackedConfig: parseTrackedDeploymentConfig({
      enabledTargets: ["aws", "github-pages"],
      primaryTarget: "aws",
      targets: {
        aws: {
          publicOrigin: "https://links.example.com",
        },
      },
    }),
  });

  // Act
  const rows = buildReadmeDeployRowsFromState(state);

  // Assert
  assert.deepEqual(rows, [
    {
      additionalUrls: "none",
      evidence: "deploy-production.yml -> Deploy AWS Site",
      primaryUrl: "https://links.example.com",
      status: "active",
      target: "aws",
    },
    {
      additionalUrls: "canonical=https://links.example.com",
      evidence: "deploy-production.yml -> Deploy GitHub Pages",
      primaryUrl: "https://someone.github.io/open-links-fork",
      status: "active",
      target: "github-pages",
    },
  ]);
});
