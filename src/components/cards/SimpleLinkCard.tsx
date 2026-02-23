import type { OpenLink } from "../../lib/content/load-content";
import type { ResolvedBrandIconOptions } from "../../lib/icons/brand-icon-options";
import LinkSiteIcon from "../icons/LinkSiteIcon";

export interface SimpleLinkCardProps {
  link: OpenLink;
  target?: "_blank" | "_self";
  rel?: string;
  interaction?: "minimal";
  brandIconOptions: ResolvedBrandIconOptions;
  themeFingerprint: string;
}

const safeId = (value: string): string => value.toLowerCase().replace(/[^a-z0-9_-]/g, "-");

export const SimpleLinkCard = (props: SimpleLinkCardProps) => {
  const target = () => props.target ?? "_blank";
  const rel = () => (target() === "_blank" ? props.rel ?? "noopener noreferrer" : undefined);
  const interaction = () => props.interaction ?? "minimal";
  const titleId = () => `simple-link-title-${safeId(props.link.id)}`;
  const descriptionId = () => `simple-link-description-${safeId(props.link.id)}`;
  const description = () => props.link.description ?? props.link.url;
  const ariaLabel = () =>
    target() === "_blank"
      ? `Open ${props.link.label} in a new tab`
      : `Open ${props.link.label}`;

  return (
    <a
      class="simple-link-card"
      href={props.link.url}
      target={target()}
      rel={rel()}
      aria-label={ariaLabel()}
      aria-labelledby={titleId()}
      aria-describedby={descriptionId()}
      data-interaction={interaction()}
      data-link-type={props.link.type}
      data-card-variant="simple"
    >
      <LinkSiteIcon
        icon={props.link.icon}
        url={props.link.url}
        label={props.link.label}
        options={props.brandIconOptions}
        themeFingerprint={props.themeFingerprint}
      />
      <span class="card-copy">
        <strong id={titleId()}>{props.link.label}</strong>
        <span id={descriptionId()}>{description()}</span>
      </span>
    </a>
  );
};

export default SimpleLinkCard;
