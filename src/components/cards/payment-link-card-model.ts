import { createMemo } from "solid-js";
import { resolvePaymentCardEffects } from "../../lib/payments/card-effects";
import { resolveSharedPaymentBrandSite } from "../../lib/payments/payment-identities";
import { clampPaymentQrImageSize, resolvePaymentQrLogoUrl } from "../../lib/payments/qr-badges";
import { resolveEnabledPaymentRails, resolvePaymentRailAction } from "../../lib/payments/rails";
import type {
  PaymentQrDisplayMode,
  PaymentQrFullscreenMode,
  PaymentQrStyle,
  PaymentRail,
} from "../../lib/payments/types";
import { copyToClipboard } from "../../lib/share/copy-to-clipboard";
import { showActionToast } from "../../lib/ui/action-toast";
import {
  type PaymentRailActionDescriptor,
  type PaymentRailEntry,
  maybePaymentRailById,
  safePaymentLinkId,
} from "./payment-link-card-actions";
import type { PaymentLinkCardProps, PaymentLinkCardSignals } from "./payment-link-card-types";

const createPaymentRailCore = (props: PaymentLinkCardProps) => {
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
      action: resolvePaymentRailAction(rail, {
        linkIcon: props.link.icon,
        linkUrl: props.link.url,
      }),
    })),
  );
  const primaryRail = createMemo(
    () => maybePaymentRailById(rails(), props.link.payment?.primaryRailId) ?? rails()[0],
  );
  const primaryAction = createMemo(() => {
    const rail = primaryRail();
    return rail
      ? resolvePaymentRailAction(rail, { linkIcon: props.link.icon, linkUrl: props.link.url })
      : undefined;
  });
  const description = () =>
    props.link.description?.trim() ??
    (railActions().length > 1
      ? `${railActions().length} payment methods available`
      : "Send support directly");
  const singleRailEntry = createMemo(() =>
    railActions().length === 1 ? railActions()[0] : undefined,
  );
  const sharedMultiHeaderBrandSite = createMemo(() =>
    props.link.icon || props.link.url
      ? undefined
      : resolveSharedPaymentBrandSite(
          rails().map((rail) => ({
            linkIcon: props.link.icon,
            linkUrl: props.link.url,
            provider: rail.provider,
            railIcon: rail.icon,
            railType: rail.rail,
            railUrl: rail.url,
          })),
        ),
  );
  const multiHeaderIconAlias = () =>
    props.link.icon ?? sharedMultiHeaderBrandSite()?.id ?? "wallet";
  const singleHeaderIconAlias = () =>
    props.link.icon ??
    singleRailEntry()?.action.iconAlias ??
    primaryAction()?.iconAlias ??
    "wallet";

  return {
    description,
    multiHeaderIconAlias,
    railActions,
    rails,
    resolvedCardEffects,
    singleHeaderIconAlias,
    singleRailEntry,
  };
};

