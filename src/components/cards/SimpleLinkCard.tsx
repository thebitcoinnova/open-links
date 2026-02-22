import type { OpenLink } from "../../lib/content/load-content";

export interface SimpleLinkCardProps {
  link: OpenLink;
  target?: "_blank" | "_self";
  rel?: string;
  interaction?: "minimal";
}

const iconFor = (value?: string) => {
  switch ((value ?? "").toLowerCase()) {
    case "github":
      return "GH";
    case "linkedin":
      return "IN";
    case "x":
      return "X";
    case "youtube":
      return "YT";
    case "instagram":
      return "IG";
    default:
      return "↗";
  }
};

export const SimpleLinkCard = (props: SimpleLinkCardProps) => {
  const target = () => props.target ?? "_blank";
  const rel = () => (target() === "_blank" ? props.rel ?? "noreferrer" : undefined);
  const interaction = () => props.interaction ?? "minimal";

  return (
    <a
      class="simple-link-card"
      href={props.link.url}
      target={target()}
      rel={rel()}
      aria-label={`Open ${props.link.label}`}
      data-interaction={interaction()}
      data-link-type={props.link.type}
    >
      <span class="card-icon" aria-hidden="true">
        {iconFor(props.link.icon)}
      </span>
      <span class="card-copy">
        <strong>{props.link.label}</strong>
        <span>{props.link.description ?? props.link.url}</span>
      </span>
    </a>
  );
};

export default SimpleLinkCard;
