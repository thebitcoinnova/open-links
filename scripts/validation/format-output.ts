import type { ValidationIssue } from "./rules";

export interface ValidationResult {
  strict: boolean;
  format: "human" | "json";
  success: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  files: {
    profile: string;
    links: string;
    site: string;
  };
}

export const formatHumanOutput = (result: ValidationResult): string => {
  const lines: string[] = [];
  const totalErrors = result.errors.length;
  const totalWarnings = result.warnings.length;

  lines.push(`OpenLinks data validation (${result.strict ? "strict" : "standard"} mode)`);
  lines.push(
    `Files: profile=${result.files.profile}, links=${result.files.links}, site=${result.files.site}`
  );
  lines.push(`Errors: ${totalErrors} | Warnings: ${totalWarnings}`);

  if (totalErrors > 0) {
    lines.push("", "Errors:");
    for (const issue of result.errors) {
      lines.push(`- [${issue.source}] ${issue.path}: ${issue.message}`);
      lines.push(`  Fix: ${issue.remediation}`);
    }
  }

  if (totalWarnings > 0) {
    lines.push("", "Warnings:");
    for (const issue of result.warnings) {
      lines.push(`- [${issue.source}] ${issue.path}: ${issue.message}`);
      lines.push(`  Fix: ${issue.remediation}`);
    }
  }

  if (totalErrors === 0 && totalWarnings === 0) {
    lines.push("No issues found.");
  }

  return lines.join("\n");
};

export const formatJsonOutput = (result: ValidationResult): string =>
  JSON.stringify(result, null, 2);
