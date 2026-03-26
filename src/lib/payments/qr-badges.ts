import {
  type KnownSite,
  type KnownSiteId,
  resolveKnownSiteById,
  resolveKnownSiteFromIcon,
  resolveKnownSiteFromUrl,
} from "../icons/known-sites-data";
import { type SiteIconGraphic, resolveKnownSiteGraphic } from "../icons/site-icon-graphics";
import { normalizeCustomLogoUrl, resolvePaymentRailLogoUrl } from "./rail-logos";
import type {
  PaymentQrBadgeConfig,
  PaymentQrBadgeItem,
  PaymentQrLogoMode,
  PaymentRailType,
} from "./types";

type ResolvedBadgeEntry =
  | {
      kind: "graphic";
      backgroundColor: string;
      graphic: SiteIconGraphic;
      label: string;
    }
  | {
      kind: "asset";
      label: string;
      url: string;
    };

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

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const toEncodedSvgDataUrl = (svg: string): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const resolveBadgeForeground = (backgroundColor: string): string => {
  const normalized = backgroundColor.trim();
  const match = normalized.match(/^#([0-9a-f]{6})$/iu);

  if (!match) {
    return "#FFFFFF";
  }

  const red = Number.parseInt(match[1].slice(0, 2), 16);
  const green = Number.parseInt(match[1].slice(2, 4), 16);
  const blue = Number.parseInt(match[1].slice(4, 6), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;

  return brightness > 150 ? "#111827" : "#FFFFFF";
};

const parseViewBox = (viewBox: string): [number, number, number, number] => {
  const parsed = viewBox
    .trim()
    .split(/\s+/u)
    .map((value) => Number.parseFloat(value));

  if (parsed.length !== 4 || parsed.some((value) => Number.isNaN(value))) {
    return [0, 0, 24, 24];
  }

  return [parsed[0] ?? 0, parsed[1] ?? 0, parsed[2] ?? 24, parsed[3] ?? 24];
};

const renderGraphic = (
  graphic: SiteIconGraphic,
  color: string,
  centerX: number,
  centerY: number,
  targetSize: number,
): string => {
  const [minX, minY, width, height] = parseViewBox(graphic.viewBox);
  const scale = targetSize / Math.max(width, height);
  const translateX = centerX - (width * scale) / 2 - minX * scale;
  const translateY = centerY - (height * scale) / 2 - minY * scale;

  return [
    `<g fill="${escapeXml(color)}" transform="translate(${translateX} ${translateY}) scale(${scale})">`,
    ...graphic.paths.map((path) => `<path d="${escapeXml(path)}" />`),
    "</g>",
  ].join("");
};

const renderBadgeEntry = (
  entry: ResolvedBadgeEntry,
  index: number,
  centerX: number,
  centerY: number,
  radius: number,
): string => {
  const clipId = `qr-badge-clip-${index}`;

  if (entry.kind === "asset") {
    const size = radius * 2;
    const imageX = centerX - radius;
    const imageY = centerY - radius;

    return [
      `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="#FFFFFF" stroke="#D1D5DB" stroke-width="1.5" />`,
      `<clipPath id="${clipId}"><circle cx="${centerX}" cy="${centerY}" r="${radius - 1}" /></clipPath>`,
      `<image href="${escapeXml(entry.url)}" x="${imageX}" y="${imageY}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${clipId})" />`,
    ].join("");
  }

  const foregroundColor = resolveBadgeForeground(entry.backgroundColor);

  return [
    `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="${escapeXml(entry.backgroundColor)}" />`,
    renderGraphic(entry.graphic, foregroundColor, centerX, centerY, radius * 1.18),
  ].join("");
};

const composeBadgeSvg = (entries: ResolvedBadgeEntry[]): string => {
  const limitedEntries = entries.slice(0, 2);
  const outerFrame =
    '<rect x="4" y="4" width="56" height="56" rx="18" fill="#FFFFFF" stroke="#D1D5DB" stroke-width="1.5" />';

  if (limitedEntries.length <= 1) {
    return [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="QR badge">',
      outerFrame,
      renderBadgeEntry(limitedEntries[0] as ResolvedBadgeEntry, 0, 32, 32, 18),
      "</svg>",
    ].join("");
  }

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="QR badge">',
    outerFrame,
    renderBadgeEntry(limitedEntries[0] as ResolvedBadgeEntry, 0, 23, 32, 14),
    renderBadgeEntry(limitedEntries[1] as ResolvedBadgeEntry, 1, 41, 32, 14),
    "</svg>",
  ].join("");
};

const resolveGraphicEntryForSiteId = (siteId: KnownSiteId): ResolvedBadgeEntry | undefined => {
  const site = resolveKnownSiteById(siteId);

  if (!site) {
    return undefined;
  }

  return {
    kind: "graphic",
    backgroundColor: site.brandColor,
    graphic: resolveKnownSiteGraphic(site.id),
    label: site.label,
  };
};

const resolveRailEntry = (railType: PaymentRailType): ResolvedBadgeEntry | undefined =>
  resolveGraphicEntryForSiteId(paymentRailSiteIds[railType]);

const dedupeEntries = (entries: ResolvedBadgeEntry[]): ResolvedBadgeEntry[] => {
  const seen = new Set<string>();

  return entries.filter((entry) => {
    const key = entry.kind === "asset" ? `asset:${entry.url}` : `graphic:${entry.label}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const resolveBadgeItems = (
  items: PaymentQrBadgeItem[] | undefined,
  railType: PaymentRailType,
): ResolvedBadgeEntry[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  const entries = items.flatMap((item): ResolvedBadgeEntry[] => {
    if (item.type === "rail") {
      const railEntry = resolveRailEntry(railType);
      return railEntry ? [railEntry] : [];
    }

    if (item.type === "site") {
      if (typeof item.value !== "string") {
        return [];
      }

      const siteEntry = resolveGraphicEntryForSiteId(item.value as KnownSiteId);
      return siteEntry ? [siteEntry] : [];
    }

    if (item.type === "asset") {
      const assetUrl = normalizeCustomLogoUrl(item.value);
      if (!assetUrl) {
        return [];
      }

      return [
        {
          kind: "asset",
          label: item.value ?? "Asset",
          url: assetUrl,
        },
      ];
    }

    return [];
  });

  return dedupeEntries(entries).slice(0, 2);
};

const resolveAutoSite = (input: {
  linkIcon?: string;
  linkUrl?: string;
  railIcon?: string;
  railUrl?: string;
}): KnownSite | undefined =>
  resolveKnownSiteFromIcon(input.linkIcon) ??
  resolveKnownSiteFromIcon(input.railIcon) ??
  (input.railUrl ? resolveKnownSiteFromUrl(input.railUrl) : undefined) ??
  (input.linkUrl ? resolveKnownSiteFromUrl(input.linkUrl) : undefined);

const resolveAutoEntries = (input: {
  linkIcon?: string;
  linkUrl?: string;
  railIcon?: string;
  railType: PaymentRailType;
  railUrl?: string;
}): ResolvedBadgeEntry[] => {
  const railEntry = resolveRailEntry(input.railType);
  const site = resolveAutoSite(input);

  if (!railEntry) {
    return [];
  }

  if (!site || site.id === paymentRailSiteIds[input.railType]) {
    return [railEntry];
  }

  const siteEntry = resolveGraphicEntryForSiteId(site.id);
  if (!siteEntry) {
    return [railEntry];
  }

  return [siteEntry, railEntry];
};

const resolveComposedBadgeUrl = (entries: ResolvedBadgeEntry[]): string | undefined => {
  if (entries.length === 0) {
    return undefined;
  }

  if (entries.length === 1) {
    const [entry] = entries;

    if (entry?.kind === "asset") {
      return entry.url;
    }
  }

  return toEncodedSvgDataUrl(composeBadgeSvg(entries));
};

export const resolvePaymentQrLogoUrl = (input: {
  badge?: PaymentQrBadgeConfig;
  customLogoUrl?: string;
  linkIcon?: string;
  linkUrl?: string;
  logoMode?: PaymentQrLogoMode;
  railIcon?: string;
  railType: PaymentRailType;
  railUrl?: string;
}): string | undefined => {
  const badgeMode = input.badge?.mode;

  if (badgeMode === "custom") {
    const badgeUrl = resolveComposedBadgeUrl(resolveBadgeItems(input.badge?.items, input.railType));

    if (badgeUrl) {
      return badgeUrl;
    }
  }

  if (badgeMode === "auto") {
    const autoEntries = resolveAutoEntries({
      linkIcon: input.linkIcon,
      linkUrl: input.linkUrl,
      railIcon: input.railIcon,
      railType: input.railType,
      railUrl: input.railUrl,
    });

    if (autoEntries.length > 1) {
      return resolveComposedBadgeUrl(autoEntries);
    }
  }

  return resolvePaymentRailLogoUrl({
    railType: input.railType,
    logoMode: input.logoMode,
    customLogoUrl: input.customLogoUrl,
  });
};

export const clampPaymentQrImageSize = (value: number | undefined): number => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.24;
  }

  return clamp(value, 0.15, 0.35);
};
