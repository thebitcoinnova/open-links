import { appendFile } from "node:fs/promises";
import path from "node:path";
import { deploymentConfig } from "../../src/lib/deployment-config";
import {
  type DeployManifest,
  assertDeployArtifactIntegrity,
  diffDeployManifests,
  readDeployManifest,
} from "../lib/deploy-artifact";
import { createDeployRun, writeDeploySummary } from "../lib/deploy-log";
import { parseArgs } from "./shared";

const args = parseArgs(process.argv.slice(2));
const artifactDir = path.resolve(args.artifact ?? ".artifacts/deploy/github-pages");
const manifestPath = path.join(artifactDir, "deploy-manifest.json");
const localManifest = await readDeployManifest(manifestPath);
const commandName = "deploy:pages:plan";
const run = await createDeployRun({
  command: commandName,
  mode: "check",
  target: "github-pages",
});

if (localManifest.target !== "github-pages") {
  throw new Error(
    `Expected a GitHub Pages deploy manifest, received target ${localManifest.target}.`,
  );
}

await assertDeployArtifactIntegrity(artifactDir, localManifest);

await run.addBreadcrumb({
  detail: `Loaded GitHub Pages artifact manifest ${localManifest.artifactHash} from ${artifactDir}.`,
  status: "info",
  step: "initialize",
});

const maybeRemoteManifest = await loadRemoteManifest(localManifest.publicOrigin);
const diff = diffDeployManifests(localManifest, maybeRemoteManifest);

await run.addBreadcrumb({
  data: {
    changed: diff.changed,
    deletes: diff.deletes,
    uploads: diff.uploads.map((file) => file.path),
  },
  detail: "Compared the local Pages artifact manifest to the live mirror manifest.",
  status: "planned",
  step: "plan",
});

if (process.env.GITHUB_OUTPUT) {
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `pages_changed=${diff.changed}\npages_artifact_hash=${localManifest.artifactHash}\npages_artifact_dir=${artifactDir}\n`,
  );
}

const summary = {
  appliedChanges: [] as string[],
  artifactDir,
  artifactHash: localManifest.artifactHash,
  command: commandName,
  discoveredRemoteState: {
    maybeRemoteManifest,
    publicOrigin: localManifest.publicOrigin,
  },
  mode: "check" as const,
  plannedChanges: {
    deletes: diff.deletes,
    uploads: diff.uploads
      .map((file) => file.path)
      .concat(diff.changed ? ["deploy-manifest.json"] : []),
  },
  resultingUrls: [localManifest.publicOrigin, deploymentConfig.primaryCanonicalOrigin],
  skippedReasons: diff.changed
    ? []
    : ["The live GitHub Pages deploy manifest already matches the built Pages artifact."],
  target: "github-pages",
  verificationResults: [
    {
      detail: maybeRemoteManifest
        ? `Compared local manifest ${localManifest.artifactHash} to live manifest ${maybeRemoteManifest.artifactHash}.`
        : "No live GitHub Pages manifest was available, so the next deploy should publish the mirror artifact.",
      name: "manifest comparison",
      status: "passed" as const,
    },
  ],
};

const { runDirectory } = await writeDeploySummary(summary, { runDirectory: run.runDirectory });
console.log(`GitHub Pages plan complete. Changed=${diff.changed}. Summary: ${runDirectory}`);

async function loadRemoteManifest(publicOrigin: string) {
  let response: Response;

  try {
    response = await fetch(`${publicOrigin}/deploy-manifest.json`, {
      headers: {
        Accept: "application/json",
      },
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as DeployManifest;
}
