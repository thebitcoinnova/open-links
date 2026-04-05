import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ReferralInboxCandidateInput } from "./referrals/import-contract";
import {
  DEFAULT_REFERRAL_IMPORT_INPUT_PATH,
  DEFAULT_REFERRAL_IMPORT_RESOLVED_PATH,
  DEFAULT_REFERRAL_IMPORT_RESOLVE_REPORT_PATH,
} from "./referrals/import-contract";
import { resolveReferralImportCandidates } from "./referrals/import-resolver";

interface CliArgs {
  inputPath: string;
  outputPath: string;
  reportPath: string;
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
  outputPath: getFlagValue(argv, "--output") ?? DEFAULT_REFERRAL_IMPORT_RESOLVED_PATH,
  reportPath: getFlagValue(argv, "--report") ?? DEFAULT_REFERRAL_IMPORT_RESOLVE_REPORT_PATH,
  showHelp: argv.includes("--help"),
});

const printHelp = (): void => {
  console.log(
    [
      "Resolve and audit tracking-heavy referral URLs before planning an import batch.",
      "",
      "Usage:",
      "  bun run referrals:import:resolve -- --input <path> [--output <path>] [--report <path>]",
    ].join("\n"),
  );
};

const readJsonFile = <T>(filePath: string): T => JSON.parse(readFileSync(filePath, "utf8")) as T;

const readCandidates = (filePath: string): ReferralInboxCandidateInput[] => {
  if (!existsSync(filePath)) {
    throw new Error(`Referral import resolve input '${filePath}' does not exist.`);
  }

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
    "Referral import resolve input must be a JSON array or an object with a candidates array.",
  );
};

const writeJsonFile = (filePath: string, payload: unknown): void => {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};

const main = async (): Promise<void> => {
  const args = parseArgs();
  if (args.showHelp) {
    printHelp();
    return;
  }

  const result = await resolveReferralImportCandidates({
    candidates: readCandidates(args.inputPath),
    inputPath: args.inputPath,
    outputPath: args.outputPath,
  });

  writeJsonFile(args.outputPath, result.candidates);
  writeJsonFile(args.reportPath, result.report);

  const counts = result.candidates.reduce(
    (summary, candidate) => {
      const status = candidate.resolution?.status;
      if (status === "resolved_clear") {
        summary.resolved += 1;
      } else if (status === "review_required") {
        summary.review += 1;
      } else {
        summary.unresolved += 1;
      }
      return summary;
    },
    { resolved: 0, review: 0, unresolved: 0 },
  );

  console.log(
    `Resolved referral candidates: ${counts.resolved} clear, ${counts.review} review, ${counts.unresolved} unresolved.`,
  );
  console.log(`Wrote resolved candidates to ${args.outputPath}.`);
  console.log(`Wrote redirect audit report to ${args.reportPath}.`);
};

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Referral import resolve failed: ${message}`);
  process.exitCode = 1;
}
