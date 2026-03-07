import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import type {
  EnrichmentFailureMode,
  EnrichmentFailureReason,
  EnrichmentMissingField,
  EnrichmentRunEntry,
  EnrichmentRunReport,
  EnrichmentRunSummary,
  ExpectedSocialProfileField,
  SupportedSocialProfilePlatform,
} from "./types";

export interface WriteEnrichmentReportInput {
  reportPath: string;
  generatedAt: string;
  strict: boolean;
  entries: EnrichmentRunEntry[];
  failureMode?: EnrichmentFailureMode;
  failOn?: EnrichmentFailureReason[];
  bypassActive?: boolean;
  abortedEarly?: boolean;
}

const ROOT = process.cwd();

const absolutePath = (value: string): string =>
  path.isAbsolute(value) ? value : path.join(ROOT, value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const FAILURE_REASONS: EnrichmentFailureReason[] = ["fetch_failed", "metadata_missing"];
const FAILURE_MODES: EnrichmentFailureMode[] = ["immediate", "aggregate"];
const MISSING_FIELDS: EnrichmentMissingField[] = ["title", "description", "image"];
const PROFILE_FIELDS: ExpectedSocialProfileField[] = [
  "profileImage",
  "followersCount",
  "followingCount",
  "subscribersCount",
];
const PROFILE_PLATFORMS: SupportedSocialProfilePlatform[] = [
  "facebook",
  "github",
  "instagram",
  "primal",
  "x",
  "youtube",
];

const isFailureReason = (value: unknown): value is EnrichmentFailureReason =>
  typeof value === "string" && FAILURE_REASONS.includes(value as EnrichmentFailureReason);

const isFailureMode = (value: unknown): value is EnrichmentFailureMode =>
  typeof value === "string" && FAILURE_MODES.includes(value as EnrichmentFailureMode);

const isMissingField = (value: unknown): value is EnrichmentMissingField =>
  typeof value === "string" && MISSING_FIELDS.includes(value as EnrichmentMissingField);

const isProfileField = (value: unknown): value is ExpectedSocialProfileField =>
  typeof value === "string" && PROFILE_FIELDS.includes(value as ExpectedSocialProfileField);

const isProfilePlatform = (value: unknown): value is SupportedSocialProfilePlatform =>
  typeof value === "string" && PROFILE_PLATFORMS.includes(value as SupportedSocialProfilePlatform);

const toFailOn = (value: unknown): EnrichmentFailureReason[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const unique: EnrichmentFailureReason[] = [];
  for (const item of value) {
    if (isFailureReason(item) && !unique.includes(item)) {
      unique.push(item);
    }
  }

  return unique.length > 0 ? unique : undefined;
};

const toMissingFields = (value: unknown): EnrichmentMissingField[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const fields = value.filter(isMissingField);
  return fields.length > 0 ? fields : undefined;
};

const toMissingProfileFields = (value: unknown): ExpectedSocialProfileField[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const fields = value.filter(isProfileField);
  return fields.length > 0 ? fields : undefined;
};

export const summarizeEntries = (entries: EnrichmentRunEntry[]): EnrichmentRunSummary => {
  const summary: EnrichmentRunSummary = {
    total: entries.length,
    fetched: 0,
    partial: 0,
    failed: 0,
    skipped: 0,
  };

  for (const entry of entries) {
    summary[entry.status] += 1;
  }

  return summary;
};

export const createEnrichmentReport = ({
  generatedAt,
  strict,
  entries,
  failureMode,
  failOn,
  bypassActive,
  abortedEarly,
}: Omit<WriteEnrichmentReportInput, "reportPath">): EnrichmentRunReport => ({
  generatedAt,
  strict,
  summary: summarizeEntries(entries),
  entries,
  failureMode,
  failOn,
  bypassActive,
  abortedEarly,
});

export const writeEnrichmentReport = (input: WriteEnrichmentReportInput): EnrichmentRunReport => {
  const report = createEnrichmentReport(input);
  const outputPath = absolutePath(input.reportPath);
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
    metadata: isRecord(value.metadata)
      ? (value.metadata as EnrichmentRunEntry["metadata"])
      : undefined,
    blocking: typeof value.blocking === "boolean" ? value.blocking : undefined,
    missingFields: toMissingFields(value.missingFields),
    manualFallbackUsed:
      typeof value.manualFallbackUsed === "boolean" ? value.manualFallbackUsed : undefined,
    extractorId: typeof value.extractorId === "string" ? value.extractorId : undefined,
    cacheKey: typeof value.cacheKey === "string" ? value.cacheKey : undefined,
    cacheCapturedAt: typeof value.cacheCapturedAt === "string" ? value.cacheCapturedAt : undefined,
    staleCache: typeof value.staleCache === "boolean" ? value.staleCache : undefined,
    supportedProfilePlatform: isProfilePlatform(value.supportedProfilePlatform)
      ? value.supportedProfilePlatform
      : undefined,
    missingProfileFields: toMissingProfileFields(value.missingProfileFields),
  };
};

export const readEnrichmentReport = (reportPath: string): EnrichmentRunReport | null => {
  const absolute = absolutePath(reportPath);

  if (!fs.existsSync(absolute)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(absolute, "utf8")) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }

    const entriesInput = Array.isArray(parsed.entries) ? parsed.entries : [];
    const entries = entriesInput
      .map(toEntry)
      .filter((entry): entry is EnrichmentRunEntry => entry !== null);

    return {
      generatedAt:
        typeof parsed.generatedAt === "string" ? parsed.generatedAt : new Date(0).toISOString(),
      strict: parsed.strict === true,
      summary: summarizeEntries(entries),
      entries,
      failureMode: isFailureMode(parsed.failureMode) ? parsed.failureMode : undefined,
      failOn: toFailOn(parsed.failOn),
      bypassActive: typeof parsed.bypassActive === "boolean" ? parsed.bypassActive : undefined,
      abortedEarly: typeof parsed.abortedEarly === "boolean" ? parsed.abortedEarly : undefined,
    };
  } catch {
    return null;
  }
};
