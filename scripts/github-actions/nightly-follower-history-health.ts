#!/usr/bin/env bun

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

export interface PublicAudienceSyncEntry {
  linkId: string;
  status: "synced" | "skipped" | "failed";
  reason: string;
  artifactPath?: string;
  detail?: string;
  fatal?: boolean;
}

export interface PublicAudienceSyncSummary {
  failed: number;
  fatalFailed?: number;
  entries: PublicAudienceSyncEntry[];
}

export interface HistorySnapshotSummary {
  linkId: string;
  platform: string;
  audienceCountRaw: string;
}

export interface HistoryRunSummary {
  observedAt: string;
  snapshots: HistorySnapshotSummary[];
  status: string;
}

export interface FollowerHistoryIndexEntry {
  linkId: string;
  platform: string;
  latestObservedAt: string;
  latestAudienceCountRaw: string;
}

export interface FollowerHistoryIndex {
  entries: FollowerHistoryIndexEntry[];
}

export type NightlyAudienceHealthFindingKind =
  | "capture_failure"
  | "missing_diagnostic"
  | "missing_snapshot"
  | "stale_index";

export interface NightlyAudienceHealthFinding {
  kind: NightlyAudienceHealthFindingKind;
  linkId?: string;
  platform?: string;
  reason: string;
  fatal?: boolean;
  detail?: string;
  artifactPath?: string;
  latestObservedAt?: string;
}

export interface NightlyAudienceHealthInput {
  publicRichSyncSummary?: PublicAudienceSyncSummary | null;
  historySummary?: HistoryRunSummary | null;
  followerHistoryIndex?: FollowerHistoryIndex | null;
}

export interface NightlyAudienceHealthReport {
  ok: boolean;
  findings: NightlyAudienceHealthFinding[];
  blockingFindings: NightlyAudienceHealthFinding[];
  advisoryFindings: NightlyAudienceHealthFinding[];
}

const ROOT = process.cwd();
const PUBLIC_RICH_SYNC_SUMMARY_PATH = ".ci-diagnostics/public-rich-sync-summary.json";
const HISTORY_SUMMARY_PATH = ".ci-diagnostics/nightly-follower-history-summary.json";
const FOLLOWER_HISTORY_INDEX_PATH = "public/history/followers/index.json";

const absolutePath = (value: string): string =>
  path.isAbsolute(value) ? value : path.join(ROOT, value);

const readJsonIfPresent = <T>(relativePath: string): T | null => {
  const absolute = absolutePath(relativePath);
  if (!fs.existsSync(absolute)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(absolute, "utf8")) as T;
};

const isFreshPublicObservation = (entry: PublicAudienceSyncEntry): boolean =>
  entry.status === "synced" || (entry.status === "skipped" && entry.reason === "counts_unchanged");

const findingKey = (finding: NightlyAudienceHealthFinding): string =>
  [finding.kind, finding.linkId ?? "", finding.reason].join("\u0000");

const dedupeFindings = (
  findings: readonly NightlyAudienceHealthFinding[],
): NightlyAudienceHealthFinding[] => {
  const seen = new Set<string>();
  const deduped: NightlyAudienceHealthFinding[] = [];

  for (const finding of findings) {
    const key = findingKey(finding);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(finding);
  }

  return deduped;
};

const isBlockingFinding = (finding: NightlyAudienceHealthFinding): boolean => {
  if (finding.kind === "capture_failure") {
    return finding.fatal === true;
  }

  return true;
};

