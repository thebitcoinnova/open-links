import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import addFormats from "ajv-formats";

type OutputFormat = "human" | "json";

interface ValidationIssue {
  level: "error" | "warning";
  source: string;
  path: string;
  message: string;
  remediation: string;
}

interface ValidationResult {
  strict: boolean;
  format: OutputFormat;
  success: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

const ROOT = process.cwd();

const readJsonFile = <T>(relativePath: string): T => {
  const absolute = path.join(ROOT, relativePath);
  return JSON.parse(fs.readFileSync(absolute, "utf8")) as T;
};

const parseFlags = () => {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  let format: OutputFormat = "human";

  const formatIndex = args.indexOf("--format");
  if (formatIndex >= 0) {
    const maybeFormat = args[formatIndex + 1];
    if (maybeFormat === "json" || maybeFormat === "human") {
      format = maybeFormat;
    }
  }

  return {
    strict,
    format
  };
};

const normalizePath = (instancePath: string): string => {
  if (!instancePath || instancePath === "/") {
    return "$";
  }
  return `$${instancePath.replaceAll("/", ".")}`;
};

const toValidationIssue = (source: string, error: ErrorObject): ValidationIssue => {
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

const printHuman = (result: ValidationResult) => {
  const totalErrors = result.errors.length;
  const totalWarnings = result.warnings.length;

  console.log(`OpenLinks data validation (${result.strict ? "strict" : "standard"} mode)`);
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
  const { strict, format } = parseFlags();

  const profileSchema = readJsonFile<Record<string, unknown>>("schema/profile.schema.json");
  const linksSchema = readJsonFile<Record<string, unknown>>("schema/links.schema.json");
  const siteSchema = readJsonFile<Record<string, unknown>>("schema/site.schema.json");

  const profileData = readJsonFile<Record<string, unknown>>("data/profile.json");
  const linksData = readJsonFile<Record<string, unknown>>("data/links.json");
  const siteData = readJsonFile<Record<string, unknown>>("data/site.json");

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const checks: Array<{ source: string; schema: Record<string, unknown>; data: Record<string, unknown> }> = [
    { source: "data/profile.json", schema: profileSchema, data: profileData },
    { source: "data/links.json", schema: linksSchema, data: linksData },
    { source: "data/site.json", schema: siteSchema, data: siteData }
  ];

  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  for (const check of checks) {
    const validator = ajv.compile(check.schema);
    const valid = validator(check.data);

    if (!valid && validator.errors) {
      for (const issue of validator.errors) {
        errors.push(toValidationIssue(check.source, issue));
      }
    }
  }

  const result: ValidationResult = {
    strict,
    format,
    success: errors.length === 0 && (!strict || warnings.length === 0),
    errors,
    warnings
  };

  if (format === "json") {
    printJson(result);
  } else {
    printHuman(result);
  }

  process.exit(result.success ? 0 : 1);
};

run();
