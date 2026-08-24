import { resolveKnownSiteId } from "../../src/lib/icons/known-sites-data";
import { type PaymentRailType, isPaymentRailType } from "../../src/lib/payments/types";
import {
  BITCOIN_ADDRESS_PATTERN,
  CRYPTO_PAYMENT_RAILS,
  ENS_PATTERN,
  ETH_ADDRESS_PATTERN,
  LIGHTNING_ADDRESS_PATTERN,
  LIGHTNING_INVOICE_OR_LNURL_PATTERN,
  PAYMENT_ALLOWED_SCHEMES,
  SOLANA_ADDRESS_PATTERN,
  WEB_PAYMENT_RAILS,
  checkCustomConflicts,
  checkKnownIconAlias,
  checkLogoUrlShape,
  checkQrColor,
  checkScheme,
  isRecord,
  toStringOrUndefined,
} from "./rules-common";
import type { ValidationIssue } from "./rules-contracts";

export const checkBitcoinFormat = (
  source: string,
  path: string,
  rail: Record<string, unknown>,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const uri = toStringOrUndefined(rail.uri);
  const address = toStringOrUndefined(rail.address);

  if (uri && !uri.toLowerCase().startsWith("bitcoin:")) {
    issues.push({
      level: "warning",
      source,
      path,
      message: `Bitcoin URI '${uri}' does not start with 'bitcoin:'.`,
      remediation: "Use BIP-21/BIP-321 style bitcoin: URIs for better wallet compatibility.",
    });
  }

  if (address && !BITCOIN_ADDRESS_PATTERN.test(address)) {
    issues.push({
      level: "warning",
      source,
      path: `${path}.address`,
      message: `Bitcoin address '${address}' does not match common on-chain address formats.`,
      remediation: "Use a valid bech32 (bc1...) or legacy/base58 BTC address.",
    });
  }

  return issues;
};

export const checkLightningFormat = (
  source: string,
  path: string,
  rail: Record<string, unknown>,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const uri = toStringOrUndefined(rail.uri);
  const address = toStringOrUndefined(rail.address);

  if (uri?.includes(":") && !uri.toLowerCase().startsWith("lightning:")) {
    issues.push({
      level: "warning",
      source,
      path,
      message: `Lightning URI '${uri}' does not start with 'lightning:'.`,
      remediation:
        "Use lightning: URIs, or provide invoice/LNURL/Lightning Address in the rail address field.",
    });
  }

  const candidate = address ?? (uri && !uri.includes(":") ? uri : undefined);
  if (!candidate) {
    return issues;
  }

  if (
    LIGHTNING_INVOICE_OR_LNURL_PATTERN.test(candidate) ||
    LIGHTNING_ADDRESS_PATTERN.test(candidate)
  ) {
    return issues;
  }

  issues.push({
    level: "warning",
    source,
    path: `${path}.address`,
    message: `Lightning value '${candidate}' does not match common invoice/LNURL/lightning-address patterns.`,
    remediation:
      "Use an invoice (lnbc...), LNURL (lnurl...), offer (lno...), or user@domain lightning address.",
  });

  return issues;
};

export const checkEthereumFormat = (
  source: string,
  path: string,
  rail: Record<string, unknown>,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const uri = toStringOrUndefined(rail.uri);
  const address = toStringOrUndefined(rail.address);

  if (uri && !uri.toLowerCase().startsWith("ethereum:")) {
    issues.push({
      level: "warning",
      source,
      path,
      message: `Ethereum URI '${uri}' does not start with 'ethereum:'.`,
      remediation: "Prefer EIP-681 style ethereum: URIs for best wallet compatibility.",
    });
  }

  if (address && !ETH_ADDRESS_PATTERN.test(address) && !ENS_PATTERN.test(address)) {
    issues.push({
      level: "warning",
      source,
      path: `${path}.address`,
      message: `Ethereum target '${address}' is not a standard hex address or ENS name.`,
      remediation: "Use a 0x-prefixed 40-byte hex address or ENS name (for example name.eth).",
    });
  }

  return issues;
};

