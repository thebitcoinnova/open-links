import { cp, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import type { BuildInfo } from "../../src/lib/build-info";
import { ensureAwsCliAvailable, loadAwsCallerIdentity } from "../lib/aws-deploy";
import { runCommand } from "../lib/command";
import { readDeployManifest } from "../lib/deploy-artifact";
import {
  type DeployVerificationResult,
  createDeployRun,
  writeDeploySummary,
} from "../lib/deploy-log";
import {
  enabledDeployTargets,
  getDeployTargetConfig,
  isPlaceholderDeployPublicOrigin,
} from "../lib/effective-deployment-config";
import { parseArgs, recordTimedAction } from "./shared";

const args = parseArgs(process.argv.slice(2));
const mode: "apply" | "check" = args.apply === "true" ? "apply" : "check";
const skipBuild = args["skip-build"] === "true";
const skipContentSync = args["skip-content-sync"] === "true";
const skipVerify = args["skip-verify"] === "true";
const includeGitHubSetup = args["include-github-setup"] === "true";
const maybeMaxWaitMs = args["max-wait-ms"]?.trim();
const commandName = "deploy:local:aws";
const target = "aws";
const defaultArtifactDir = path.resolve(".artifacts/deploy/aws");
const artifactDir = path.resolve(args.artifact ?? defaultArtifactDir);
const run = await createDeployRun({
  command: commandName,
  mode,
  target,
});

const appliedChanges: string[] = [];
const skippedReasons: string[] = [];
const verificationResults: DeployVerificationResult[] = [];
const discoveredRemoteState: Record<string, unknown> = {};
const plannedChanges: Record<string, unknown> = {
  artifactDir,
  includeGitHubSetup,
  skipBuild,
  skipContentSync,
  skipVerify,
};
let artifactHash: string | undefined;
let maybeVerifyCommitSha: string | undefined;
let resultingUrls: string[] = [];

await run.addBreadcrumb({
  data: {
    artifactDir,
    includeGitHubSetup,
    maybeMaxWaitMs,
    skipBuild,
    skipContentSync,
    skipVerify,
    target,
  },
  detail: "Starting the local-first AWS production deploy workflow.",
  status: "info",
  step: "initialize",
});

try {
  const awsEnabled = enabledDeployTargets.includes("aws");
  const awsConfig = getDeployTargetConfig("aws");
  const gitBranchStatus = runCommand("git", ["status", "--short", "--branch"]).stdout.trim();
  const dirtyPaths = runCommand("git", ["status", "--porcelain"])
    .stdout.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  Object.assign(discoveredRemoteState, {
    awsEnabled,
    awsPublicOrigin: awsConfig.publicOrigin,
    gitBranchStatus,
    gitDirtyPaths: dirtyPaths,
    githubSetupIncluded: includeGitHubSetup,
    placeholderAwsPublicOrigin: isPlaceholderDeployPublicOrigin(awsConfig.publicOrigin),
  });
  resultingUrls = [awsConfig.publicOrigin];

  if (!awsEnabled) {
    throw new Error(
      "AWS target is not enabled in the effective deployment configuration. Enable the aws target before using the local AWS deploy loop.",
    );
  }

  verificationResults.push({
    detail: `AWS target is enabled and resolves to ${awsConfig.publicOrigin}.`,
    name: "aws target",
    status: "passed",
  });

  if (isPlaceholderDeployPublicOrigin(awsConfig.publicOrigin)) {
    verificationResults.push({
      detail:
        "AWS public origin is still a placeholder value. Live verification may fail until the canonical AWS origin is configured.",
      name: "aws public origin",
      status: "skipped",
    });
  } else {
    verificationResults.push({
      detail: `AWS public origin is configured as ${awsConfig.publicOrigin}.`,
      name: "aws public origin",
      status: "passed",
    });
  }

  if (dirtyPaths.length > 0) {
    skippedReasons.push(
      `Git worktree is dirty (${dirtyPaths.length} path(s)). Local runs are allowed, but artifact hash is the authoritative proof of what was deployed.`,
    );
    verificationResults.push({
      detail:
        "Detected a dirty worktree. Local deploy verification can still be useful, but build-info commit SHA is not authoritative for uncommitted local changes.",
      name: "git worktree",
      status: "skipped",
    });
  } else {
    verificationResults.push({
      detail: "Git worktree is clean.",
      name: "git worktree",
      status: "passed",
    });
  }

  await recordTimedAction(
    run,
    {
      detail: "Validated AWS CLI access for the local-first AWS deploy loop.",
      status: "passed",
      step: "aws cli",
    },
    () => ensureAwsCliAvailable(),
  );
  const identity = await recordTimedAction(
    run,
    {
      data: (currentIdentity: ReturnType<typeof loadAwsCallerIdentity>) => ({
        accountId: currentIdentity.Account,
        arn: currentIdentity.Arn,
        userId: currentIdentity.UserId,
      }),
      detail: "Loaded the active AWS caller identity for the local-first AWS deploy loop.",
      status: "passed",
      step: "caller identity",
    },
    () => loadAwsCallerIdentity(),
  );
  Object.assign(discoveredRemoteState, { awsIdentity: identity });
  verificationResults.push({
    detail: `AWS caller identity resolved to ${identity.Arn}.`,
    name: "aws identity",
    status: "passed",
  });

  if (!skipBuild) {
    const buildCommand: [string, ...string[]] = [
      "bun",
      "run",
      "scripts/deploy/build.ts",
      "--target=aws",
      ...(skipContentSync ? ["--skip-content-sync"] : []),
    ];
    await runDeployCommand({
      applyMode: mode,
      command: buildCommand,
      detail: "Built the local AWS deployment artifact.",
      run,
      step: "build",
    });

    if (artifactDir !== defaultArtifactDir) {
      await recordTimedAction(
        run,
        {
          data: { artifactDir, sourceArtifactDir: defaultArtifactDir },
          detail: `Copied the built AWS artifact into ${artifactDir}.`,
          status: "passed",
          step: "artifact copy",
        },
        async () => {
          await rm(artifactDir, { force: true, recursive: true });
          await mkdir(path.dirname(artifactDir), { recursive: true });
          await cp(defaultArtifactDir, artifactDir, { recursive: true });
        },
      );
    }
  } else {
    skippedReasons.push("Skipped local build because --skip-build was provided.");
  }

  if (skipContentSync) {
    skippedReasons.push(
      "Skipped avatar/rich/image/social-preview/badge generation so the local AWS loop can avoid tracked content-cache churn during infra debugging.",
    );
  }

  const maybeManifest = await loadLocalArtifactManifest(artifactDir);
  if (maybeManifest) {
    artifactHash = maybeManifest.artifactHash;
    verificationResults.push({
      detail: `Loaded local AWS artifact hash ${maybeManifest.artifactHash} from ${artifactDir}.`,
      name: "artifact manifest",
      status: "passed",
    });
    Object.assign(discoveredRemoteState, {
      localArtifactManifest: {
        artifactHash: maybeManifest.artifactHash,
        publicOrigin: maybeManifest.publicOrigin,
        target: maybeManifest.target,
      },
    });
  } else if (mode === "apply") {
    throw new Error(
      `No deploy manifest was found in ${artifactDir}. Build the AWS artifact first or provide --artifact=<path> pointing at a prepared AWS artifact directory.`,
    );
  } else {
    verificationResults.push({
      detail:
        "No local AWS artifact manifest was found. Check mode can still exercise setup/bootstrap/verify, but publish/apply would require a built artifact.",
      name: "artifact manifest",
      status: "skipped",
    });
  }

  await runDeployCommand({
    applyMode: mode,
    command: [
      "bun",
      "run",
      "scripts/deploy/setup-aws.ts",
      ...(mode === "apply" ? ["--apply"] : []),
    ],
    detail:
      mode === "apply"
        ? "Applied AWS setup reconciliation for the local-first deploy loop."
        : "Checked AWS setup state for the local-first deploy loop.",
    run,
    step: "aws setup",
  });

  if (includeGitHubSetup) {
    const githubSetupCommand: [string, ...string[]] = [
      "bun",
      "run",
      "scripts/deploy/setup-github.ts",
      ...(mode === "apply" ? ["--apply"] : []),
    ];
    await runDeployCommand({
      applyMode: mode,
      command: githubSetupCommand,
      detail:
        mode === "apply"
          ? "Applied optional GitHub setup reconciliation."
          : "Checked optional GitHub setup state.",
      run,
      step: "github setup",
    });
  } else {
    skippedReasons.push(
      "Skipped GitHub setup because --include-github-setup was not provided; local AWS proof does not require GitHub admin access by default.",
    );
  }

  const bootstrapBaseCommand: [string, ...string[]] = [
    "bun",
    "run",
    "scripts/deploy/bootstrap-aws.ts",
  ];
  if (maybeMaxWaitMs) {
    bootstrapBaseCommand.push(`--max-wait-ms=${maybeMaxWaitMs}`);
  }

  if (mode === "apply") {
    const bootstrapApplyCommand: [string, ...string[]] = [...bootstrapBaseCommand, "--apply"];
    await runDeployCommand({
      applyMode: mode,
      command: bootstrapBaseCommand,
      detail: "Ran the AWS bootstrap dry pass before local apply.",
      run,
      step: "bootstrap check",
    });
    await runDeployCommand({
      applyMode: mode,
      command: bootstrapApplyCommand,
      detail: "Applied the AWS bootstrap step locally.",
      run,
      step: "bootstrap apply",
    });
  } else {
    await runDeployCommand({
      applyMode: mode,
      command: bootstrapBaseCommand,
      detail: "Checked the AWS bootstrap step locally.",
      run,
      step: "bootstrap check",
    });
  }

  if (mode === "apply") {
    const publishCommand: [string, ...string[]] = [
      "bun",
      "run",
      "scripts/deploy/publish.ts",
      "--target=aws",
      `--artifact=${artifactDir}`,
      "--apply",
    ];
    if (maybeMaxWaitMs) {
      publishCommand.push(`--max-wait-ms=${maybeMaxWaitMs}`);
    }

    await runDeployCommand({
      applyMode: mode,
      command: publishCommand,
      detail: `Published the local AWS artifact from ${artifactDir}.`,
      run,
      step: "publish",
    });
  } else {
    skippedReasons.push(
      "Skipped AWS publish because check mode does not execute remote mutations.",
    );
  }

  if (!skipVerify) {
    maybeVerifyCommitSha =
      mode === "apply"
        ? resolveLocalExpectedCommitSha()
        : await loadLiveExpectedCommitSha(awsConfig.publicOrigin);
    Object.assign(discoveredRemoteState, {
      verifyExpectedCommitSha: maybeVerifyCommitSha ?? null,
      verifyStrategy: mode === "apply" ? "local-head" : "live-build-info",
    });
    const verifyCommand: [string, ...string[]] = [
      "bun",
      "run",
      "scripts/deploy/verify.ts",
      "--target=aws",
      ...(maybeVerifyCommitSha ? [`--expect-commit-sha=${maybeVerifyCommitSha}`] : []),
    ];
    await runDeployCommand({
      applyMode: mode,
      command: verifyCommand,
      detail: "Verified the live AWS deployment target.",
      run,
      step: "verify",
    });
  } else {
    skippedReasons.push("Skipped live verification because --skip-verify was provided.");
  }

  const { runDirectory } = await writeDeploySummary(
    {
      appliedChanges,
      artifactDir,
      artifactHash,
      command: commandName,
      discoveredRemoteState,
      mode,
      plannedChanges,
      resultingUrls,
      skippedReasons,
      target,
      verificationResults,
    },
    { runDirectory: run.runDirectory },
  );

  console.log(`Local AWS deploy ${mode} complete. Summary: ${runDirectory}`);
} catch (error) {
  const errorDetail = error instanceof Error ? error.message : String(error);
  verificationResults.push({
    detail: errorDetail,
    name: "local aws deploy",
    status: "failed",
  });

  const { runDirectory } = await writeDeploySummary(
    {
      appliedChanges,
      artifactDir,
      artifactHash,
      command: commandName,
      discoveredRemoteState,
      mode,
      plannedChanges,
      resultingUrls,
      skippedReasons,
      target,
      verificationResults,
    },
    { runDirectory: run.runDirectory },
  );

  throw new Error(`${errorDetail}\nSee ${runDirectory}.`);
}

async function loadLocalArtifactManifest(maybeArtifactDir: string) {
  const manifestPath = path.join(maybeArtifactDir, "deploy-manifest.json");

  try {
    await readFile(manifestPath, "utf8");
    return await readDeployManifest(manifestPath);
  } catch {
    return null;
  }
}

async function loadLiveExpectedCommitSha(publicOrigin: string) {
  try {
    const response = await fetch(new URL("/build-info.json", publicOrigin));
    if (!response.ok) {
      return undefined;
    }

    const buildInfo = (await response.json()) as BuildInfo;
    const commitSha = buildInfo.commitSha.trim();
    return commitSha.length > 0 ? commitSha : undefined;
  } catch {
    return undefined;
  }
}

function resolveLocalExpectedCommitSha() {
  const commitSha = runCommand("git", ["rev-parse", "HEAD"]).stdout.trim();
  return commitSha.length > 0 ? commitSha : undefined;
}

async function runDeployCommand(input: {
  applyMode: "apply" | "check";
  command: [string, ...string[]];
  detail: string;
  run: Awaited<ReturnType<typeof createDeployRun>>;
  step: string;
}) {
  const renderedCommand = input.command.join(" ");

  await recordTimedAction(
    input.run,
    {
      data: { command: renderedCommand },
      detail: input.detail,
      status: "passed",
      step: input.step,
    },
    () => runCommand(input.command[0], input.command.slice(1)),
  );

  const commandKind = input.applyMode === "apply" ? "Applied" : "Checked";
  verificationResults.push({
    detail: `${commandKind} via \`${renderedCommand}\`.`,
    name: input.step,
    status: "passed",
  });

  if (
    input.applyMode === "apply" &&
    ["build", "aws setup", "github setup", "bootstrap apply", "publish"].includes(input.step)
  ) {
    appliedChanges.push(input.detail);
  }
}
