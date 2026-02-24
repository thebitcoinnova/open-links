import { KNOWN_SITE_ALIASES, normalizeKnownSiteAlias } from "../../src/lib/icons/known-sites-data";
import {
  isPaymentRailType,
  type PaymentRailType
} from "../../src/lib/payments/types";

export interface ValidationIssue {
  level: "error" | "warning";
  source: string;
  path: string;
  message: string;
  remediation: string;
}

interface PolicyInput {
  profile: Record<string, unknown>;
  links: Record<string, unknown>;
  site: Record<string, unknown>;
  sources?: {
    profile: string;
    links: string;
    site: string;
  };
}

const BASE_ALLOWED_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);
const PAYMENT_ALLOWED_SCHEMES = new Set([
  ...BASE_ALLOWED_SCHEMES,
  "bitcoin:",
  "lightning:",
  "ethereum:",
  "solana:"
]);

const PROFILE_KEYS = new Set([
  "name",
  "headline",
  "avatar",
  "bio",
  "location",
  "pronouns",
  "status",
  "profileLinks",
  "contact",
  "custom"
]);

const LINKS_ROOT_KEYS = new Set(["links", "groups", "order", "custom"]);
const LINK_KEYS = new Set([
  "id",
  "label",
  "url",
  "type",
  "icon",
  "description",
  "group",
  "order",
  "enabled",
  "metadata",
  "enrichment",
  "payment",
  "custom"
]);

const SITE_KEYS = new Set(["title", "description", "baseUrl", "theme", "ui", "quality", "custom"]);

const WEB_PAYMENT_RAILS = new Set<PaymentRailType>([
  "patreon",
  "kofi",
  "paypal",
  "cashapp",
  "stripe",
  "coinbase"
]);

const CRYPTO_PAYMENT_RAILS = new Set<PaymentRailType>([
  "bitcoin",
  "lightning",
  "ethereum",
  "solana"
]);

