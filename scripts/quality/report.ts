import fs from "node:fs";
import path from "node:path";
import type { QualityRunResult } from "./types";

const formatIssue = (prefix: string, issue: QualityRunResult["errors"][number]) => {
  const scope = issue.scope ? ` (${issue.scope})` : "";
  const metric = issue.metric ? ` [${issue.metric}]` : "";
  const expected = issue.expected !== undefined ? ` expected=${issue.expected}` : "";
  const actual = issue.actual !== undefined ? ` actual=${issue.actual}` : "";

  return `${prefix} [${issue.domain}]${scope}${metric} ${issue.message}${actual}${expected}\n  Fix: ${issue.remediation}`;
};

export const formatQualityHumanOutput = (result: QualityRunResult): string => {
  const lines: string[] = [];

  lines.push(`OpenLinks quality checks (${result.strict ? "strict" : "standard"} mode)`);
  lines.push(`Blocking domains: ${result.blockingDomains.join(", ")}`);
  lines.push(`Report path: ${result.reportPath}`);
  lines.push(`Errors: ${result.errors.length} | Warnings: ${result.warnings.length}`);

  lines.push("", "Domain status:");
  for (const domain of result.domainResults) {
    lines.push(`- ${domain.domain}: ${domain.status} — ${domain.summary}`);
  }

  if (result.errors.length > 0) {
    lines.push("", "Errors:");
    for (const issue of result.errors) {
      lines.push(formatIssue("-", issue));
    }
  }

  if (result.warnings.length > 0) {
    lines.push("", "Warnings:");
    for (const issue of result.warnings) {
      lines.push(formatIssue("-", issue));
    }
  }

  if (result.checklist.length > 0) {
    lines.push("", "Manual smoke checklist:");
    for (const check of result.checklist) {
      lines.push(`- [${check.status}] ${check.label}`);
      lines.push(`  Details: ${check.details}`);
      if (check.remediation) {
        lines.push(`  Fix: ${check.remediation}`);
      }
    }
  }

  lines.push("", "Remediation checklist:");
  const domains = Object.keys(result.remediationChecklist);
  if (domains.length === 0) {
    lines.push("- none");
  } else {
    for (const domain of domains) {
      lines.push(`- ${domain}`);
      for (const entry of result.remediationChecklist[domain]) {
        lines.push(`  - ${entry}`);
      }
    }
  }

  return lines.join("\n");
};

export const formatQualityJsonOutput = (result: QualityRunResult): string =>
  JSON.stringify(result, null, 2);

export const writeQualityReport = (reportPath: string, result: QualityRunResult) => {
  const absolutePath = path.isAbsolute(reportPath)
    ? reportPath
    : path.join(process.cwd(), reportPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, formatQualityJsonOutput(result));
};

export const writeQualitySummary = (summaryPath: string, result: QualityRunResult) => {
  const absolutePath = path.isAbsolute(summaryPath)
    ? summaryPath
    : path.join(process.cwd(), summaryPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, formatQualityHumanOutput(result));
};
