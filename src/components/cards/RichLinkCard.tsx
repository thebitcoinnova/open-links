import type { OpenLink } from "../../lib/content/load-content";
import type { ResolvedBrandIconOptions } from "../../lib/icons/brand-icon-options";
import type { RichCardViewModel } from "../../lib/ui/rich-card-policy";
import NonPaymentLinkCardShell, { type CardAnalyticsButtonProps } from "./NonPaymentLinkCardShell";

export interface RichLinkCardProps {
  analyticsButton?: CardAnalyticsButtonProps;
  link: OpenLink;
  viewModel: RichCardViewModel;
  target?: "_blank" | "_self";
  rel?: string;
  interaction?: "minimal";
  brandIconOptions: ResolvedBrandIconOptions;
  themeFingerprint: string;
}

export const RichLinkCard = (props: RichLinkCardProps) => (
  <NonPaymentLinkCardShell
    analyticsButton={props.analyticsButton}
    link={props.link}
    viewModel={props.viewModel}
    rootClassName={`rich-link-card image-${props.viewModel.imageTreatment}`}
    cardVariant="rich"
    target={props.target}
    rel={props.rel}
    interaction={props.interaction}
    brandIconOptions={props.brandIconOptions}
    themeFingerprint={props.themeFingerprint}
  />
);

export default RichLinkCard;
