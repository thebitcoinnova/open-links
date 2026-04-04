import { For, Show, createMemo, createSignal } from "solid-js";
import type { OpenLink } from "../../lib/content/load-content";
import type { ResolvedBrandIconOptions } from "../../lib/icons/brand-icon-options";
import type { ShareLinkResult } from "../../lib/share/share-link";
import { showActionToast } from "../../lib/ui/action-toast";
import type {
  NonPaymentCardMetaItem,
  NonPaymentCardViewModel,
  RichProfilePreviewRenderKind,
} from "../../lib/ui/rich-card-policy";
import { resolveProfilePreviewRenderKind } from "../../lib/ui/rich-card-policy";
import BottomActionBar, { type BottomActionBarItem } from "../actions/BottomActionBar";
import LinkSiteIcon from "../icons/LinkSiteIcon";

export interface CardActionButtonProps {
  ariaLabel: string;
  kind: "analytics" | "copy" | "qr" | "share";
  onClick: () => undefined | Promise<ShareLinkResult | undefined>;
  title?: string;
}

export interface NonPaymentLinkCardShellProps {
  resolveCardActions?: () => CardActionButtonProps[];
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
const profilePreviewAspectRatioCache = new Map<string, number | null>();
const pendingProfilePreviewAspectRatioUrls = new Set<string>();

const metaItemClassName = (item: NonPaymentCardMetaItem): string => {
  if (item.kind === "handle") {
    return "non-payment-card-meta-item card-handle";
  }

  if (item.kind === "metric") {
    return "non-payment-card-meta-item card-metric";
  }

  return "non-payment-card-meta-item card-source-inline";
};

const resolveNaturalAspectRatio = (
  naturalWidth: number,
  naturalHeight: number,
): number | undefined => {
  if (
    !Number.isFinite(naturalWidth) ||
    !Number.isFinite(naturalHeight) ||
    naturalWidth <= 0 ||
    naturalHeight <= 0
  ) {
    return undefined;
  }

  return naturalWidth / naturalHeight;
};

export const NonPaymentLinkCardShell = (props: NonPaymentLinkCardShellProps) => {
  const cardActions = createMemo(() => props.resolveCardActions?.() ?? []);
  const referral = () => props.viewModel.referral;
  const profilePreview = () => props.viewModel.profilePreview;
  const [profilePreviewMeasurementVersion, setProfilePreviewMeasurementVersion] = createSignal(0);
  const target = () => props.target ?? "_blank";
  const rel = () => (target() === "_blank" ? (props.rel ?? "noopener noreferrer") : undefined);
  const interaction = () => props.interaction ?? "minimal";
  const hasProfileLayout = () => props.viewModel.socialProfile.usesProfileLayout;
  const titleId = () => `${props.cardVariant}-link-title-${safeId(props.link.id)}`;
  const descriptionId = () => `${props.cardVariant}-link-description-${safeId(props.link.id)}`;
  const metaId = () => `${props.cardVariant}-link-meta-${safeId(props.link.id)}`;
  const sourceId = () => `${props.cardVariant}-link-source-${safeId(props.link.id)}`;
  const hasHeaderMeta = () => props.viewModel.headerMetaItems.length > 0;
  const hasFooterSource = () => Boolean(props.viewModel.footerSourceLabel);
  const hasReferral = () => Boolean(referral());
  const hasReferralBenefits = () => (referral()?.benefitRows.length ?? 0) > 0;
  const hasInlineReferralTerms = () => Boolean(referral()?.terms?.inlineSummary);
  const hasReferralTermsLink = () => Boolean(referral()?.terms?.url);
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
    props.viewModel.contactKind === "email"
      ? props.viewModel.contactValue
        ? `Send email to ${props.viewModel.contactValue}`
        : "Send email"
      : target() === "_blank"
        ? `Open ${props.viewModel.title} in a new tab`
        : `Open ${props.viewModel.title}`;
  const descriptionClassName = () =>
    props.viewModel.contactKind === "email"
      ? "non-payment-card-description non-payment-card-description-email"
      : "non-payment-card-description";
  const referralTermsLinkAriaLabel = () =>
    `Open terms for ${props.viewModel.title}${target() === "_blank" ? " in a new tab" : ""}`;

  const handleCardAction = async (action: CardActionButtonProps) => {
    showActionToast((await action.onClick()) as ShareLinkResult | undefined);
  };

  const resolveActionLabel = (kind: CardActionButtonProps["kind"]): string => {
    if (kind === "analytics") {
      return "Stats";
    }

    if (kind === "qr") {
      return "QR";
    }

    if (kind === "copy") {
      return "Copy";
    }

    return "Share";
  };

  const actionItems = createMemo<BottomActionBarItem[]>(() =>
    cardActions().map((action) => ({
      ariaLabel: action.ariaLabel,
      kind: action.kind,
      label: resolveActionLabel(action.kind),
      onClick: async () => {
        await handleCardAction(action);
      },
      title: action.title,
    })),
  );
  const hasActions = () => actionItems().length > 0;
  const resolveMeasuredProfilePreviewAspectRatio = (): number | undefined => {
    const currentProfilePreview = profilePreview();
    const previewImageUrl = currentProfilePreview.imageUrl;

    if (
      !currentProfilePreview.enabled ||
      !previewImageUrl ||
      currentProfilePreview.placement === "bottom-row" ||
      typeof Image === "undefined"
    ) {
      return undefined;
    }

    const cachedRatio = profilePreviewAspectRatioCache.get(previewImageUrl);
    if (cachedRatio !== undefined) {
      return cachedRatio ?? undefined;
    }

    if (pendingProfilePreviewAspectRatioUrls.has(previewImageUrl)) {
      return undefined;
    }

    pendingProfilePreviewAspectRatioUrls.add(previewImageUrl);
    const image = new Image();
    const settle = (maybeAspectRatio: number | undefined) => {
      profilePreviewAspectRatioCache.set(previewImageUrl, maybeAspectRatio ?? null);
      pendingProfilePreviewAspectRatioUrls.delete(previewImageUrl);
      setProfilePreviewMeasurementVersion((value) => value + 1);
      image.removeEventListener("load", handleLoad);
      image.removeEventListener("error", handleError);
    };
    const handleLoad = () => {
      settle(resolveNaturalAspectRatio(image.naturalWidth, image.naturalHeight));
    };
    const handleError = () => {
      settle(undefined);
    };

    image.addEventListener("load", handleLoad);
    image.addEventListener("error", handleError);
    image.src = previewImageUrl;

    if (image.complete) {
      const maybeAspectRatio = resolveNaturalAspectRatio(image.naturalWidth, image.naturalHeight);
      profilePreviewAspectRatioCache.set(previewImageUrl, maybeAspectRatio ?? null);
      pendingProfilePreviewAspectRatioUrls.delete(previewImageUrl);
      image.removeEventListener("load", handleLoad);
      image.removeEventListener("error", handleError);
      return maybeAspectRatio;
    }

    return profilePreviewAspectRatioCache.get(previewImageUrl) ?? undefined;
  };
  const profilePreviewRenderKind = createMemo<RichProfilePreviewRenderKind>(() => {
    profilePreviewMeasurementVersion();

    return resolveProfilePreviewRenderKind({
      enabled: profilePreview().enabled && Boolean(profilePreview().imageUrl),
      placement: profilePreview().placement,
      maybeMeasuredAspectRatio: resolveMeasuredProfilePreviewAspectRatio(),
      bannerMinAspectRatio: profilePreview().bannerMinAspectRatio,
      nonBannerFallback: profilePreview().nonBannerFallback,
    });
  });

  return (
    <div
      class="non-payment-card-frame"
      data-card-variant={props.cardVariant}
      data-has-actions={hasActions() ? "true" : "false"}
      data-has-referral={hasReferral() ? "true" : "false"}
      data-has-referral-terms-link={hasReferralTermsLink() ? "true" : "false"}
      data-has-profile-layout={hasProfileLayout() ? "true" : "false"}
      data-has-profile-preview-media={profilePreview().enabled ? "true" : "false"}
      data-profile-preview-placement={profilePreview().placement}
      data-profile-preview-render={profilePreviewRenderKind()}
      data-lead-kind={props.viewModel.leadKind}
      data-image-treatment={props.viewModel.imageTreatment}
      data-link-kind={props.viewModel.linkKind}
      data-link-scheme={props.viewModel.linkScheme}
      data-contact-kind={props.viewModel.contactKind}
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
        data-has-profile-layout={hasProfileLayout() ? "true" : "false"}
        data-has-header-meta={hasHeaderMeta() ? "true" : "false"}
        data-has-footer={showFooter() ? "true" : "false"}
        data-has-profile-preview-media={profilePreview().enabled ? "true" : "false"}
        data-profile-preview-placement={profilePreview().placement}
        data-profile-preview-render={profilePreviewRenderKind()}
        data-has-actions={hasActions() ? "true" : "false"}
        data-has-referral={hasReferral() ? "true" : "false"}
        data-link-kind={props.viewModel.linkKind}
        data-link-scheme={props.viewModel.linkScheme}
        data-contact-kind={props.viewModel.contactKind}
      >
        <span
          class="non-payment-card-shell"
          data-profile-preview-render={profilePreviewRenderKind()}
        >
          <Show when={profilePreviewRenderKind() === "top-banner" && profilePreview().imageUrl}>
            <span
              class="rich-card-media non-payment-card-profile-preview non-payment-card-profile-preview-top-banner"
              aria-hidden="true"
            >
              <img src={profilePreview().imageUrl} alt="" loading="lazy" />
            </span>
          </Show>

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
            data-has-actions={hasActions() ? "true" : "false"}
            data-has-referral={hasReferral() ? "true" : "false"}
          >
            <Show when={hasReferral()}>
              <span class="non-payment-card-referral-badge-row">
                <span class="non-payment-card-referral-badge">{referral()?.disclosureLabel}</span>
              </span>
            </Show>
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
            <Show when={hasReferralBenefits()}>
              <span class="non-payment-card-referral-benefits">
                <For each={referral()?.benefitRows ?? []}>
                  {(benefit) => (
                    <span
                      class="non-payment-card-referral-benefit-row"
                      data-benefit-kind={benefit.kind}
                    >
                      <span class="non-payment-card-referral-benefit-label">{benefit.label}</span>
                      <span class="non-payment-card-referral-benefit-value">{benefit.value}</span>
                    </span>
                  )}
                </For>
              </span>
            </Show>
            <span class={descriptionClassName()} id={descriptionId()}>
              {props.viewModel.description}
            </span>
            <Show when={hasInlineReferralTerms()}>
              <span class="non-payment-card-referral-terms">
                {referral()?.terms?.inlineSummary}
              </span>
            </Show>
          </span>

          <Show when={profilePreviewRenderKind() === "bottom-row" && profilePreview().imageUrl}>
            <span
              class="rich-card-media non-payment-card-profile-preview non-payment-card-profile-preview-bottom-row"
              aria-hidden="true"
            >
              <img src={profilePreview().imageUrl} alt="" loading="lazy" />
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

          <Show when={profilePreviewRenderKind() === "compact-end" && profilePreview().imageUrl}>
            <span
              class="rich-card-media non-payment-card-profile-preview non-payment-card-profile-preview-compact-end"
              aria-hidden="true"
            >
              <img src={profilePreview().imageUrl} alt="" loading="lazy" />
            </span>
          </Show>
        </span>
      </a>

      <Show when={hasReferralTermsLink()}>
        <div class="non-payment-card-secondary-links">
          <a
            class="non-payment-card-referral-terms-link"
            href={referral()?.terms?.url}
            target={target()}
            rel={rel()}
            aria-label={referralTermsLinkAriaLabel()}
            title={referralTermsLinkAriaLabel()}
          >
            {referral()?.terms?.linkLabel ?? "Terms"}
          </a>
        </div>
      </Show>

      <BottomActionBar class="card-action-row" items={actionItems()} label="Card actions" />
    </div>
  );
};

export default NonPaymentLinkCardShell;
