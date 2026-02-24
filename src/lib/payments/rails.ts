import type {
  LinkPaymentConfig,
  PaymentRail,
  PaymentRailType
} from "./types";

export interface ResolvedPaymentRailAction {
  rail: PaymentRail;
  label: string;
  iconAlias: string;
  href?: string;
  qrPayload?: string;
  copyValue?: string;
  displayValue?: string;
  openInNewTab: boolean;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const trimString = (value: unknown): string | undefined => (isNonEmptyString(value) ? value.trim() : undefined);
const trimNumberish = (value: unknown): string | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return trimString(value);
};

const isHttpLike = (value: string): boolean => /^(https?:)?\/\//i.test(value);

const hasExplicitScheme = (value: string): boolean => /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value);

const appendQuery = (base: string, params: URLSearchParams): string => {
  const query = params.toString();
  if (!query) {
    return base;
  }

  return `${base}${base.includes("?") ? "&" : "?"}${query}`;
};

const setIfPresent = (params: URLSearchParams, key: string, value: unknown) => {
  const normalized = trimString(value);
  if (normalized) {
    params.set(key, normalized);
  }
};

const appendManyIfPresent = (params: URLSearchParams, key: string, values: unknown): void => {
  if (!Array.isArray(values)) {
    return;
  }

  for (const value of values) {
    const normalized = trimString(value);
    if (normalized) {
      params.append(key, normalized);
    }
  }
};

const appendCustomQuery = (params: URLSearchParams, query: unknown): void => {
  if (!query || typeof query !== "object" || Array.isArray(query)) {
    return;
  }

  for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
    const normalized = trimString(value);
    if (normalized) {
      params.set(key, normalized);
    }
  }
};

const railTypeLabelMap: Record<PaymentRailType, string> = {
  patreon: "Patreon",
  kofi: "Ko-fi",
  paypal: "PayPal",
  cashapp: "Cash App",
  stripe: "Stripe",
  coinbase: "Coinbase",
  bitcoin: "Bitcoin",
  lightning: "Lightning",
  ethereum: "Ethereum",
  solana: "Solana",
  "custom-crypto": "Crypto"
};

const railIconAliasMap: Record<PaymentRailType, string> = {
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
  "custom-crypto": "wallet"
};

export const paymentRailLabel = (railType: PaymentRailType): string => railTypeLabelMap[railType];

export const paymentRailIconAlias = (railType: PaymentRailType): string => railIconAliasMap[railType];

const resolveWebRailHref = (rail: PaymentRail): string | undefined =>
  trimString(rail.url) ?? trimString(rail.uri);

const resolveBitcoinUri = (rail: PaymentRail): string | undefined => {
  const direct = trimString(rail.uri);
  if (direct) {
    return direct;
  }

  const address = trimString(rail.address);
  if (!address) {
    return undefined;
  }

  const params = new URLSearchParams();
  setIfPresent(params, "amount", rail.amount);
  setIfPresent(params, "label", rail.label);
  setIfPresent(params, "message", rail.message);
  setIfPresent(params, "memo", rail.memo);
  appendManyIfPresent(params, "reference", rail.references);
  appendCustomQuery(params, rail.query);

  return appendQuery(`bitcoin:${address}`, params);
};

const resolveLightningUri = (rail: PaymentRail): string | undefined => {
  const direct = trimString(rail.uri);
  if (direct) {
    return direct;
  }

  const address = trimString(rail.address);
  if (!address) {
    return undefined;
  }

  const params = new URLSearchParams();
  setIfPresent(params, "amount", rail.amount);
  setIfPresent(params, "message", rail.message);
  setIfPresent(params, "memo", rail.memo);
  appendCustomQuery(params, rail.query);

  const prefixed = address.startsWith("lightning:") ? address : `lightning:${address}`;
  return appendQuery(prefixed, params);
};

const resolveEthereumUri = (rail: PaymentRail): string | undefined => {
  const direct = trimString(rail.uri);
  if (direct) {
    return direct;
  }

  const address = trimString(rail.address);
  if (!address) {
    return undefined;
  }

  const chainId = trimNumberish(rail.chainId);
  const encodedTarget = chainId ? `${address}@${chainId}` : address;

  const params = new URLSearchParams();
  setIfPresent(params, "value", rail.amount);
  setIfPresent(params, "message", rail.message);
  setIfPresent(params, "memo", rail.memo);
  appendCustomQuery(params, rail.query);

  return appendQuery(`ethereum:${encodedTarget}`, params);
};

