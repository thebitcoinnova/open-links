import process from "node:process";
import { fetchLinktreeBootstrap } from "./bootstrap/linktree";

interface CliArgs {
  sourceUrl?: string;
  timeoutMs: number;
  retries: number;
  showHelp: boolean;
}

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_RETRIES = 1;

const parseInteger = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getFlagValue = (args: string[], flag: string): string | undefined => {
  const index = args.indexOf(flag);
  if (index < 0) {
    return undefined;
  }

  const value = args[index + 1];
  if (typeof value !== "string" || value.startsWith("--")) {
    return undefined;
  }

  return value;
};

const parseArgs = (argv = process.argv.slice(2)): CliArgs => ({
  sourceUrl: getFlagValue(argv, "--url"),
  timeoutMs: Math.max(
    1_000,
    parseInteger(getFlagValue(argv, "--timeout-ms")) ?? DEFAULT_TIMEOUT_MS,
  ),
  retries: Math.max(0, parseInteger(getFlagValue(argv, "--retries")) ?? DEFAULT_RETRIES),
  showHelp: argv.includes("--help"),
});

const printHelp = (): void => {
  console.log(
    [
      "Extract normalized bootstrap data from a Linktree URL.",
      "",
      "Usage:",
      "  bun run bootstrap:linktree -- --url <https://linktr.ee/<handle>> [--timeout-ms <ms>] [--retries <n>]",
    ].join("\n"),
  );
};

const main = async (): Promise<void> => {
  const args = parseArgs();
  if (args.showHelp) {
    printHelp();
    return;
  }

  if (!args.sourceUrl) {
    throw new Error("Missing required flag --url <https://linktr.ee/<handle>>.");
  }

  const result = await fetchLinktreeBootstrap({
    sourceUrl: args.sourceUrl,
    timeoutMs: args.timeoutMs,
    retries: args.retries,
  });

  console.log(JSON.stringify(result, null, 2));
};

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Linktree bootstrap extraction failed: ${message}`);
  process.exitCode = 1;
}
