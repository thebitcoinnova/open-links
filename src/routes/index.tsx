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
import PaymentLinkCard from "../components/cards/PaymentLinkCard";
import RichLinkCard from "../components/cards/RichLinkCard";
import SimpleLinkCard from "../components/cards/SimpleLinkCard";
import AnimatedPageSwap from "../components/layout/AnimatedPageSwap";
import LinkSection, { type LinkSectionData } from "../components/layout/LinkSection";
import SiteFooter from "../components/layout/SiteFooter";
import TopUtilityBar from "../components/layout/TopUtilityBar";
import UtilityControlsMenu from "../components/layout/UtilityControlsMenu";
import ProfileHeader from "../components/profile/ProfileHeader";
import ThemeToggle from "../components/theme/ThemeToggle";
import {
  readAnalyticsPageState,
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
  parseFollowerHistoryCsv,
  parseFollowerHistoryIndex,
} from "../lib/analytics/follower-history";
import { loadContent, resolveGeneratedContentImageUrl } from "../lib/content/load-content";
import { resolveBrandIconOptions } from "../lib/icons/brand-icon-options";
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
import { getThemeDefinition, resolveThemeSelection } from "../lib/theme/theme-registry";
import { ACTION_TOAST_OPTIONS, registerActionToastClient } from "../lib/ui/action-toast";
import { resolveComposition, resolveLinkSections } from "../lib/ui/composition";
import { resolveFooterPreferences } from "../lib/ui/footer-preferences";
import { resolveLayoutPreferences } from "../lib/ui/layout-preferences";
import {
  buildRichCardViewModel,
  resolveRichCardVariant,
  resolveRichRenderMode,
} from "../lib/ui/rich-card-policy";
import { resolveTypographyPreferences } from "../lib/ui/typography-preferences";

const content = loadContent();
const composition = resolveComposition(content.site);
const layout = resolveLayoutPreferences(content.site);
const footerPreferences = resolveFooterPreferences(content.site);
const richRenderMode = resolveRichRenderMode(content.site);
const modePolicy = resolveModePolicy(content.site);
const brandIconOptions = resolveBrandIconOptions(content.site);
const themeSelection = resolveThemeSelection(content.site);
const themeDefinition = getThemeDefinition(themeSelection.active);
const typography = resolveTypographyPreferences({
  site: content.site,
  activeTheme: themeSelection.active,
  typographyScale: layout.typographyScale,
});

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

