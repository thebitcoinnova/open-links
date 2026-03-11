import { For, Show, createMemo } from "solid-js";
import type { OpenLink } from "../../lib/content/load-content";
import type { ResolvedBrandIconOptions } from "../../lib/icons/brand-icon-options";
import { IconAnalytics, IconShare } from "../../lib/icons/custom-icons";
import type { ShareLinkResult } from "../../lib/share/share-link";
import { showActionToast } from "../../lib/ui/action-toast";
import type {
  NonPaymentCardMetaItem,
  NonPaymentCardViewModel,
} from "../../lib/ui/rich-card-policy";
import LinkSiteIcon from "../icons/LinkSiteIcon";

export interface CardAnalyticsButtonProps {
  ariaLabel: string;
  kind: "analytics" | "share";
  onClick: () => undefined | Promise<ShareLinkResult | undefined>;
  title?: string;
}

export interface NonPaymentLinkCardShellProps {
  resolveCardActions?: () => CardAnalyticsButtonProps[];
  link: OpenLink;
  viewModel: NonPaymentCardViewModel;
  rootClassName: string;
  cardVariant: "simple" | "rich";
  target?: "_blank" | "_self";
  rel?: string;
  interaction?: "minimal";
  brandIconOptions: ResolvedBrandIconOptions;
  themeFingerprint: string;
}

const safeId = (value: string): string => value.toLowerCase().replace(/[^a-z0-9_-]/g, "-");

const metaItemClassName = (item: NonPaymentCardMetaItem): string => {
  if (item.kind === "handle") {
    return "non-payment-card-meta-item card-handle";
  }

  if (item.kind === "metric") {
    return "non-payment-card-meta-item card-metric";
  }

  return "non-payment-card-meta-item card-source-inline";
};

