import type { OpenLink, ProfileData } from "../lib/content/load-content";
import { PAYMENT_CARD_EFFECT_EASTER_EGG_PATH } from "../lib/payments/card-effect-samples";
import { resolveQrLogoWithEmbeddedAssets } from "../lib/qr/logo-resolver";
import { resolveBaseAwareAssetPath } from "../lib/seo/resolve-seo-metadata";

export const PAYMENT_CARD_EFFECT_GALLERY_MENU_LABEL = "Tip card sparks";

export const resolvePaymentCardEffectGalleryMenuHref = (basePath = "/"): string =>
  resolveBaseAwareAssetPath(PAYMENT_CARD_EFFECT_EASTER_EGG_PATH, basePath);

export interface QrDialogTarget {
  ariaLabel: string;
  logoSize: number;
  logoUrl?: string;
  payload: string;
  qrAriaLabel: string;
  title: string;
}

export const resolveProfileQrDialogTarget = (input: {
  baseUrl?: string;
  payload: string;
  profile: ProfileData;
  siteLogoUrl?: string;
}): Promise<QrDialogTarget> =>
  resolveQrLogoWithEmbeddedAssets(
    {
      kind: "profile",
      avatarUrl: input.profile.avatar,
      siteLogoUrl: input.siteLogoUrl,
    },
    input.baseUrl,
  ).then((qrLogo) => ({
    ariaLabel: `${input.profile.name} QR code`,
    logoSize: qrLogo.logoSize,
    logoUrl: qrLogo.logoUrl,
    payload: input.payload,
    qrAriaLabel: `${input.profile.name} profile QR code`,
    title: input.profile.name,
  }));

export const resolveLinkQrDialogTarget = (input: {
  baseUrl?: string;
  link: OpenLink;
  payload: string;
}): Promise<QrDialogTarget> =>
  resolveQrLogoWithEmbeddedAssets(
    {
      kind: "link",
      link: input.link,
    },
    input.baseUrl,
  ).then((qrLogo) => ({
    ariaLabel: `${input.link.label} QR code`,
    logoSize: qrLogo.logoSize,
    logoUrl: qrLogo.logoUrl,
    payload: input.payload,
    qrAriaLabel: `${input.link.label} link QR code`,
    title: input.link.label,
  }));
