import { KNOWN_SITE_ALIASES, normalizeKnownSiteAlias } from "../../src/lib/icons/known-sites-data";
import type { PaymentRailType } from "../../src/lib/payments/types";
import type { ValidationIssue } from "./rules-contracts";

export const BASE_ALLOWED_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);
export const PAYMENT_ALLOWED_SCHEMES = new Set([
  ...BASE_ALLOWED_SCHEMES,
  "bitcoin:",
  "lightning:",
  "ethereum:",
  "solana:",
]);

export const PROFILE_KEYS = new Set([
  "name",
  "headline",
  "avatar",
  "bio",
  "entityType",
  "location",
  "pronouns",
  "status",
  "profileLinks",
  "contact",
  "custom",
]);

export const LINKS_ROOT_KEYS = new Set(["links", "groups", "order", "custom"]);
export const LINK_KEYS = new Set([
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
  "referral",
  "payment",
  "custom",
]);

export const SITE_KEYS = new Set([
  "title",
  "description",
  "baseUrl",
  "theme",
  "ui",
  "quality",
  "sharing",
  "custom",
]);

export const WEB_PAYMENT_RAILS = new Set<PaymentRailType>([
  "patreon",
  "kofi",
  "paypal",
  "cashapp",
  "stripe",
  "coinbase",
]);

export const CRYPTO_PAYMENT_RAILS = new Set<PaymentRailType>([
  "bitcoin",
  "lightning",
  "ethereum",
  "solana",
]);

export const BITCOIN_ADDRESS_PATTERN =
  /^(bc1[ac-hj-np-z02-9]{25,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/;
export const LIGHTNING_INVOICE_OR_LNURL_PATTERN = /^(lnbc|lntb|lnbcrt|lno|lnurl)[0-9a-z]+$/i;
export const LIGHTNING_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const ETH_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
export const ENS_PATTERN = /^.+\.eth$/i;
export const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const toStringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

export const handleResolutionReasonSummary = (reason: string): string => {
  switch (reason) {
    case "missing_handle_segment":
      return "Missing expected username segment in the URL path.";
    case "not_profile_url":
      return "URL does not match a supported profile URL shape.";
    case "invalid_handle":
      return "URL path segment failed handle-format checks.";
    default:
      return "Supported handle extractor could not resolve a handle from this URL.";
  }
};

export const unknownTopLevelWarnings = (
  source: string,
  payload: Record<string, unknown>,
  allowed: Set<string>,
): ValidationIssue[] => {
  const warnings: ValidationIssue[] = [];

  for (const key of Object.keys(payload)) {
    if (!allowed.has(key)) {
      warnings.push({
        level: "warning",
        source,
        path: `$.${key}`,
        message: `Unknown top-level key '${key}' is allowed but not part of the core contract.`,
        remediation: `Move '${key}' into a dedicated custom block if it is extension data, or document why it belongs at top level.`,
      });
    }
  }

  return warnings;
};

export const checkCustomConflicts = (
  source: string,
  customValue: unknown,
  reservedKeys: Set<string>,
  pathPrefix: string,
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
        remediation: `Rename '${pathPrefix}.${key}' to a non-reserved extension key (for example '${key}Extra').`,
      });
    }
  }

  return errors;
};

export const checkScheme = (
  source: string,
  path: string,
  value: unknown,
  options?: {
    allowedSchemes?: Set<string>;
    remediation?: string;
  },
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
          remediation: options.remediation ?? "Use an allowed URL scheme for this field.",
        },
      ];
    }
  } catch {
    return [
      {
        level: "error",
        source,
        path,
        message: "URL value is not parseable.",
        remediation:
          options?.remediation ?? "Provide a valid absolute URL or supported scheme-based URL.",
      },
    ];
  }

  return [];
};

export const checkKnownIconAlias = (
  source: string,
  path: string,
  value: unknown,
): ValidationIssue[] => {
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
      message: `Unknown icon alias '${value}'. Runtime rendering will fall back to URL-domain matching or generic icon fallback.`,
      remediation:
        "Use a known alias from src/lib/icons/known-sites-data.ts, or remove links[].icon to rely on domain mapping.",
    },
  ];
};

export const checkIconOverrideAliases = (
  source: string,
  path: string,
  value: unknown,
): ValidationIssue[] => {
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
          "Use a known source alias from src/lib/icons/known-sites-data.ts in ui.brandIcons.iconOverrides.",
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
          "Use a known target alias from src/lib/icons/known-sites-data.ts in ui.brandIcons.iconOverrides.",
      });
    }
  }

  return warnings;
};

export const isLikelyCssColor = (value: string): boolean => {
  const normalized = value.trim();

  return (
    /^#[\da-fA-F]{3,8}$/.test(normalized) ||
    /^rgba?\(/i.test(normalized) ||
    /^hsla?\(/i.test(normalized) ||
    /^var\(--[\w-]+\)$/.test(normalized) ||
    /^[a-zA-Z]+$/.test(normalized)
  );
};

export const checkQrColor = (
  source: string,
  path: string,
  value: unknown,
  label: string,
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
      remediation: "Use hex/rgb/hsl/named color values for QR foreground/background styling.",
    },
  ];
};

export const checkLogoUrlShape = (
  source: string,
  path: string,
  value: unknown,
): ValidationIssue[] => {
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
      remediation:
        "Use '/payment-logos/...' for local assets or a full https URL for remote assets.",
    },
  ];
};
