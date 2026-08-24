import {
  type FollowerHistoryRow,
  normalizeFollowerHistoryRows,
} from "../../src/lib/analytics/follower-history";

export const dedupeFollowerHistoryRows = (
  rows: readonly FollowerHistoryRow[],
): FollowerHistoryRow[] => {
  const seen = new Set<string>();
  return normalizeFollowerHistoryRows(rows).filter((row) => {
    const key = [
      row.observedAt,
      row.linkId,
      row.platform,
      row.handle,
      row.canonicalUrl,
      row.audienceKind,
      row.audienceCount,
      row.audienceCountRaw,
      row.source,
    ].join("\u0000");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
