import { For, Show } from "solid-js";
import type { OpenLink } from "../../lib/content/load-content";
import type { ResolvedBrandIconOptions } from "../../lib/icons/brand-icon-options";
import type { RichCardViewModel } from "../../lib/ui/rich-card-policy";
import LinkSiteIcon from "../icons/LinkSiteIcon";

export interface RichLinkCardProps {
  link: OpenLink;
  viewModel: RichCardViewModel;
  target?: "_blank" | "_self";
  rel?: string;
  interaction?: "minimal";
  brandIconOptions: ResolvedBrandIconOptions;
  themeFingerprint: string;
}

const safeId = (value: string): string => value.toLowerCase().replace(/[^a-z0-9_-]/g, "-");

export const RichLinkCard = (props: RichLinkCardProps) => {
  const target = () => props.target ?? "_blank";
  const rel = () => (target() === "_blank" ? (props.rel ?? "noopener noreferrer") : undefined);
  const titleId = () => `rich-link-title-${safeId(props.link.id)}`;
  const descriptionId = () => `rich-link-description-${safeId(props.link.id)}`;
  const metaId = () => `rich-link-meta-${safeId(props.link.id)}`;
  const sourceId = () => `rich-link-source-${safeId(props.link.id)}`;
  const hasHandleDisplay = () => Boolean(props.viewModel.handleDisplay);
  const hasHeaderMeta = () =>
    props.viewModel.showProfileHeader &&
    Boolean(props.viewModel.handleDisplay || props.viewModel.socialProfile.metrics.length > 0);
  const hasFallbackHandle = () =>
    props.viewModel.showMetaHandle && Boolean(props.viewModel.handleDisplay);
  const fallbackHeaderMeta = () => {
    if (props.viewModel.showProfileHeader) {
      return undefined;
    }

    if (hasFallbackHandle()) {
      return props.viewModel.handleDisplay;
    }

    if (props.viewModel.showSourceLabel && props.viewModel.sourceLabel) {
      return props.viewModel.sourceLabel;
    }

    return undefined;
  };
  const hasFallbackHeaderMeta = () => Boolean(fallbackHeaderMeta());
  const showFooterHandle = () => props.viewModel.showProfileHeader && hasHandleDisplay();
  const hasSourceCopy = () =>
    Boolean(props.viewModel.showSourceLabel && props.viewModel.sourceLabel) || showFooterHandle();
  const ariaDescribedBy = () => {
    const ids = [descriptionId()];
    if (hasHeaderMeta() || hasFallbackHeaderMeta()) {
      ids.push(metaId());
    }
    if (props.viewModel.showSourceLabel && props.viewModel.sourceLabel) {
      ids.push(sourceId());
    }
    return ids.join(" ");
  };
  const ariaLabel = () =>
    target() === "_blank"
      ? `Open ${props.viewModel.title} in a new tab`
      : `Open ${props.viewModel.title}`;
  const showPreviewMedia = () =>
    props.viewModel.imageTreatment !== "off" && Boolean(props.viewModel.previewImageUrl);

  return (
    <a
      class={`rich-link-card image-${props.viewModel.imageTreatment}`}
      href={props.link.url}
      target={target()}
      rel={rel()}
      aria-label={ariaLabel()}
      aria-labelledby={titleId()}
      aria-describedby={ariaDescribedBy()}
      data-interaction={props.interaction ?? "minimal"}
      data-link-type={props.link.type}
      data-card-variant="rich"
      data-image-fit={props.viewModel.imageFit}
      data-mobile-image-layout={props.viewModel.mobileImageLayout}
      data-has-avatar={props.viewModel.socialProfile.profileImageUrl ? "true" : "false"}
      data-has-preview-image={showPreviewMedia() ? "true" : "false"}
      data-has-metrics={props.viewModel.socialProfile.metrics.length > 0 ? "true" : "false"}
      data-has-profile-layout={props.viewModel.showProfileHeader ? "true" : "false"}
    >
      <span class="rich-card-body">
        <Show
          when={props.viewModel.showProfileHeader}
          fallback={
            <span class="rich-card-header rich-card-header-fallback">
              <span class="rich-card-header-copy">
                <strong class="rich-card-title" id={titleId()}>
                  {props.viewModel.title}
                </strong>
                <Show when={hasFallbackHeaderMeta()}>
                  <span class="rich-card-profile-meta rich-card-fallback-meta" id={metaId()}>
                    <Show
                      when={hasFallbackHandle()}
                      fallback={
                        <span class="rich-card-source rich-card-source-inline">
                          {fallbackHeaderMeta()}
                        </span>
                      }
                    >
                      <span class="rich-card-handle">{props.viewModel.handleDisplay}</span>
                    </Show>
                  </span>
                </Show>
              </span>
            </span>
          }
        >
          <span class="rich-card-header rich-card-header-profile">
            <Show
              when={props.viewModel.socialProfile.profileImageUrl}
              fallback={<span class="rich-card-avatar rich-card-avatar-empty" aria-hidden="true" />}
            >
              <span class="rich-card-avatar" aria-hidden="true">
                <img src={props.viewModel.socialProfile.profileImageUrl} alt="" loading="lazy" />
              </span>
            </Show>
            <span class="rich-card-header-copy">
              <strong class="rich-card-title" id={titleId()}>
                {props.viewModel.title}
              </strong>
              <Show when={hasHeaderMeta()}>
                <span class="rich-card-profile-meta" id={metaId()}>
                  <Show when={props.viewModel.handleDisplay}>
                    <span class="rich-card-handle">{props.viewModel.handleDisplay}</span>
                  </Show>
                  <For each={props.viewModel.socialProfile.metrics}>
                    {(metric) => <span class="rich-card-metric">{metric.displayText}</span>}
                  </For>
                </span>
              </Show>
            </span>
          </span>
        </Show>

        <Show when={showPreviewMedia()}>
          <span class="rich-card-media" aria-hidden="true">
            <img src={props.viewModel.previewImageUrl} alt="" loading="lazy" />
          </span>
        </Show>

        <span class="rich-card-description" id={descriptionId()}>
          {props.viewModel.description}
        </span>

        <span class="rich-card-meta">
          <LinkSiteIcon
            icon={props.link.icon}
            url={props.link.url}
            label={props.link.label}
            options={props.brandIconOptions}
            themeFingerprint={props.themeFingerprint}
          />
          <Show when={hasSourceCopy()}>
            <span class="rich-card-meta-copy">
              <Show when={showFooterHandle()}>
                <span class="rich-card-handle" id={metaId()}>
                  {props.viewModel.handleDisplay}
                </span>
              </Show>
              <Show when={props.viewModel.showSourceLabel && props.viewModel.sourceLabel}>
                <span class="rich-card-source" id={sourceId()}>
                  {props.viewModel.sourceLabel}
                </span>
              </Show>
            </span>
          </Show>
        </span>
      </span>
    </a>
  );
};

export default RichLinkCard;
