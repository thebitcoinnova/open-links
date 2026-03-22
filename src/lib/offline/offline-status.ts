export type ConnectivityStatus = "online" | "offline";
export type OfflineResourceFailureReason = "missing" | "network";
export type OfflineAwareLoadStatus = "available" | "loading" | "unavailable";

export type OfflineResourceState<T> =
  | {
      status: "available";
      value: T;
    }
  | {
      status: "unavailable";
      reason: OfflineResourceFailureReason;
    };

export interface AnalyticsOverviewMessageInput {
  connectivity: ConnectivityStatus;
  entryCount: number;
  status: OfflineAwareLoadStatus;
  unavailableReason?: OfflineResourceFailureReason;
}

export interface FollowerHistoryEmptyStateMessageInput {
  connectivity: ConnectivityStatus;
  status: Exclude<OfflineAwareLoadStatus, "loading">;
  unavailableReason?: OfflineResourceFailureReason;
}

export const buildAvailableOfflineResource = <T>(value: T): OfflineResourceState<T> => ({
  status: "available",
  value,
});

export const buildUnavailableOfflineResource = (
  reason: OfflineResourceFailureReason,
): OfflineResourceState<never> => ({
  status: "unavailable",
  reason,
});

export const readConnectivityStatus = (): ConnectivityStatus => {
  if (typeof navigator === "undefined") {
    return "online";
  }

  return navigator.onLine === false ? "offline" : "online";
};

export const resolveAnalyticsOverviewMessage = (
  input: AnalyticsOverviewMessageInput,
): string | null => {
  if (input.status === "loading") {
    return "Loading follower history…";
  }

  if (input.status === "unavailable") {
    if (input.unavailableReason === "missing") {
      return "No public follower history is published yet.";
    }

    return input.connectivity === "offline"
      ? "Follower history is unavailable offline until analytics has been loaded online once."
      : "Follower history could not be loaded.";
  }

  if (input.entryCount === 0) {
    return "No public follower history is published yet.";
  }

  return null;
};

export const resolveFollowerHistoryEmptyStateMessage = (
  input: FollowerHistoryEmptyStateMessageInput,
): string => {
  if (input.status === "unavailable") {
    if (input.unavailableReason === "missing") {
      return "No follower history is available for this chart yet.";
    }

    return input.connectivity === "offline"
      ? "History is unavailable offline until this chart has been loaded online once."
      : "Follower history could not be loaded.";
  }

  return "No history in this range yet.";
};
