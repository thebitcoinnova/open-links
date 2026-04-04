import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ReferralCatalogPayload } from "../src/lib/content/referral-catalog";
import type { ReferralImportPlan } from "./referrals/import-contract";
import {
  DEFAULT_LINKS_PATH,
  DEFAULT_LOCAL_REFERRAL_CATALOG_PATH,
  DEFAULT_REFERRAL_IMPORT_PLAN_PATH,
} from "./referrals/import-contract";
import { applyReferralImportPlan, defaultSelectedCandidateIds } from "./referrals/import-planner";

interface CliArgs {
  planPath: string;
  linksPath: string;
  localCatalogPath: string;
  applyAllPlanned: boolean;
  onlyCandidateIds?: string[];
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
  planPath: getFlagValue(argv, "--proposal") ?? DEFAULT_REFERRAL_IMPORT_PLAN_PATH,
  linksPath: getFlagValue(argv, "--links") ?? DEFAULT_LINKS_PATH,
  localCatalogPath: getFlagValue(argv, "--local-catalog") ?? DEFAULT_LOCAL_REFERRAL_CATALOG_PATH,
  applyAllPlanned: argv.includes("--all-planned"),
  onlyCandidateIds: getFlagValue(argv, "--only")
    ?.split(",")
    .map((candidateId) => candidateId.trim())
    .filter((candidateId) => candidateId.length > 0),
  showHelp: argv.includes("--help"),
});

const printHelp = (): void => {
  console.log(
    [
      "Apply a reviewed referral import proposal to data/links.json and the fork-local catalog overlay.",
      "",
      "Usage:",
      "  bun run referrals:import:apply -- --proposal <path> --all-planned",
      "  bun run referrals:import:apply -- --proposal <path> --only <candidate-a,candidate-b>",
    ].join("\n"),
  );
};

const readJsonFile = <T>(filePath: string): T => JSON.parse(readFileSync(filePath, "utf8")) as T;

const readOptionalJsonFile = <T>(filePath: string): T | undefined =>
  existsSync(filePath) ? readJsonFile<T>(filePath) : undefined;

const writeJsonFile = (filePath: string, payload: unknown): void => {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};

const resolveSelection = (args: CliArgs, plan: ReferralImportPlan): string[] => {
  if (args.onlyCandidateIds && args.onlyCandidateIds.length > 0) {
    return args.onlyCandidateIds;
  }

  if (args.applyAllPlanned) {
    return defaultSelectedCandidateIds(plan);
  }

  throw new Error("Choose either --all-planned or --only <candidate-a,candidate-b>.");
};

const main = (): void => {
  const args = parseArgs();
  if (args.showHelp) {
    printHelp();
    return;
  }

  const plan = readJsonFile<ReferralImportPlan>(args.planPath);
  const selection = resolveSelection(args, plan);
  const result = applyReferralImportPlan({
    plan,
    linksPayload: readJsonFile(args.linksPath),
    localCatalogPayload: readOptionalJsonFile<ReferralCatalogPayload & { $schema?: string }>(
      args.localCatalogPath,
    ),
    selectedCandidateIds: selection,
  });

  writeJsonFile(args.linksPath, result.linksPayload);
  writeJsonFile(args.localCatalogPath, result.localCatalogPayload);

  console.log(
    `Applied referral import candidates: ${result.appliedCandidateIds.join(", ") || "(none)"}`,
  );
  if (result.skippedCandidateIds.length > 0) {
    console.log(`Skipped candidates: ${result.skippedCandidateIds.join(", ")}`);
  }

  if (result.sharedCatalogNotes.length > 0) {
    console.log("");
    console.log("Shared catalog follow-up:");
    for (const note of result.sharedCatalogNotes) {
      console.log(`- ${note}`);
    }
  }
};

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Referral import apply failed: ${message}`);
  process.exitCode = 1;
}
