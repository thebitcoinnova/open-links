import * as Collapsible from "@kobalte/core/collapsible";
import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import type { OpenLink, SiteData } from "../../lib/content/load-content";
import type { ResolvedBrandIconOptions } from "../../lib/icons/brand-icon-options";
import { IconCopy, IconOpen, IconQrCode } from "../../lib/icons/custom-icons";
import type { PaymentCardEffectDebugTuning } from "../../lib/payments/card-effect-debug-tuning";
import { resolvePaymentCardEffects } from "../../lib/payments/card-effects";
import { clampPaymentQrImageSize, resolvePaymentQrLogoUrl } from "../../lib/payments/qr-badges";
import {
  type ResolvedPaymentRailAction,
  resolveEnabledPaymentRails,
  resolvePaymentRailAction,
  resolvePrimaryPaymentHref,
} from "../../lib/payments/rails";
import type {
  PaymentQrDisplayMode,
  PaymentQrFullscreenMode,
  PaymentQrLogoMode,
  PaymentQrStyle,
  PaymentRail,
} from "../../lib/payments/types";
import { copyToClipboard } from "../../lib/share/copy-to-clipboard";
import { showActionToast } from "../../lib/ui/action-toast";
import MobileOverflowMenu from "../actions/MobileOverflowMenu";
import LinkSiteIcon from "../icons/LinkSiteIcon";
import PaymentQrFullscreen from "../payments/PaymentQrFullscreen";
import StyledPaymentQr from "../payments/StyledPaymentQr";
import PaymentCardEffects from "./PaymentCardEffects";

export interface PaymentLinkCardProps {
  link: OpenLink;
  site: SiteData;
  interaction?: "minimal";
  brandIconOptions: ResolvedBrandIconOptions;
  themeFingerprint: string;
  effectDebugTuning?: PaymentCardEffectDebugTuning;
}

type PaymentRailEntry = {
  rail: PaymentRail;
  action: ResolvedPaymentRailAction;
};

type PaymentRailActionKind = "copy" | "open" | "qr";
interface PaymentRailActionDescriptor {
  ariaLabel: string;
  kind: PaymentRailActionKind;
  label: string;
  onSelect?: () => void | Promise<void>;
  href?: string;
  rel?: string;
  target?: "_blank" | "_self";
}

export interface MobilePaymentRailActionLayout {
  inlineKinds: PaymentRailActionKind[];
  overflowKinds: PaymentRailActionKind[];
}

const safeId = (value: string): string => value.toLowerCase().replace(/[^a-z0-9_-]/g, "-");

const renderPaymentRailActionIcon = (kind: PaymentRailActionKind) => {
  if (kind === "copy") {
    return <IconCopy class="payment-rail-button-icon" aria-hidden="true" />;
  }

  if (kind === "open") {
    return <IconOpen class="payment-rail-button-icon" aria-hidden="true" />;
  }

  return <IconQrCode class="payment-rail-button-icon" aria-hidden="true" />;
};

const railById = (rails: PaymentRail[], railId: string | undefined): PaymentRail | undefined => {
  if (!railId) {
    return undefined;
  }

  return rails.find((rail) => rail.id === railId);
};

export const resolveMobilePaymentRailActionLayout = (
  kinds: PaymentRailActionKind[],
): MobilePaymentRailActionLayout => {
  const orderedKinds: PaymentRailActionKind[] = ["open", "qr", "copy"];
  const prioritizedKinds = orderedKinds.filter((kind) => kinds.includes(kind));

  return {
    inlineKinds: prioritizedKinds.slice(0, 2),
    overflowKinds: prioritizedKinds.slice(2),
  };
};

