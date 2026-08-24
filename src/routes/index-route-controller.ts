import { createMemo, createResource, createSignal } from "solid-js";
import {
  readAnalyticsPageState,
  replaceAnalyticsPageState,
  resolveAnalyticsPageHrefFromUrl,
  writeAnalyticsPageState,
} from "../lib/analytics/analytics-page-query";
import {
  type FollowerHistoryMode,
  type FollowerHistoryRange,
  type FollowerHistoryRow,
  buildFollowerHistoryAvailabilityMap,
  filterFollowerHistoryRowsByLinkId,
} from "../lib/analytics/follower-history";
import {
  type ConnectivityStatus,
  type OfflineResourceFailureReason,
  type OfflineResourceState,
  buildAvailableOfflineResource,
  readConnectivityStatus,
  resolveAnalyticsOverviewMessage,
  resolveFollowerHistoryEmptyStateMessage,
} from "../lib/offline/offline-status";
import { type UiMode, canToggleMode, persistModePreference } from "../lib/theme/mode-controller";
import {
  resolveAnalyticsNavigationVisible,
  resolveAnalyticsPageEnabled,
  resolveAnalyticsPageOpenState,
} from "../lib/ui/analytics-page-preferences";
import { resolvePublicPageView } from "../lib/ui/public-page-view";
import { fetchFollowerHistoryIndex, fetchFollowerHistoryRows } from "./follower-history-data";
import { content, modePolicy, profileQrSiteLogoUrl, themeSelection } from "./index-route-config";
import {
  type QrDialogTarget,
  resolveLinkQrDialogTarget,
  resolveProfileQrDialogTarget,
} from "./index.helpers";

type PageViewKey = "analytics" | "links";

const createRouteSignals = () => {
  const analyticsPageEnabled = resolveAnalyticsPageEnabled(content.site);
  const [connectivity, setConnectivity] = createSignal<ConnectivityStatus>("online");
  const [mode, setMode] = createSignal<UiMode>("dark");
  const [analyticsPageOpen, setAnalyticsPageOpen] = createSignal(
    resolveAnalyticsPageOpenState(readAnalyticsPageState(), analyticsPageEnabled),
  );
  const [analyticsMode, setAnalyticsMode] = createSignal<FollowerHistoryMode>("raw");
  const [analyticsRange, setAnalyticsRange] = createSignal<FollowerHistoryRange>("30d");
  const [modalRange, setModalRange] = createSignal<FollowerHistoryRange>("30d");
  const [modalMode, setModalMode] = createSignal<FollowerHistoryMode>("raw");
  const [selectedHistoryLinkId, setSelectedHistoryLinkId] = createSignal<string | null>(null);
  const [selectedQrTarget, setSelectedQrTarget] = createSignal<QrDialogTarget | null>(null);

  return {
    analyticsMode,
    analyticsPageEnabled,
    analyticsPageOpen,
    analyticsRange,
    connectivity,
    modalMode,
    modalRange,
    mode,
    selectedHistoryLinkId,
    selectedQrTarget,
    setAnalyticsMode,
    setAnalyticsPageOpen,
    setAnalyticsRange,
    setConnectivity,
    setModalMode,
    setModalRange,
    setMode,
    setSelectedHistoryLinkId,
    setSelectedQrTarget,
  };
};

const createFollowerHistoryState = (signals: ReturnType<typeof createRouteSignals>) => {
  const [historyIndexState] = createResource(fetchFollowerHistoryIndex);
  const historyIndex = createMemo(() => {
    const state = historyIndexState();
    return state?.status === "available" ? state.value : null;
  });
  const historyIndexUnavailableReason = createMemo<OfflineResourceFailureReason | undefined>(() => {
    const state = historyIndexState();
    return state?.status === "unavailable" ? state.reason : undefined;
  });
  const historyAvailability = createMemo(() => buildFollowerHistoryAvailabilityMap(historyIndex()));
  const analyticsEntries = createMemo(() => historyIndex()?.entries ?? []);
  const selectedHistoryEntry = createMemo(() => {
    const linkId = signals.selectedHistoryLinkId();
    return linkId ? historyAvailability().get(linkId) : undefined;
  });
  const [allHistoryRowStates] = createResource(
    () => (signals.analyticsPageOpen() ? (historyIndex()?.entries ?? null) : null),
    async (entries) => {
      if (!entries) return new Map<string, OfflineResourceState<FollowerHistoryRow[]>>();
      const resolved = await Promise.all(
        entries.map(async (entry) => {
          const state = await fetchFollowerHistoryRows(entry.csvPath);
          const filtered =
            state.status === "available"
              ? buildAvailableOfflineResource(
                  filterFollowerHistoryRowsByLinkId(state.value, entry.linkId),
                )
              : state;
          return [entry.linkId, filtered] as const;
        }),
      );
      return new Map<string, OfflineResourceState<FollowerHistoryRow[]>>(resolved);
    },
  );
  const allHistoryRows = createMemo(() => {
    const rows = new Map<string, FollowerHistoryRow[]>();
    for (const [linkId, state] of allHistoryRowStates() ?? []) {
      if (state.status === "available") rows.set(linkId, state.value);
    }
    return rows;
  });
  const [selectedHistoryRowState] = createResource(
    () => selectedHistoryEntry() ?? null,
    async (entry) => {
      if (!entry) return buildAvailableOfflineResource<FollowerHistoryRow[]>([]);
      const state = await fetchFollowerHistoryRows(entry.csvPath);
      return state.status === "available"
        ? buildAvailableOfflineResource(
            filterFollowerHistoryRowsByLinkId(state.value, entry.linkId),
          )
        : state;
    },
  );
  const selectedHistoryRows = createMemo(() => {
    const state = selectedHistoryRowState();
    return state?.status === "available" ? state.value : [];
  });
  const resolveChartEmptyStateMessage = (
    state: OfflineResourceState<FollowerHistoryRow[]> | undefined,
  ) =>
    state
      ? resolveFollowerHistoryEmptyStateMessage({
          connectivity: signals.connectivity(),
          status: state.status === "unavailable" ? "unavailable" : "available",
          unavailableReason: state.status === "unavailable" ? state.reason : undefined,
        })
      : "Loading follower history…";
  const analyticsOverviewMessage = createMemo(() =>
    resolveAnalyticsOverviewMessage({
      connectivity: signals.connectivity(),
      entryCount: analyticsEntries().length,
      status: historyIndexState.loading ? "loading" : (historyIndexState()?.status ?? "available"),
      unavailableReason: historyIndexUnavailableReason(),
    }),
  );
  const selectedHistoryEmptyStateMessage = createMemo(() =>
    resolveChartEmptyStateMessage(selectedHistoryRowState()),
  );

  return {
    allHistoryRows,
    allHistoryRowStates,
    analyticsEntries,
    analyticsOverviewMessage,
    historyAvailability,
    resolveChartEmptyStateMessage,
    selectedHistoryEmptyStateMessage,
    selectedHistoryEntry,
    selectedHistoryRows,
  };
};

