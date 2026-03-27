import { type KnownSiteId, resolveKnownSiteById } from "../icons/known-sites-data";
import { type SiteIconGraphic, resolveKnownSiteGraphic } from "../icons/site-icon-graphics";

export type ResolvedQrBadgeEntry =
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

interface ComposeQrBadgeOptions {
  foregroundEntryIndex?: 0 | 1;
}

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
  entry: ResolvedQrBadgeEntry,
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

const composeBadgeSvg = (
  entries: ResolvedQrBadgeEntry[],
  options?: ComposeQrBadgeOptions,
): string => {
  const limitedEntries = entries.slice(0, 2);
  const outerFrame =
    '<rect x="4" y="4" width="56" height="56" rx="18" fill="#FFFFFF" stroke="#D1D5DB" stroke-width="1.5" />';

  if (limitedEntries.length <= 1) {
    return [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="QR badge">',
      outerFrame,
      renderBadgeEntry(limitedEntries[0] as ResolvedQrBadgeEntry, 0, 32, 32, 18),
      "</svg>",
    ].join("");
  }

  const positionedEntries = [
    {
      centerX: 23,
      centerY: 32,
      entry: limitedEntries[0] as ResolvedQrBadgeEntry,
      entryIndex: 0 as const,
      radius: 14,
    },
    {
      centerX: 41,
      centerY: 32,
      entry: limitedEntries[1] as ResolvedQrBadgeEntry,
      entryIndex: 1 as const,
      radius: 14,
    },
  ];
  const foregroundEntryIndex = options?.foregroundEntryIndex ?? 1;
  const backgroundEntries = positionedEntries.filter(
    (entry) => entry.entryIndex !== foregroundEntryIndex,
  );
  const maybeForegroundEntry = positionedEntries.find(
    (entry) => entry.entryIndex === foregroundEntryIndex,
  );

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="QR badge">',
    outerFrame,
    ...backgroundEntries.map((entry) =>
      renderBadgeEntry(entry.entry, entry.entryIndex, entry.centerX, entry.centerY, entry.radius),
    ),
    ...(maybeForegroundEntry
      ? [
          renderBadgeEntry(
            maybeForegroundEntry.entry,
            maybeForegroundEntry.entryIndex,
            maybeForegroundEntry.centerX,
            maybeForegroundEntry.centerY,
            maybeForegroundEntry.radius,
          ),
        ]
      : []),
    "</svg>",
  ].join("");
};

export const dedupeQrBadgeEntries = (entries: ResolvedQrBadgeEntry[]): ResolvedQrBadgeEntry[] => {
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

export const resolveKnownSiteQrBadgeEntry = (
  siteId: KnownSiteId,
): ResolvedQrBadgeEntry | undefined => {
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

export const resolveComposedQrBadgeUrl = (
  entries: ResolvedQrBadgeEntry[],
  options?: ComposeQrBadgeOptions,
): string | undefined => {
  if (entries.length === 0) {
    return undefined;
  }

  if (entries.length === 1) {
    const [entry] = entries;

    if (entry?.kind === "asset") {
      return entry.url;
    }
  }

  return toEncodedSvgDataUrl(composeBadgeSvg(entries, options));
};
