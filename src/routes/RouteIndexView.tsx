import { For, Match, Show, Suspense, Switch, lazy } from "solid-js";
import { Toaster } from "solid-sonner";
import FollowerHistorySegmentedControl from "../components/analytics/FollowerHistorySegmentedControl";
import {
  FOLLOWER_HISTORY_MODE_OPTIONS,
  FOLLOWER_HISTORY_RANGE_OPTIONS,
} from "../components/analytics/follower-history-controls";
import AnimatedPageSwap from "../components/layout/AnimatedPageSwap";
import LinkSection from "../components/layout/LinkSection";
import SiteFooter from "../components/layout/SiteFooter";
import TopUtilityBar from "../components/layout/TopUtilityBar";
import UtilityControlsMenu from "../components/layout/UtilityControlsMenu";
import ProfileHeader from "../components/profile/ProfileHeader";
import QrCodeDialog from "../components/qr/QrCodeDialog";
import type { FollowerHistoryIndexEntry } from "../lib/analytics/follower-history";
import { describeFollowerHistoryRange } from "../lib/analytics/follower-history";
import { resolveEntityAnalyticsLabel } from "../lib/content/entity-type";
import { ACTION_TOAST_OPTIONS } from "../lib/ui/action-toast";
import PublicLinkCard from "./PublicLinkCard";
import {
  brandIconOptions,
  composition,
  content,
  footerPreferences,
  homePageHref,
  layout,
  pageAriaLabel,
  paymentCardEffectGalleryMenuHref,
  profileQuickLinks,
  sections,
  showGroupHeading,
  targetForLink,
} from "./index-route-config";
import type { RouteIndexController } from "./index-route-controller";
import { PAYMENT_CARD_EFFECT_GALLERY_MENU_LABEL } from "./index.helpers";

const FollowerHistoryChart = lazy(() => import("../components/analytics/FollowerHistoryChart"));
const FollowerHistoryModal = lazy(() => import("../components/analytics/FollowerHistoryModal"));

const RouteProfileHeader = (props: { controller: RouteIndexController }) => (
  <ProfileHeader
    profile={content.profile}
    alignment={layout.profileHeaderAlignment}
    links={content.links}
    quickLinks={profileQuickLinks}
    richness={composition.profileRichness}
    onProfileQrOpen={props.controller.openProfileQrDialog}
    vcard={content.site.sharing?.vcard}
  />
);

const RoutePublicCard = (props: {
  controller: RouteIndexController;
  link: (typeof content.links)[number];
}) => (
  <PublicLinkCard
    brandIconOptions={brandIconOptions}
    hasHistory={props.controller.historyAvailability().has(props.link.id)}
    link={props.link}
    onHistoryOpen={props.controller.openHistoryModal}
    onQrOpen={(link, payload) => void props.controller.openLinkQrDialog(link, payload)}
    site={content.site}
    target={targetForLink(props.link.url)}
    themeFingerprint={props.controller.themeFingerprint()}
  />
);

const LinksPage = (props: { controller: RouteIndexController }) => (
  <For each={composition.blocks}>
    {(block) => (
      <Switch>
        <Match when={block === "profile"}>
          <RouteProfileHeader controller={props.controller} />
        </Match>
        <Match when={block === "links"}>
          <For each={sections}>
            {(section) => (
              <LinkSection
                section={section}
                showHeading={showGroupHeading}
                groupingStyle={composition.grouping}
              >
                {(link) => <RoutePublicCard controller={props.controller} link={link} />}
              </LinkSection>
            )}
          </For>
        </Match>
      </Switch>
    )}
  </For>
);

const AnalyticsCard = (props: {
  controller: RouteIndexController;
  entry: FollowerHistoryIndexEntry;
}) => (
  <section class="analytics-card">
    <div class="analytics-card-header">
      <div>
        <h3>{props.entry.label}</h3>
        <p>{props.entry.latestAudienceCountRaw}</p>
      </div>
      <button
        type="button"
        class="analytics-open-button"
        onClick={() => props.controller.openHistoryModal(props.entry.linkId)}
      >
        Open chart
      </button>
    </div>
    <FollowerHistoryChart
      audienceKind={props.entry.audienceKind}
      emptyStateMessage={props.controller.resolveChartEmptyStateMessage(
        props.controller.allHistoryRowStates()?.get(props.entry.linkId),
      )}
      mode={props.controller.analyticsMode()}
      rangeDescription={describeFollowerHistoryRange(props.controller.analyticsRange())}
      range={props.controller.analyticsRange()}
      rows={props.controller.allHistoryRows().get(props.entry.linkId) ?? []}
      summaryLabel={props.entry.label}
      themeFingerprint={props.controller.themeFingerprint()}
    />
  </section>
);