const BITCOIN_ADDRESS_PATTERN = /^(bc1[ac-hj-np-z02-9]{25,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/;
const LIGHTNING_INVOICE_OR_LNURL_PATTERN = /^(lnbc|lntb|lnbcrt|lno|lnurl)[0-9a-z]+$/i;
const LIGHTNING_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ETH_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const ENS_PATTERN = /^.+\.eth$/i;
const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toStringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const unknownTopLevelWarnings = (
  source: string,
  payload: Record<string, unknown>,
  allowed: Set<string>
): ValidationIssue[] => {
  const warnings: ValidationIssue[] = [];

  for (const key of Object.keys(payload)) {
    if (!allowed.has(key)) {
      warnings.push({
        level: "warning",
        source,
        path: `$.${key}`,
        message: `Unknown top-level key '${key}' is allowed but not part of the core contract.`,
        remediation: `Move '${key}' into a dedicated custom block if it is extension data, or document why it belongs at top level.`
      });
    }
  }

  return warnings;
};

const checkCustomConflicts = (
  source: string,
  customValue: unknown,
  reservedKeys: Set<string>,
  pathPrefix: string
): ValidationIssue[] => {
  const errors: ValidationIssue[] = [];

  if (!isRecord(customValue)) {
    return errors;
  }

  for (const key of Object.keys(customValue)) {
    if (reservedKeys.has(key)) {
      errors.push({
        level: "error",
        source,
        path: `${pathPrefix}.${key}`,
        message: `Custom key '${key}' conflicts with reserved core key '${key}'.`,
        remediation: `Rename '${pathPrefix}.${key}' to a non-reserved extension key (for example '${key}Extra').`
      });
    }
  }

  return errors;
};

const checkScheme = (
  source: string,
  path: string,
  value: unknown,
  options?: {
    allowedSchemes?: Set<string>;
    remediation?: string;
  }
): ValidationIssue[] => {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }

  try {
    const parsed = new URL(value);

    if (options?.allowedSchemes && !options.allowedSchemes.has(parsed.protocol)) {
      return [
        {
          level: "error",
          source,
          path,
          message: `URL scheme '${parsed.protocol}' is not allowed.`,
          remediation: options.remediation ?? "Use an allowed URL scheme for this field."
        }
      ];
    }
  } catch {
    return [
      {
        level: "error",
        source,
        path,
        message: "URL value is not parseable.",
        remediation: options?.remediation ?? "Provide a valid absolute URL or supported scheme-based URL."
      }
    ];
  }

  return [];
};

const checkKnownIconAlias = (source: string, path: string, value: unknown): ValidationIssue[] => {
  if (typeof value !== "string") {
    return [];
  }

  const alias = normalizeKnownSiteAlias(value);
  if (!alias) {
    return [];
  }

  if (KNOWN_SITE_ALIASES.has(alias)) {
    return [];
  }

  return [
    {
      level: "warning",
      source,
      path,
      message:
        `Unknown icon alias '${value}'. Runtime rendering will fall back to URL-domain matching or generic icon fallback.`,
      remediation:
        "Use a known alias from src/lib/icons/known-sites-data.ts, or remove links[].icon to rely on domain mapping."
    }
  ];
};

const checkIconOverrideAliases = (source: string, path: string, value: unknown): ValidationIssue[] => {
  if (!isRecord(value)) {
    return [];
  }

  const warnings: ValidationIssue[] = [];

  for (const [sourceAliasRaw, targetAliasRaw] of Object.entries(value)) {
    const sourceAlias = normalizeKnownSiteAlias(sourceAliasRaw);
    if (!sourceAlias || !KNOWN_SITE_ALIASES.has(sourceAlias)) {
      warnings.push({
        level: "warning",
        source,
        path: `${path}.${sourceAliasRaw}`,
        message: `Unknown icon override source alias '${sourceAliasRaw}'. Runtime remapping will ignore this entry.`,
        remediation:
          "Use a known source alias from src/lib/icons/known-sites-data.ts in ui.brandIcons.iconOverrides."
      });
    }

    if (typeof targetAliasRaw !== "string") {
      continue;
    }

    const targetAlias = normalizeKnownSiteAlias(targetAliasRaw);
    if (!targetAlias || !KNOWN_SITE_ALIASES.has(targetAlias)) {
      warnings.push({
        level: "warning",
        source,
        path: `${path}.${sourceAliasRaw}`,
        message: `Unknown icon override target alias '${targetAliasRaw}'. Runtime remapping will ignore this entry.`,
        remediation:
          "Use a known target alias from src/lib/icons/known-sites-data.ts in ui.brandIcons.iconOverrides."
      });
    }
  }

  return warnings;
};

const isLikelyCssColor = (value: string): boolean => {
  const normalized = value.trim();

  return (
    /^#[\da-fA-F]{3,8}$/.test(normalized) ||
    /^rgba?\(/i.test(normalized) ||
    /^hsla?\(/i.test(normalized) ||
    /^var\(--[\w-]+\)$/.test(normalized) ||
    /^[a-zA-Z]+$/.test(normalized)
  );
};

const checkQrColor = (
  source: string,
  path: string,
  value: unknown,
  label: string
): ValidationIssue[] => {
  const color = toStringOrUndefined(value);
  if (!color) {
    return [];
  }

  if (isLikelyCssColor(color)) {
    return [];
  }

  return [
    {
      level: "warning",
      source,
      path,
      message: `${label} '${color}' does not look like a valid CSS color value.`,
      remediation: "Use hex/rgb/hsl/named color values for QR foreground/background styling."
    }
  ];
};

const checkLogoUrlShape = (source: string, path: string, value: unknown): ValidationIssue[] => {
  const url = toStringOrUndefined(value);
  if (!url) {
    return [];
  }

  if (url.startsWith("/")) {
    return [];
  }

  if (/^https?:\/\//i.test(url)) {
    return [];
  }

  return [
    {
      level: "warning",
      source,
      path,
      message: `Custom QR logo URL '${url}' should be an absolute http(s) URL or a root-relative asset path.`,
      remediation: "Use '/payment-logos/...' for local assets or a full https URL for remote assets."
    }
  ];
};

const checkBitcoinFormat = (source: string, path: string, rail: Record<string, unknown>): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const uri = toStringOrUndefined(rail.uri);
  const address = toStringOrUndefined(rail.address);

  if (uri && !uri.toLowerCase().startsWith("bitcoin:")) {
    issues.push({
      level: "warning",
      source,
      path,
      message: `Bitcoin URI '${uri}' does not start with 'bitcoin:'.`,
      remediation: "Use BIP-21/BIP-321 style bitcoin: URIs for better wallet compatibility."
    });
  }

  if (address && !BITCOIN_ADDRESS_PATTERN.test(address)) {
    issues.push({
      level: "warning",
      source,
      path: `${path}.address`,
      message: `Bitcoin address '${address}' does not match common on-chain address formats.`,
      remediation: "Use a valid bech32 (bc1...) or legacy/base58 BTC address."
    });
  }

  return issues;
};

const checkLightningFormat = (source: string, path: string, rail: Record<string, unknown>): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const uri = toStringOrUndefined(rail.uri);
  const address = toStringOrUndefined(rail.address);

  if (uri && uri.includes(":") && !uri.toLowerCase().startsWith("lightning:")) {
    issues.push({
      level: "warning",
      source,
      path,
      message: `Lightning URI '${uri}' does not start with 'lightning:'.`,
      remediation: "Use lightning: URIs, or provide invoice/LNURL/Lightning Address in the rail address field."
    });
  }

  const candidate = address ?? (uri && !uri.includes(":") ? uri : undefined);
  if (!candidate) {
    return issues;
  }

  if (LIGHTNING_INVOICE_OR_LNURL_PATTERN.test(candidate) || LIGHTNING_ADDRESS_PATTERN.test(candidate)) {
    return issues;
  }

  issues.push({
    level: "warning",
    source,
    path: `${path}.address`,
    message: `Lightning value '${candidate}' does not match common invoice/LNURL/lightning-address patterns.`,
    remediation: "Use an invoice (lnbc...), LNURL (lnurl...), offer (lno...), or user@domain lightning address."
  });

  return issues;
};

const checkEthereumFormat = (source: string, path: string, rail: Record<string, unknown>): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const uri = toStringOrUndefined(rail.uri);
  const address = toStringOrUndefined(rail.address);

  if (uri && !uri.toLowerCase().startsWith("ethereum:")) {
    issues.push({
      level: "warning",
      source,
      path,
      message: `Ethereum URI '${uri}' does not start with 'ethereum:'.`,
      remediation: "Prefer EIP-681 style ethereum: URIs for best wallet compatibility."
    });
  }

  if (address && !ETH_ADDRESS_PATTERN.test(address) && !ENS_PATTERN.test(address)) {
    issues.push({
      level: "warning",
      source,
      path: `${path}.address`,
      message: `Ethereum target '${address}' is not a standard hex address or ENS name.`,
      remediation: "Use a 0x-prefixed 40-byte hex address or ENS name (for example name.eth)."
    });
  }

  return issues;
};

