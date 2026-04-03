import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { runPublicBuildCleanup } from "../clean-public-build-artifacts";
import { resolveStableBuildTimestamp } from "../lib/build-timestamp";
import { runCommand } from "../lib/command";
import { copyArtifact, finalizeArtifact, readDeployManifest } from "../lib/deploy-artifact";
import { createDeployRun, writeDeploySummary } from "../lib/deploy-log";
import {
  type DeployTarget,
  enabledDeployTargets,
  getDeployTargetConfig,
  parseDeployTarget,
} from "../lib/effective-deployment-config";
import { parseArgs } from "./shared";

const args = parseArgs(process.argv.slice(2));
const requestedTarget = args.target;
const skipContentSync = args["skip-content-sync"] === "true";
const targets = requestedTarget ? [parseDeployTarget(requestedTarget)] : enabledDeployTargets;
const outputDir = path.resolve("dist");
const deployArtifactsDir = path.resolve(".artifacts/deploy");
const commandName = "deploy:build";
const run = await createDeployRun({
  command: commandName,
  mode: "check",
  target: requestedTarget ?? "all",
});
const buildTimestamp = resolveStableBuildTimestamp({
  explicitValue: process.env.OPENLINKS_BUILD_TIMESTAMP,
});
const builtArtifacts: Array<{
  artifactHash: string;
  destinationDir: string;
  target: DeployTarget;
}> = [];

await run.addBreadcrumb({
  data: { targets },
  detail: "Preparing to build target-specific deployment artifacts.",
  status: "info",
  step: "initialize",
});

const removedPublicArtifacts = runPublicBuildCleanup();
await run.addBreadcrumb({
  data: {
    removedPaths: removedPublicArtifacts,
  },
  detail:
    removedPublicArtifacts.length > 0
      ? `Removed ${removedPublicArtifacts.length} legacy or OS-generated public artifacts before the deploy build.`
      : "No legacy or OS-generated public artifacts needed cleanup before the deploy build.",
  status: "passed",
  step: "public cleanup",
});

if (!skipContentSync) {
  runCommand("bun", ["run", "avatar:sync"]);
  runCommand("bun", ["run", "enrich:rich:strict"]);
  runCommand("bun", ["run", "images:sync"]);
  runCommand("bun", ["run", "social:preview:generate"]);
  runCommand("bun", ["run", "validate:data"]);
  runCommand("bun", ["run", "badge:site"]);
} else {
  runCommand("bun", ["run", "validate:data"]);
}
await run.addBreadcrumb({
  detail: skipContentSync
    ? "Skipped content sync and generation steps before the deploy build and ran validate:data only."
    : "Ran the shared pre-build sync and validation steps for deployment artifacts.",
  status: "passed",
  step: "prebuild",
});

for (const target of targets) {
  const destinationDir = path.join(deployArtifactsDir, target);
  const targetConfig = getDeployTargetConfig(target);

  runCommand("bunx", ["vite", "build"], {
    env: {
      OPENLINKS_BUILD_TIMESTAMP: buildTimestamp,
      OPENLINKS_DEPLOY_TARGET: target,
    },
  });

  await rm(destinationDir, { force: true, recursive: true });
  await copyArtifact(outputDir, destinationDir);

  await finalizeArtifact(destinationDir, target);

  const manifest = await readDeployManifest(path.join(destinationDir, "deploy-manifest.json"));
  builtArtifacts.push({
    artifactHash: manifest.artifactHash,
    destinationDir,
    target,
  });
  await run.addBreadcrumb({
    data: {
      artifactHash: manifest.artifactHash,
      basePath: targetConfig.basePath,
      destinationDir,
      publicOrigin: manifest.publicOrigin,
      target,
    },
    detail: `Built ${target} artifact ${manifest.artifactHash}.`,
    status: "passed",
    step: "artifact build",
  });
}

const { runDirectory } = await writeDeploySummary(
  {
    appliedChanges: builtArtifacts.map(
      (artifact) =>
        `Built ${artifact.target} artifact ${artifact.artifactHash} at ${artifact.destinationDir}.`,
    ),
    artifactDir: requestedTarget ? builtArtifacts[0]?.destinationDir : undefined,
    artifactHash: requestedTarget ? builtArtifacts[0]?.artifactHash : undefined,
    command: commandName,
    discoveredRemoteState: {
      outputDir,
      skipContentSync,
    },
    mode: "check",
    plannedChanges: {
      skipContentSync,
      targets,
    },
    resultingUrls: builtArtifacts.map(
      (artifact) => getDeployTargetConfig(artifact.target).publicOrigin,
    ),
    skippedReasons: skipContentSync
      ? [
          "Skipped avatar/rich/image/social-preview/badge generation for an infra/debug-oriented artifact build.",
        ]
      : [],
    target: requestedTarget ?? "all",
    verificationResults: builtArtifacts.map((artifact) => ({
      detail: `${artifact.target} artifact ${artifact.artifactHash} passed the target assertions.`,
      name: `${artifact.target} artifact`,
      status: "passed" as const,
    })),
  },
  { runDirectory: run.runDirectory },
);

console.log(`Deploy build complete. Summary: ${runDirectory}`);
