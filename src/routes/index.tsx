import {
  For,
  Match,
  Show,
  Suspense,
  Switch,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  lazy,
  onCleanup,
  onMount,
} from "solid-js";
import { Toaster, toast } from "solid-sonner";
import FollowerHistorySegmentedControl from "../components/analytics/FollowerHistorySegmentedControl";
import {
  FOLLOWER_HISTORY_MODE_OPTIONS,
  FOLLOWER_HISTORY_RANGE_OPTIONS,
} from "../components/analytics/follower-history-controls";
import PaymentLinkCard from "../components/cards/PaymentLinkCard";
import RichLinkCard from "../components/cards/RichLinkCard";
import SimpleLinkCard from "../components/cards/SimpleLinkCard";
import AnimatedPageSwap from "../components/layout/AnimatedPageSwap";
import LinkSection, { type LinkSectionData } from "../components/layout/LinkSection";
import SiteFooter from "../components/layout/SiteFooter";
import TopUtilityBar from "../components/layout/TopUtilityBar";
import UtilityControlsMenu from "../components/layout/UtilityControlsMenu";
import ProfileHeader from "../components/profile/ProfileHeader";
import QrCodeDialog from "../components/qr/QrCodeDialog";
import {
  readAnalyticsPageState,
  replaceAnalyticsPageState,
  resolveAnalyticsPageHrefFromUrl,
  writeAnalyticsPageState,
} from "../lib/analytics/analytics-page-query";
import {
  FOLLOWER_HISTORY_INDEX_PUBLIC_PATH,
  type FollowerHistoryIndex,
  type FollowerHistoryMode,
  type FollowerHistoryRange,
  type FollowerHistoryRow,
  buildFollowerHistoryAvailabilityMap,
  describeFollowerHistoryRange,
  filterFollowerHistoryRowsByLinkId,
  parseFollowerHistoryCsv,
  parseFollowerHistoryIndex,
} from "../lib/analytics/follower-history";
import { resolveEntityAnalyticsLabel, resolveEntityPageLabel } from "../lib/content/entity-type";
import { loadContent, resolveGeneratedContentImageUrl } from "../lib/content/load-content";
import { resolveBrandIconOptions } from "../lib/icons/brand-icon-options";
import {
  type ConnectivityStatus,
  type OfflineResourceFailureReason,
  type OfflineResourceState,
  buildAvailableOfflineResource,
  buildUnavailableOfflineResource,
  readConnectivityStatus,
  resolveAnalyticsOverviewMessage,
  resolveFollowerHistoryEmptyStateMessage,
} from "../lib/offline/offline-status";
import { isPaymentCapableLink } from "../lib/payments/types";
import {
  resolveBaseAwareAssetPath,
  resolveBasePathFromUrl,
  resolveSeoMetadata,
} from "../lib/seo/resolve-seo-metadata";
import { copyLink, shareLink } from "../lib/share/share-link";
import {
  type UiMode,
  applyThemeState,
  applyTypographyState,
  canToggleMode,
  persistModePreference,
  resolveInitialMode,
  resolveModePolicy,
} from "../lib/theme/mode-controller";
import { resolveThemeSelection } from "../lib/theme/theme-registry";
import { ACTION_TOAST_OPTIONS, registerActionToastClient } from "../lib/ui/action-toast";
import {
  resolveAnalyticsNavigationVisible,
  resolveAnalyticsPageEnabled,
  resolveAnalyticsPageOpenState,
} from "../lib/ui/analytics-page-preferences";
import { resolveComposition, resolveLinkSections } from "../lib/ui/composition";
import { resolveFooterPreferences } from "../lib/ui/footer-preferences";
import { resolveLayoutPreferences } from "../lib/ui/layout-preferences";
import { resolveProfileQuickLinksState } from "../lib/ui/profile-quick-links";
import { resolvePublicPageView } from "../lib/ui/public-page-view";
import { buildRichCardViewModel, resolveRichCardVariant } from "../lib/ui/rich-card-policy";
import { resolveTypographyPreferences } from "../lib/ui/typography-preferences";
import {
  PAYMENT_CARD_EFFECT_GALLERY_MENU_LABEL,
  type QrDialogTarget,
  resolveLinkQrDialogTarget,
  resolvePaymentCardEffectGalleryMenuHref,
  resolveProfileQrDialogTarget,
} from "./index.helpers";