export const checkSolanaFormat = (
  source: string,
  path: string,
  rail: Record<string, unknown>,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const uri = toStringOrUndefined(rail.uri);
  const address = toStringOrUndefined(rail.address);

  if (uri && !uri.toLowerCase().startsWith("solana:")) {
    issues.push({
      level: "warning",
      source,
      path,
      message: `Solana URI '${uri}' does not start with 'solana:'.`,
      remediation: "Prefer Solana Pay style solana: URIs for wallet interop.",
    });
  }

  if (address && !SOLANA_ADDRESS_PATTERN.test(address)) {
    issues.push({
      level: "warning",
      source,
      path: `${path}.address`,
      message: `Solana address '${address}' is not a valid base58 public key shape.`,
      remediation: "Use a valid base58 Solana public key (typically 32-44 chars).",
    });
  }

  return issues;
};

export const checkRailFormatWarnings = (
  source: string,
  path: string,
  railType: PaymentRailType,
  rail: Record<string, unknown>,
): ValidationIssue[] => {
  switch (railType) {
    case "bitcoin":
      return checkBitcoinFormat(source, path, rail);
    case "lightning":
      return checkLightningFormat(source, path, rail);
    case "ethereum":
      return checkEthereumFormat(source, path, rail);
    case "solana":
      return checkSolanaFormat(source, path, rail);
    default:
      return [];
  }
};

export const checkPaymentQrConfig = (
  source: string,
  path: string,
  value: unknown,
): ValidationIssue[] => {
  if (!isRecord(value)) {
    return [];
  }

  const issues: ValidationIssue[] = [];
  const logoMode = toStringOrUndefined(value.logoMode);

  if (logoMode === "custom" && !toStringOrUndefined(value.logoUrl)) {
    issues.push({
      level: "error",
      source,
      path,
      message: "QR logoMode is 'custom' but logoUrl is missing.",
      remediation: "Provide qr.logoUrl when qr.logoMode is set to custom.",
    });
  }

  issues.push(
    ...checkQrColor(
      source,
      `${path}.foregroundColor`,
      value.foregroundColor,
      "QR foreground color",
    ),
  );
  issues.push(
    ...checkQrColor(
      source,
      `${path}.backgroundColor`,
      value.backgroundColor,
      "QR background color",
    ),
  );
  issues.push(...checkLogoUrlShape(source, `${path}.logoUrl`, value.logoUrl));

  if (typeof value.logoSize === "number" && (value.logoSize < 0.15 || value.logoSize > 0.35)) {
    issues.push({
      level: "warning",
      source,
      path: `${path}.logoSize`,
      message: `QR logoSize ${value.logoSize} is outside the recommended 0.15-0.35 range for scan reliability.`,
      remediation: "Use qr.logoSize between 0.15 and 0.35 to reduce scanning failures.",
    });
  }

  const badge = isRecord(value.badge) ? value.badge : undefined;
  const badgeMode = toStringOrUndefined(badge?.mode);
  const badgeItems = Array.isArray(badge?.items) ? badge.items : undefined;

  if (badgeMode === "custom" && (!badgeItems || badgeItems.length === 0)) {
    issues.push({
      level: "error",
      source,
      path: `${path}.badge.items`,
      message: "QR badge mode 'custom' requires at least one badge item.",
      remediation: "Provide qr.badge.items when qr.badge.mode is set to custom.",
    });
  }

  if (badgeItems && badgeItems.length > 2) {
    issues.push({
      level: "error",
      source,
      path: `${path}.badge.items`,
      message: `QR badge supports at most 2 items, received ${badgeItems.length}.`,
      remediation: "Limit qr.badge.items to 1 or 2 entries to preserve scan reliability.",
    });
  }

  if (badgeItems) {
    badgeItems.forEach((item, itemIndex) => {
      if (!isRecord(item)) {
        return;
      }

      const itemType = toStringOrUndefined(item.type);
      const itemValue = toStringOrUndefined(item.value);

      if ((itemType === "site" || itemType === "asset") && !itemValue) {
        issues.push({
          level: "error",
          source,
          path: `${path}.badge.items[${itemIndex}].value`,
          message: `QR badge item '${itemType}' requires a value.`,
          remediation: `Provide qr.badge.items[${itemIndex}].value for ${itemType} badge items.`,
        });
      }

      if (itemType === "site" && itemValue && !resolveKnownSiteId(itemValue)) {
        issues.push({
          level: "error",
          source,
          path: `${path}.badge.items[${itemIndex}].value`,
          message: `QR badge site '${itemValue}' is not a known site id.`,
          remediation:
            "Use a supported known-site id such as 'cluborange', 'lightning', or 'bitcoin'.",
        });
      }

      if (itemType === "asset") {
        issues.push(
          ...checkLogoUrlShape(source, `${path}.badge.items[${itemIndex}].value`, item.value),
        );
      }
    });
  }

  if (typeof badge?.size === "number" && (badge.size < 0.15 || badge.size > 0.35)) {
    issues.push({
      level: "warning",
      source,
      path: `${path}.badge.size`,
      message: `QR badge size ${badge.size} is outside the recommended 0.15-0.35 range for scan reliability.`,
      remediation: "Use qr.badge.size between 0.15 and 0.35 to reduce scanning failures.",
    });
  }

  return issues;
};