export const PaymentLinkCard = (props: PaymentLinkCardProps) => {
  const [toggledQrRailIds, setToggledQrRailIds] = createSignal<Set<string>>(new Set());
  const [fullscreenRailId, setFullscreenRailId] = createSignal<string | undefined>();
  const [fullscreenCtaLabel, setFullscreenCtaLabel] = createSignal("Open Full Screen");

  const siteQrDefaults = createMemo(() => props.site.ui?.payments?.qr);
  const resolvedCardEffects = createMemo(() =>
    resolvePaymentCardEffects({
      payment: props.link.payment,
      sitePayments: props.site.ui?.payments,
    }),
  );
  const rails = createMemo(() => resolveEnabledPaymentRails(props.link.payment));

  const railActions = createMemo<PaymentRailEntry[]>(() =>
    rails().map((rail) => ({
      rail,
      action: resolvePaymentRailAction(rail),
    })),
  );

  const primaryRail = createMemo(() => {
    const availableRails = rails();
    const preferred = railById(availableRails, props.link.payment?.primaryRailId);

    return preferred ?? availableRails[0];
  });

  const primaryAction = createMemo(() => {
    const preferredRail = primaryRail();

    if (preferredRail) {
      return resolvePaymentRailAction(preferredRail);
    }

    return undefined;
  });

  const titleId = () => `payment-link-title-${safeId(props.link.id)}`;
  const descriptionId = () => `payment-link-description-${safeId(props.link.id)}`;

  const description = () =>
    props.link.description?.trim() ??
    (railActions().length > 1
      ? `${railActions().length} payment methods available`
      : "Send support directly");

  const hasSingleRail = createMemo(() => railActions().length === 1);
  const singleRailEntry = createMemo(() => (hasSingleRail() ? railActions()[0] : undefined));

  const effectiveQrDisplay = (): PaymentQrDisplayMode =>
    props.link.payment?.qrDisplay ?? siteQrDefaults()?.displayDefault ?? "always";

  const shouldShowQr = (railEntry: PaymentRailEntry): boolean => {
    if (effectiveQrDisplay() === "hidden") {
      return false;
    }

    if (railEntry.rail.qr?.enabled === false) {
      return false;
    }

    return Boolean(railEntry.action.qrPayload);
  };

  const isQrVisible = (railId: string): boolean => {
    const mode = effectiveQrDisplay();

    if (mode === "hidden") {
      return false;
    }

    const toggled = toggledQrRailIds();

    if (mode === "always") {
      return !toggled.has(railId);
    }

    return toggled.has(railId);
  };

  const toggleQrVisibility = (railId: string) => {
    setToggledQrRailIds((previous) => {
      const next = new Set(previous);

      if (next.has(railId)) {
        next.delete(railId);
      } else {
        next.add(railId);
      }

      return next;
    });
  };

  const qrStyleForRail = (rail: PaymentRail): PaymentQrStyle =>
    rail.qr?.style ?? siteQrDefaults()?.styleDefault ?? "dots";

  const qrForegroundForRail = (rail: PaymentRail): string | undefined =>
    rail.qr?.foregroundColor ?? siteQrDefaults()?.foregroundColorDefault;

  const qrBackgroundForRail = (rail: PaymentRail): string | undefined =>
    rail.qr?.backgroundColor ?? siteQrDefaults()?.backgroundColorDefault;

  const qrLogoModeForRail = (rail: PaymentRail): PaymentQrLogoMode =>
    rail.qr?.logoMode ?? siteQrDefaults()?.logoModeDefault ?? "rail-default";

  const qrLogoSizeForRail = (rail: PaymentRail): number =>
    clampPaymentQrImageSize(
      rail.qr?.badge?.size ?? rail.qr?.logoSize ?? siteQrDefaults()?.logoSizeDefault,
    );

  const qrLogoUrlForRail = (rail: PaymentRail): string | undefined =>
    resolvePaymentQrLogoUrl({
      badge: rail.qr?.badge,
      linkIcon: props.link.icon,
      linkUrl: props.link.url,
      railType: rail.rail,
      railIcon: rail.icon,
      railUrl: rail.url,
      logoMode: qrLogoModeForRail(rail),
      customLogoUrl: rail.qr?.logoUrl,
    });

  const qrFullscreenModeForRail = (rail: PaymentRail): PaymentQrFullscreenMode =>
    rail.qr?.fullscreen ?? siteQrDefaults()?.fullscreenDefault ?? "enabled";

  const canUseFullscreenForRail = (railEntry: {
    rail: PaymentRail;
    action: ResolvedPaymentRailAction;
  }): boolean => {
    if (!shouldShowQr(railEntry) || !railEntry.action.qrPayload) {
      return false;
    }

    return qrFullscreenModeForRail(railEntry.rail) === "enabled";
  };

  const openRailInNewTab = (railEntry: PaymentRailEntry): string | undefined =>
    railEntry.action.openInNewTab ? "noopener noreferrer" : undefined;

  const copyRailValue = async (label: string, value: string | undefined) => {
    if (!value) {
      return;
    }

    const copied = await copyToClipboard(value);
    showActionToast({
      message: copied ? `${label} copied` : `Could not copy ${label}`,
      status: copied ? "copied" : "failed",
    });
  };

  createEffect(() => {
    rails();
    effectiveQrDisplay();
    setToggledQrRailIds(new Set<string>());
  });

  onMount(() => {
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia("(pointer: coarse)");
    const updateLabel = () => {
      const isTouch = media.matches || "ontouchstart" in window;
      setFullscreenCtaLabel(isTouch ? "Tap for Full Screen" : "Open Full Screen");
    };

    updateLabel();
    media.addEventListener("change", updateLabel);

    onCleanup(() => {
      media.removeEventListener("change", updateLabel);
    });
  });

  const activeFullscreenRail = createMemo(() => {
    const railId = fullscreenRailId();

    if (!railId) {
      return undefined;
    }

    return railActions().find((entry) => entry.rail.id === railId);
  });

  const multiHeaderIconAlias = () => props.link.icon ?? "wallet";
  const singleHeaderIconAlias = () =>
    props.link.icon ??
    singleRailEntry()?.action.iconAlias ??
    primaryAction()?.iconAlias ??
    "wallet";
  const railPanelId = (railId: string) => `payment-rail-qr-${safeId(`${props.link.id}-${railId}`)}`;
  const singleRailSummaryValue = (railEntry: PaymentRailEntry): string =>
    railEntry.action.displayValue ?? description();
  const singleRailSummaryNote = (railEntry: PaymentRailEntry): string | undefined => {
    const summary = description();
    return summary === singleRailSummaryValue(railEntry) ? undefined : summary;
  };
  const hasRailActions = (railEntry: PaymentRailEntry): boolean =>
    Boolean(railEntry.action.copyValue || railEntry.action.href || shouldShowQr(railEntry));
  const openRail = (railEntry: PaymentRailEntry) => {
    const href = railEntry.action.href;

    if (!href || typeof window === "undefined") {
      return;
    }

    if (railEntry.action.openInNewTab) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }

    window.location.assign(href);
  };
  const resolveRailActions = (
    railEntry: PaymentRailEntry,
    railId: string,
    qrVisible: boolean,
  ): PaymentRailActionDescriptor[] => {
    const actions: PaymentRailActionDescriptor[] = [];

    if (railEntry.action.href) {
      actions.push({
        ariaLabel: `Open ${railEntry.action.label}`,
        href: railEntry.action.href,
        kind: "open",
        label: "Open",
        onSelect: () => openRail(railEntry),
        rel: openRailInNewTab(railEntry),
        target: railEntry.action.openInNewTab ? "_blank" : "_self",
      });
    }

    if (shouldShowQr(railEntry)) {
      actions.push({
        ariaLabel: `${qrVisible ? "Hide" : "Show"} ${railEntry.action.label} QR code`,
        kind: "qr",
        label: qrVisible ? "Hide QR" : "Show QR",
        onSelect: () => toggleQrVisibility(railId),
      });
    }

    if (railEntry.action.copyValue) {
      actions.push({
        ariaLabel: `Copy ${railEntry.action.label} payment value`,
        kind: "copy",
        label: "Copy",
        onSelect: () => copyRailValue(railEntry.action.label, railEntry.action.copyValue),
      });
    }

    return actions;
  };
  const renderRailActionControl = (
    action: PaymentRailActionDescriptor,
    railId: string,
    className: string,
    qrVisible: boolean,
  ) => {
    if (action.kind === "open" && action.href) {
      return (
        <a
          class={className}
          href={action.href}
          target={action.target}
          rel={action.rel}
          aria-label={action.ariaLabel}
        >
          {renderPaymentRailActionIcon(action.kind)}
          <span class="payment-rail-button-label">{action.label}</span>
        </a>
      );
    }

    return (
      <button
        type="button"
        class={className}
        data-active={action.kind === "qr" && qrVisible ? "true" : "false"}
        onClick={() => action.onSelect?.()}
        aria-label={action.ariaLabel}
        aria-expanded={action.kind === "qr" ? qrVisible : undefined}
        aria-controls={action.kind === "qr" ? railPanelId(railId) : undefined}
      >
        {renderPaymentRailActionIcon(action.kind)}
        <span class="payment-rail-button-label">{action.label}</span>
      </button>
    );
  };

  const renderRailActions = (
    railEntry: PaymentRailEntry,
    railId: string,
    railLabelId: string,
    qrVisible: boolean,
    singleRail: boolean,
  ) => {
    if (!hasRailActions(railEntry)) {
      return null;
    }

    const actions = resolveRailActions(railEntry, railId, qrVisible);
    const mobileLayout = resolveMobilePaymentRailActionLayout(actions.map((action) => action.kind));
    const inlineMobileActions = mobileLayout.inlineKinds
      .map((kind) => actions.find((action) => action.kind === kind))
      .filter((action): action is PaymentRailActionDescriptor => Boolean(action));
    const overflowActions = mobileLayout.overflowKinds
      .map((kind) => actions.find((action) => action.kind === kind))
      .filter((action): action is PaymentRailActionDescriptor => Boolean(action));

    return (
      <div
        class={
          singleRail ? "payment-rail-actions payment-rail-actions--single" : "payment-rail-actions"
        }
        aria-labelledby={railLabelId}
      >
        <div class="payment-rail-actions-desktop">
          <For each={actions}>
            {(action) =>
              renderRailActionControl(
                action,
                railId,
                `payment-rail-button ${action.kind === "open" ? "payment-rail-button--primary" : action.kind === "qr" ? "payment-rail-button--toggle" : "payment-rail-button--secondary"}`,
                qrVisible,
              )
            }
          </For>
        </div>
        <div class="payment-rail-actions-mobile">
          <For each={inlineMobileActions}>
            {(action) =>
              renderRailActionControl(
                action,
                railId,
                `payment-rail-button ${action.kind === "open" ? "payment-rail-button--primary" : action.kind === "qr" ? "payment-rail-button--toggle" : "payment-rail-button--secondary"}`,
                qrVisible,
              )
            }
          </For>
          <MobileOverflowMenu
            actions={overflowActions.map((action) => ({
              label: action.label,
              onSelect: () => action.onSelect?.(),
            }))}
            class="payment-rail-button payment-rail-button--secondary mobile-overflow-menu-trigger"
            contentClass="mobile-overflow-menu-content payment-rail-overflow-menu"
            itemClass="mobile-overflow-menu-item"
            label={`More ${railEntry.action.label} actions`}
          />
        </div>
      </div>
    );
  };

  const renderInlineQrCanvas = (railEntry: PaymentRailEntry) => (
    <StyledPaymentQr
      payload={railEntry.action.qrPayload as string}
      size={176}
      style={qrStyleForRail(railEntry.rail)}
      foregroundColor={qrForegroundForRail(railEntry.rail)}
      backgroundColor={qrBackgroundForRail(railEntry.rail)}
      logoUrl={qrLogoUrlForRail(railEntry.rail)}
      logoSize={qrLogoSizeForRail(railEntry.rail)}
      themeFingerprint={props.themeFingerprint}
      class="payment-rail-qr-canvas"
      ariaLabel={`${railEntry.action.label} QR code`}
    />
  );

  const renderQrPanel = (railEntry: PaymentRailEntry, railId: string, railLabelId: string) => {
    const fullscreenEnabled = () => canUseFullscreenForRail(railEntry);
    const fullscreenLabel = () => `${fullscreenCtaLabel()} for ${railEntry.action.label} QR code`;
    const openFullscreen = () => {
      if (!fullscreenEnabled()) {
        return;
      }

      setFullscreenRailId(railId);
    };

    return (
      <Show when={railEntry.action.qrPayload && shouldShowQr(railEntry)}>
        <Collapsible.Root open={isQrVisible(railId)}>
          <Collapsible.Content
            class="payment-rail-qr-panel"
            id={railPanelId(railId)}
            aria-labelledby={railLabelId}
            data-fullscreen-enabled={fullscreenEnabled() ? "true" : "false"}
          >
            <Show when={fullscreenEnabled()} fallback={renderInlineQrCanvas(railEntry)}>
              <button
                type="button"
                class="payment-rail-qr-activator"
                onClick={openFullscreen}
                aria-label={fullscreenLabel()}
                title={fullscreenLabel()}
              >
                {renderInlineQrCanvas(railEntry)}
                <span class="payment-rail-button payment-rail-button--quiet payment-rail-fullscreen">
                  {fullscreenCtaLabel()}
                </span>
              </button>
            </Show>
          </Collapsible.Content>
        </Collapsible.Root>
      </Show>
    );
  };

  return (
    <article
      class="payment-link-card"
      aria-labelledby={titleId()}
      aria-describedby={descriptionId()}
      data-interaction={props.interaction ?? "minimal"}
      data-link-type={props.link.type}
      data-card-variant="payment"
      data-has-effects={resolvedCardEffects() ? "true" : "false"}
      data-layout={hasSingleRail() ? "single" : "multi"}
      data-rail-count={railActions().length}
      data-bombasticity={resolvedCardEffects()?.bombasticity?.toFixed(2) ?? "0.00"}
    >
      <Show when={resolvedCardEffects()}>
        {(effects) => (
          <PaymentCardEffects
            effects={effects().effects}
            glitterPalette={effects().glitterPalette}
            tone={effects().tone}
            bombasticity={effects().bombasticity}
            debugTuning={props.effectDebugTuning}
          />
        )}
      </Show>

      <div class="payment-link-card-content">
        <Show when={!singleRailEntry()}>
          <section class="payment-multi-layout">
            <div class="payment-card-header">
              <div class="payment-card-heading">
                <LinkSiteIcon
                  icon={multiHeaderIconAlias()}
                  url={props.link.url}
                  label={props.link.label}
                  options={props.brandIconOptions}
                  themeFingerprint={props.themeFingerprint}
                />
                <div class="payment-card-copy">
                  <strong id={titleId()}>{props.link.label}</strong>
                  <span id={descriptionId()}>{description()}</span>
                </div>
              </div>
            </div>

            <ul class="payment-rails-list">
              <For each={railActions()}>
                {(railEntry) => {
                  const railId = railEntry.rail.id;
                  const qrVisible = () => isQrVisible(railId);
                  const railLabelId = `payment-rail-label-${safeId(`${props.link.id}-${railId}`)}`;
                  const hasVisibleQr = () => shouldShowQr(railEntry) && qrVisible();

                  return (
                    <li
                      class="payment-rail-item"
                      data-rail={railEntry.rail.rail}
                      data-has-visible-qr={hasVisibleQr() ? "true" : "false"}
                    >
                      <div
                        class="payment-rail-main"
                        data-has-visible-qr={hasVisibleQr() ? "true" : "false"}
                      >
                        <div class="payment-rail-content">
                          <div class="payment-rail-heading">
                            <LinkSiteIcon
                              icon={railEntry.action.iconAlias}
                              url={railEntry.action.href ?? props.link.url}
                              label={railEntry.action.label}
                              options={props.brandIconOptions}
                              themeFingerprint={props.themeFingerprint}
                            />
                            <div class="payment-rail-copy">
                              <strong id={railLabelId}>{railEntry.action.label}</strong>
                              <span>
                                {railEntry.action.displayValue ?? "Configured payment rail"}
                              </span>
                            </div>
                          </div>

                          {renderRailActions(railEntry, railId, railLabelId, qrVisible(), false)}
                        </div>

                        {renderQrPanel(railEntry, railId, railLabelId)}
                      </div>
                    </li>
                  );
                }}
              </For>
            </ul>
          </section>
        </Show>

        <Show when={singleRailEntry()}>
          {(railEntry) => {
            const railId = railEntry().rail.id;
            const railLabelId = `payment-rail-label-${safeId(`${props.link.id}-${railId}`)}`;
            const hasVisibleQr = () => shouldShowQr(railEntry()) && isQrVisible(railId);

            return (
              <section
                class="payment-single-layout"
                data-rail={railEntry().rail.rail}
                data-has-visible-qr={hasVisibleQr() ? "true" : "false"}
              >
                <div class="payment-single-main">
                  <div class="payment-card-header payment-card-header--single">
                    <div class="payment-card-heading payment-card-heading--single">
                      <LinkSiteIcon
                        icon={singleHeaderIconAlias()}
                        url={resolvePrimaryPaymentHref(props.link.payment)}
                        label={props.link.label}
                        options={props.brandIconOptions}
                        themeFingerprint={props.themeFingerprint}
                      />
                      <div class="payment-card-copy payment-card-copy--single">
                        <strong id={titleId()}>{props.link.label}</strong>
                        <span id={descriptionId()}>{singleRailSummaryValue(railEntry())}</span>
                        <div class="payment-card-supporting-row">
                          <span class="payment-card-meta-badge" id={railLabelId}>
                            {railEntry().action.label}
                          </span>
                          <Show when={singleRailSummaryNote(railEntry())}>
                            {(note) => <span class="payment-card-note">{note()}</span>}
                          </Show>
                        </div>
                      </div>
                    </div>
                  </div>

                  {renderRailActions(railEntry(), railId, railLabelId, isQrVisible(railId), true)}
                </div>

                {renderQrPanel(railEntry(), railId, titleId())}
              </section>
            );
          }}
        </Show>
      </div>

      <Show when={activeFullscreenRail()}>
        {(entry) => (
          <PaymentQrFullscreen
            open={true}
            railLabel={entry().action.label}
            payload={entry().action.qrPayload as string}
            style={qrStyleForRail(entry().rail)}
            foregroundColor={qrForegroundForRail(entry().rail)}
            backgroundColor={qrBackgroundForRail(entry().rail)}
            logoUrl={qrLogoUrlForRail(entry().rail)}
            logoSize={qrLogoSizeForRail(entry().rail)}
            themeFingerprint={props.themeFingerprint}
            onClose={() => setFullscreenRailId(undefined)}
          />
        )}
      </Show>
    </article>
  );
};

export default PaymentLinkCard;
