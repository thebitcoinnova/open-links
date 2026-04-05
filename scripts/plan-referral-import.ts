import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ReferralCatalogPayload } from "../src/lib/content/referral-catalog";
import type { ReferralInboxCandidateInput } from "./referrals/import-contract";
import {
  DEFAULT_LINKS_PATH,
  DEFAULT_LOCAL_REFERRAL_CATALOG_PATH,
  DEFAULT_REFERRAL_IMPORT_INPUT_PATH,
  DEFAULT_REFERRAL_IMPORT_PLAN_PATH,
  DEFAULT_REFERRAL_IMPORT_RESOLVED_PATH,
  DEFAULT_SHARED_REFERRAL_CATALOG_PATH,
} from "./referrals/import-contract";
import { buildReferralImportPlan, renderReferralImportPlanTable } from "./referrals/import-planner";

interface CliArgs {
  inputPath: string;
  outputPath: string;
  linksPath: string;
  sharedCatalogPath: string;
  localCatalogPath: string;
  showHelp: boolean;
}

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
  inputPath: getFlagValue(argv, "--input") ?? DEFAULT_REFERRAL_IMPORT_INPUT_PATH,
  outputPath: getFlagValue(argv, "--output") ?? DEFAULT_REFERRAL_IMPORT_PLAN_PATH,
  linksPath: getFlagValue(argv, "--links") ?? DEFAULT_LINKS_PATH,
  sharedCatalogPath: getFlagValue(argv, "--shared-catalog") ?? DEFAULT_SHARED_REFERRAL_CATALOG_PATH,
  localCatalogPath: getFlagValue(argv, "--local-catalog") ?? DEFAULT_LOCAL_REFERRAL_CATALOG_PATH,
  showHelp: argv.includes("--help"),
});

const printHelp = (): void => {
  console.log(
    [
      "Plan a batch referral import from a gitignored inbox-candidate JSON file.",
      "",
      "Usage:",
      "  bun run referrals:import:plan -- --input <path> [--output <path>] [--links <path>]",
      "    [--shared-catalog <path>] [--local-catalog <path>]",
      "",
      `Default input: ${DEFAULT_REFERRAL_IMPORT_INPUT_PATH}`,
      `Resolved candidate recommendation: ${DEFAULT_REFERRAL_IMPORT_RESOLVED_PATH}`,
    ].join("\n"),
  );
};

const readJsonFile = <T>(filePath: string): T => JSON.parse(readFileSync(filePath, "utf8")) as T;

const readOptionalJsonFile = <T>(filePath: string): T | undefined =>
  existsSync(filePath) ? readJsonFile<T>(filePath) : undefined;

const readCandidates = (filePath: string): ReferralInboxCandidateInput[] => {
  const payload = readJsonFile<
    ReferralInboxCandidateInput[] | { candidates?: ReferralInboxCandidateInput[] }
  >(filePath);

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.candidates)) {
    return payload.candidates;
  }

  throw new Error(
    "Referral import input must be a JSON array or an object with a candidates array.",
  );
};

const writeJsonFile = (filePath: string, payload: unknown): void => {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};

const main = (): void => {
  const args = parseArgs();
  if (args.showHelp) {
    printHelp();
    return;
  }

  const plan = buildReferralImportPlan({
    candidates: readCandidates(args.inputPath),
    linksPayload: readJsonFile(args.linksPath),
    sharedCatalogPayload: readOptionalJsonFile<ReferralCatalogPayload>(args.sharedCatalogPath),
    localCatalogPayload: readOptionalJsonFile<ReferralCatalogPayload>(args.localCatalogPath),
    inputPath: args.inputPath,
    linksPath: args.linksPath,
    sharedCatalogPath: args.sharedCatalogPath,
    localCatalogPath: args.localCatalogPath,
  });

  writeJsonFile(args.outputPath, plan);
  console.log(renderReferralImportPlanTable(plan));
  console.log("");
  console.log(`Wrote referral import plan to ${args.outputPath}.`);
};

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Referral import planning failed: ${message}`);
  process.exitCode = 1;
}
