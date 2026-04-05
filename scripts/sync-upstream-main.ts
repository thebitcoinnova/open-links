import process from "node:process";
import { renderUpstreamSyncCliOutput } from "./lib/upstream-sync-cli-output";
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
    process.stdout.write(renderUpstreamSyncCliOutput(result));
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
