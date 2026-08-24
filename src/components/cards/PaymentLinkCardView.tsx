import * as Collapsible from "@kobalte/core/collapsible";
import { For, Show } from "solid-js";
import { resolvePrimaryPaymentHref } from "../../lib/payments/rails";
import MobileOverflowMenu from "../actions/MobileOverflowMenu";
import LinkSiteIcon from "../icons/LinkSiteIcon";
import PaymentQrFullscreen from "../payments/PaymentQrFullscreen";
import StyledPaymentQr from "../payments/StyledPaymentQr";
import PaymentCardEffects from "./PaymentCardEffects";
import { PaymentRailActionControl } from "./PaymentRailActionControl";
import {
  type PaymentRailActionDescriptor,
  type PaymentRailEntry,
  resolveMobilePaymentRailActionLayout,
  safePaymentLinkId,
} from "./payment-link-card-actions";
import type { PaymentLinkCardModel } from "./payment-link-card-model";
import type { PaymentLinkCardProps } from "./payment-link-card-types";

interface PaymentViewProps {
  model: PaymentLinkCardModel;
  card: PaymentLinkCardProps;
}

const PaymentRailActions = (
  props: PaymentViewProps & {
    entry: PaymentRailEntry;
    labelId: string;
    qrVisible: boolean;
    singleRail: boolean;
  },
) => {
  const actions = () => props.model.resolveRailActions(props.entry, props.qrVisible);
  const mobileLayout = () =>
    resolveMobilePaymentRailActionLayout(actions().map((action) => action.kind));
  const selectMobileActions = (kinds: PaymentRailActionDescriptor["kind"][]) =>
    kinds
      .map((kind) => actions().find((action) => action.kind === kind))
      .filter((action): action is PaymentRailActionDescriptor => Boolean(action));

  return (
    <Show when={actions().length > 0}>
      <div
        class={
          props.singleRail
            ? "payment-rail-actions payment-rail-actions--single"
            : "payment-rail-actions"
        }
        aria-labelledby={props.labelId}
      >
        <div class="payment-rail-actions-desktop">
          <For each={actions()}>
            {(action) => (
              <PaymentRailActionControl
                action={action}
                panelId={props.model.railPanelId(props.entry.rail.id)}
                className={`payment-rail-button ${action.kind === "open" ? "payment-rail-button--primary" : action.kind === "qr" ? "payment-rail-button--toggle" : "payment-rail-button--secondary"}`}
                qrVisible={props.qrVisible}
              />
            )}
          </For>
        </div>
        <div class="payment-rail-actions-mobile">
          <For each={selectMobileActions(mobileLayout().inlineKinds)}>
            {(action) => (
              <PaymentRailActionControl
                action={action}
                panelId={props.model.railPanelId(props.entry.rail.id)}
                className={`payment-rail-button ${action.kind === "open" ? "payment-rail-button--primary" : action.kind === "qr" ? "payment-rail-button--toggle" : "payment-rail-button--secondary"}`}
                qrVisible={props.qrVisible}
              />
            )}
          </For>
          <MobileOverflowMenu
            actions={selectMobileActions(mobileLayout().overflowKinds).map((action) => ({
              label: action.label,
              onSelect: () => action.onSelect?.(),
            }))}
            class="payment-rail-button payment-rail-button--secondary mobile-overflow-menu-trigger"
            contentClass="mobile-overflow-menu-content payment-rail-overflow-menu"
            itemClass="mobile-overflow-menu-item"
            label={`More ${props.entry.action.label} actions`}
          />
        </div>
      </div>
    </Show>
  );
};

const InlinePaymentQr = (props: PaymentViewProps & { entry: PaymentRailEntry }) => (
  <StyledPaymentQr
    payload={props.entry.action.qrPayload as string}
    size={176}
    style={props.model.qrStyleForRail(props.entry.rail)}
    foregroundColor={props.model.qrForegroundForRail(props.entry.rail)}
    backgroundColor={props.model.qrBackgroundForRail(props.entry.rail)}
    logoUrl={props.model.qrLogoUrlForRail(props.entry.rail)}
    logoSize={props.model.qrLogoSizeForRail(props.entry.rail)}
    themeFingerprint={props.card.themeFingerprint}
    class="payment-rail-qr-canvas"
    ariaLabel={`${props.entry.action.label} QR code`}
  />
);

