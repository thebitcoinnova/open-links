import type {
  FollowerHistoryRow,
  FollowerHistorySource,
} from "../../src/lib/analytics/follower-history";
import type { PublicRichSyncSummary } from "../public-rich-sync";

export interface HistoryRunSnapshotSummary {
  audienceCount: number;
  audienceCountRaw: string;
  audienceKind: FollowerHistoryRow["audienceKind"];
  csvChanged?: boolean;
  csvPath: string;
  handle: string;
  label: string;
  linkId: string;
  platform: string;
  rowCount?: number;
  source: FollowerHistorySource;
}

export type HistoryRunStatus = "dry_run" | "no_snapshots" | "written";

export interface HistoryRunSummary {
  dryRun: boolean;
  indexChanged: boolean;
  indexEntryCount: number;
  observedAt: string;
  snapshotCount: number;
  snapshots: HistoryRunSnapshotSummary[];
  status: HistoryRunStatus;
}

export const resolvePublicRichSyncFailedLinkIds = (
  summary: Pick<PublicRichSyncSummary, "entries"> | null | undefined,
): Set<string> =>
  new Set(
    (summary?.entries ?? [])
      .filter((entry) => entry.status === "failed")
      .map((entry) => entry.linkId),
  );

export const resolveFreshPublicRichSyncLinkIds = (
  summary: Pick<PublicRichSyncSummary, "entries"> | null | undefined,
): Set<string> =>
  new Set(
    (summary?.entries ?? [])
      .filter(
        (entry) =>
          entry.status === "synced" ||
          (entry.status === "skipped" && entry.reason === "counts_unchanged"),
      )
      .map((entry) => entry.linkId),
  );

export const createHistoryRunSummary = (input: {
  dryRun: boolean;
  indexChanged: boolean;
  indexEntryCount: number;
  observedAt: string;
  snapshots: HistoryRunSnapshotSummary[];
  status: HistoryRunStatus;
}): HistoryRunSummary => ({
  dryRun: input.dryRun,
  indexChanged: input.indexChanged,
  indexEntryCount: input.indexEntryCount,
  observedAt: input.observedAt,
  snapshotCount: input.snapshots.length,
  snapshots: input.snapshots,
  status: input.status,
});
