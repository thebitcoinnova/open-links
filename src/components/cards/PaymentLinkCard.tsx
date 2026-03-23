import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import type { OpenLink, SiteData } from "../../lib/content/load-content";
import type { ResolvedBrandIconOptions } from "../../lib/icons/brand-icon-options";
import { IconCopy, IconOpen, IconQrCode } from "../../lib/icons/custom-icons";
import { resolvePaymentCardEffects } from "../../lib/payments/card-effects";
import { resolvePaymentRailLogoUrl } from "../../lib/payments/rail-logos";
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
}

type PaymentRailEntry = {
  rail: PaymentRail;
  action: ResolvedPaymentRailAction;
};

type PaymentRailActionKind = "copy" | "open" | "qr";

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

const clampLogoSize = (value: number | undefined): number => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.24;
  }

  return Math.min(0.35, Math.max(0.15, value));
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
    clampLogoSize(rail.qr?.logoSize ?? siteQrDefaults()?.logoSizeDefault);

  const qrLogoUrlForRail = (rail: PaymentRail): string | undefined =>
    resolvePaymentRailLogoUrl({
      railType: rail.rail,
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

    return (
      <div
        class={
          singleRail ? "payment-rail-actions payment-rail-actions--single" : "payment-rail-actions"
        }
        aria-labelledby={railLabelId}
      >
        <Show when={railEntry.action.href}>
          {(href) => (
            <a
              class="payment-rail-button payment-rail-button--primary"
              href={href()}
              target={railEntry.action.openInNewTab ? "_blank" : "_self"}
              rel={openRailInNewTab(railEntry)}
              aria-label={`Open ${railEntry.action.label}`}
            >
              {renderPaymentRailActionIcon("open")}
              <span class="payment-rail-button-label">Open</span>
            </a>
          )}
        </Show>

        <Show when={railEntry.action.copyValue}>
          <button
            type="button"
            class="payment-rail-button payment-rail-button--secondary"
            onClick={() => copyRailValue(railEntry.action.label, railEntry.action.copyValue)}
            aria-label={`Copy ${railEntry.action.label} payment value`}
          >
            {renderPaymentRailActionIcon("copy")}
            <span class="payment-rail-button-label">Copy</span>
          </button>
        </Show>

        <Show when={shouldShowQr(railEntry)}>
          <button
            type="button"
            class="payment-rail-button payment-rail-button--toggle"
            data-active={qrVisible ? "true" : "false"}
            onClick={() => toggleQrVisibility(railId)}
            aria-label={`${qrVisible ? "Hide" : "Show"} ${railEntry.action.label} QR code`}
            aria-expanded={qrVisible}
            aria-controls={railPanelId(railId)}
          >
            {renderPaymentRailActionIcon("qr")}
            <span class="payment-rail-button-label">{qrVisible ? "Hide QR" : "Show QR"}</span>
          </button>
        </Show>
      </div>
    );
  };

  const renderQrPanel = (railEntry: PaymentRailEntry, railId: string, railLabelId: string) => (
    <Show when={railEntry.action.qrPayload}>
      <section class="payment-rail-qr-panel" id={railPanelId(railId)} aria-labelledby={railLabelId}>
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

        <Show when={canUseFullscreenForRail(railEntry)}>
          <button
            type="button"
            class="payment-rail-button payment-rail-button--quiet payment-rail-fullscreen"
            onClick={() => setFullscreenRailId(railId)}
          >
            {fullscreenCtaLabel()}
          </button>
        </Show>
      </section>
    </Show>
  );

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
                  const hasVisibleQr = () =>
                    shouldShowQr(railEntry) && qrVisible() && Boolean(railEntry.action.qrPayload);

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

                        <Show when={hasVisibleQr()}>
                          {renderQrPanel(railEntry, railId, railLabelId)}
                        </Show>
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
            const hasVisibleQr = () =>
              shouldShowQr(railEntry()) &&
              isQrVisible(railId) &&
              Boolean(railEntry().action.qrPayload);

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

                <Show when={hasVisibleQr()}>{renderQrPanel(railEntry(), railId, titleId())}</Show>
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