const checkSolanaFormat = (source: string, path: string, rail: Record<string, unknown>): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const uri = toStringOrUndefined(rail.uri);
  const address = toStringOrUndefined(rail.address);

  if (uri && !uri.toLowerCase().startsWith("solana:")) {
    issues.push({
      level: "warning",
      source,
      path,
      message: `Solana URI '${uri}' does not start with 'solana:'.`,
      remediation: "Prefer Solana Pay style solana: URIs for wallet interop."
    });
  }

  if (address && !SOLANA_ADDRESS_PATTERN.test(address)) {
    issues.push({
      level: "warning",
      source,
      path: `${path}.address`,
      message: `Solana address '${address}' is not a valid base58 public key shape.`,
      remediation: "Use a valid base58 Solana public key (typically 32-44 chars)."
    });
  }

  return issues;
};

const checkRailFormatWarnings = (
  source: string,
  path: string,
  railType: PaymentRailType,
  rail: Record<string, unknown>
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

const checkPaymentQrConfig = (source: string, path: string, value: unknown): ValidationIssue[] => {
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
      remediation: "Provide qr.logoUrl when qr.logoMode is set to custom."
    });
  }

  issues.push(...checkQrColor(source, `${path}.foregroundColor`, value.foregroundColor, "QR foreground color"));
  issues.push(...checkQrColor(source, `${path}.backgroundColor`, value.backgroundColor, "QR background color"));
  issues.push(...checkLogoUrlShape(source, `${path}.logoUrl`, value.logoUrl));

  if (typeof value.logoSize === "number" && (value.logoSize < 0.15 || value.logoSize > 0.35)) {
    issues.push({
      level: "warning",
      source,
      path: `${path}.logoSize`,
      message: `QR logoSize ${value.logoSize} is outside the recommended 0.15-0.35 range for scan reliability.`,
      remediation: "Use qr.logoSize between 0.15 and 0.35 to reduce scanning failures."
    });
  }

  return issues;
};

