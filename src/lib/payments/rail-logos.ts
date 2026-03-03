import type { PaymentQrLogoMode, PaymentRailType } from "./types";

const railLogoPaths: Record<PaymentRailType, string> = {
  patreon: "/payment-logos/patreon.svg",
  kofi: "/payment-logos/kofi.svg",
  paypal: "/payment-logos/paypal.svg",
  cashapp: "/payment-logos/cashapp.svg",
  stripe: "/payment-logos/stripe.svg",
  coinbase: "/payment-logos/coinbase.svg",
  bitcoin: "/payment-logos/bitcoin.svg",
  lightning: "/payment-logos/lightning.svg",
  ethereum: "/payment-logos/ethereum.svg",
  solana: "/payment-logos/solana.svg",
  "custom-crypto": "/payment-logos/generic-crypto.svg",
};

const toAssetUrl = (assetPath: string): string => {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedPath = assetPath.startsWith("/") ? assetPath.slice(1) : assetPath;

  return `${normalizedBase}${normalizedPath}`;
};

const normalizeCustomLogoUrl = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.startsWith("/")) {
    return toAssetUrl(trimmed);
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return undefined;
};

export const resolvePaymentRailLogoUrl = (input: {
  railType: PaymentRailType;
  logoMode?: PaymentQrLogoMode;
  customLogoUrl?: string;
}): string | undefined => {
  const mode = input.logoMode ?? "rail-default";

  if (mode === "none") {
    return undefined;
  }

  if (mode === "custom") {
    const customLogo = normalizeCustomLogoUrl(input.customLogoUrl);
    return customLogo ?? toAssetUrl(railLogoPaths[input.railType]);
  }

  return toAssetUrl(railLogoPaths[input.railType]);
};
