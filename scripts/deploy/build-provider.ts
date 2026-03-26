import { runCommand } from "../lib/command";
import { readDeployManifest } from "../lib/deploy-artifact";
import { createDeployRun, writeDeploySummary } from "../lib/deploy-log";
import {
  buildProviderDeployEnvironment,
  getProviderArtifactDirectory,
  parseProviderDeployTarget,
  resolveProviderDeployPublicOrigin,
} from "../lib/provider-deploy";
import { parseArgs } from "./shared";

const args = parseArgs(process.argv.slice(2));
const target = parseProviderDeployTarget(args.target ?? args.provider);
const buildEnv = buildProviderDeployEnvironment(target);
const publicOrigin = resolveProviderDeployPublicOrigin(target);
const artifactDir = getProviderArtifactDirectory(target);
const commandName = "deploy:build:provider";
const run = await createDeployRun({
  command: commandName,
  mode: "check",
  target,
});

await run.addBreadcrumb({
  data: {
    artifactDir,
    publicOrigin,
    target,
  },
  detail: `Prepared provider-native ${target} build context.`,
  status: "planned",
  step: "initialize",
});

runCommand("bun", ["run", "scripts/deploy/build.ts", `--target=${target}`], {
  env: buildEnv,
});

await run.addBreadcrumb({
  data: {
    artifactDir,
    publicOrigin,
  },
  detail: `Built the ${target} provider artifact with provider-aware canonical origin resolution.`,
  status: "passed",
  step: "build",
});

const manifest = await readDeployManifest(`${artifactDir}/deploy-manifest.json`);
const { runDirectory } = await writeDeploySummary(
  {
    appliedChanges: [
      `Built ${target} provider artifact ${manifest.artifactHash} at ${artifactDir}.`,
    ],
    artifactDir,
    artifactHash: manifest.artifactHash,
    command: commandName,
    discoveredRemoteState: {
      buildEnv,
      publicOrigin,
    },
    mode: "check",
    plannedChanges: {
      target,
    },
    resultingUrls: [publicOrigin, manifest.publicOrigin],
    skippedReasons: [],
    target,
    verificationResults: [
      {
        detail: `${target} provider artifact ${manifest.artifactHash} is ready to publish from ${artifactDir}.`,
        name: `${target} provider artifact`,
        status: "passed",
      },
    ],
  },
  { runDirectory: run.runDirectory },
);

console.log(`Provider build complete for ${target}. Summary: ${runDirectory}`);