const RANGE_OPTIONS: Array<{ label: string; value: FollowerHistoryRange }> = [
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
  { label: "180D", value: "180d" },
  { label: "All", value: "all" },
];
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
    resolveImagePath: (candidate) => {
      const resolved = resolveGeneratedContentImageUrl(candidate);
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

const fetchFollowerHistoryIndex = async (): Promise<FollowerHistoryIndex | null> => {
  try {
    const response = await fetch(historyAssetUrl(FOLLOWER_HISTORY_INDEX_PUBLIC_PATH));
    if (!response.ok) {
      return null;
    }

    return parseFollowerHistoryIndex(await response.json());
  } catch {
    return null;
  }
};

const fetchFollowerHistoryRows = async (csvPath: string): Promise<FollowerHistoryRow[]> => {
  const response = await fetch(historyAssetUrl(csvPath));
  if (!response.ok) {
    throw new Error(`Unable to load follower history from ${csvPath}.`);
  }

  return parseFollowerHistoryCsv(await response.text());
};

export default function RouteIndex() {
  const [mode, setMode] = createSignal<UiMode>("dark");
  const [analyticsPageOpen, setAnalyticsPageOpen] = createSignal(readAnalyticsPageState());
  const [analyticsRange, setAnalyticsRange] = createSignal<FollowerHistoryRange>("30d");
  const [modalRange, setModalRange] = createSignal<FollowerHistoryRange>("30d");
  const [modalMode, setModalMode] = createSignal<FollowerHistoryMode>("raw");
  const [selectedHistoryLinkId, setSelectedHistoryLinkId] = createSignal<string | null>(null);

  const canToggle = createMemo(() => canToggleMode(modePolicy));
  const themeFingerprint = () => `${themeSelection.active}:${mode()}`;

  const [historyIndex] = createResource(fetchFollowerHistoryIndex);

  const historyAvailability = createMemo(() => buildFollowerHistoryAvailabilityMap(historyIndex()));
  const analyticsEntries = createMemo(() => historyIndex()?.entries ?? []);
  const analyticsAvailable = createMemo(() => analyticsEntries().length > 0);
  const selectedHistoryEntry = createMemo(() => {
    const selectedLinkId = selectedHistoryLinkId();
    return selectedLinkId ? historyAvailability().get(selectedLinkId) : undefined;
  });

  const [allHistoryRows] = createResource(
    () => (analyticsPageOpen() ? (historyIndex()?.updatedAt ?? null) : null),
    async () => {
      const entries = analyticsEntries();
      const resolved = await Promise.all(
        entries.map(
          async (entry) => [entry.linkId, await fetchFollowerHistoryRows(entry.csvPath)] as const,
        ),
      );
      return new Map<string, FollowerHistoryRow[]>(resolved);
    },
  );

  const [selectedHistoryRows] = createResource(
    () => selectedHistoryEntry()?.csvPath ?? null,
    async (csvPath) => (csvPath ? fetchFollowerHistoryRows(csvPath) : []),
  );

  const syncAnalyticsStateFromLocation = () => {
    setAnalyticsPageOpen(readAnalyticsPageState());
  };

  const toggleAnalyticsPage = () => {
    const nextOpen = !analyticsPageOpen();
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

  const renderCard = (link: (typeof content.links)[number]) => {
    const target = targetForLink(link.url);
    const resolveCardActions = () => {
      const historyEntry = historyAvailability().get(link.id);
      const shareUrl = link.url;
      const shareActions = shareUrl
        ? [
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
        {
          ariaLabel: `View ${link.label} follower history`,
          kind: "analytics" as const,
          onClick: () => {
            openHistoryModal(link.id);
            return undefined;
          },
          title: `View ${link.label} follower history`,
        },
        ...shareActions,
      ];
    };

    if (isPaymentCapableLink(link)) {
      return (
        <PaymentLinkCard
          link={link}
          site={content.site}
          target={target}
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
    setMode(resolveInitialMode(modePolicy));
    applySeoMetadata();
    syncAnalyticsStateFromLocation();
    window.addEventListener("popstate", syncAnalyticsStateFromLocation);
  });

  onCleanup(() => {
    if (typeof window !== "undefined") {
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

  const profileHeader = (analyticsActive: boolean) => (
    <ProfileHeader
      profile={content.profile}
      richness={composition.profileRichness}
      analyticsAvailable={analyticsAvailable()}
      analyticsActive={analyticsActive}
      onAnalyticsToggle={analyticsAvailable() ? toggleAnalyticsPage : undefined}
    />
  );

  const renderLinksPage = () => (
    <For each={composition.blocks}>
      {(block) => (
        <Switch>
          <Match when={block === "profile"}>{profileHeader(false)}</Match>
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
      {profileHeader(true)}

      <section class="analytics-page" aria-label="Follower analytics">
        <div class="analytics-page-header">
          <div>
            <h2>Follower Analytics</h2>
            <p>
              Showing {describeFollowerHistoryRange(analyticsRange())} of public follower history.
            </p>
          </div>
          <div class="analytics-control-group" aria-label="Analytics time range">
            <For each={RANGE_OPTIONS}>
              {(option) => (
                <button
                  aria-pressed={analyticsRange() === option.value}
                  type="button"
                  class="analytics-chip"
                  data-active={analyticsRange() === option.value ? "true" : "false"}
                  onClick={() => setAnalyticsRange(option.value)}
                >
                  {option.label}
                </button>
              )}
            </For>
          </div>
        </div>

        <Show when={historyIndex.loading}>
          <p class="analytics-empty-state">Loading follower history…</p>
        </Show>
        <Show when={historyIndex.error}>
          <p class="analytics-empty-state">Follower history could not be loaded.</p>
        </Show>
        <Show
          when={!historyIndex.loading && !historyIndex.error && analyticsEntries().length === 0}
        >
          <p class="analytics-empty-state">No public follower history is published yet.</p>
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
                    mode="raw"
                    rangeDescription={describeFollowerHistoryRange(analyticsRange())}
                    range={analyticsRange()}
                    rows={allHistoryRows()?.get(entry.linkId) ?? []}
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
      aria-label="OpenLinks profile and links"
      class={`page composition-${composition.mode} profile-${composition.profileEmphasis} layout-${layout.desktopColumns} typography-${layout.typographyScale} targets-${layout.targetSize}`}
      style={
        { "--profile-avatar-scale": String(layout.profileAvatarScale) } as Record<string, string>
      }
    >
      <TopUtilityBar
        title={content.site.title}
        controlsLabel="Theme and mode controls"
        logoPath="branding/openlinks-logo/openlinks-logo.svg"
        logoAlt="OpenLinks logo"
      >
        <UtilityControlsMenu panelLabel="Theme and mode controls">
          <Show
            when={canToggle()}
            fallback={
              <span class="utility-pill" aria-live="polite">
                {modePolicy === "static-dark" ? "Dark mode fixed" : "Light mode fixed"}
              </span>
            }
          >
            <ThemeToggle mode={mode()} onToggle={handleModeToggle} />
          </Show>
          <span class="utility-pill" aria-live="polite">
            {themeDefinition?.label ?? themeSelection.active} ·{" "}
            {themeDefinition?.intensity ?? "mild"}
          </span>
          <span class="utility-pill" aria-live="polite">
            Cards: {richRenderMode === "simple" ? "simple only" : "rich + simple"}
          </span>
        </UtilityControlsMenu>
      </TopUtilityBar>

      <AnimatedPageSwap
        activeKey={analyticsPageOpen() ? ("analytics" as PageViewKey) : ("links" as PageViewKey)}
        renderView={(key) => (key === "analytics" ? renderAnalyticsPage() : renderLinksPage())}
      />

      <SiteFooter
        preferences={footerPreferences}
        buildTimestampIso={__OPENLINKS_BUILD_TIMESTAMP__}
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
          rows={selectedHistoryRows() ?? []}
          themeFingerprint={themeFingerprint()}
        />
      </Suspense>
    </main>
  );
}