const createPaymentQrModel = (
  props: PaymentLinkCardProps,
  signals: PaymentLinkCardSignals,
  core: ReturnType<typeof createPaymentRailCore>,
) => {
  const siteQrDefaults = createMemo(() => props.site.ui?.payments?.qr);
  const effectiveQrDisplay = (): PaymentQrDisplayMode =>
    props.link.payment?.qrDisplay ?? siteQrDefaults()?.displayDefault ?? "always";
  const shouldShowQr = (entry: PaymentRailEntry): boolean =>
    effectiveQrDisplay() !== "hidden" &&
    entry.rail.qr?.enabled !== false &&
    Boolean(entry.action.qrPayload);
  const isQrVisible = (railId: string): boolean => {
    const mode = effectiveQrDisplay();
    if (mode === "hidden") return false;
    const toggled = signals.toggledQrRailIds();
    return mode === "always" ? !toggled.has(railId) : toggled.has(railId);
  };
  const toggleQrVisibility = (railId: string) => {
    signals.setToggledQrRailIds((previous) => {
      const next = new Set(previous);
      if (next.has(railId)) next.delete(railId);
      else next.add(railId);
      return next;
    });
  };
  const qrStyleForRail = (rail: PaymentRail): PaymentQrStyle =>
    rail.qr?.style ?? siteQrDefaults()?.styleDefault ?? "dots";
  const qrForegroundForRail = (rail: PaymentRail) =>
    rail.qr?.foregroundColor ?? siteQrDefaults()?.foregroundColorDefault;
  const qrBackgroundForRail = (rail: PaymentRail) =>
    rail.qr?.backgroundColor ?? siteQrDefaults()?.backgroundColorDefault;
  const qrLogoSizeForRail = (rail: PaymentRail): number =>
    clampPaymentQrImageSize(
      rail.qr?.badge?.size ?? rail.qr?.logoSize ?? siteQrDefaults()?.logoSizeDefault,
    );
  const qrLogoUrlForRail = (rail: PaymentRail) =>
    resolvePaymentQrLogoUrl({
      badge: rail.qr?.badge,
      defaultLogoMode: siteQrDefaults()?.logoModeDefault,
      link: props.link,
      logoMode: rail.qr?.logoMode,
      customLogoUrl: rail.qr?.logoUrl,
      rail,
    });
  const qrFullscreenModeForRail = (rail: PaymentRail): PaymentQrFullscreenMode =>
    rail.qr?.fullscreen ?? siteQrDefaults()?.fullscreenDefault ?? "enabled";
  const canUseFullscreenForRail = (entry: PaymentRailEntry): boolean =>
    shouldShowQr(entry) &&
    Boolean(entry.action.qrPayload) &&
    qrFullscreenModeForRail(entry.rail) === "enabled";
  const activeFullscreenRail = createMemo(() => {
    const railId = signals.fullscreenRailId();
    return railId ? core.railActions().find((entry) => entry.rail.id === railId) : undefined;
  });

  return {
    activeFullscreenRail,
    canUseFullscreenForRail,
    effectiveQrDisplay,
    isQrVisible,
    qrBackgroundForRail,
    qrForegroundForRail,
    qrLogoSizeForRail,
    qrLogoUrlForRail,
    qrStyleForRail,
    shouldShowQr,
    toggleQrVisibility,
  };
};

const createPaymentActionModel = (
  props: PaymentLinkCardProps,
  qr: ReturnType<typeof createPaymentQrModel>,
) => {
  const railPanelId = (railId: string) =>
    `payment-rail-qr-${safePaymentLinkId(`${props.link.id}-${railId}`)}`;
  const openRail = (entry: PaymentRailEntry) => {
    const href = entry.action.href;
    if (!href || typeof window === "undefined") return;
    if (entry.action.openInNewTab) window.open(href, "_blank", "noopener,noreferrer");
    else window.location.assign(href);
  };
  const copyRailValue = async (label: string, value: string | undefined) => {
    if (!value) return;
    const copied = await copyToClipboard(value);
    showActionToast({
      message: copied ? `${label} copied` : `Could not copy ${label}`,
      status: copied ? "copied" : "failed",
    });
  };
  const resolveRailActions = (entry: PaymentRailEntry, qrVisible: boolean) => {
    const actions: PaymentRailActionDescriptor[] = [];
    if (entry.action.href) {
      actions.push({
        ariaLabel: `Open ${entry.action.label}`,
        href: entry.action.href,
        kind: "open",
        label: "Open",
        onSelect: () => openRail(entry),
        rel: entry.action.openInNewTab ? "noopener noreferrer" : undefined,
        target: entry.action.openInNewTab ? "_blank" : "_self",
      });
    }
    if (qr.shouldShowQr(entry)) {
      actions.push({
        ariaLabel: `${qrVisible ? "Hide" : "Show"} ${entry.action.label} QR code`,
        kind: "qr",
        label: qrVisible ? "Hide QR" : "Show QR",
        onSelect: () => qr.toggleQrVisibility(entry.rail.id),
      });
    }
    if (entry.action.copyValue) {
      actions.push({
        ariaLabel: `Copy ${entry.action.label} payment value`,
        kind: "copy",
        label: "Copy",
        onSelect: () => copyRailValue(entry.action.label, entry.action.copyValue),
      });
    }
    return actions;
  };

  return { railPanelId, resolveRailActions };
};

export const createPaymentLinkCardModel = (
  props: PaymentLinkCardProps,
  signals: PaymentLinkCardSignals,
) => {
  const core = createPaymentRailCore(props);
  const qr = createPaymentQrModel(props, signals, core);
  const actions = createPaymentActionModel(props, qr);
  const titleId = () => `payment-link-title-${safePaymentLinkId(props.link.id)}`;
  const descriptionId = () => `payment-link-description-${safePaymentLinkId(props.link.id)}`;

  return { ...core, ...qr, ...actions, descriptionId, signals, titleId };
};

export type PaymentLinkCardModel = ReturnType<typeof createPaymentLinkCardModel>;
