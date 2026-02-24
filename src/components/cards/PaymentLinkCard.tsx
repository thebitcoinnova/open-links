import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import type { OpenLink, SiteData } from "../../lib/content/load-content";
import type { ResolvedBrandIconOptions } from "../../lib/icons/brand-icon-options";
import { resolvePaymentRailLogoUrl } from "../../lib/payments/rail-logos";
import {
  resolveEnabledPaymentRails,
  resolvePaymentRailAction,
  resolvePrimaryPaymentHref,
  type ResolvedPaymentRailAction
} from "../../lib/payments/rails";
import type {
  PaymentQrDisplayMode,
  PaymentQrFullscreenMode,
  PaymentQrLogoMode,
  PaymentQrStyle,
  PaymentRail
} from "../../lib/payments/types";
import LinkSiteIcon from "../icons/LinkSiteIcon";
import PaymentQrFullscreen from "../payments/PaymentQrFullscreen";
import StyledPaymentQr from "../payments/StyledPaymentQr";

export interface PaymentLinkCardProps {
  link: OpenLink;
  site: SiteData;
  target?: "_blank" | "_self";
  rel?: string;
  interaction?: "minimal";
  brandIconOptions: ResolvedBrandIconOptions;
  themeFingerprint: string;
}

const safeId = (value: string): string => value.toLowerCase().replace(/[^a-z0-9_-]/g, "-");