export const checkPaymentRail = (
  source: string,
  path: string,
  value: unknown,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  if (!isRecord(value)) {
    return [
      {
        level: "error",
        source,
        path,
        message: "Payment rail must be an object.",
        remediation: "Provide each payment rail as an object with id and rail fields.",
      },
    ];
  }

  const railTypeRaw = value.rail;
  if (!isPaymentRailType(railTypeRaw)) {
    issues.push({
      level: "error",
      source,
      path: `${path}.rail`,
      message: `Unknown payment rail '${String(railTypeRaw)}'.`,
      remediation:
        "Use a supported rail type (for example bitcoin, lightning, paypal, patreon, etc.).",
    });

    return issues;
  }

  if (typeof value.id !== "string" || value.id.trim().length === 0) {
    issues.push({
      level: "error",
      source,
      path: `${path}.id`,
      message: "Payment rail id is required.",
      remediation: "Provide a stable payment rail id (for example 'btc' or 'paypal').",
    });
  }

  issues.push(...checkKnownIconAlias(source, `${path}.icon`, value.icon));

  if (typeof value.provider === "string" && !resolveKnownSiteId(value.provider)) {
    issues.push({
      level: "error",
      source,
      path: `${path}.provider`,
      message: `Payment provider '${value.provider}' is not a known site id or alias.`,
      remediation:
        "Register the provider in src/lib/icons/known-sites-data.ts, then use that known site id or alias.",
    });
  }

  const url = toStringOrUndefined(value.url);
  const uri = toStringOrUndefined(value.uri);
  const address = toStringOrUndefined(value.address);
  const scheme = toStringOrUndefined(value.scheme);

  if (WEB_PAYMENT_RAILS.has(railTypeRaw) && !url && !uri) {
    issues.push({
      level: "error",
      source,
      path,
      message: `Rail '${railTypeRaw}' requires url or uri.`,
      remediation: `Provide payment.rails[].url or payment.rails[].uri for ${railTypeRaw}.`,
    });
  }

  if (CRYPTO_PAYMENT_RAILS.has(railTypeRaw) && !uri && !address) {
    issues.push({
      level: "error",
      source,
      path,
      message: `Rail '${railTypeRaw}' requires uri or address.`,
      remediation: `Provide payment.rails[].uri or payment.rails[].address for ${railTypeRaw}.`,
    });
  }

  if (railTypeRaw === "custom-crypto" && !uri && !(scheme && address) && !url) {
    issues.push({
      level: "error",
      source,
      path,
      message: "Rail 'custom-crypto' requires uri, url, or scheme + address.",
      remediation: "Provide uri, url, or both scheme and address for custom-crypto rails.",
    });
  }

  issues.push(
    ...checkScheme(source, `${path}.url`, value.url, {
      allowedSchemes: PAYMENT_ALLOWED_SCHEMES,
      remediation: "Use http/https or supported payment schemes in payment rail URL fields.",
    }),
  );

  if (uri?.includes(":")) {
    issues.push(
      ...checkScheme(source, `${path}.uri`, uri, {
        remediation:
          "Use a valid URI for payment rails (for example bitcoin:, lightning:, ethereum:, solana:, or https://).",
      }),
    );
  }

  if (Array.isArray(value.appLinks)) {
    value.appLinks.forEach((entry, appIndex) => {
      if (!isRecord(entry)) {
        return;
      }

      issues.push(
        ...checkScheme(source, `${path}.appLinks[${appIndex}].url`, entry.url, {
          remediation: "Provide a parseable app deep-link URL.",
        }),
      );
    });
  }

  issues.push(...checkPaymentQrConfig(source, `${path}.qr`, value.qr));
  issues.push(...checkRailFormatWarnings(source, path, railTypeRaw, value));

  return issues;
};