const AnalyticsPage = (props: { controller: RouteIndexController }) => (
  <>
    <RouteProfileHeader controller={props.controller} />
    <section
      class="analytics-page"
      aria-label={resolveEntityAnalyticsLabel(content.profile.entityType)}
    >
      <div class="analytics-page-header">
        <div>
          <h2>{resolveEntityAnalyticsLabel(content.profile.entityType)}</h2>
          <p>
            Showing {describeFollowerHistoryRange(props.controller.analyticsRange())} of public
            follower history.
          </p>
        </div>
        <div class="analytics-page-controls">
          <FollowerHistorySegmentedControl
            class="analytics-control-group"
            label="Analytics time range"
            options={FOLLOWER_HISTORY_RANGE_OPTIONS}
            onChange={props.controller.setAnalyticsRange}
            value={props.controller.analyticsRange()}
          />
          <FollowerHistorySegmentedControl
            class="analytics-control-group"
            label="Analytics display mode"
            options={FOLLOWER_HISTORY_MODE_OPTIONS}
            onChange={props.controller.setAnalyticsMode}
            value={props.controller.analyticsMode()}
          />
        </div>
      </div>
      <Show when={props.controller.analyticsOverviewMessage()}>
        {(message) => (
          <p class="analytics-empty-state analytics-status-note" aria-live="polite">
            {message()}
          </p>
        )}
      </Show>
      <div class="analytics-grid">
        <Suspense fallback={<p class="analytics-empty-state">Loading charts…</p>}>
          <For each={props.controller.analyticsEntries()}>
            {(entry) => <AnalyticsCard controller={props.controller} entry={entry} />}
          </For>
        </Suspense>
      </div>
    </section>
  </>
);

const RouteNavigation = (props: { controller: RouteIndexController }) => (
  <TopUtilityBar
    title={content.site.title}
    controlsLabel="Site menu"
    logoPath="branding/openlinks-logo/openlinks-logo.svg"
    logoAlt="OpenLinks logo"
  >
    <UtilityControlsMenu
      activeNavigationItem={props.controller.activeNavigationItem()}
      analyticsHref={props.controller.analyticsPageHref()}
      homeHref={homePageHref}
      isOffline={props.controller.isOffline()}
      label="site menu"
      mode={props.controller.mode()}
      onAnalyticsSelect={(event) => {
        event.preventDefault();
        props.controller.setActiveView("analytics");
      }}
      onHomeSelect={(event) => {
        event.preventDefault();
        props.controller.setActiveView("links");
      }}
      onToggleMode={props.controller.canToggle() ? props.controller.handleModeToggle : undefined}
      testingGalleryHref={paymentCardEffectGalleryMenuHref}
      testingGalleryLabel={PAYMENT_CARD_EFFECT_GALLERY_MENU_LABEL}
    />
  </TopUtilityBar>
);

const RouteDialogs = (props: { controller: RouteIndexController }) => (
  <>
    <Suspense fallback={null}>
      <FollowerHistoryModal
        entry={props.controller.selectedHistoryEntry()}
        mode={props.controller.modalMode()}
        onClose={props.controller.closeHistoryModal}
        onModeChange={props.controller.setModalMode}
        onRangeChange={props.controller.setModalRange}
        open={Boolean(props.controller.selectedHistoryLinkId())}
        range={props.controller.modalRange()}
        rows={props.controller.selectedHistoryRows()}
        emptyStateMessage={props.controller.selectedHistoryEmptyStateMessage()}
        themeFingerprint={props.controller.themeFingerprint()}
      />
    </Suspense>
    <Show when={props.controller.selectedQrTarget()}>
      {(target) => (
        <QrCodeDialog
          open={true}
          title={target().title}
          payload={target().payload}
          ariaLabel={target().ariaLabel}
          qrAriaLabel={target().qrAriaLabel}
          logoUrl={target().logoUrl}
          logoSize={target().logoSize}
          themeFingerprint={props.controller.themeFingerprint()}
          onClose={props.controller.closeQrDialog}
        />
      )}
    </Show>
  </>
);

export default function RouteIndexView(props: { controller: RouteIndexController }) {
  return (
    <main
      aria-label={pageAriaLabel()}
      class={`page composition-${composition.mode} profile-${composition.profileEmphasis} layout-${layout.desktopColumns} typography-${layout.typographyScale} targets-${layout.targetSize} card-style-${layout.cardStyle}`}
      style={
        { "--profile-avatar-scale": String(layout.profileAvatarScale) } as Record<string, string>
      }
    >
      <RouteNavigation controller={props.controller} />
      <AnimatedPageSwap
        activeKey={props.controller.activeView()}
        renderView={(key) =>
          key === "analytics" ? (
            <AnalyticsPage controller={props.controller} />
          ) : (
            <LinksPage controller={props.controller} />
          )
        }
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
        theme={props.controller.mode() === "dark" ? "dark" : "light"}
        toastOptions={ACTION_TOAST_OPTIONS}
        visibleToasts={4}
      />
      <RouteDialogs controller={props.controller} />
    </main>
  );
}