const PaymentQrPanel = (
  props: PaymentViewProps & {
    entry: PaymentRailEntry;
    labelId: string;
  },
) => {
  const fullscreenEnabled = () => props.model.canUseFullscreenForRail(props.entry);
  const fullscreenLabel = () =>
    `${props.model.signals.fullscreenCtaLabel()} for ${props.entry.action.label} QR code`;
  const openFullscreen = () => {
    if (fullscreenEnabled()) props.model.signals.setFullscreenRailId(props.entry.rail.id);
  };

  return (
    <Show when={props.entry.action.qrPayload && props.model.shouldShowQr(props.entry)}>
      <Collapsible.Root open={props.model.isQrVisible(props.entry.rail.id)}>
        <Collapsible.Content
          class="payment-rail-qr-panel"
          id={props.model.railPanelId(props.entry.rail.id)}
          aria-labelledby={props.labelId}
          data-fullscreen-enabled={fullscreenEnabled() ? "true" : "false"}
          data-has-logo={props.model.qrLogoUrlForRail(props.entry.rail) ? "true" : "false"}
        >
          <Show when={fullscreenEnabled()} fallback={<InlinePaymentQr {...props} />}>
            <button
              type="button"
              class="payment-rail-qr-activator"
              onClick={openFullscreen}
              aria-label={fullscreenLabel()}
              title={fullscreenLabel()}
            >
              <InlinePaymentQr {...props} />
              <span class="payment-rail-button payment-rail-button--quiet payment-rail-fullscreen">
                {props.model.signals.fullscreenCtaLabel()}
              </span>
            </button>
          </Show>
        </Collapsible.Content>
      </Collapsible.Root>
    </Show>
  );
};

const MultiPaymentRail = (props: PaymentViewProps & { entry: PaymentRailEntry }) => {
  const railId = () => props.entry.rail.id;
  const labelId = () =>
    `payment-rail-label-${safePaymentLinkId(`${props.card.link.id}-${railId()}`)}`;
  const qrVisible = () => props.model.isQrVisible(railId());
  const hasVisibleQr = () => props.model.shouldShowQr(props.entry) && qrVisible();

  return (
    <li
      class="payment-rail-item"
      data-rail={props.entry.rail.rail}
      data-has-visible-qr={hasVisibleQr() ? "true" : "false"}
    >
      <div class="payment-rail-main" data-has-visible-qr={hasVisibleQr() ? "true" : "false"}>
        <div class="payment-rail-content">
          <div class="payment-rail-heading">
            <LinkSiteIcon
              icon={props.entry.action.iconAlias}
              url={props.entry.action.href ?? props.card.link.url}
              label={props.entry.action.label}
              options={props.card.brandIconOptions}
              themeFingerprint={props.card.themeFingerprint}
            />
            <div class="payment-rail-copy">
              <strong id={labelId()}>{props.entry.action.label}</strong>
              <span>{props.entry.action.displayValue ?? "Configured payment rail"}</span>
            </div>
          </div>
          <PaymentRailActions
            {...props}
            labelId={labelId()}
            qrVisible={qrVisible()}
            singleRail={false}
          />
        </div>
        <PaymentQrPanel {...props} labelId={labelId()} />
      </div>
    </li>
  );
};

const PaymentMultiLayout = (props: PaymentViewProps) => (
  <section class="payment-multi-layout">
    <div class="payment-card-header">
      <div class="payment-card-heading">
        <LinkSiteIcon
          icon={props.model.multiHeaderIconAlias()}
          url={props.card.link.url}
          label={props.card.link.label}
          options={props.card.brandIconOptions}
          themeFingerprint={props.card.themeFingerprint}
        />
        <div class="payment-card-copy">
          <strong id={props.model.titleId()}>{props.card.link.label}</strong>
          <span id={props.model.descriptionId()}>{props.model.description()}</span>
        </div>
      </div>
    </div>
    <ul class="payment-rails-list">
      <For each={props.model.railActions()}>
        {(entry) => <MultiPaymentRail {...props} entry={entry} />}
      </For>
    </ul>
  </section>
);

