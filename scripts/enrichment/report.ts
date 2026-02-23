import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import type {
  EnrichmentRunEntry,
  EnrichmentRunReport,
  EnrichmentRunSummary
} from "./types";

export interface WriteEnrichmentReportInput {
  reportPath: string;
  generatedAt: string;
  strict: boolean;
  entries: EnrichmentRunEntry[];
}

const ROOT = process.cwd();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const summarizeEntries = (entries: EnrichmentRunEntry[]): EnrichmentRunSummary => {
  const summary: EnrichmentRunSummary = {
    total: entries.length,
    fetched: 0,
    partial: 0,
    failed: 0,
    skipped: 0
  };

  for (const entry of entries) {
    summary[entry.status] += 1;
  }

  return summary;
};

export const createEnrichmentReport = ({
  generatedAt,
  strict,
  entries
}: Omit<WriteEnrichmentReportInput, "reportPath">): EnrichmentRunReport => ({
  generatedAt,
  strict,
  summary: summarizeEntries(entries),
  entries
});

export const writeEnrichmentReport = (input: WriteEnrichmentReportInput): EnrichmentRunReport => {
  const report = createEnrichmentReport(input);
  const outputPath = path.join(ROOT, input.reportPath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
};

const toEntry = (value: unknown): EnrichmentRunEntry | null => {
  if (!isRecord(value)) {
    return null;
  }

  const status = value.status;
  const reason = value.reason;
  const linkId = value.linkId;
  const url = value.url;

  if (
    typeof linkId !== "string" ||
    typeof url !== "string" ||
    typeof status !== "string" ||
    typeof reason !== "string"
  ) {
    return null;
  }

  return {
    linkId,
    url,
    status: status as EnrichmentRunEntry["status"],
    reason: reason as EnrichmentRunEntry["reason"],
    attempts: typeof value.attempts === "number" ? value.attempts : 0,
    durationMs: typeof value.durationMs === "number" ? value.durationMs : 0,
    message: typeof value.message === "string" ? value.message : "",
    remediation: typeof value.remediation === "string" ? value.remediation : "",
    statusCode: typeof value.statusCode === "number" ? value.statusCode : undefined,
    metadata: isRecord(value.metadata) ? (value.metadata as EnrichmentRunEntry["metadata"]) : undefined
  };
};

export const readEnrichmentReport = (reportPath: string): EnrichmentRunReport | null => {
  const absolute = path.join(ROOT, reportPath);

  if (!fs.existsSync(absolute)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(absolute, "utf8")) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }

    const entriesInput = Array.isArray(parsed.entries) ? parsed.entries : [];
    const entries = entriesInput.map(toEntry).filter((entry): entry is EnrichmentRunEntry => entry !== null);

    return {
      generatedAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : new Date(0).toISOString(),
      strict: parsed.strict === true,
      summary: summarizeEntries(entries),
      entries
    };
  } catch {
    return null;
  }
};