const content = loadContent();
const composition = resolveComposition(content.site);
const layout = resolveLayoutPreferences(content.site);
const footerPreferences = resolveFooterPreferences(content.site);
const modePolicy = resolveModePolicy(content.site);
const brandIconOptions = resolveBrandIconOptions(content.site);
const themeSelection = resolveThemeSelection(content.site);
const typography = resolveTypographyPreferences({
  site: content.site,
  activeTheme: themeSelection.active,
  typographyScale: layout.typographyScale,
});
const paymentCardEffectGalleryMenuHref = resolvePaymentCardEffectGalleryMenuHref(
  import.meta.env.BASE_URL,
);
const profileQuickLinks = resolveProfileQuickLinksState(content.links);
const profileQrSiteLogoUrl = resolveBaseAwareAssetPath(
  "branding/openlinks-logo/openlinks-logo.svg",
  import.meta.env.BASE_URL,
);
const homePageHref = resolveAnalyticsPageHrefFromUrl(
  new URL(import.meta.env.BASE_URL || "/", "https://openlinks.local"),
  false,
);

registerActionToastClient({
  default: (message) => toast(message),
  error: (message) => toast.error(message),
});

const sections = resolveLinkSections(
  content.links,
  content.groups,
  composition.grouping,
) as LinkSectionData[];
const showGroupHeading = composition.grouping !== "none";
type PageViewKey = "analytics" | "links";

const FollowerHistoryChart = lazy(() => import("../components/analytics/FollowerHistoryChart"));
const FollowerHistoryModal = lazy(() => import("../components/analytics/FollowerHistoryModal"));

const historyAssetUrl = (assetPath: string): string => {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${assetPath.replace(/^\/+/, "")}`;
};

const ensureMetaTag = (attr: "name" | "property", key: string, contentValue: string) => {
  const selector = `meta[${attr}=\"${key}\"]`;
  let meta = document.head.querySelector<HTMLMetaElement>(selector);

  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attr, key);
    document.head.appendChild(meta);
  }

  meta.setAttribute("content", contentValue);
};

const ensureCanonical = (href: string) => {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }

  link.setAttribute("href", href);
};

const applySeoMetadata = () => {
  const canonicalBaseUrl =
    __OPENLINKS_CANONICAL_ORIGIN__.trim().length > 0
      ? __OPENLINKS_CANONICAL_ORIGIN__
      : content.site.quality?.seo?.canonicalBaseUrl;
  const seoSite =
    canonicalBaseUrl && canonicalBaseUrl !== content.site.quality?.seo?.canonicalBaseUrl
      ? {
          ...content.site,
          quality: {
            ...content.site.quality,
            seo: {
              ...content.site.quality?.seo,
              canonicalBaseUrl,
            },
          },
        }
      : content.site;
  const { metadata } = resolveSeoMetadata(seoSite, content.profile, {
    fallbackOrigin: window.location.origin,
    resolveImagePath: (candidate, context) => {
      const resolved = resolveGeneratedContentImageUrl({
        candidate,
        slotId: context.slotId,
      });
      if (!resolved) {
        return undefined;
      }

      return resolveBaseAwareAssetPath(resolved, resolveBasePathFromUrl(canonicalBaseUrl));
    },
  });

  document.title = metadata.title;
  ensureCanonical(metadata.canonical);

  ensureMetaTag("name", "description", metadata.description);
  ensureMetaTag("property", "og:title", metadata.ogTitle);
  ensureMetaTag("property", "og:description", metadata.ogDescription);
  ensureMetaTag("property", "og:type", metadata.ogType);
  ensureMetaTag("property", "og:url", metadata.ogUrl);
  ensureMetaTag("property", "og:image", metadata.ogImage);

  ensureMetaTag("name", "twitter:card", metadata.twitterCard);
  ensureMetaTag("name", "twitter:title", metadata.twitterTitle);
  ensureMetaTag("name", "twitter:description", metadata.twitterDescription);
  ensureMetaTag("name", "twitter:image", metadata.twitterImage);
};

