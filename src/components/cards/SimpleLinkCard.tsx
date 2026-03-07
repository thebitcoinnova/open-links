import { For, Show } from "solid-js";
import type { OpenLink, SiteData } from "../../lib/content/load-content";
import type { ResolvedBrandIconOptions } from "../../lib/icons/brand-icon-options";
import {
  resolveLinkCardDescription,
  resolveLinkSourcePresentation,
} from "../../lib/ui/rich-card-policy";
import { resolveSocialProfileMetadata } from "../../lib/ui/social-profile-metadata";
import LinkSiteIcon from "../icons/LinkSiteIcon";

export interface SimpleLinkCardProps {
  link: OpenLink;
  site: SiteData;
  target?: "_blank" | "_self";
  rel?: string;
  interaction?: "minimal";
  brandIconOptions: ResolvedBrandIconOptions;
  themeFingerprint: string;
}

const safeId = (value: string): string => value.toLowerCase().replace(/[^a-z0-9_-]/g, "-");

export const SimpleLinkCard = (props: SimpleLinkCardProps) => {
  const target = () => props.target ?? "_blank";
  const rel = () => (target() === "_blank" ? (props.rel ?? "noopener noreferrer") : undefined);
  const interaction = () => props.interaction ?? "minimal";
  const titleId = () => `simple-link-title-${safeId(props.link.id)}`;
  const descriptionId = () => `simple-link-description-${safeId(props.link.id)}`;
  const metaId = () => `simple-link-meta-${safeId(props.link.id)}`;
  const sourceId = () => `simple-link-source-${safeId(props.link.id)}`;
  const socialProfile = () => resolveSocialProfileMetadata(props.link);
  const sourcePresentation = () => resolveLinkSourcePresentation(props.site, props.link);
  const description = () => resolveLinkCardDescription(props.link, socialProfile());
  const title = () =>
    socialProfile().usesProfileLayout
      ? (socialProfile().displayName ?? props.link.label)
      : props.link.label;
  const hasProfileMeta = () =>
    Boolean(socialProfile().handleDisplay || socialProfile().metrics.length > 0);
  const showSourceRow = () =>
    Boolean(sourcePresentation().showSourceLabel && sourcePresentation().sourceLabel) &&
    (socialProfile().usesProfileLayout || props.link.type === "rich");
  const ariaDescribedBy = () => {
    const ids = [descriptionId()];
    if (hasProfileMeta()) {
      ids.push(metaId());
    }
    if (showSourceRow()) {
      ids.push(sourceId());
    }
    return ids.join(" ");
  };
  const ariaLabel = () =>
    target() === "_blank" ? `Open ${title()} in a new tab` : `Open ${title()}`;

  return (
    <a
      class="simple-link-card"
      href={props.link.url}
      target={target()}
      rel={rel()}
      aria-label={ariaLabel()}
      aria-labelledby={titleId()}
      aria-describedby={ariaDescribedBy()}
      data-interaction={interaction()}
      data-link-type={props.link.type}
      data-card-variant="simple"
      data-has-profile-layout={socialProfile().usesProfileLayout ? "true" : "false"}
      data-has-avatar={socialProfile().profileImageUrl ? "true" : "false"}
      data-has-metrics={socialProfile().metrics.length > 0 ? "true" : "false"}
    >
      <Show
        when={socialProfile().usesProfileLayout}
        fallback={
          <LinkSiteIcon
            icon={props.link.icon}
            url={props.link.url}
            label={props.link.label}
            options={props.brandIconOptions}
            themeFingerprint={props.themeFingerprint}
          />
        }
      >
        <Show
          when={socialProfile().profileImageUrl}
          fallback={<span class="simple-card-avatar simple-card-avatar-empty" aria-hidden="true" />}
        >
          <span class="simple-card-avatar" aria-hidden="true">
            <img src={socialProfile().profileImageUrl} alt="" loading="lazy" />
          </span>
        </Show>
      </Show>
      <span class="card-copy">
        <span class="simple-card-header">
          <strong id={titleId()}>{title()}</strong>
          <Show when={hasProfileMeta()}>
            <span class="simple-card-profile-line" id={metaId()}>
              <Show when={socialProfile().handleDisplay}>
                <span class="card-handle">{socialProfile().handleDisplay}</span>
              </Show>
              <For each={socialProfile().metrics}>
                {(metric) => <span class="simple-card-metric">{metric.displayText}</span>}
              </For>
            </span>
          </Show>
        </span>
        <span class="simple-card-description" id={descriptionId()}>
          {description()}
        </span>
        <Show when={showSourceRow()}>
          <span class="simple-card-source" id={sourceId()}>
            <span class="simple-card-source-icon">
              <LinkSiteIcon
                icon={props.link.icon}
                url={props.link.url}
                label={props.link.label}
                options={props.brandIconOptions}
                themeFingerprint={props.themeFingerprint}
              />
            </span>
            <span class="simple-card-source-label">{sourcePresentation().sourceLabel}</span>
          </span>
        </Show>
      </span>
    </a>
  );
};

export default SimpleLinkCard;
