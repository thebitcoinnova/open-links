import { runCommand } from "../lib/command";
import {
  type DeployVerificationResult,
  createDeployRun,
  writeDeploySummary,
} from "../lib/deploy-log";
import { parseArgs } from "./shared";

const args = parseArgs(process.argv.slice(2));
const mode: "apply" | "check" = args.apply === "true" ? "apply" : "check";
const commandName = "deploy:setup";
const run = await createDeployRun({
  command: commandName,
  mode,
  target: "deploy-setup",
});

const childCommands = [
  buildChildCommand("scripts/deploy/setup-aws.ts", args, mode),
  buildChildCommand("scripts/deploy/setup-github.ts", args, mode),
];

await run.addBreadcrumb({
  data: { childCommands },
  detail: "Prepared the AWS and GitHub setup command sequence.",
  status: "planned",
  step: "plan",
});

const discoveredRemoteState: Array<{
  command: string;
  stderr: string;
  status: number;
  stdout: string;
}> = [];
const appliedChanges: string[] = [];
const skippedReasons: string[] = [];
const verificationResults: DeployVerificationResult[] = [];

for (const childCommand of childCommands) {
  await run.addBreadcrumb({
    detail: `Running ${childCommand.command.join(" ")}.`,
    status: "info",
    step: "child command",
  });

  const [command, ...commandArgs] = childCommand.command;
  const result = runCommand(command, commandArgs, {
    allowFailure: true,
  });

  discoveredRemoteState.push({
    command: childCommand.command.join(" "),
    stderr: result.stderr,
    status: result.status,
    stdout: result.stdout,
  });

  if (result.status !== 0) {
    verificationResults.push({
      detail:
        result.stderr.trim() || result.stdout.trim() || `${childCommand.command.join(" ")} failed.`,
      name: childCommand.label,
      status: "failed",
    });

    await run.addBreadcrumb({
      detail: `${childCommand.label} failed.`,
      status: "failed",
      step: "child command",
    });

    const { runDirectory } = await writeDeploySummary(
      {
        appliedChanges,
        artifactDir: undefined,
        artifactHash: undefined,
        command: commandName,
        discoveredRemoteState,
        mode,
        plannedChanges: { childCommands },
        resultingUrls: [],
        skippedReasons,
        target: "deploy-setup",
        verificationResults,
      },
      { runDirectory: run.runDirectory },
    );

    throw new Error(`${childCommand.label} failed. See ${runDirectory} for details.`);
  }

  const output = result.stdout.trim();
  if (mode === "apply") {
    appliedChanges.push(output || `Executed ${childCommand.label}.`);
  } else {
    skippedReasons.push(output || `Checked ${childCommand.label} without applying changes.`);
  }

  verificationResults.push({
    detail: output || `${childCommand.label} completed successfully.`,
    name: childCommand.label,
    status: "passed",
  });

  await run.addBreadcrumb({
    detail: `${childCommand.label} completed successfully.`,
    status: "passed",
    step: "child command",
  });
}

const { runDirectory } = await writeDeploySummary(
  {
    appliedChanges,
    artifactDir: undefined,
    artifactHash: undefined,
    command: commandName,
    discoveredRemoteState,
    mode,
    plannedChanges: { childCommands },
    resultingUrls: [],
    skippedReasons,
    target: "deploy-setup",
    verificationResults,
  },
  { runDirectory: run.runDirectory },
);

console.log(`Deployment setup ${mode} complete. Summary: ${runDirectory}`);

function buildChildCommand(
  scriptPath: string,
  args: Record<string, string>,
  mode: "apply" | "check",
) {
  const command: [string, ...string[]] = ["bun", "run", scriptPath];

  if (mode === "apply") {
    command.push("--apply");
  }

  if (args.repo) {
    command.push(`--repo=${args.repo}`);
  }

  if (args["role-arn"] && scriptPath.endsWith("setup-github.ts")) {
    command.push(`--role-arn=${args["role-arn"]}`);
  }

  return {
    command,
    label: scriptPath.includes("setup-aws") ? "AWS setup" : "GitHub setup",
  };
}