const createNavigationState = (
  signals: ReturnType<typeof createRouteSignals>,
  history: ReturnType<typeof createFollowerHistoryState>,
) => {
  const activeView = createMemo(() => resolvePublicPageView(signals.analyticsPageOpen()));
  const analyticsAvailable = createMemo(() => history.analyticsEntries().length > 0);
  const showAnalyticsNavigation = createMemo(() =>
    resolveAnalyticsNavigationVisible({
      analyticsAvailable: analyticsAvailable(),
      analyticsPageEnabled: signals.analyticsPageEnabled,
      analyticsPageOpen: signals.analyticsPageOpen(),
    }),
  );
  const analyticsPageHref = createMemo(() =>
    showAnalyticsNavigation() && typeof window !== "undefined"
      ? resolveAnalyticsPageHrefFromUrl(new URL(window.location.href), true)
      : undefined,
  );
  const activeNavigationItem = createMemo<"analytics" | "home">(() =>
    activeView() === "analytics" ? "analytics" : "home",
  );
  const setActiveView = (view: PageViewKey) => {
    const nextOpen = resolveAnalyticsPageOpenState(
      view === "analytics",
      signals.analyticsPageEnabled,
    );
    if (nextOpen === signals.analyticsPageOpen()) return;
    writeAnalyticsPageState(nextOpen);
    signals.setAnalyticsPageOpen(nextOpen);
    signals.setSelectedHistoryLinkId(null);
  };
  const syncAnalyticsStateFromLocation = () => {
    const requestedOpen = readAnalyticsPageState();
    const nextOpen = resolveAnalyticsPageOpenState(requestedOpen, signals.analyticsPageEnabled);
    if (requestedOpen && !signals.analyticsPageEnabled) replaceAnalyticsPageState(false);
    signals.setAnalyticsPageOpen(nextOpen);
  };
  const syncConnectivityState = () => signals.setConnectivity(readConnectivityStatus());

  return {
    activeNavigationItem,
    activeView,
    analyticsPageHref,
    setActiveView,
    syncAnalyticsStateFromLocation,
    syncConnectivityState,
  };
};

const createRouteActions = (
  signals: ReturnType<typeof createRouteSignals>,
  history: ReturnType<typeof createFollowerHistoryState>,
) => {
  const openHistoryModal = (linkId: string) => {
    signals.setModalRange("30d");
    signals.setModalMode("raw");
    signals.setSelectedHistoryLinkId(linkId);
  };
  const openProfileQrDialog = async (payload: string) => {
    signals.setSelectedQrTarget(
      await resolveProfileQrDialogTarget({
        baseUrl: typeof window === "undefined" ? undefined : window.location.href,
        payload,
        profile: content.profile,
        siteLogoUrl: profileQrSiteLogoUrl,
      }),
    );
  };
  const openLinkQrDialog = async (link: (typeof content.links)[number], payload: string) => {
    signals.setSelectedQrTarget(
      await resolveLinkQrDialogTarget({
        baseUrl: typeof window === "undefined" ? undefined : window.location.href,
        link,
        payload,
      }),
    );
  };
  const handleModeToggle = () => {
    if (!canToggleMode(modePolicy)) return;
    const nextMode: UiMode = signals.mode() === "dark" ? "light" : "dark";
    signals.setMode(nextMode);
    persistModePreference(modePolicy, nextMode);
  };

  return {
    closeHistoryModal: () => signals.setSelectedHistoryLinkId(null),
    closeQrDialog: () => signals.setSelectedQrTarget(null),
    handleModeToggle,
    openHistoryModal,
    openLinkQrDialog,
    openProfileQrDialog,
    selectedHistoryEntry: history.selectedHistoryEntry,
  };
};

export const createRouteIndexController = () => {
  const signals = createRouteSignals();
  const history = createFollowerHistoryState(signals);
  const navigation = createNavigationState(signals, history);
  const actions = createRouteActions(signals, history);

  return {
    ...signals,
    ...history,
    ...navigation,
    ...actions,
    canToggle: createMemo(() => canToggleMode(modePolicy)),
    isOffline: createMemo(() => signals.connectivity() === "offline"),
    themeFingerprint: () => `${themeSelection.active}:${signals.mode()}`,
  };
};

export type RouteIndexController = ReturnType<typeof createRouteIndexController>;
