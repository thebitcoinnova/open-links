export const PAYMENT_RAIL_TYPES = [
  "patreon",
  "kofi",
  "paypal",
  "cashapp",
  "stripe",
  "coinbase",
  "bitcoin",
  "lightning",
  "ethereum",
  "solana",
  "custom-crypto"
] as const;

export type PaymentRailType = (typeof PAYMENT_RAIL_TYPES)[number];

export type PaymentQrDisplayMode = "always" | "toggle" | "hidden";
export type PaymentQrStyle = "square" | "rounded" | "dots";
export type PaymentQrLogoMode = "rail-default" | "custom" | "none";
export type PaymentQrFullscreenMode = "enabled" | "disabled";

export interface PaymentQrConfig {
  enabled?: boolean;
  fullscreen?: PaymentQrFullscreenMode;
  style?: PaymentQrStyle;
  foregroundColor?: string;
  backgroundColor?: string;
  logoMode?: PaymentQrLogoMode;
  logoUrl?: string;
  logoSize?: number;
  payload?: string;
  custom?: Record<string, unknown>;
}

export interface PaymentAppLink {
  appId: string;
  label: string;
  url: string;
  custom?: Record<string, unknown>;
}

export interface PaymentRail {
  id: string;
  rail: PaymentRailType;
  label?: string;
  enabled?: boolean;
  icon?: string;
  url?: string;
  uri?: string;
  address?: string;
  scheme?: string;
  network?: string;
  amount?: string;
  message?: string;
  memo?: string;
  chainId?: string | number;
  references?: string[];
  query?: Record<string, string>;
  qr?: PaymentQrConfig;
  appLinks?: PaymentAppLink[];
  custom?: Record<string, unknown>;
}

export interface LinkPaymentConfig {
  qrDisplay?: PaymentQrDisplayMode;
  primaryRailId?: string;
  rails?: PaymentRail[];
  custom?: Record<string, unknown>;
}

export interface SitePaymentQrDefaults {
  displayDefault?: PaymentQrDisplayMode;
  styleDefault?: PaymentQrStyle;
  foregroundColorDefault?: string;
  backgroundColorDefault?: string;
  logoModeDefault?: PaymentQrLogoMode;
  logoSizeDefault?: number;
  fullscreenDefault?: PaymentQrFullscreenMode;
}

export interface SitePaymentsConfig {
  qr?: SitePaymentQrDefaults;
  custom?: Record<string, unknown>;
}

export const PAYMENT_QR_DISPLAY_MODES = ["always", "toggle", "hidden"] as const;
export const PAYMENT_QR_STYLES = ["square", "rounded", "dots"] as const;
export const PAYMENT_QR_LOGO_MODES = ["rail-default", "custom", "none"] as const;
export const PAYMENT_QR_FULLSCREEN_MODES = ["enabled", "disabled"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isPaymentRailType = (value: unknown): value is PaymentRailType =>
  typeof value === "string" && (PAYMENT_RAIL_TYPES as readonly string[]).includes(value);

export const hasPaymentRails = (payment: LinkPaymentConfig | undefined): boolean =>
  Array.isArray(payment?.rails) && payment.rails.some((rail) => rail.enabled !== false);

export const isPaymentCapableLink = (
  link: { type?: string; payment?: LinkPaymentConfig } | undefined
): boolean => {
  if (!link) {
    return false;
  }

  return link.type === "payment" || hasPaymentRails(link.payment);
};

export const normalizePaymentRail = (value: unknown): PaymentRail | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  if (typeof value.id !== "string" || value.id.trim().length === 0) {
    return undefined;
  }

  if (!isPaymentRailType(value.rail)) {
    return undefined;
  }

  return value as unknown as PaymentRail;
};