const PaymentSingleLayout = (props: PaymentViewProps & { entry: PaymentRailEntry }) => {
  const railId = () => props.entry.rail.id;
  const labelId = () =>
    `payment-rail-label-${safePaymentLinkId(`${props.card.link.id}-${railId()}`)}`;
  const summaryValue = () => props.entry.action.displayValue ?? props.model.description();
  const summaryNote = () =>
    props.model.description() === summaryValue() ? undefined : props.model.description();
  const hasVisibleQr = () =>
    props.model.shouldShowQr(props.entry) && props.model.isQrVisible(railId());

  return (
    <section
      class="payment-single-layout"
      data-rail={props.entry.rail.rail}
      data-has-visible-qr={hasVisibleQr() ? "true" : "false"}
    >
      <div class="payment-single-main">
        <div class="payment-card-header payment-card-header--single">
          <div class="payment-card-heading payment-card-heading--single">
            <LinkSiteIcon
              icon={props.model.singleHeaderIconAlias()}
              url={resolvePrimaryPaymentHref(props.card.link.payment)}
              label={props.card.link.label}
              options={props.card.brandIconOptions}
              themeFingerprint={props.card.themeFingerprint}
            />
            <div class="payment-card-copy payment-card-copy--single">
              <strong id={props.model.titleId()}>{props.card.link.label}</strong>
              <span id={props.model.descriptionId()}>{summaryValue()}</span>
              <div class="payment-card-supporting-row">
                <span class="payment-card-meta-badge" id={labelId()}>
                  {props.entry.action.label}
                </span>
                <Show when={summaryNote()}>
                  {(note) => <span class="payment-card-note">{note()}</span>}
                </Show>
              </div>
            </div>
          </div>
        </div>
        <PaymentRailActions
          {...props}
          labelId={labelId()}
          qrVisible={props.model.isQrVisible(railId())}
          singleRail={true}
        />
      </div>
      <PaymentQrPanel {...props} labelId={props.model.titleId()} />
    </section>
  );
};

const ActivePaymentQrFullscreen = (props: PaymentViewProps) => (
  <Show when={props.model.activeFullscreenRail()}>
    {(entry) => (
      <PaymentQrFullscreen
        open={true}
        railLabel={entry().action.label}
        payload={entry().action.qrPayload as string}
        style={props.model.qrStyleForRail(entry().rail)}
        foregroundColor={props.model.qrForegroundForRail(entry().rail)}
        backgroundColor={props.model.qrBackgroundForRail(entry().rail)}
        logoUrl={props.model.qrLogoUrlForRail(entry().rail)}
        logoSize={props.model.qrLogoSizeForRail(entry().rail)}
        themeFingerprint={props.card.themeFingerprint}
        onClose={() => props.model.signals.setFullscreenRailId(undefined)}
      />
    )}
  </Show>
);

export default function PaymentLinkCardView(props: PaymentViewProps) {
  return (
    <article
      class="payment-link-card"
      aria-labelledby={props.model.titleId()}
      aria-describedby={props.model.descriptionId()}
      data-interaction={props.card.interaction ?? "minimal"}
      data-link-type={props.card.link.type}
      data-card-variant="payment"
      data-has-effects={props.model.resolvedCardEffects() ? "true" : "false"}
      data-layout={props.model.singleRailEntry() ? "single" : "multi"}
      data-rail-count={props.model.railActions().length}
      data-bombasticity={props.model.resolvedCardEffects()?.bombasticity?.toFixed(2) ?? "0.00"}
    >
      <Show when={props.model.resolvedCardEffects()}>
        {(effects) => (
          <PaymentCardEffects
            effects={effects().effects}
            glitterPalette={effects().glitterPalette}
            tone={effects().tone}
            bombasticity={effects().bombasticity}
            debugTuning={props.card.effectDebugTuning}
          />
        )}
      </Show>
      <div class="payment-link-card-content">
        <Show when={!props.model.singleRailEntry()}>
          <PaymentMultiLayout {...props} />
        </Show>
        <Show when={props.model.singleRailEntry()}>
          {(entry) => <PaymentSingleLayout {...props} entry={entry()} />}
        </Show>
      </div>
      <ActivePaymentQrFullscreen {...props} />
    </article>
  );
}
