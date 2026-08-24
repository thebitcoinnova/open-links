import {
  FOLLOWER_HISTORY_INDEX_PUBLIC_PATH,
  type FollowerHistoryIndex,
  type FollowerHistoryRow,
  parseFollowerHistoryCsv,
  parseFollowerHistoryIndex,
} from "../lib/analytics/follower-history";
import {
  type OfflineResourceState,
  buildAvailableOfflineResource,
  buildUnavailableOfflineResource,
} from "../lib/offline/offline-status";

const historyAssetUrl = (assetPath: string): string => {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${assetPath.replace(/^\/+/, "")}`;
};

const isMissingHistoryResponse = (status: number): boolean => status === 404;

export const fetchFollowerHistoryIndex = async (): Promise<
  OfflineResourceState<FollowerHistoryIndex>
> => {
  try {
    const response = await fetch(historyAssetUrl(FOLLOWER_HISTORY_INDEX_PUBLIC_PATH));
    if (!response.ok) {
      return buildUnavailableOfflineResource(
        isMissingHistoryResponse(response.status) ? "missing" : "network",
      );
    }

    return buildAvailableOfflineResource(parseFollowerHistoryIndex(await response.json()));
  } catch {
    return buildUnavailableOfflineResource("network");
  }
};

export const fetchFollowerHistoryRows = async (
  csvPath: string,
): Promise<OfflineResourceState<FollowerHistoryRow[]>> => {
  try {
    const response = await fetch(historyAssetUrl(csvPath));
    if (!response.ok) {
      return buildUnavailableOfflineResource(
        isMissingHistoryResponse(response.status) ? "missing" : "network",
      );
    }

    return buildAvailableOfflineResource(parseFollowerHistoryCsv(await response.text()));
  } catch {
    return buildUnavailableOfflineResource("network");
  }
};