export const checkPaymentConfig = (
  source: string,
  path: string,
  value: unknown,
): ValidationIssue[] => {
  if (!isRecord(value)) {
    return [];
  }

  const issues: ValidationIssue[] = [];

  issues.push(
    ...checkCustomConflicts(
      source,
      value.custom,
      new Set(["rails", "qrDisplay", "primaryRailId"]),
      `${path}.custom`,
    ),
  );

  const rails = Array.isArray(value.rails) ? value.rails : [];

  rails.forEach((rail, railIndex) => {
    issues.push(...checkPaymentRail(source, `${path}.rails[${railIndex}]`, rail));
  });

  const primaryRailId = toStringOrUndefined(value.primaryRailId);
  if (primaryRailId && rails.length > 0) {
    const exists = rails.some(
      (rail) => isRecord(rail) && toStringOrUndefined(rail.id) === primaryRailId,
    );
    if (!exists) {
      issues.push({
        level: "warning",
        source,
        path: `${path}.primaryRailId`,
        message: `primaryRailId '${primaryRailId}' does not match any rail id.`,
        remediation: "Set primaryRailId to an existing payment.rails[].id value.",
      });
    }
  }

  return issues;
};

export const checkSitePaymentsConfig = (
  source: string,
  site: Record<string, unknown>,
): ValidationIssue[] => {
  const ui = isRecord(site.ui) ? site.ui : undefined;
  const payments = ui && isRecord(ui.payments) ? ui.payments : undefined;
  const qr = payments && isRecord(payments.qr) ? payments.qr : undefined;

  if (!qr) {
    return [];
  }

  const issues: ValidationIssue[] = [];

  issues.push(
    ...checkQrColor(
      source,
      "$.ui.payments.qr.foregroundColorDefault",
      qr.foregroundColorDefault,
      "Default QR foreground color",
    ),
  );
  issues.push(
    ...checkQrColor(
      source,
      "$.ui.payments.qr.backgroundColorDefault",
      qr.backgroundColorDefault,
      "Default QR background color",
    ),
  );

  if (
    typeof qr.logoSizeDefault === "number" &&
    (qr.logoSizeDefault < 0.15 || qr.logoSizeDefault > 0.35)
  ) {
    issues.push({
      level: "warning",
      source,
      path: "$.ui.payments.qr.logoSizeDefault",
      message: `logoSizeDefault ${qr.logoSizeDefault} is outside the recommended 0.15-0.35 range for scan reliability.`,
      remediation: "Use a default logo size between 0.15 and 0.35 to reduce scanning failures.",
    });
  }

  return issues;
};
