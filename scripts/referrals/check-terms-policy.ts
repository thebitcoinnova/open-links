import { checkReferralTermsPolicy } from "./terms-policy";

interface CliArgs {
  format: "json" | "text";
  showHelp: boolean;
  termsUrl?: string;
  url?: string;
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

const parseArgs = (argv = process.argv.slice(2)): CliArgs => {
  const maybeFormat = getFlagValue(argv, "--format");

  return {
    format: maybeFormat === "json" ? "json" : "text",
    showHelp: argv.includes("--help"),
    termsUrl: getFlagValue(argv, "--terms-url"),
    url: getFlagValue(argv, "--url"),
  };
};

const printHelp = (): void => {
  console.log(
    [
      "Check official referral terms for public-sharing restrictions.",
      "",
      "Usage:",
      "  bun run referrals:terms:check -- --url <referral-url> [--terms-url <terms-url>] [--format json|text]",
    ].join("\n"),
  );
};

const main = async (): Promise<void> => {
  const args = parseArgs();

  if (args.showHelp) {
    printHelp();
    return;
  }

  if (!args.url) {
    throw new Error("Missing required --url <referral-url>.");
  }

  const result = await checkReferralTermsPolicy({
    referralUrl: args.url,
    termsUrl: args.termsUrl,
  });

  if (args.format === "json") {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Policy status: ${result.status}`);
  console.log(`Normalized source URL: ${result.normalizedSourceUrl}`);
  if (result.checkedUrl) {
    console.log(`Checked URL: ${result.checkedUrl}`);
  }
  if (result.matchedRuleId) {
    console.log(`Matched rule: ${result.matchedRuleId}`);
  }
  if (result.evidenceSnippet) {
    console.log(`Evidence: ${result.evidenceSnippet}`);
  }
  if (result.reason) {
    console.log(`Reason: ${result.reason}`);
  }
};

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Referral terms policy check failed: ${message}`);
  process.exitCode = 1;
}