const checkPaymentRail = (source: string, path: string, value: unknown): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  if (!isRecord(value)) {
    return [
      {
        level: "error",
        source,
        path,
        message: "Payment rail must be an object.",
        remediation: "Provide each payment rail as an object with id and rail fields."
      }
    ];
  }

  const railTypeRaw = value.rail;
  if (!isPaymentRailType(railTypeRaw)) {
    issues.push({
      level: "error",
      source,
      path: `${path}.rail`,
      message: `Unknown payment rail '${String(railTypeRaw)}'.`,
      remediation: "Use a supported rail type (for example bitcoin, lightning, paypal, patreon, etc.)."
    });

    return issues;
  }

  if (typeof value.id !== "string" || value.id.trim().length === 0) {
    issues.push({
      level: "error",
      source,
      path: `${path}.id`,
      message: "Payment rail id is required.",
      remediation: "Provide a stable payment rail id (for example 'btc' or 'paypal')."
    });
  }

  issues.push(...checkKnownIconAlias(source, `${path}.icon`, value.icon));

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
      remediation: `Provide payment.rails[].url or payment.rails[].uri for ${railTypeRaw}.`
    });
  }

  if (CRYPTO_PAYMENT_RAILS.has(railTypeRaw) && !uri && !address) {
    issues.push({
      level: "error",
      source,
      path,
      message: `Rail '${railTypeRaw}' requires uri or address.`,
      remediation: `Provide payment.rails[].uri or payment.rails[].address for ${railTypeRaw}.`
    });
  }

  if (railTypeRaw === "custom-crypto" && !uri && !(scheme && address) && !url) {
    issues.push({
      level: "error",
      source,
      path,
      message: "Rail 'custom-crypto' requires uri, url, or scheme + address.",
      remediation: "Provide uri, url, or both scheme and address for custom-crypto rails."
    });
  }

  issues.push(
    ...checkScheme(source, `${path}.url`, value.url, {
      allowedSchemes: PAYMENT_ALLOWED_SCHEMES,
      remediation: "Use http/https or supported payment schemes in payment rail URL fields."
    })
  );

  if (uri && uri.includes(":")) {
    issues.push(
      ...checkScheme(source, `${path}.uri`, uri, {
        remediation: "Use a valid URI for payment rails (for example bitcoin:, lightning:, ethereum:, solana:, or https://)."
      })
    );
  }

  if (Array.isArray(value.appLinks)) {
    value.appLinks.forEach((entry, appIndex) => {
      if (!isRecord(entry)) {
        return;
      }

      issues.push(
        ...checkScheme(source, `${path}.appLinks[${appIndex}].url`, entry.url, {
          remediation: "Provide a parseable app deep-link URL."
        })
      );
    });
  }

  issues.push(...checkPaymentQrConfig(source, `${path}.qr`, value.qr));
  issues.push(...checkRailFormatWarnings(source, path, railTypeRaw, value));

  return issues;
};

const checkPaymentConfig = (source: string, path: string, value: unknown): ValidationIssue[] => {
  if (!isRecord(value)) {
    return [];
  }

  const issues: ValidationIssue[] = [];

  issues.push(...checkCustomConflicts(source, value.custom, new Set(["rails", "qrDisplay", "primaryRailId"]), `${path}.custom`));

  const rails = Array.isArray(value.rails) ? value.rails : [];

  rails.forEach((rail, railIndex) => {
    issues.push(...checkPaymentRail(source, `${path}.rails[${railIndex}]`, rail));
  });

  const primaryRailId = toStringOrUndefined(value.primaryRailId);
  if (primaryRailId && rails.length > 0) {
    const exists = rails.some((rail) => isRecord(rail) && toStringOrUndefined(rail.id) === primaryRailId);
    if (!exists) {
      issues.push({
        level: "warning",
        source,
        path: `${path}.primaryRailId`,
        message: `primaryRailId '${primaryRailId}' does not match any rail id.`,
        remediation: "Set primaryRailId to an existing payment.rails[].id value."
      });
    }
  }

  return issues;
};

