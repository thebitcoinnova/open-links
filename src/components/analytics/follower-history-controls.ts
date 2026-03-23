import type {
  FollowerHistoryMode,
  FollowerHistoryRange,
} from "../../lib/analytics/follower-history";

export const FOLLOWER_HISTORY_RANGE_OPTIONS: Array<{
  label: string;
  value: FollowerHistoryRange;
}> = [
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
  { label: "180D", value: "180d" },
  { label: "All", value: "all" },
];

export const FOLLOWER_HISTORY_MODE_OPTIONS: Array<{
  label: string;
  value: FollowerHistoryMode;
}> = [
  { label: "Raw", value: "raw" },
  { label: "Growth", value: "growth" },
];
