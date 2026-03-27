import type { OpenLink } from "../content/load-content";
import { clampQrLogoSize, resolveQrLogo } from "../qr/logo-resolver";
import type { PaymentQrBadgeConfig, PaymentQrLogoMode, PaymentRail } from "./types";

export const resolvePaymentQrLogoUrl = (input: {
  badge?: PaymentQrBadgeConfig;
  customLogoUrl?: string;
  defaultLogoMode?: PaymentQrLogoMode;
  link: OpenLink;
  logoMode?: PaymentQrLogoMode;
  rail: PaymentRail;
}): string | undefined =>
  resolveQrLogo({
    kind: "payment",
    link: input.link,
    rail: input.rail,
    badge: input.badge,
    customLogoUrl: input.customLogoUrl,
    defaultLogoMode: input.defaultLogoMode,
    logoMode: input.logoMode,
  }).logoUrl;

export const clampPaymentQrImageSize = (value: number | undefined): number =>
  clampQrLogoSize(value);
