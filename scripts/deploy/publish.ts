import { runCommand } from "../lib/command";
import { createDeployRun, writeDeploySummary } from "../lib/deploy-log";
import { parseArgs } from "./shared";

const args = parseArgs(process.argv.slice(2));
const target = args.target?.trim();

if (!target) {
  throw new Error("Missing required flag --target=<aws|github-pages|render|railway>.");
}

const commandName = "deploy:publish";
const run = await createDeployRun({
  command: commandName,
  mode: args.apply === "true" ? "apply" : "check",
  target,
});

await run.addBreadcrumb({
  data: { args, target },
  detail: `Dispatching deployment publish flow for ${target}.`,
  status: "planned",
  step: "dispatch",
});

if (target === "aws") {
  const childArgs = ["run", "scripts/deploy/publish-aws.ts"];
  if (args.apply === "true") {
    childArgs.push("--apply");
  }
  if (args.artifact) {
    childArgs.push(`--artifact=${args.artifact}`);
  }
  if (args["max-wait-ms"]) {
    childArgs.push(`--max-wait-ms=${args["max-wait-ms"]}`);
  }

  runCommand("bun", childArgs);
} else if (target === "github-pages") {
  const childArgs = ["run", "scripts/deploy/plan-pages.ts"];
  if (args.artifact) {
    childArgs.push(`--artifact=${args.artifact}`);
  }
  runCommand("bun", childArgs);
} else {
  const { runDirectory } = await writeDeploySummary(
    {
      appliedChanges: [],
      artifactDir: undefined,
      artifactHash: undefined,
      command: commandName,
      discoveredRemoteState: { target },
      mode: args.apply === "true" ? "apply" : "check",
      plannedChanges: {
        reason:
          "Provider-native targets are published by their hosting platforms, not by this script.",
      },
      resultingUrls: [],
      skippedReasons: [
        `${target} publishes outside GitHub Actions. Use the provider-native host to publish artifacts for this target.`,
      ],
      target,
      verificationResults: [
        {
          detail: `${target} does not use the GitHub Actions publish dispatcher.`,
          name: target,
          status: "skipped",
        },
      ],
    },
    { runDirectory: run.runDirectory },
  );

  console.log(`Deployment publish skipped for ${target}. Summary: ${runDirectory}`);
  process.exit(0);
}

const { runDirectory } = await writeDeploySummary(
  {
    appliedChanges: [`Dispatched publish flow for ${target}.`],
    artifactDir: args.artifact,
    artifactHash: undefined,
    command: commandName,
    discoveredRemoteState: { args, target },
    mode: args.apply === "true" ? "apply" : "check",
    plannedChanges: { target },
    resultingUrls: [],
    skippedReasons: [],
    target,
    verificationResults: [
      {
        detail: `Publish dispatch completed for ${target}.`,
        name: target,
        status: "passed",
      },
    ],
  },
  { runDirectory: run.runDirectory },
);

console.log(`Deployment publish complete. Summary: ${runDirectory}`);
