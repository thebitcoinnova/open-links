import process from "node:process";
import { runUpstreamSync } from "./lib/upstream-sync";
import { renderUpstreamSyncCliOutput } from "./lib/upstream-sync-cli-output";

interface CliArgs {
  branch?: string;
  json: boolean;
  remote?: string;
}

const getFlagValue = (args: string[], flag: string): string | undefined => {
  const flagWithEquals = `${flag}=`;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument.startsWith(flagWithEquals)) {
      return argument.slice(flagWithEquals.length);
    }

    if (argument === flag) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${flag}.`);
      }
      return value;
    }
  }

  return undefined;
};

const parseArgs = (argv = process.argv.slice(2)): CliArgs => {
  const args: CliArgs = {
    json: false,
  };

  for (const argument of argv) {
    if (argument === "--json") {
      args.json = true;
    }
  }

  args.branch = getFlagValue(argv, "--branch")?.trim();
  args.remote = getFlagValue(argv, "--remote")?.trim();

  return args;
};

const run = () => {
  const args = parseArgs();
  const result = runUpstreamSync({
    branch: args.branch,
    remote: args.remote,
  });

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(renderUpstreamSyncCliOutput(result));
  }

  if (result.status === "conflict" || result.status === "failed") {
    process.exitCode = 1;
  }
};

try {
  run();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