export const NonPaymentLinkCardShell = (props: NonPaymentLinkCardShellProps) => {
  const cardActions = createMemo(() => props.resolveCardActions?.() ?? []);
  const target = () => props.target ?? "_blank";
  const rel = () => (target() === "_blank" ? (props.rel ?? "noopener noreferrer") : undefined);
  const interaction = () => props.interaction ?? "minimal";
  const titleId = () => `${props.cardVariant}-link-title-${safeId(props.link.id)}`;
  const descriptionId = () => `${props.cardVariant}-link-description-${safeId(props.link.id)}`;
  const metaId = () => `${props.cardVariant}-link-meta-${safeId(props.link.id)}`;
  const sourceId = () => `${props.cardVariant}-link-source-${safeId(props.link.id)}`;
  const hasHeaderMeta = () => props.viewModel.headerMetaItems.length > 0;
  const hasFooterSource = () => Boolean(props.viewModel.footerSourceLabel);
  const showFooter = () => props.viewModel.showFooterIcon || hasFooterSource();
  const ariaDescribedBy = () => {
    const ids = [descriptionId()];

    if (hasHeaderMeta()) {
      ids.push(metaId());
    }

    if (hasFooterSource()) {
      ids.push(sourceId());
    }

    return ids.join(" ");
  };
  const ariaLabel = () =>
    target() === "_blank"
      ? `Open ${props.viewModel.title} in a new tab`
      : `Open ${props.viewModel.title}`;

  const handleCardAction = async (action: CardAnalyticsButtonProps) => {
    showActionToast((await action.onClick()) as ShareLinkResult | undefined);
  };

  return (
    <div
      class="non-payment-card-frame"
      data-has-actions={cardActions().length > 0 ? "true" : "false"}
    >
      <a
        class={props.rootClassName}
        href={props.link.url}
        target={target()}
        rel={rel()}
        aria-label={ariaLabel()}
        aria-describedby={ariaDescribedBy()}
        data-interaction={interaction()}
        data-link-type={props.link.type}
        data-card-variant={props.cardVariant}
        data-image-fit={props.viewModel.imageFit}
        data-image-treatment={props.viewModel.imageTreatment}
        data-lead-kind={props.viewModel.leadKind}
        data-has-avatar={props.viewModel.socialProfile.profileImageUrl ? "true" : "false"}
        data-has-preview-image={props.viewModel.leadKind === "preview" ? "true" : "false"}
        data-has-metrics={props.viewModel.socialProfile.metrics.length > 0 ? "true" : "false"}
        data-has-profile-layout={props.viewModel.socialProfile.usesProfileLayout ? "true" : "false"}
        data-has-header-meta={hasHeaderMeta() ? "true" : "false"}
        data-has-footer={showFooter() ? "true" : "false"}
        data-has-description-image-row={props.viewModel.showDescriptionImageRow ? "true" : "false"}
        data-has-actions={cardActions().length > 0 ? "true" : "false"}
      >
        <span class="non-payment-card-shell">
          <span class={`non-payment-card-lead non-payment-card-lead-${props.viewModel.leadKind}`}>
            <Show when={props.viewModel.leadKind === "preview" && props.viewModel.leadImageUrl}>
              <span class="rich-card-media non-payment-card-lead-media" aria-hidden="true">
                <img src={props.viewModel.leadImageUrl} alt="" loading="lazy" />
              </span>
            </Show>
            <Show when={props.viewModel.leadKind === "avatar"}>
              <Show
                when={props.viewModel.leadImageUrl}
                fallback={
                  <span class="card-lead-avatar card-lead-avatar-empty" aria-hidden="true" />
                }
              >
                <span class="card-lead-avatar" aria-hidden="true">
                  <img src={props.viewModel.leadImageUrl} alt="" loading="lazy" />
                </span>
              </Show>
            </Show>
            <Show when={props.viewModel.leadKind === "icon"}>
              <span class="non-payment-card-lead-icon" aria-hidden="true">
                <LinkSiteIcon
                  icon={props.link.icon}
                  url={props.link.url}
                  label={props.link.label}
                  options={props.brandIconOptions}
                  themeFingerprint={props.themeFingerprint}
                />
              </span>
            </Show>
          </span>

          <span
            class="non-payment-card-summary"
            data-has-actions={cardActions().length > 0 ? "true" : "false"}
          >
            <span class="non-payment-card-title-row">
              <strong class="non-payment-card-title" id={titleId()}>
                {props.viewModel.title}
              </strong>
            </span>
            <Show when={hasHeaderMeta()}>
              <span class="non-payment-card-header-meta" id={metaId()}>
                <For each={props.viewModel.headerMetaItems}>
                  {(item) => <span class={metaItemClassName(item)}>{item.text}</span>}
                </For>
              </span>
            </Show>
          </span>

          <span class="non-payment-card-description" id={descriptionId()}>
            {props.viewModel.description}
          </span>

          <Show
            when={
              props.cardVariant === "rich" &&
              props.viewModel.showDescriptionImageRow &&
              props.viewModel.descriptionImageUrl
            }
          >
            <span class="rich-card-media non-payment-card-description-image" aria-hidden="true">
              <img src={props.viewModel.descriptionImageUrl} alt="" loading="lazy" />
            </span>
          </Show>

          <Show when={showFooter()}>
            <span class="non-payment-card-footer">
              <Show when={props.viewModel.showFooterIcon}>
                <span class="non-payment-card-footer-icon">
                  <LinkSiteIcon
                    icon={props.link.icon}
                    url={props.link.url}
                    label={props.link.label}
                    options={props.brandIconOptions}
                    themeFingerprint={props.themeFingerprint}
                  />
                </span>
              </Show>
              <Show when={hasFooterSource()}>
                <span class="non-payment-card-source-label" id={sourceId()}>
                  {props.viewModel.footerSourceLabel}
                </span>
              </Show>
            </span>
          </Show>
        </span>
      </a>

      <Show when={cardActions().length > 0}>
        <span class="card-action-row" aria-label="Card actions">
          <For each={cardActions()}>
            {(action) => (
              <button
                type="button"
                class={`card-action-button card-action-button-${action.kind}`}
                aria-label={action.ariaLabel}
                title={action.title ?? action.ariaLabel}
                onClick={() => handleCardAction(action)}
              >
                <Show
                  when={action.kind === "analytics"}
                  fallback={<IconShare class="card-action-button-icon" aria-hidden="true" />}
                >
                  <IconAnalytics class="card-action-button-icon" aria-hidden="true" />
                </Show>
              </button>
            )}
          </For>
        </span>
      </Show>
    </div>
  );
};

export default NonPaymentLinkCardShell;
