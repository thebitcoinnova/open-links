import fs from "node:fs";
import path from "node:path";
import { runA11yChecks } from "./a11y";
import { runManualSmokeChecks } from "./manual-smoke";
import { runPerformanceChecks } from "./perf";
import {
  formatQualityHumanOutput,
  formatQualityJsonOutput,
  writeQualityReport,
  writeQualitySummary,
} from "./report";
import { runSeoChecks } from "./seo";
import type {
  QualityDomain,
  QualityDomainResult,
  QualityIssue,
  QualityPolicy,
  QualityProfileInput,
  QualityRunResult,
  QualitySiteInput,
} from "./types";

type OutputFormat = "human" | "json";

interface ArgMap {
  excludeDomains: QualityDomain[];
  strict: boolean;
  format: OutputFormat;
  reportPath?: string;
  summaryPath?: string;
  sitePath: string;
  profilePath: string;
}

const ROOT = process.cwd();
const ALL_QUALITY_DOMAINS = ["seo", "accessibility", "performance", "manual-smoke"] as const;

const readJson = <T>(relativePath: string): T => {
  const absolutePath = path.isAbsolute(relativePath) ? relativePath : path.join(ROOT, relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf8")) as T;
};

const parseArgs = (): ArgMap => {
  const args = process.argv.slice(2);

  const getFlagValue = (name: string): string | undefined => {
    const index = args.indexOf(name);
    if (index < 0) return undefined;
    return args[index + 1];
  };

  const formatRaw = getFlagValue("--format");
  const excludeDomains = args
    .flatMap((value, index) => {
      if (value !== "--exclude-domain") {
        return [];
      }

      const nextValue = args[index + 1];
      return typeof nextValue === "string" ? nextValue.split(",") : [];
    })
    .map((value) => value.trim())
    .filter((value): value is QualityDomain =>
      ["seo", "accessibility", "performance", "manual-smoke"].includes(value),
    );

  return {
    excludeDomains,
    strict: args.includes("--strict"),
    format: formatRaw === "json" ? "json" : "human",
    reportPath: getFlagValue("--report"),
    summaryPath: getFlagValue("--summary"),
    sitePath: getFlagValue("--site") ?? "data/site.json",
    profilePath: getFlagValue("--profile") ?? "data/profile.json",
  };
};

const collectRemediationChecklist = (issues: QualityIssue[]): Record<string, string[]> => {
  const remediation = new Map<string, Set<string>>();

  for (const issue of issues) {
    if (!remediation.has(issue.domain)) {
      remediation.set(issue.domain, new Set());
    }
    const maybeDomainEntries = remediation.get(issue.domain);
    if (maybeDomainEntries) {
      maybeDomainEntries.add(issue.remediation);
    }
  }

  const output: Record<string, string[]> = {};
  for (const [domain, entries] of remediation) {
    output[domain] = Array.from(entries);
  }

  return output;
};

const resolveBlockingDomains = (
  policy: QualityPolicy | undefined,
  excludeDomains: readonly QualityDomain[],
): QualityDomain[] => {
  const configured = policy?.blockingDomains?.filter((domain) =>
    ALL_QUALITY_DOMAINS.includes(domain),
  ) as QualityDomain[] | undefined;

  if (configured && configured.length > 0) {
    return configured.filter((domain) => !excludeDomains.includes(domain));
  }

  const defaultBlockingDomains: QualityDomain[] = ["seo", "accessibility", "performance"];
  return defaultBlockingDomains.filter((domain) => !excludeDomains.includes(domain));
};

const buildResult = (
  strict: boolean,
  reportPath: string,
  blockingDomains: QualityDomain[],
  domainResults: QualityDomainResult[],
  checklist: QualityRunResult["checklist"],
): QualityRunResult => {
  const allIssues = domainResults.flatMap((domain) => domain.issues);
  const errors = allIssues.filter((issue) => issue.level === "error");
  const warnings = allIssues.filter((issue) => issue.level === "warning");

  const blockingErrorCount = errors.filter((issue) =>
    blockingDomains.includes(issue.domain),
  ).length;

  return {
    strict,
    generatedAt: new Date().toISOString(),
    success: blockingErrorCount === 0,
    reportPath,
    blockingDomains,
    domainResults,
    errors,
    warnings,
    checklist,
    remediationChecklist: collectRemediationChecklist(allIssues),
  };
};

const run = () => {
  const args = parseArgs();

  const site = readJson<QualitySiteInput>(args.sitePath);
  const profile = readJson<QualityProfileInput>(args.profilePath);

  const qualityPolicy = site.quality;
  const reportPath =
    args.reportPath ?? qualityPolicy?.reportPath ?? "data/generated/quality-report.json";
  const summaryPath =
    args.summaryPath ?? qualityPolicy?.summaryPath ?? "data/generated/quality-report.md";

  const seoResult = runSeoChecks(site, profile);
  const a11yResult = runA11yChecks({
    rootDir: ROOT,
    strict: args.strict,
    focusContrastStrict: qualityPolicy?.accessibility?.focusContrastStrict ?? true,
    site,
  });
  const manualSmokeResult = runManualSmokeChecks({
    rootDir: ROOT,
    checklistLabels: qualityPolicy?.accessibility?.manualSmokeChecks ?? [],
  });
  const perfResult = runPerformanceChecks({
    rootDir: ROOT,
    strict: args.strict,
    site,
  });

  const domainResults: QualityDomainResult[] = [
    seoResult.domainResult,
    a11yResult,
    perfResult,
    manualSmokeResult.domainResult,
  ].filter((domainResult) => !args.excludeDomains.includes(domainResult.domain));

  const blockingDomains = resolveBlockingDomains(qualityPolicy, args.excludeDomains);
  const result = buildResult(
    args.strict,
    reportPath,
    blockingDomains,
    domainResults,
    manualSmokeResult.checks,
  );

  writeQualityReport(reportPath, result);
  writeQualitySummary(summaryPath, result);

  if (args.format === "json") {
    console.log(formatQualityJsonOutput(result));
  } else {
    console.log(formatQualityHumanOutput(result));
  }

  process.exit(result.success ? 0 : 1);
};

run();