const checkSitePaymentsConfig = (source: string, site: Record<string, unknown>): ValidationIssue[] => {
  const ui = isRecord(site.ui) ? site.ui : undefined;
  const payments = ui && isRecord(ui.payments) ? ui.payments : undefined;
  const qr = payments && isRecord(payments.qr) ? payments.qr : undefined;

  if (!qr) {
    return [];
  }

  const issues: ValidationIssue[] = [];

  issues.push(
    ...checkQrColor(source, "$.ui.payments.qr.foregroundColorDefault", qr.foregroundColorDefault, "Default QR foreground color")
  );
  issues.push(
    ...checkQrColor(source, "$.ui.payments.qr.backgroundColorDefault", qr.backgroundColorDefault, "Default QR background color")
  );

  if (typeof qr.logoSizeDefault === "number" && (qr.logoSizeDefault < 0.15 || qr.logoSizeDefault > 0.35)) {
    issues.push({
      level: "warning",
      source,
      path: "$.ui.payments.qr.logoSizeDefault",
      message: `logoSizeDefault ${qr.logoSizeDefault} is outside the recommended 0.15-0.35 range for scan reliability.`,
      remediation: "Use a default logo size between 0.15 and 0.35 to reduce scanning failures."
    });
  }

  return issues;
};

export const runPolicyRules = ({ profile, links, site, sources: overrideSources }: PolicyInput): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const sources = {
    profile: "data/profile.json",
    links: "data/links.json",
    site: "data/site.json",
    ...overrideSources
  };

  issues.push(...unknownTopLevelWarnings(sources.profile, profile, PROFILE_KEYS));
  issues.push(...unknownTopLevelWarnings(sources.links, links, LINKS_ROOT_KEYS));
  issues.push(...unknownTopLevelWarnings(sources.site, site, SITE_KEYS));

  issues.push(...checkCustomConflicts(sources.profile, profile.custom, PROFILE_KEYS, "$.custom"));
  issues.push(...checkCustomConflicts(sources.links, links.custom, LINKS_ROOT_KEYS, "$.custom"));
  issues.push(...checkCustomConflicts(sources.site, site.custom, SITE_KEYS, "$.custom"));

  const siteUi = isRecord(site.ui) ? site.ui : undefined;
  const maybeScale = siteUi && typeof siteUi.profileAvatarScale === "number" ? siteUi.profileAvatarScale : undefined;
  if (maybeScale !== undefined && (maybeScale <= 0 || maybeScale > 4)) {
    issues.push({
      level: "warning",
      source: sources.site,
      path: "$.ui.profileAvatarScale",
      message: `profileAvatarScale ${maybeScale} is outside the recommended 0–4 range.`,
      remediation: "Use a value between 0 and 4 (default 1.5) for avatar size multiplier."
    });
  }
  const brandIcons = siteUi && isRecord(siteUi.brandIcons) ? siteUi.brandIcons : undefined;
  issues.push(
    ...checkIconOverrideAliases(sources.site, "$.ui.brandIcons.iconOverrides", brandIcons?.iconOverrides)
  );
  issues.push(...checkSitePaymentsConfig(sources.site, site));

  const profileLinks = Array.isArray(profile.profileLinks) ? profile.profileLinks : [];
  profileLinks.forEach((link, index) => {
    if (isRecord(link)) {
      issues.push(
        ...checkScheme(sources.profile, `$.profileLinks[${index}].url`, link.url, {
          allowedSchemes: BASE_ALLOWED_SCHEMES,
          remediation: "Use one of: http, https, mailto, tel."
        })
      );
    }
  });

  const linkItems = Array.isArray(links.links) ? links.links : [];
  linkItems.forEach((link, index) => {
    if (!isRecord(link)) {
      return;
    }

    const linkType = toStringOrUndefined(link.type);
    const paymentConfig = isRecord(link.payment) ? link.payment : undefined;
    const isPaymentContext = linkType === "payment" || Boolean(paymentConfig);

    if (linkType === "simple" || linkType === "rich" || toStringOrUndefined(link.url)) {
      issues.push(
        ...checkScheme(sources.links, `$.links[${index}].url`, link.url, {
          allowedSchemes: isPaymentContext ? PAYMENT_ALLOWED_SCHEMES : BASE_ALLOWED_SCHEMES,
          remediation: isPaymentContext
            ? "Use http/https/mailto/tel or a supported payment scheme for payment-enabled links."
            : "Use one of: http, https, mailto, tel."
        })
      );
    }

    issues.push(...checkKnownIconAlias(sources.links, `$.links[${index}].icon`, link.icon));
    issues.push(...checkPaymentConfig(sources.links, `$.links[${index}].payment`, link.payment));
    issues.push(
      ...checkCustomConflicts(
        sources.links,
        link.custom,
        LINK_KEYS,
        `$.links[${index}].custom`
      )
    );
  });

  return issues;
};
