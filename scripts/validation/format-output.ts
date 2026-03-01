import type { ValidationIssue } from "./rules";

export interface ValidationResult {
  strict: boolean;
  format: "human" | "json";
  success: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  strictBlockingWarnings: number;
  files: {
    profile: string;
    links: string;
    site: string;
  };
  enrichment: {
    reportPath: string;
    found: boolean;
    generatedAt?: string;
    failureMode?: "immediate" | "aggregate";
    failOn?: Array<"fetch_failed" | "metadata_missing">;
    bypassActive?: boolean;
    abortedEarly?: boolean;
    summary?: {
      total: number;
      fetched: number;
      partial: number;
      failed: number;
      skipped: number;
    };
  };
}

export const formatHumanOutput = (result: ValidationResult): string => {
  const lines: string[] = [];
  const totalErrors = result.errors.length;
  const totalWarnings = result.warnings.length;

  lines.push(`OpenLinks data validation (${result.strict ? "strict" : "standard"} mode)`);
  lines.push(
    `Files: profile=${result.files.profile}, links=${result.files.links}, site=${result.files.site}`,
  );
  lines.push(
    `Enrichment report: ${result.enrichment.found ? "found" : "missing"} (${result.enrichment.reportPath})`,
  );
  if (result.enrichment.summary) {
    const summary = result.enrichment.summary;
    lines.push(
      `Enrichment summary: total=${summary.total}, fetched=${summary.fetched}, partial=${summary.partial}, failed=${summary.failed}, skipped=${summary.skipped}`,
    );
  }
  if (result.enrichment.failureMode || result.enrichment.failOn) {
    const failureMode = result.enrichment.failureMode ?? "immediate";
    const failOn = result.enrichment.failOn?.join(", ") ?? "fetch_failed, metadata_missing";
    lines.push(`Enrichment policy: failureMode=${failureMode}, failOn=${failOn}`);
  }
  if (typeof result.enrichment.bypassActive === "boolean") {
    lines.push(`Enrichment bypass active: ${result.enrichment.bypassActive ? "yes" : "no"}`);
  }
  if (result.enrichment.abortedEarly) {
    lines.push("Enrichment run aborted early due to immediate failure mode.");
  }
  lines.push(
    `Errors: ${totalErrors} | Warnings: ${totalWarnings} | Strict-blocking warnings: ${result.strictBlockingWarnings}`,
  );

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
      const strictNote = issue.strictBlocking === false ? " [non-strict-blocking]" : "";
      lines.push(`- [${issue.source}] ${issue.path}${strictNote}: ${issue.message}`);
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