export const analyzeNightlyAudienceHealth = (
  input: NightlyAudienceHealthInput,
): NightlyAudienceHealthReport => {
  const findings: NightlyAudienceHealthFinding[] = [];
  const publicSummary = input.publicRichSyncSummary;
  const historySummary = input.historySummary;
  const followerHistoryIndex = input.followerHistoryIndex;

  if (!publicSummary) {
    findings.push({
      kind: "missing_diagnostic",
      reason: "public_rich_sync_summary_missing",
      detail: `${PUBLIC_RICH_SYNC_SUMMARY_PATH} was not produced.`,
    });
  }

  if (!historySummary) {
    findings.push({
      kind: "missing_diagnostic",
      reason: "nightly_follower_history_summary_missing",
      detail: `${HISTORY_SUMMARY_PATH} was not produced.`,
    });
  }

  const failedEntries = (publicSummary?.entries ?? []).filter((entry) => entry.status === "failed");
  const failedLinkIds = new Set(failedEntries.map((entry) => entry.linkId));
  for (const entry of failedEntries) {
    findings.push({
      kind: "capture_failure",
      linkId: entry.linkId,
      reason: entry.reason,
      fatal: entry.fatal === true,
      detail: entry.detail,
      artifactPath: entry.artifactPath,
    });
  }

  if (historySummary && followerHistoryIndex) {
    const observedAt = historySummary.observedAt;
    const snapshotLinkIds = new Set(historySummary.snapshots.map((snapshot) => snapshot.linkId));
    const indexEntriesByLinkId = new Map(
      followerHistoryIndex.entries.map((entry) => [entry.linkId, entry]),
    );

    for (const entry of publicSummary?.entries.filter(isFreshPublicObservation) ?? []) {
      if (snapshotLinkIds.has(entry.linkId)) {
        continue;
      }

      const indexEntry = indexEntriesByLinkId.get(entry.linkId);
      findings.push({
        kind: "missing_snapshot",
        linkId: entry.linkId,
        platform: indexEntry?.platform,
        reason: "fresh_public_observation_missing_history_snapshot",
        artifactPath: entry.artifactPath,
        latestObservedAt: indexEntry?.latestObservedAt,
      });
    }

    for (const entry of followerHistoryIndex.entries) {
      if (entry.latestObservedAt === observedAt || failedLinkIds.has(entry.linkId)) {
        continue;
      }

      findings.push({
        kind: "stale_index",
        linkId: entry.linkId,
        platform: entry.platform,
        reason: "history_index_not_updated_for_current_run",
        latestObservedAt: entry.latestObservedAt,
        detail: `Latest history remains ${entry.latestObservedAt}; current run observed at ${observedAt}.`,
      });
    }
  }

  const dedupedFindings = dedupeFindings(findings);
  const blockingFindings = dedupedFindings.filter(isBlockingFinding);
  const advisoryFindings = dedupedFindings.filter((finding) => !isBlockingFinding(finding));
  return {
    ok: blockingFindings.length === 0,
    findings: dedupedFindings,
    blockingFindings,
    advisoryFindings,
  };
};

const formatFinding = (finding: NightlyAudienceHealthFinding): string => {
  const subject = finding.linkId ? `${finding.linkId}` : finding.reason;
  const details = [
    `kind=${finding.kind}`,
    `reason=${finding.reason}`,
    finding.fatal === undefined ? undefined : `fatal=${finding.fatal ? "yes" : "no"}`,
    finding.latestObservedAt ? `latestObservedAt=${finding.latestObservedAt}` : undefined,
    finding.artifactPath ? `artifact=${finding.artifactPath}` : undefined,
    finding.detail,
  ].filter((entry): entry is string => Boolean(entry));

  return `- ${subject}: ${details.join("; ")}`;
};

export const formatNightlyAudienceHealthReport = (report: NightlyAudienceHealthReport): string => {
  if (report.findings.length === 0) {
    return "Nightly audience health check passed.";
  }

  if (report.ok) {
    return [
      "Nightly audience health check passed with advisory findings:",
      ...report.advisoryFindings.map(formatFinding),
    ].join("\n");
  }

  const lines = ["Nightly audience health check failed:"];
  if (report.blockingFindings.length > 0) {
    lines.push("Blocking findings:");
    lines.push(...report.blockingFindings.map(formatFinding));
  }
  if (report.advisoryFindings.length > 0) {
    lines.push("Advisory findings:");
    lines.push(...report.advisoryFindings.map(formatFinding));
  }

  return lines.join("\n");
};

const runCli = (): void => {
  const report = analyzeNightlyAudienceHealth({
    publicRichSyncSummary: readJsonIfPresent<PublicAudienceSyncSummary>(
      PUBLIC_RICH_SYNC_SUMMARY_PATH,
    ),
    historySummary: readJsonIfPresent<HistoryRunSummary>(HISTORY_SUMMARY_PATH),
    followerHistoryIndex: readJsonIfPresent<FollowerHistoryIndex>(FOLLOWER_HISTORY_INDEX_PATH),
  });

  console.log(formatNightlyAudienceHealthReport(report));
  if (!report.ok) {
    process.exit(1);
  }
};

if (import.meta.main) {
  runCli();
}