const targetForLink = (url?: string): "_blank" | "_self" => {
  const mode = content.site.ui?.linkTarget ?? "new-tab-external";

  if (mode === "same-tab") return "_self";
  if (mode === "new-tab-all") return "_blank";

  if (!url) return "_self";

  return url.startsWith("http://") || url.startsWith("https://") ? "_blank" : "_self";
};

const isMissingHistoryResponse = (status: number): boolean => status === 404;

const fetchFollowerHistoryIndex = async (): Promise<OfflineResourceState<FollowerHistoryIndex>> => {
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

const fetchFollowerHistoryRows = async (
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

export default function RouteIndex() {
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

  const canToggle = createMemo(() => canToggleMode(modePolicy));
  const themeFingerprint = () => `${themeSelection.active}:${mode()}`;
  const isOffline = createMemo(() => connectivity() === "offline");

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
  const analyticsAvailable = createMemo(() => analyticsEntries().length > 0);
  const selectedHistoryEntry = createMemo(() => {
    const selectedLinkId = selectedHistoryLinkId();
    return selectedLinkId ? historyAvailability().get(selectedLinkId) : undefined;
  });

  const [allHistoryRowStates] = createResource(
    () => (analyticsPageOpen() ? (historyIndex()?.entries ?? null) : null),
    async (entries) => {
      if (!entries) {
        return new Map<string, OfflineResourceState<FollowerHistoryRow[]>>();
      }

      const resolved = await Promise.all(
        entries.map(
          async (entry) =>
            [
              entry.linkId,
              await fetchFollowerHistoryRows(entry.csvPath).then((state) =>
                state.status === "available"
                  ? buildAvailableOfflineResource(
                      filterFollowerHistoryRowsByLinkId(state.value, entry.linkId),
                    )
                  : state,
              ),
            ] as const,
        ),
      );
      return new Map<string, OfflineResourceState<FollowerHistoryRow[]>>(resolved);
    },
  );
  const allHistoryRows = createMemo(() => {
    const rows = new Map<string, FollowerHistoryRow[]>();

    for (const [linkId, state] of allHistoryRowStates() ?? []) {
      if (state.status === "available") {
        rows.set(linkId, state.value);
      }
    }

    return rows;
  });

  const [selectedHistoryRowState] = createResource(
    () => selectedHistoryEntry() ?? null,
    async (entry) =>
      entry
        ? fetchFollowerHistoryRows(entry.csvPath).then((state) =>
            state.status === "available"
              ? buildAvailableOfflineResource(
                  filterFollowerHistoryRowsByLinkId(state.value, entry.linkId),
                )
              : state,
          )
        : buildAvailableOfflineResource<FollowerHistoryRow[]>([]),
  );
  const selectedHistoryRows = createMemo(() => {
    const state = selectedHistoryRowState();
    return state?.status === "available" ? state.value : [];
  });
  const analyticsOverviewMessage = createMemo(() =>
    resolveAnalyticsOverviewMessage({
      connectivity: connectivity(),
      entryCount: analyticsEntries().length,
      status: historyIndexState.loading ? "loading" : (historyIndexState()?.status ?? "available"),
      unavailableReason: historyIndexUnavailableReason(),
    }),
  );
  const resolveChartEmptyStateMessage = (
    state: OfflineResourceState<FollowerHistoryRow[]> | undefined,
  ): string => {
    if (!state) {
      return "Loading follower history…";
    }

    return resolveFollowerHistoryEmptyStateMessage({
      connectivity: connectivity(),
      status: state.status === "unavailable" ? "unavailable" : "available",
      unavailableReason: state.status === "unavailable" ? state.reason : undefined,
    });
  };
  const selectedHistoryEmptyStateMessage = createMemo(() =>
    resolveChartEmptyStateMessage(selectedHistoryRowState()),
  );

  const syncAnalyticsStateFromLocation = () => {
    const requestedOpen = readAnalyticsPageState();
    const nextOpen = resolveAnalyticsPageOpenState(requestedOpen, analyticsPageEnabled);

    if (requestedOpen && !analyticsPageEnabled) {
      replaceAnalyticsPageState(false);
    }

    setAnalyticsPageOpen(nextOpen);
  };
  const syncConnectivityState = () => {
    setConnectivity(readConnectivityStatus());
  };
  const activeView = createMemo(() => resolvePublicPageView(analyticsPageOpen()));
  const showAnalyticsNavigation = createMemo(() =>
    resolveAnalyticsNavigationVisible({
      analyticsAvailable: analyticsAvailable(),
      analyticsPageEnabled,
      analyticsPageOpen: analyticsPageOpen(),
    }),
  );
  const analyticsPageHref = createMemo(() => {
    if (!showAnalyticsNavigation() || typeof window === "undefined") {
      return undefined;
    }

    return resolveAnalyticsPageHrefFromUrl(new URL(window.location.href), true);
  });
  const activeNavigationItem = createMemo<"analytics" | "home">(() =>
    activeView() === "analytics" ? "analytics" : "home",
  );
  const setActiveView = (view: PageViewKey) => {
    const nextOpen = resolveAnalyticsPageOpenState(view === "analytics", analyticsPageEnabled);

    if (nextOpen === analyticsPageOpen()) {
      return;
    }

    writeAnalyticsPageState(nextOpen);
    setAnalyticsPageOpen(nextOpen);
    setSelectedHistoryLinkId(null);
  };

  const openHistoryModal = (linkId: string) => {
    setModalRange("30d");
    setModalMode("raw");
    setSelectedHistoryLinkId(linkId);
  };

  const closeHistoryModal = () => {
    setSelectedHistoryLinkId(null);
  };

  const openQrDialog = (target: QrDialogTarget) => {
    setSelectedQrTarget(target);
  };

  const openProfileQrDialog = async (payload: string) => {
    openQrDialog(
      await resolveProfileQrDialogTarget({
        baseUrl: typeof window === "undefined" ? undefined : window.location.href,
        payload,
        profile: content.profile,
        siteLogoUrl: profileQrSiteLogoUrl,
      }),
    );
  };

  const openLinkQrDialog = async (link: (typeof content.links)[number], payload: string) => {
    openQrDialog(
      await resolveLinkQrDialogTarget({
        baseUrl: typeof window === "undefined" ? undefined : window.location.href,
        link,
        payload,
      }),
    );
  };

  const closeQrDialog = () => {
    setSelectedQrTarget(null);
  };

  const renderCard = (link: (typeof content.links)[number]) => {
    const target = targetForLink(link.url);
    const resolveCardActions = () => {
      const historyEntry = historyAvailability().get(link.id);
      const shareUrl = link.url?.trim();
      const shareActions = shareUrl
        ? [
            {
              ariaLabel: `Show ${link.label} QR code`,
              kind: "qr" as const,
              onClick: () => {
                void openLinkQrDialog(link, shareUrl);
                return undefined;
              },
              title: `Show ${link.label} QR code`,
            },
            {
              ariaLabel: `Share ${link.label}`,
              kind: "share" as const,
              onClick: () =>
                shareLink({
                  copiedMessage: `${link.label} link shared`,
                  failedMessage: `Could not share ${link.label}`,
                  mode: "url-only",
                  sharedMessage: `${link.label} link shared`,
                  title: link.label,
                  url: shareUrl,
                }),
              title: `Share ${link.label}`,
            },
            {
              ariaLabel: `Copy ${link.label} link`,
              kind: "copy" as const,
              onClick: () =>
                copyLink({
                  copiedMessage: `${link.label} link copied`,
                  failedMessage: `Could not copy ${link.label} link`,
                  url: shareUrl,
                }),
              title: `Copy ${link.label} link`,
            },
          ]
        : [];

      if (!historyEntry) {
        return shareActions;
      }

      return [
        ...shareActions,
        {
          ariaLabel: `View ${link.label} follower history`,
          kind: "analytics" as const,
          onClick: () => {
            openHistoryModal(link.id);
            return undefined;
          },
          title: `View ${link.label} follower history`,
        },
      ];
    };

    if (isPaymentCapableLink(link)) {
      return (
        <PaymentLinkCard
          link={link}
          site={content.site}
          interaction="minimal"
          brandIconOptions={brandIconOptions}
          themeFingerprint={themeFingerprint()}
        />
      );
    }

    if (resolveRichCardVariant(content.site, link) === "rich") {
      return (
        <RichLinkCard
          resolveCardActions={resolveCardActions}
          link={link}
          viewModel={buildRichCardViewModel(content.site, link)}
          target={target}
          interaction="minimal"
          brandIconOptions={brandIconOptions}
          themeFingerprint={themeFingerprint()}
        />
      );
    }

    return (
      <SimpleLinkCard
        resolveCardActions={resolveCardActions}
        link={link}
        site={content.site}
        target={target}
        interaction="minimal"
        brandIconOptions={brandIconOptions}
        themeFingerprint={themeFingerprint()}
      />
    );
  };

  onMount(() => {
    syncConnectivityState();
    setMode(resolveInitialMode(modePolicy));
    applySeoMetadata();
    syncAnalyticsStateFromLocation();
    window.addEventListener("online", syncConnectivityState);
    window.addEventListener("offline", syncConnectivityState);
    window.addEventListener("popstate", syncAnalyticsStateFromLocation);
  });

  onCleanup(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", syncConnectivityState);
      window.removeEventListener("offline", syncConnectivityState);
      window.removeEventListener("popstate", syncAnalyticsStateFromLocation);
    }
  });

  createEffect(() => {
    applyThemeState({
      themeId: themeSelection.active,
      mode: mode(),
      policy: modePolicy,
      density: layout.density,
      brandIconSizeMode: brandIconOptions.sizeMode,
    });
    applyTypographyState(typography);
  });

  const handleModeToggle = () => {
    if (!canToggle()) {
      return;
    }

    const nextMode: UiMode = mode() === "dark" ? "light" : "dark";
    setMode(nextMode);
    persistModePreference(modePolicy, nextMode);
  };

  const profileHeader = () => (
    <ProfileHeader
      profile={content.profile}
      quickLinks={profileQuickLinks}
      richness={composition.profileRichness}
      onProfileQrOpen={openProfileQrDialog}
    />
  );

  const renderLinksPage = () => (
    <For each={composition.blocks}>
      {(block) => (
        <Switch>
          <Match when={block === "profile"}>{profileHeader()}</Match>
          <Match when={block === "links"}>
            <For each={sections}>
              {(section) => (
                <LinkSection
                  section={section}
                  showHeading={showGroupHeading}
                  groupingStyle={composition.grouping}
                >
                  {(link) => renderCard(link)}
                </LinkSection>
              )}
            </For>
          </Match>
        </Switch>
      )}
    </For>
  );

  const renderAnalyticsPage = () => (
    <>
      {profileHeader()}

      <section
        class="analytics-page"
        aria-label={resolveEntityAnalyticsLabel(content.profile.entityType)}
      >
        <div class="analytics-page-header">
          <div>
            <h2>{resolveEntityAnalyticsLabel(content.profile.entityType)}</h2>
            <p>
              Showing {describeFollowerHistoryRange(analyticsRange())} of public follower history.
            </p>
          </div>
          <div class="analytics-page-controls">
            <FollowerHistorySegmentedControl
              class="analytics-control-group"
              label="Analytics time range"
              options={FOLLOWER_HISTORY_RANGE_OPTIONS}
              onChange={setAnalyticsRange}
              value={analyticsRange()}
            />
            <FollowerHistorySegmentedControl
              class="analytics-control-group"
              label="Analytics display mode"
              options={FOLLOWER_HISTORY_MODE_OPTIONS}
              onChange={setAnalyticsMode}
              value={analyticsMode()}
            />
          </div>
        </div>

        <Show when={analyticsOverviewMessage()}>
          {(message) => (
            <p class="analytics-empty-state analytics-status-note" aria-live="polite">
              {message()}
            </p>
          )}
        </Show>

        <div class="analytics-grid">
          <Suspense fallback={<p class="analytics-empty-state">Loading charts…</p>}>
            <For each={analyticsEntries()}>
              {(entry) => (
                <section class="analytics-card">
                  <div class="analytics-card-header">
                    <div>
                      <h3>{entry.label}</h3>
                      <p>{entry.latestAudienceCountRaw}</p>
                    </div>
                    <button
                      type="button"
                      class="analytics-open-button"
                      onClick={() => openHistoryModal(entry.linkId)}
                    >
                      Open chart
                    </button>
                  </div>

                  <FollowerHistoryChart
                    audienceKind={entry.audienceKind}
                    emptyStateMessage={resolveChartEmptyStateMessage(
                      allHistoryRowStates()?.get(entry.linkId),
                    )}
                    mode={analyticsMode()}
                    rangeDescription={describeFollowerHistoryRange(analyticsRange())}
                    range={analyticsRange()}
                    rows={allHistoryRows().get(entry.linkId) ?? []}
                    summaryLabel={entry.label}
                    themeFingerprint={themeFingerprint()}
                  />
                </section>
              )}
            </For>
          </Suspense>
        </div>
      </section>
    </>
  );

  return (
    <main
      aria-label={`OpenLinks ${resolveEntityPageLabel(content.profile.entityType).toLowerCase()} and links`}
      class={`page composition-${composition.mode} profile-${composition.profileEmphasis} layout-${layout.desktopColumns} typography-${layout.typographyScale} targets-${layout.targetSize}`}
      style={
        { "--profile-avatar-scale": String(layout.profileAvatarScale) } as Record<string, string>
      }
    >
      <TopUtilityBar
        title={content.site.title}
        controlsLabel="Site menu"
        logoPath="branding/openlinks-logo/openlinks-logo.svg"
        logoAlt="OpenLinks logo"
      >
        <UtilityControlsMenu
          activeNavigationItem={activeNavigationItem()}
          analyticsHref={analyticsPageHref()}
          homeHref={homePageHref}
          isOffline={isOffline()}
          label="site menu"
          mode={mode()}
          onAnalyticsSelect={(event) => {
            event.preventDefault();
            setActiveView("analytics");
          }}
          onHomeSelect={(event) => {
            event.preventDefault();
            setActiveView("links");
          }}
          onToggleMode={canToggle() ? handleModeToggle : undefined}
          testingGalleryHref={paymentCardEffectGalleryMenuHref}
          testingGalleryLabel={PAYMENT_CARD_EFFECT_GALLERY_MENU_LABEL}
        />
      </TopUtilityBar>

      <AnimatedPageSwap
        activeKey={activeView()}
        renderView={(key) => (key === "analytics" ? renderAnalyticsPage() : renderLinksPage())}
      />

      <SiteFooter
        preferences={footerPreferences}
        buildInfo={__OPENLINKS_BUILD_INFO__}
        logoPath="branding/openlinks-logo/openlinks-logo.svg"
        logoAlt="OpenLinks logo"
      />

      <Toaster
        containerAriaLabel="Action notifications"
        duration={ACTION_TOAST_OPTIONS.duration}
        mobileOffset={{ bottom: 16, left: 16, right: 16 }}
        position="bottom-center"
        richColors
        theme={mode() === "dark" ? "dark" : "light"}
        toastOptions={ACTION_TOAST_OPTIONS}
        visibleToasts={4}
      />

      <Suspense fallback={null}>
        <FollowerHistoryModal
          entry={selectedHistoryEntry()}
          mode={modalMode()}
          onClose={closeHistoryModal}
          onModeChange={setModalMode}
          onRangeChange={setModalRange}
          open={Boolean(selectedHistoryLinkId())}
          range={modalRange()}
          rows={selectedHistoryRows()}
          emptyStateMessage={selectedHistoryEmptyStateMessage()}
          themeFingerprint={themeFingerprint()}
        />
      </Suspense>

      <Show when={selectedQrTarget()}>
        {(target) => (
          <QrCodeDialog
            open={true}
            title={target().title}
            payload={target().payload}
            ariaLabel={target().ariaLabel}
            qrAriaLabel={target().qrAriaLabel}
            logoUrl={target().logoUrl}
            logoSize={target().logoSize}
            themeFingerprint={themeFingerprint()}
            onClose={closeQrDialog}
          />
        )}
      </Show>
    </main>
  );
}
