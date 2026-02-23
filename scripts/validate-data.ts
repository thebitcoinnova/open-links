import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { readEnrichmentReport } from "./enrichment/report";
import type { EnrichmentRunEntry, EnrichmentRunReport, EnrichmentRunSummary } from "./enrichment/types";
import { runPolicyRules, type ValidationIssue } from "./validation/rules";
import {
  formatHumanOutput,
  formatJsonOutput,
  type ValidationResult
} from "./validation/format-output";

type OutputFormat = "human" | "json";

type ArgMap = {
  strict: boolean;
  format: OutputFormat;
  profilePath: string;
  linksPath: string;
  sitePath: string;
  enrichmentReportPath?: string;
};

const ROOT = process.cwd();

const absolutePath = (value: string): string =>
  path.isAbsolute(value) ? value : path.join(ROOT, value);

const readJsonFile = <T>(relativePath: string): T => {
  const absolute = absolutePath(relativePath);
  return JSON.parse(fs.readFileSync(absolute, "utf8")) as T;
};

const parseArgs = (): ArgMap => {
  const args = process.argv.slice(2);

  const getFlagValue = (name: string): string | undefined => {
    const index = args.indexOf(name);
    if (index < 0) return undefined;
    return args[index + 1];
  };

  const formatRaw = getFlagValue("--format");
  const format: OutputFormat = formatRaw === "json" ? "json" : "human";

  return {
    strict: args.includes("--strict"),
    format,
    profilePath: getFlagValue("--profile") ?? "data/profile.json",
    linksPath: getFlagValue("--links") ?? "data/links.json",
    sitePath: getFlagValue("--site") ?? "data/site.json",
    enrichmentReportPath: getFlagValue("--enrichment-report")
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const resolveEnrichmentReportPath = (
  site: Record<string, unknown>,
  overridePath?: string
): string => {
  if (overridePath) {
    return overridePath;
  }

  const ui = isRecord(site.ui) ? site.ui : undefined;
  const richCards = ui && isRecord(ui.richCards) ? ui.richCards : undefined;
  const enrichment = richCards && isRecord(richCards.enrichment) ? richCards.enrichment : undefined;
  const reportPath = enrichment && typeof enrichment.reportPath === "string" ? enrichment.reportPath : undefined;

  return reportPath ?? "data/generated/rich-enrichment-report.json";
};

const normalizePath = (instancePath: string): string => {
  if (!instancePath || instancePath === "/") {
    return "$";
  }
  return `$${instancePath.replaceAll("/", ".")}`;
};

const schemaIssue = (source: string, error: ErrorObject): ValidationIssue => {
  const fieldPath = normalizePath(error.instancePath);
  const message = error.message ?? "Validation issue";

  return {
    level: "error",
    source,
    path: fieldPath,
    message,
    remediation: `Update ${fieldPath} in ${source} to satisfy schema rule: ${message}.`
  };
};

const sortIssues = (issues: ValidationIssue[]): ValidationIssue[] =>
  [...issues].sort((left, right) => {
    if (left.source !== right.source) return left.source.localeCompare(right.source);
    if (left.path !== right.path) return left.path.localeCompare(right.path);
    return left.message.localeCompare(right.message);
  });

const enrichmentIssueLevel = (
  strict: boolean,
  status: EnrichmentRunEntry["status"]
): ValidationIssue["level"] => {
  if (status === "failed" && strict) {
    return "error";
  }

  return "warning";
};

const enrichmentIssues = (
  reportPath: string,
  report: EnrichmentRunReport | null,
  strict: boolean
): ValidationIssue[] => {
  if (!report) {
    return [
      {
        level: strict ? "error" : "warning",
        source: reportPath,
        path: "$",
        message: "Rich enrichment report not found.",
        remediation: "Run `npm run enrich:rich` before validation/build so strict-mode policy can evaluate rich-link enrichment outcomes."
      }
    ];
  }

  const issues: ValidationIssue[] = [];

  report.entries.forEach((entry, index) => {
    if (entry.status !== "failed" && entry.status !== "partial") {
      return;
    }
    if (entry.status === "partial" && strict) {
      return;
    }

    const severityLabel = entry.status === "failed" ? "failed" : "partial";
    issues.push({
      level: enrichmentIssueLevel(strict, entry.status),
      source: reportPath,
      path: `$.entries[${index}]`,
      message: `Rich enrichment ${severityLabel} for link '${entry.linkId}' (${entry.reason}). ${entry.message}`,
      remediation: entry.remediation
    });
  });

  return issues;
};

const run = () => {
  const args = parseArgs();

  const profileSchema = readJsonFile<Record<string, unknown>>("schema/profile.schema.json");
  const linksSchema = readJsonFile<Record<string, unknown>>("schema/links.schema.json");
  const siteSchema = readJsonFile<Record<string, unknown>>("schema/site.schema.json");

  const profileData = readJsonFile<Record<string, unknown>>(args.profilePath);
  const linksData = readJsonFile<Record<string, unknown>>(args.linksPath);
  const siteData = readJsonFile<Record<string, unknown>>(args.sitePath);
  const enrichmentReportPath = resolveEnrichmentReportPath(siteData, args.enrichmentReportPath);
  const enrichmentReport = readEnrichmentReport(enrichmentReportPath);

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const schemaChecks: Array<{ source: string; schema: Record<string, unknown>; data: Record<string, unknown> }> = [
    { source: args.profilePath, schema: profileSchema, data: profileData },
    { source: args.linksPath, schema: linksSchema, data: linksData },
    { source: args.sitePath, schema: siteSchema, data: siteData }
  ];

  const issues: ValidationIssue[] = [];

  for (const check of schemaChecks) {
    const validate = ajv.compile(check.schema);
    const valid = validate(check.data);
    if (!valid && validate.errors) {
      for (const error of validate.errors) {
        issues.push(schemaIssue(check.source, error));
      }
    }
  }

  issues.push(
    ...runPolicyRules({
      profile: profileData,
      links: linksData,
      site: siteData,
      sources: {
        profile: args.profilePath,
        links: args.linksPath,
        site: args.sitePath
      }
    })
  );
  issues.push(...enrichmentIssues(enrichmentReportPath, enrichmentReport, args.strict));

  const errors = sortIssues(issues.filter((issue) => issue.level === "error"));
  const warnings = sortIssues(issues.filter((issue) => issue.level === "warning"));

  const enrichmentSummary: EnrichmentRunSummary | undefined = enrichmentReport?.summary;

  const result: ValidationResult = {
    strict: args.strict,
    format: args.format,
    success: errors.length === 0 && (!args.strict || warnings.length === 0),
    errors,
    warnings,
    files: {
      profile: args.profilePath,
      links: args.linksPath,
      site: args.sitePath
    },
    enrichment: {
      reportPath: enrichmentReportPath,
      found: enrichmentReport !== null,
      generatedAt: enrichmentReport?.generatedAt,
      summary: enrichmentSummary
    }
  };

  if (args.format === "json") {
    console.log(formatJsonOutput(result));
  } else {
    console.log(formatHumanOutput(result));
  }

  process.exit(result.success ? 0 : 1);
};

run();
