import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  type DeployTarget,
  getDeployTargetConfig,
  parseDeployTarget,
} from "../../src/lib/deployment-config";
import { runCommand } from "../lib/command";
import { copyArtifact, finalizeArtifact, readDeployManifest } from "../lib/deploy-artifact";
import { createDeployRun, writeDeploySummary } from "../lib/deploy-log";
import { parseArgs } from "./shared";

const args = parseArgs(process.argv.slice(2));
const requestedTarget = args.target;
const targets = requestedTarget
  ? [parseDeployTarget(requestedTarget)]
  : (["github-pages", "aws"] as const);
const outputDir = path.resolve("dist");
const deployArtifactsDir = path.resolve(".artifacts/deploy");
const commandName = "deploy:build";
const run = await createDeployRun({
  command: commandName,
  mode: "check",
  target: requestedTarget ?? "all",
});
const buildTimestamp = new Date().toISOString();
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

runCommand("bun", ["run", "avatar:sync"]);
runCommand("bun", ["run", "enrich:rich:strict"]);
runCommand("bun", ["run", "images:sync"]);
runCommand("bun", ["run", "validate:data"]);
await run.addBreadcrumb({
  detail: "Ran the shared pre-build sync and validation steps for deployment artifacts.",
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
    },
    mode: "check",
    plannedChanges: {
      targets,
    },
    resultingUrls: builtArtifacts.map(
      (artifact) => getDeployTargetConfig(artifact.target).publicOrigin,
    ),
    skippedReasons: [],
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
