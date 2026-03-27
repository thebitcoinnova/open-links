import {
  type KnownSite,
  type KnownSiteId,
  resolveKnownSiteById,
  resolveKnownSiteFromIcon,
  resolveKnownSiteFromUrl,
  resolveKnownSiteId,
} from "../icons/known-sites-data";
import type { PaymentRail, PaymentRailType } from "./types";

const paymentRailSiteIds: Record<PaymentRailType, KnownSiteId> = {
  patreon: "patreon",
  kofi: "kofi",
  paypal: "paypal",
  cashapp: "cashapp",
  stripe: "stripe",
  coinbase: "coinbase",
  bitcoin: "bitcoin",
  lightning: "lightning",
  ethereum: "ethereum",
  solana: "solana",
  "custom-crypto": "wallet",
};

const trimToUndefined = (value: string | undefined): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const resolveKnownSiteFromAlias = (value: string | undefined): KnownSite | undefined => {
  const maybeSiteId = resolveKnownSiteId(value);

  if (!maybeSiteId) {
    return undefined;
  }

  return resolveKnownSiteById(maybeSiteId);
};

export interface PaymentIdentityInput {
  linkIcon?: string;
  linkUrl?: string;
  provider?: string;
  railIcon?: string;
  railType: PaymentRailType;
  railUrl?: string;
}

export interface ResolvedPaymentRailIdentity {
  railSite?: KnownSite;
  providerSite?: KnownSite;
  brandSite?: KnownSite;
  effectiveIconAlias: string;
  autoBadgeSiteIds: KnownSiteId[];
}

export const resolvePaymentRailSiteId = (railType: PaymentRailType): KnownSiteId =>
  paymentRailSiteIds[railType];

export const resolvePaymentRailSite = (railType: PaymentRailType): KnownSite | undefined =>
  resolveKnownSiteById(resolvePaymentRailSiteId(railType));

export const resolvePaymentProviderSite = (input: PaymentIdentityInput): KnownSite | undefined => {
  const explicitProviderSite = resolveKnownSiteFromAlias(trimToUndefined(input.provider));

  if (explicitProviderSite) {
    return explicitProviderSite;
  }

  const maybeRailUrl = trimToUndefined(input.railUrl);
  const maybeLinkUrl = trimToUndefined(input.linkUrl);

  return (
    resolveKnownSiteFromIcon(trimToUndefined(input.railIcon)) ??
    (maybeRailUrl ? resolveKnownSiteFromUrl(maybeRailUrl) : undefined) ??
    resolveKnownSiteFromIcon(trimToUndefined(input.linkIcon)) ??
    (maybeLinkUrl ? resolveKnownSiteFromUrl(maybeLinkUrl) : undefined)
  );
};

export const resolvePaymentRailIdentity = (
  input: PaymentIdentityInput,
): ResolvedPaymentRailIdentity => {
  const railSite = resolvePaymentRailSite(input.railType);
  const maybeRawRailIcon = trimToUndefined(input.railIcon);
  const explicitProviderSite = resolveKnownSiteFromAlias(trimToUndefined(input.provider));
  const railIconSite = resolveKnownSiteFromIcon(maybeRawRailIcon);
  const railUrlSite = input.railUrl ? resolveKnownSiteFromUrl(input.railUrl) : undefined;
  const linkIconSite = resolveKnownSiteFromIcon(trimToUndefined(input.linkIcon));
  const linkUrlSite = input.linkUrl ? resolveKnownSiteFromUrl(input.linkUrl) : undefined;
  const providerSite =
    explicitProviderSite ?? railIconSite ?? railUrlSite ?? linkIconSite ?? linkUrlSite;
  const brandSite = providerSite ?? railSite;
  const effectiveIconAlias =
    explicitProviderSite?.id ??
    maybeRawRailIcon ??
    railUrlSite?.id ??
    linkIconSite?.id ??
    linkUrlSite?.id ??
    railSite?.id ??
    "wallet";

  if (!railSite) {
    return {
      railSite,
      providerSite,
      brandSite,
      effectiveIconAlias,
      autoBadgeSiteIds: providerSite ? [providerSite.id] : [],
    };
  }

  return {
    railSite,
    providerSite,
    brandSite,
    effectiveIconAlias,
    autoBadgeSiteIds:
      !providerSite || providerSite.id === railSite.id
        ? [railSite.id]
        : [providerSite.id, railSite.id],
  };
};

export const resolvePaymentRailIdentityForRail = (
  rail: Pick<PaymentRail, "icon" | "provider" | "rail" | "url">,
  context?: Pick<PaymentIdentityInput, "linkIcon" | "linkUrl">,
): ResolvedPaymentRailIdentity =>
  resolvePaymentRailIdentity({
    linkIcon: context?.linkIcon,
    linkUrl: context?.linkUrl,
    provider: rail.provider,
    railIcon: rail.icon,
    railType: rail.rail,
    railUrl: rail.url,
  });

export const resolveSharedPaymentBrandSite = (
  inputs: PaymentIdentityInput[],
): KnownSite | undefined => {
  const brandSiteIds = new Set<KnownSiteId>();

  for (const input of inputs) {
    const brandSiteId = resolvePaymentRailIdentity(input).brandSite?.id;

    if (!brandSiteId) {
      return undefined;
    }

    brandSiteIds.add(brandSiteId);

    if (brandSiteIds.size > 1) {
      return undefined;
    }
  }

  const [sharedBrandSiteId] = [...brandSiteIds];

  if (!sharedBrandSiteId) {
    return undefined;
  }

  return resolveKnownSiteById(sharedBrandSiteId);
};
