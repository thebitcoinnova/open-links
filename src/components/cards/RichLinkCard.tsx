import { Show } from "solid-js";
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
  const handleId = () => `rich-link-handle-${safeId(props.link.id)}`;
  const sourceId = () => `rich-link-source-${safeId(props.link.id)}`;
  const hasMetaCopy = () =>
    Boolean(props.viewModel.handleDisplay || props.viewModel.showSourceLabel);
  const ariaDescribedBy = () => {
    const ids = [descriptionId()];
    if (props.viewModel.handleDisplay) {
      ids.push(handleId());
    }
    if (props.viewModel.showSourceLabel) {
      ids.push(sourceId());
    }
    return ids.join(" ");
  };
  const ariaLabel = () =>
    target() === "_blank"
      ? `Open ${props.viewModel.title} in a new tab`
      : `Open ${props.viewModel.title}`;
  const showMediaSlot = () => props.viewModel.imageTreatment !== "off";

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
      data-has-image={props.viewModel.imageUrl ? "true" : "false"}
    >
      <Show when={showMediaSlot()}>
        <Show
          when={props.viewModel.imageUrl}
          fallback={<span class="rich-card-media rich-card-media-fallback">No preview image</span>}
        >
          <span class="rich-card-media" aria-hidden="true">
            <img src={props.viewModel.imageUrl} alt="" loading="lazy" />
          </span>
        </Show>
      </Show>

      <span class="rich-card-body">
        <strong class="rich-card-title" id={titleId()}>
          {props.viewModel.title}
        </strong>
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
          <Show when={hasMetaCopy()}>
            <span class="rich-card-meta-copy">
              <Show when={props.viewModel.handleDisplay}>
                <span class="rich-card-handle" id={handleId()}>
                  {props.viewModel.handleDisplay}
                </span>
              </Show>
              <Show when={props.viewModel.showSourceLabel}>
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