const resolveSolanaUri = (rail: PaymentRail): string | undefined => {
  const direct = trimString(rail.uri);
  if (direct) {
    return direct;
  }

  const address = trimString(rail.address);
  if (!address) {
    return undefined;
  }

  const params = new URLSearchParams();
  setIfPresent(params, "amount", rail.amount);
  setIfPresent(params, "label", rail.label);
  setIfPresent(params, "message", rail.message);
  setIfPresent(params, "memo", rail.memo);
  appendManyIfPresent(params, "reference", rail.references);
  appendCustomQuery(params, rail.query);

  return appendQuery(`solana:${address}`, params);
};

const resolveCustomCryptoUri = (rail: PaymentRail): string | undefined => {
  const direct = trimString(rail.uri);
  if (direct) {
    return direct;
  }

  const address = trimString(rail.address);
  const scheme = trimString(rail.scheme);

  if (!address || !scheme) {
    return trimString(rail.url);
  }

  const params = new URLSearchParams();
  setIfPresent(params, "amount", rail.amount);
  setIfPresent(params, "message", rail.message);
  setIfPresent(params, "memo", rail.memo);
  appendManyIfPresent(params, "reference", rail.references);
  appendCustomQuery(params, rail.query);

  return appendQuery(`${scheme}:${address}`, params);
};

const resolveRailHref = (rail: PaymentRail): string | undefined => {
  switch (rail.rail) {
    case "patreon":
    case "kofi":
    case "paypal":
    case "cashapp":
    case "stripe":
    case "coinbase":
      return resolveWebRailHref(rail);
    case "bitcoin":
      return resolveBitcoinUri(rail);
    case "lightning":
      return resolveLightningUri(rail);
    case "ethereum":
      return resolveEthereumUri(rail);
    case "solana":
      return resolveSolanaUri(rail);
    case "custom-crypto":
      return resolveCustomCryptoUri(rail);
    default:
      return undefined;
  }
};

const resolveDisplayValue = (rail: PaymentRail, href?: string): string | undefined => {
  return (
    trimString(rail.address) ??
    trimString(rail.uri) ??
    trimString(rail.url) ??
    trimString(rail.memo) ??
    href
  );
};

export const resolvePaymentRailAction = (rail: PaymentRail): ResolvedPaymentRailAction => {
  const href = resolveRailHref(rail);
  const displayValue = resolveDisplayValue(rail, href);

  const qrPayloadFromConfig = trimString(rail.qr?.payload);
  const qrPayload = qrPayloadFromConfig ?? href;

  const explicitCopy =
    trimString(rail.address) ??
    trimString(rail.uri) ??
    trimString(rail.url) ??
    qrPayload ??
    href;

  return {
    rail,
    label: trimString(rail.label) ?? paymentRailLabel(rail.rail),
    iconAlias: trimString(rail.icon) ?? paymentRailIconAlias(rail.rail),
    href,
    qrPayload,
    copyValue: explicitCopy,
    displayValue,
    openInNewTab: Boolean(href && (isHttpLike(href) || !hasExplicitScheme(href)))
  };
};

export const resolveEnabledPaymentRails = (payment: LinkPaymentConfig | undefined): PaymentRail[] => {
  if (!Array.isArray(payment?.rails)) {
    return [];
  }

  return payment.rails.filter((rail): rail is PaymentRail => {
    if (!rail || typeof rail !== "object") {
      return false;
    }

    if (typeof rail.id !== "string" || rail.id.trim().length === 0) {
      return false;
    }

    if (rail.enabled === false) {
      return false;
    }

    return true;
  });
};

export const resolvePrimaryPaymentRail = (payment: LinkPaymentConfig | undefined): PaymentRail | undefined => {
  const enabledRails = resolveEnabledPaymentRails(payment);
  if (enabledRails.length === 0) {
    return undefined;
  }

  const preferredRailId = trimString(payment?.primaryRailId);
  if (preferredRailId) {
    const preferred = enabledRails.find((rail) => rail.id === preferredRailId);
    if (preferred) {
      return preferred;
    }
  }

  return enabledRails[0];
};

export const resolvePrimaryPaymentHref = (payment: LinkPaymentConfig | undefined): string | undefined => {
  const primaryRail = resolvePrimaryPaymentRail(payment);
  if (!primaryRail) {
    return undefined;
  }

  return resolvePaymentRailAction(primaryRail).href;
};
