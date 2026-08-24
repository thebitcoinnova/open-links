import PaymentLinkCard from "../components/cards/PaymentLinkCard";
import RichLinkCard from "../components/cards/RichLinkCard";
import SimpleLinkCard from "../components/cards/SimpleLinkCard";
import type { OpenLink, SiteData } from "../lib/content/load-content";
import type { ResolvedBrandIconOptions } from "../lib/icons/brand-icon-options";
import { isPaymentCapableLink } from "../lib/payments/types";
import { copyLink, shareLink } from "../lib/share/share-link";
import { buildRichCardViewModel, resolveRichCardVariant } from "../lib/ui/rich-card-policy";

interface PublicLinkCardProps {
  brandIconOptions: ResolvedBrandIconOptions;
  hasHistory: boolean;
  link: OpenLink;
  onHistoryOpen: (linkId: string) => void;
  onQrOpen: (link: OpenLink, payload: string) => void;
  site: SiteData;
  target: "_blank" | "_self";
  themeFingerprint: string;
}

export default function PublicLinkCard(props: PublicLinkCardProps) {
  const resolveCardActions = () => {
    const maybeShareUrl = props.link.url?.trim();
    const shareActions = maybeShareUrl
      ? [
          {
            ariaLabel: `Show ${props.link.label} QR code`,
            kind: "qr" as const,
            onClick: () => {
              props.onQrOpen(props.link, maybeShareUrl);
              return undefined;
            },
            title: `Show ${props.link.label} QR code`,
          },
          {
            ariaLabel: `Share ${props.link.label}`,
            kind: "share" as const,
            onClick: () =>
              shareLink({
                copiedMessage: `${props.link.label} link shared`,
                failedMessage: `Could not share ${props.link.label}`,
                mode: "url-only",
                sharedMessage: `${props.link.label} link shared`,
                title: props.link.label,
                url: maybeShareUrl,
              }),
            title: `Share ${props.link.label}`,
          },
          {
            ariaLabel: `Copy ${props.link.label} link`,
            kind: "copy" as const,
            onClick: () =>
              copyLink({
                copiedMessage: `${props.link.label} link copied`,
                failedMessage: `Could not copy ${props.link.label} link`,
                url: maybeShareUrl,
              }),
            title: `Copy ${props.link.label} link`,
          },
        ]
      : [];

    if (!props.hasHistory) {
      return shareActions;
    }

    return [
      ...shareActions,
      {
        ariaLabel: `View ${props.link.label} follower history`,
        kind: "analytics" as const,
        onClick: () => {
          props.onHistoryOpen(props.link.id);
          return undefined;
        },
        title: `View ${props.link.label} follower history`,
      },
    ];
  };

  if (isPaymentCapableLink(props.link)) {
    return (
      <PaymentLinkCard
        link={props.link}
        site={props.site}
        interaction="minimal"
        brandIconOptions={props.brandIconOptions}
        themeFingerprint={props.themeFingerprint}
      />
    );
  }

  if (resolveRichCardVariant(props.site, props.link) === "rich") {
    return (
      <RichLinkCard
        resolveCardActions={resolveCardActions}
        link={props.link}
        viewModel={buildRichCardViewModel(props.site, props.link)}
        target={props.target}
        interaction="minimal"
        brandIconOptions={props.brandIconOptions}
        themeFingerprint={props.themeFingerprint}
      />
    );
  }

  return (
    <SimpleLinkCard
      resolveCardActions={resolveCardActions}
      link={props.link}
      site={props.site}
      target={props.target}
      interaction="minimal"
      brandIconOptions={props.brandIconOptions}
      themeFingerprint={props.themeFingerprint}
    />
  );
}
