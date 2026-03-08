import type { OpenLink, SiteData } from "../../lib/content/load-content";
import type { ResolvedBrandIconOptions } from "../../lib/icons/brand-icon-options";
import { buildSimpleCardViewModel } from "../../lib/ui/rich-card-policy";
import NonPaymentLinkCardShell from "./NonPaymentLinkCardShell";

export interface SimpleLinkCardProps {
  link: OpenLink;
  site: SiteData;
  target?: "_blank" | "_self";
  rel?: string;
  interaction?: "minimal";
  brandIconOptions: ResolvedBrandIconOptions;
  themeFingerprint: string;
}

export const SimpleLinkCard = (props: SimpleLinkCardProps) => {
  const viewModel = () => buildSimpleCardViewModel(props.site, props.link);

  return (
    <NonPaymentLinkCardShell
      link={props.link}
      viewModel={viewModel()}
      rootClassName="simple-link-card"
      cardVariant="simple"
      target={props.target}
      rel={props.rel}
      interaction={props.interaction}
      brandIconOptions={props.brandIconOptions}
      themeFingerprint={props.themeFingerprint}
    />
  );
};

export default SimpleLinkCard;
