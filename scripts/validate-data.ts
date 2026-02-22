import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { runPolicyRules, type ValidationIssue } from "./validation/rules";

type OutputFormat = "human" | "json";

type ArgMap = {
  strict: boolean;
  format: OutputFormat;
  profilePath: string;
  linksPath: string;
  sitePath: string;
};

interface ValidationResult {
  strict: boolean;
  format: OutputFormat;
  success: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  files: {
    profile: string;
    links: string;
    site: string;
  };
}

const ROOT = process.cwd();

const readJsonFile = <T>(relativePath: string): T => {
  const absolute = path.join(ROOT, relativePath);
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
    sitePath: getFlagValue("--site") ?? "data/site.json"
  };
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

const printHuman = (result: ValidationResult) => {
  const totalErrors = result.errors.length;
  const totalWarnings = result.warnings.length;

  console.log(`OpenLinks data validation (${result.strict ? "strict" : "standard"} mode)`);
  console.log(`Files: profile=${result.files.profile}, links=${result.files.links}, site=${result.files.site}`);
  console.log(`Errors: ${totalErrors} | Warnings: ${totalWarnings}`);

  if (totalErrors > 0) {
    console.log("\nErrors:");
    for (const issue of result.errors) {
      console.log(`- [${issue.source}] ${issue.path}: ${issue.message}`);
      console.log(`  Fix: ${issue.remediation}`);
    }
  }

  if (totalWarnings > 0) {
    console.log("\nWarnings:");
    for (const issue of result.warnings) {
      console.log(`- [${issue.source}] ${issue.path}: ${issue.message}`);
      console.log(`  Fix: ${issue.remediation}`);
    }
  }

  if (totalErrors === 0 && totalWarnings === 0) {
    console.log("No issues found.");
  }
};

const printJson = (result: ValidationResult) => {
  console.log(JSON.stringify(result, null, 2));
};

const run = () => {
  const args = parseArgs();

  const profileSchema = readJsonFile<Record<string, unknown>>("schema/profile.schema.json");
  const linksSchema = readJsonFile<Record<string, unknown>>("schema/links.schema.json");
  const siteSchema = readJsonFile<Record<string, unknown>>("schema/site.schema.json");

  const profileData = readJsonFile<Record<string, unknown>>(args.profilePath);
  const linksData = readJsonFile<Record<string, unknown>>(args.linksPath);
  const siteData = readJsonFile<Record<string, unknown>>(args.sitePath);

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

  const errors = sortIssues(issues.filter((issue) => issue.level === "error"));
  const warnings = sortIssues(issues.filter((issue) => issue.level === "warning"));

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
    }
  };

  if (args.format === "json") {
    printJson(result);
  } else {
    printHuman(result);
  }

  process.exit(result.success ? 0 : 1);
};

run();
