import fs from "node:fs";
import path from "node:path";
import {
  type SimpleIcon,
  siBitcoin,
  siCashapp,
  siCoinbase,
  siEthereum,
  siKofi,
  siLightning,
  siPatreon,
  siPaypal,
  siSolana,
  siStripe,
} from "simple-icons";
import {
  ACTIVE_PAYMENT_LOGO_SOURCE_ENTRIES,
  type BrandSvgSourceEntry,
} from "../src/lib/icons/brand-svg-sources";
import { resolveKnownSiteById } from "../src/lib/icons/known-sites-data";
import type { SiteIconGraphic, SiteIconGraphicPath } from "../src/lib/icons/site-icon-graphics";
import { resolveKnownSiteGraphic } from "../src/lib/icons/site-icon-graphics";

const ROOT = process.cwd();
const OUTPUT_ROOT = path.join(ROOT, "public/payment-logos");
const SIMPLE_ICONS_BY_KEY: Record<string, SimpleIcon> = {
  siBitcoin,
  siCashapp,
  siCoinbase,
  siEthereum,
  siKofi,
  siLightning,
  siPatreon,
  siPaypal,
  siSolana,
  siStripe,
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

  return brightness > 150 ? "#111111" : "#FFFFFF";
};

const toSimpleIconGraphic = (icon: SimpleIcon): SiteIconGraphic => ({
  title: icon.title,
  viewBox: "0 0 24 24",
  paths: [icon.path],
});

const renderPath = (pathValue: string | SiteIconGraphicPath): string => {
  if (typeof pathValue === "string") {
    return `<path d="${escapeXml(pathValue)}" />`;
  }

  const attributes = [
    `d="${escapeXml(pathValue.d)}"`,
    pathValue.fillRule ? `fill-rule="${escapeXml(pathValue.fillRule)}"` : undefined,
    pathValue.clipRule ? `clip-rule="${escapeXml(pathValue.clipRule)}"` : undefined,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");

  return `<path ${attributes} />`;
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
    ...graphic.paths.map(renderPath),
    "</g>",
  ].join("");
};

const buildProvenanceComment = (entry: BrandSvgSourceEntry): string => {
  const source =
    entry.sourceKind === "repo-fallback" && entry.repoSourceAssetPath
      ? entry.repoSourceAssetPath
      : entry.sourceUrl;

  const method =
    entry.sourceKind === "simple-icons-package"
      ? "Generated from the Simple Icons glyph and brand color into a circular payment-logo badge."
      : entry.sourceKind === "repo-fallback"
        ? "Retained as the OpenLinks-owned fallback asset because no shared non-brand source is more appropriate yet."
        : `Generated from the shared brand source entry (${entry.sourceKind}) into a circular payment-logo badge.`;

  const notes =
    entry.normalizationNotes ??
    "Centered on a circular background for QR and payment-card legibility.";

  return [
    "<!--",
    "SVG Logo Provenance",
    `Source: ${source}`,
    `Method: ${method}`,
    `Notes: ${notes}`,
    "-->",
  ].join("\n");
};

const buildPaymentLogoSvg = (entry: BrandSvgSourceEntry): string => {
  if (entry.sourceKind === "repo-fallback" && entry.repoSourceAssetPath) {
    return fs.readFileSync(path.join(ROOT, entry.repoSourceAssetPath), "utf8");
  }

  let graphic: SiteIconGraphic | undefined;
  let backgroundColor: string | undefined;
  let title = entry.brandId;

  if (entry.sourceKind === "simple-icons-package") {
    const icon = entry.packageIconKey ? SIMPLE_ICONS_BY_KEY[entry.packageIconKey] : undefined;
    if (!icon) {
      throw new Error(`Missing Simple Icons source for ${entry.brandId}.`);
    }

    graphic = toSimpleIconGraphic(icon);
    backgroundColor = `#${icon.hex}`;
    title = icon.title;
  } else if (entry.knownSiteId) {
    const site = resolveKnownSiteById(entry.knownSiteId);
    if (!site) {
      throw new Error(`Missing known-site metadata for ${entry.brandId}.`);
    }

    graphic = resolveKnownSiteGraphic(site.id);
    backgroundColor = site.brandColor;
    title = site.label;
  }

  if (!graphic || !backgroundColor) {
    throw new Error(`No renderable payment-logo source for ${entry.brandId}.`);
  }

  const foregroundColor = resolveBadgeForeground(backgroundColor);

  return [
    buildProvenanceComment(entry),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="${escapeXml(title)}">`,
    `  <circle cx="64" cy="64" r="58" fill="${escapeXml(backgroundColor)}"/>`,
    `  ${renderGraphic(graphic, foregroundColor, 64, 64, 58)}`,
    "</svg>",
    "",
  ].join("\n");
};

const run = () => {
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });

  for (const entry of ACTIVE_PAYMENT_LOGO_SOURCE_ENTRIES) {
    if (!entry.paymentLogoAssetPath) {
      continue;
    }

    const outputPath = path.join(ROOT, "public", entry.paymentLogoAssetPath.replace(/^\//u, ""));
    fs.writeFileSync(outputPath, buildPaymentLogoSvg(entry), "utf8");
    console.log(`Generated ${path.relative(ROOT, outputPath)} from ${entry.brandId}`);
  }
};

run();