const linkTargetForHref = (href: string | undefined): "_blank" | "_self" => {
  if (!href) {
    return "_self";
  }

  if (/^https?:\/\//i.test(href)) {
    return "_blank";
  }

  return "_self";
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
  const [copiedRailId, setCopiedRailId] = createSignal<string | undefined>();
  const [fullscreenCtaLabel, setFullscreenCtaLabel] = createSignal("Open Full Screen");

  let copiedResetTimer: ReturnType<typeof setTimeout> | undefined;

  const siteQrDefaults = createMemo(() => props.site.ui?.payments?.qr);
  const rails = createMemo(() => resolveEnabledPaymentRails(props.link.payment));

  const railActions = createMemo(() =>
    rails().map((rail) => ({
      rail,
      action: resolvePaymentRailAction(rail)
    }))
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
    props.link.description ?? props.link.url ?? "Support this profile across multiple payment rails";

  const effectiveQrDisplay = (): PaymentQrDisplayMode =>
    props.link.payment?.qrDisplay ?? siteQrDefaults()?.displayDefault ?? "always";

  const primaryHref = createMemo(() => {
    const explicit = props.link.url?.trim();
    if (explicit && explicit.length > 0) {
      return explicit;
    }

    return resolvePrimaryPaymentHref(props.link.payment);
  });

  const primaryTarget = createMemo(() => props.target ?? linkTargetForHref(primaryHref()));
  const primaryRel = createMemo(() =>
    primaryTarget() === "_blank" ? props.rel ?? "noopener noreferrer" : undefined
  );

  const shouldShowQr = (railEntry: { rail: PaymentRail; action: ResolvedPaymentRailAction }): boolean => {
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
      customLogoUrl: rail.qr?.logoUrl
    });

  const qrFullscreenModeForRail = (rail: PaymentRail): PaymentQrFullscreenMode =>
    rail.qr?.fullscreen ?? siteQrDefaults()?.fullscreenDefault ?? "enabled";

  const canUseFullscreenForRail = (railEntry: { rail: PaymentRail; action: ResolvedPaymentRailAction }): boolean => {
    if (!shouldShowQr(railEntry) || !railEntry.action.qrPayload) {
      return false;
    }

    return qrFullscreenModeForRail(railEntry.rail) === "enabled";
  };

  const openRailInNewTab = (railEntry: { rail: PaymentRail; action: ResolvedPaymentRailAction }): string | undefined =>
    railEntry.action.openInNewTab ? "noopener noreferrer" : undefined;

  const copyRailValue = async (railId: string, value: string | undefined) => {
    if (!value || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopiedRailId(railId);

      if (copiedResetTimer) {
        clearTimeout(copiedResetTimer);
      }

      copiedResetTimer = setTimeout(() => {
        setCopiedRailId(undefined);
      }, 1600);
    } catch {
      // Ignore clipboard failures on insecure contexts.
    }
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

  onCleanup(() => {
    if (copiedResetTimer) {
      clearTimeout(copiedResetTimer);
    }
  });

  const activeFullscreenRail = createMemo(() => {
    const railId = fullscreenRailId();

    if (!railId) {
      return undefined;
    }

    return railActions().find((entry) => entry.rail.id === railId);
  });

  const headerIconAlias = () => props.link.icon ?? primaryAction()?.iconAlias ?? "wallet";
  const headerIconUrl = () => primaryHref() ?? primaryAction()?.href ?? "https://openlinks.dev";

  return (
    <article
      class="payment-link-card"
      aria-labelledby={titleId()}
      aria-describedby={descriptionId()}
      data-interaction={props.interaction ?? "minimal"}
      data-link-type={props.link.type}
      data-card-variant="payment"
    >
      <div class="payment-card-header">
        <div class="payment-card-heading">
          <LinkSiteIcon
            icon={headerIconAlias()}
            url={headerIconUrl()}
            label={props.link.label}
            options={props.brandIconOptions}
            themeFingerprint={props.themeFingerprint}
          />
          <div class="payment-card-copy">
            <strong id={titleId()}>{props.link.label}</strong>
            <span id={descriptionId()}>{description()}</span>
          </div>
        </div>

        <Show when={primaryHref()}>
          {(href) => (
            <a
              class="payment-card-primary-action"
              href={href()}
              target={primaryTarget()}
              rel={primaryRel()}
              aria-label={`Open ${props.link.label}`}
            >
              Open
            </a>
          )}
        </Show>
      </div>

      <ul class="payment-rails-list">
        <For each={railActions()}>
          {(railEntry) => {
            const railId = railEntry.rail.id;
            const showQrForRail = () => shouldShowQr(railEntry);
            const qrVisible = () => isQrVisible(railId);
            const railHref = () => railEntry.action.href;
            const railTarget = () => (railEntry.action.openInNewTab ? "_blank" : "_self");
            const railLabelId = `payment-rail-label-${safeId(`${props.link.id}-${railId}`)}`;

            return (
              <li class="payment-rail-item" data-rail={railEntry.rail.rail}>
                <div class="payment-rail-top-row">
                  <div class="payment-rail-heading">
                    <LinkSiteIcon
                      icon={railEntry.action.iconAlias}
                      url={railHref() ?? headerIconUrl()}
                      label={railEntry.action.label}
                      options={props.brandIconOptions}
                      themeFingerprint={props.themeFingerprint}
                    />
                    <div class="payment-rail-copy">
                      <strong id={railLabelId}>{railEntry.action.label}</strong>
                      <span>{railEntry.action.displayValue ?? "Configured payment rail"}</span>
                    </div>
                  </div>

                  <div class="payment-rail-actions">
                    <Show when={railEntry.action.copyValue}>
                      <button
                        type="button"
                        class="payment-rail-button"
                        onClick={() => copyRailValue(railId, railEntry.action.copyValue)}
                        aria-label={`Copy ${railEntry.action.label} payment value`}
                      >
                        {copiedRailId() === railId ? "Copied" : "Copy"}
                      </button>
                    </Show>

                    <Show when={railHref()}>
                      {(href) => (
                        <a
                          class="payment-rail-button"
                          href={href()}
                          target={railTarget()}
                          rel={openRailInNewTab(railEntry)}
                          aria-label={`Open ${railEntry.action.label}`}
                        >
                          Open
                        </a>
                      )}
                    </Show>
                  </div>
                </div>

                <Show when={showQrForRail()}>
                  <div class="payment-rail-qr-tools">
                    <button
                      type="button"
                      class="payment-rail-button"
                      onClick={() => toggleQrVisibility(railId)}
                      aria-expanded={qrVisible()}
                      aria-controls={`payment-rail-qr-${safeId(`${props.link.id}-${railId}`)}`}
                    >
                      {qrVisible() ? "Hide QR" : "Show QR"}
                    </button>
                  </div>
                </Show>

                <Show when={showQrForRail() && qrVisible() && railEntry.action.qrPayload}>
                  <div
                    class="payment-rail-qr-panel"
                    id={`payment-rail-qr-${safeId(`${props.link.id}-${railId}`)}`}
                    role="region"
                    aria-labelledby={railLabelId}
                  >
                    <StyledPaymentQr
                      payload={railEntry.action.qrPayload as string}
                      size={176}
                      style={qrStyleForRail(railEntry.rail)}
                      foregroundColor={qrForegroundForRail(railEntry.rail)}
                      backgroundColor={qrBackgroundForRail(railEntry.rail)}
                      logoUrl={qrLogoUrlForRail(railEntry.rail)}
                      logoSize={qrLogoSizeForRail(railEntry.rail)}
                      class="payment-rail-qr-canvas"
                      ariaLabel={`${railEntry.action.label} QR code`}
                    />

                    <Show when={canUseFullscreenForRail(railEntry)}>
                      <button
                        type="button"
                        class="payment-rail-button payment-rail-fullscreen"
                        onClick={() => setFullscreenRailId(railId)}
                      >
                        {fullscreenCtaLabel()}
                      </button>
                    </Show>
                  </div>
                </Show>
              </li>
            );
          }}
        </For>
      </ul>

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
            onClose={() => setFullscreenRailId(undefined)}
          />
        )}
      </Show>
    </article>
  );
};

export default PaymentLinkCard;
