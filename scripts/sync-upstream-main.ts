import process from "node:process";
import { runUpstreamMainSync } from "./lib/upstream-sync-main";

interface CliArgs {
  json: boolean;
}

const parseArgs = (argv = process.argv.slice(2)): CliArgs => {
  const args: CliArgs = {
    json: false,
  };

  for (const argument of argv) {
    if (argument === "--json") {
      args.json = true;
    }
  }

  return args;
};

const run = () => {
  const args = parseArgs();
  const result = runUpstreamMainSync();

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${result.message}\n`);
    if (result.conflictingPaths.length > 0) {
      process.stdout.write(`Conflicts: ${result.conflictingPaths.join(", ")}\n`);
    }
    if (result.pushStatus !== "not_attempted" && result.pushStatus !== "not_needed") {
      process.stdout.write(`Push status: ${result.pushStatus}\n`);
    }
  }

  if (
    result.status === "conflict" ||
    result.status === "failed" ||
    result.pushStatus === "failed"
  ) {
    process.exitCode = 1;
  }
};

run();
