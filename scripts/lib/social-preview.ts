import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import type { ResvgRenderOptions } from "@resvg/resvg-js";
import type { OpenLinksMarkSpec } from "./openlinks-logo";

export const SOCIAL_PREVIEW_WIDTH = 1200;
export const SOCIAL_PREVIEW_HEIGHT = 630;
export const DEFAULT_SOCIAL_PREVIEW_TAGLINE = "Own your links";
export const DEFAULT_SOCIAL_PREVIEW_EYEBROW = "OPEN SOURCE LINKS";
export const DEFAULT_SOCIAL_PREVIEW_FOOTER = "STATIC / OPEN SOURCE / YOURS";

export interface BuildSocialPreviewSvgInput {
  title: string;
  description: string;
  markSpec: OpenLinksMarkSpec;
  eyebrow?: string;
  tagline?: string;
  footer?: string;
}

const LEFT_X = 96;
const TITLE_START_Y = 248;
const TITLE_LINE_HEIGHT = 88;
const DESCRIPTION_LINE_HEIGHT = 34;
const SVG_LAYOUT_PRECISION = 100;
const TEXT_MEASURE_SVG_WIDTH = 2048;
const TEXT_MEASURE_SVG_HEIGHT = 256;
const DISPLAY_FONT_FAMILY = "'Space Grotesk', 'Avenir Next', 'Segoe UI', sans-serif";
const BODY_FONT_FAMILY = "'Manrope', 'IBM Plex Sans', 'Segoe UI', sans-serif";

export const SOCIAL_PREVIEW_FONT_FILES = [
  fileURLToPath(new URL("../assets/fonts/SpaceGrotesk-wght.ttf", import.meta.url)),
  fileURLToPath(new URL("../assets/fonts/Manrope-wght.ttf", import.meta.url)),
] as const;

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const normalizeWhitespace = (value: string): string => value.replace(/\s+/gu, " ").trim();

const splitLongToken = (token: string, maxChars: number): string[] => {
  if (token.length <= maxChars) {
    return [token];
  }

  const parts: string[] = [];
  for (let cursor = 0; cursor < token.length; cursor += maxChars) {
    parts.push(token.slice(cursor, cursor + maxChars));
  }
  return parts;
};

const ellipsize = (value: string, maxChars: number): string => {
  if (value.length <= maxChars) {
    return value;
  }

  const clipped = value.slice(0, Math.max(1, maxChars - 1)).trimEnd();
  return `${clipped}...`;
};

const wrapText = (value: string, maxChars: number, maxLines: number): string[] => {
  const normalized = normalizeWhitespace(value);
  if (normalized.length === 0) {
    return [];
  }

  const tokens = normalized
    .split(" ")
    .flatMap((token) => splitLongToken(token, maxChars))
    .filter((token) => token.length > 0);

  const lines: string[] = [];
  let currentLine = "";
  let overflowed = false;

  for (const token of tokens) {
    const candidate = currentLine.length > 0 ? `${currentLine} ${token}` : token;
    if (candidate.length <= maxChars) {
      currentLine = candidate;
      continue;
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = token;
    } else {
      lines.push(token);
      currentLine = "";
    }

    if (lines.length === maxLines) {
      overflowed = true;
      break;
    }
  }

  if (!overflowed && currentLine.length > 0 && lines.length < maxLines) {
    lines.push(currentLine);
  } else if (currentLine.length > 0 && lines.length === maxLines) {
    overflowed = true;
  }

  if (overflowed && lines.length > 0) {
    lines[lines.length - 1] = ellipsize(lines[lines.length - 1], maxChars);
  }

  return lines.slice(0, maxLines);
};

const renderTextLines = (input: {
  lines: string[];
  fontFamily: string;
  fontSize: number;
  fontWeight?: number;
  fill: string;
  x: number;
  startY: number;
  lineHeight: number;
  letterSpacing?: string;
}) =>
  input.lines
    .map((line, index) => {
      const y = input.startY + index * input.lineHeight;
      const letterSpacing =
        typeof input.letterSpacing === "string" ? ` letter-spacing="${input.letterSpacing}"` : "";

      return `<text x="${input.x}" y="${y}" font-family="${input.fontFamily}" font-size="${input.fontSize}" font-weight="${input.fontWeight ?? 400}" fill="${input.fill}"${letterSpacing}>${escapeXml(line)}</text>`;
    })
    .join("\n");

interface SvgPillLayoutInput {
  x: number;
  y: number;
  label: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: number;
  paddingX: number;
  paddingY: number;
  letterSpacing?: string;
}

interface SvgPillLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  textX: number;
  textY: number;
  label: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: number;
  letterSpacing?: string;
}

interface RenderSvgPillInput extends SvgPillLayout {
  backgroundFill: string;
  backgroundFillOpacity?: number;
  indent?: string;
  stroke?: string;
  strokeOpacity?: number;
  textFill: string;
}

const formatSvgNumber = (value: number): string => {
  const rounded = Math.round(value * SVG_LAYOUT_PRECISION) / SVG_LAYOUT_PRECISION;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toString();
};

export const resolveSocialPreviewFontOptions = (): NonNullable<ResvgRenderOptions["font"]> => ({
  fontFiles: [...SOCIAL_PREVIEW_FONT_FILES],
  loadSystemFonts: false,
  defaultFontFamily: "Manrope",
  sansSerifFamily: "Manrope",
});

interface MeasuredSvgTextBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MeasureSvgTextInput {
  label: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: number;
  letterSpacing?: string;
}

const textBoundsCache = new Map<string, MeasuredSvgTextBounds>();

const measureSvgTextBounds = (input: MeasureSvgTextInput): MeasuredSvgTextBounds => {
  const label = normalizeWhitespace(input.label);
  if (label.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const cacheKey = [
    label,
    input.fontFamily,
    input.fontSize,
    input.fontWeight ?? 400,
    input.letterSpacing ?? "",
  ].join("|");
  const cachedBounds = textBoundsCache.get(cacheKey);
  if (cachedBounds) {
    return cachedBounds;
  }

  const letterSpacing =
    typeof input.letterSpacing === "string" ? ` letter-spacing="${input.letterSpacing}"` : "";
  const svgSource = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TEXT_MEASURE_SVG_WIDTH}" height="${TEXT_MEASURE_SVG_HEIGHT}" viewBox="0 0 ${TEXT_MEASURE_SVG_WIDTH} ${TEXT_MEASURE_SVG_HEIGHT}">`,
    `  <text x="0" y="0" font-family="${input.fontFamily}" font-size="${formatSvgNumber(input.fontSize)}" font-weight="${input.fontWeight ?? 400}"${letterSpacing}>${escapeXml(label)}</text>`,
    "</svg>",
  ].join("\n");
  const renderer = new Resvg(svgSource, { font: resolveSocialPreviewFontOptions() });
  const bounds = renderer.getBBox();

  if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
    throw new Error(`Failed to measure social preview text bounds for "${label}".`);
  }

  const measuredBounds = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
  textBoundsCache.set(cacheKey, measuredBounds);
  return measuredBounds;
};

const resolveSvgPillLayout = (input: SvgPillLayoutInput): SvgPillLayout => {
  const label = normalizeWhitespace(input.label);
  const bounds = measureSvgTextBounds({
    label,
    fontFamily: input.fontFamily,
    fontSize: input.fontSize,
    fontWeight: input.fontWeight,
    letterSpacing: input.letterSpacing,
  });
  const height = Math.max(1, Math.ceil(bounds.height + input.paddingY * 2));
  const width = Math.max(height, Math.ceil(bounds.width + input.paddingX * 2));

  return {
    x: input.x,
    y: input.y,
    width,
    height,
    radius: Math.ceil(height / 2),
    textX: input.x + input.paddingX - bounds.x,
    textY: input.y + input.paddingY - bounds.y,
    label,
    fontFamily: input.fontFamily,
    fontSize: input.fontSize,
    fontWeight: input.fontWeight,
    letterSpacing: input.letterSpacing,
  };
};

const renderSvgPill = (input: RenderSvgPillInput): string => {
  const indent = input.indent ?? "";
  const letterSpacing =
    typeof input.letterSpacing === "string" ? ` letter-spacing="${input.letterSpacing}"` : "";
  const fillOpacity =
    typeof input.backgroundFillOpacity === "number"
      ? ` fill-opacity="${formatSvgNumber(input.backgroundFillOpacity)}"`
      : "";
  const stroke = typeof input.stroke === "string" ? ` stroke="${input.stroke}"` : "";
  const strokeOpacity =
    typeof input.strokeOpacity === "number"
      ? ` stroke-opacity="${formatSvgNumber(input.strokeOpacity)}"`
      : "";

  return [
    `${indent}<rect x="${formatSvgNumber(input.x)}" y="${formatSvgNumber(input.y)}" width="${formatSvgNumber(input.width)}" height="${formatSvgNumber(input.height)}" rx="${formatSvgNumber(input.radius)}" fill="${input.backgroundFill}"${fillOpacity}${stroke}${strokeOpacity} />`,
    `${indent}<text x="${formatSvgNumber(input.textX)}" y="${formatSvgNumber(input.textY)}" font-family="${input.fontFamily}" font-size="${formatSvgNumber(input.fontSize)}" font-weight="${input.fontWeight ?? 400}" fill="${input.textFill}"${letterSpacing}>${escapeXml(input.label)}</text>`,
  ].join("\n");
};

const buildOpenLinksMarkGroup = (markSpec: OpenLinksMarkSpec, strokeColor: string): string =>
  [
    `<circle cx="50" cy="50" r="${markSpec.circleRadius}" fill="none" stroke="${strokeColor}" stroke-width="${markSpec.stroke.circle}" />`,
    `<path d="${markSpec.pathData}" fill="none" stroke="${strokeColor}" stroke-width="${markSpec.stroke.l}" stroke-linecap="round" stroke-linejoin="round" />`,
  ].join("\n");

export const buildSocialPreviewSvg = (input: BuildSocialPreviewSvgInput): string => {
  const titleLines = wrapText(input.title, 16, 2);
  const descriptionLines = wrapText(input.description, 52, 2);
  const titleEndY = TITLE_START_Y + Math.max(0, titleLines.length - 1) * TITLE_LINE_HEIGHT;
  const taglineY = titleEndY + 94;
  const descriptionStartY = taglineY + 58;
  const footer = normalizeWhitespace(input.footer ?? DEFAULT_SOCIAL_PREVIEW_FOOTER);
  const eyebrow = normalizeWhitespace(input.eyebrow ?? DEFAULT_SOCIAL_PREVIEW_EYEBROW);
  const tagline = normalizeWhitespace(input.tagline ?? DEFAULT_SOCIAL_PREVIEW_TAGLINE);
  const mark = buildOpenLinksMarkGroup(input.markSpec, "#f5f7fb");
  const eyebrowPill = resolveSvgPillLayout({
    x: 96,
    y: 98,
    label: eyebrow,
    fontFamily: DISPLAY_FONT_FAMILY,
    fontSize: 16,
    fontWeight: 700,
    paddingX: 26,
    paddingY: 11,
    letterSpacing: "0.18em",
  });
  const footerPill = resolveSvgPillLayout({
    x: 0,
    y: -22,
    label: footer,
    fontFamily: DISPLAY_FONT_FAMILY,
    fontSize: 14,
    fontWeight: 700,
    paddingX: 20,
    paddingY: 10,
    letterSpacing: "0.14em",
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SOCIAL_PREVIEW_WIDTH}" height="${SOCIAL_PREVIEW_HEIGHT}" viewBox="0 0 ${SOCIAL_PREVIEW_WIDTH} ${SOCIAL_PREVIEW_HEIGHT}" role="img" aria-labelledby="title desc">`,
    '  <title id="title">OpenLinks social preview</title>',
    `  <desc id="desc">${escapeXml(`${normalizeWhitespace(input.title)}. ${normalizeWhitespace(tagline)}. ${normalizeWhitespace(input.description)}`)}</desc>`,
    "  <defs>",
    '    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">',
    '      <stop offset="0%" stop-color="#05080e" />',
    '      <stop offset="58%" stop-color="#0c1420" />',
    '      <stop offset="100%" stop-color="#152636" />',
    "    </linearGradient>",
    '    <radialGradient id="glow" cx="50%" cy="50%" r="56%">',
    '      <stop offset="0%" stop-color="#50e3c2" stop-opacity="0.44" />',
    '      <stop offset="100%" stop-color="#50e3c2" stop-opacity="0" />',
    "    </radialGradient>",
    '    <linearGradient id="accentLine" x1="0%" y1="0%" x2="100%" y2="0%">',
    '      <stop offset="0%" stop-color="#50e3c2" />',
    '      <stop offset="100%" stop-color="#7cf2d8" stop-opacity="0.28" />',
    "    </linearGradient>",
    "  </defs>",
    '  <rect width="1200" height="630" rx="36" fill="url(#bg)" />',
    '  <path d="M0 0 H1200 V180 C1085 144 965 126 842 126 C739 126 633 138 523 162 C357 198 170 226 0 184 Z" fill="#f5f7fb" fill-opacity="0.02" />',
    '  <circle cx="930" cy="312" r="246" fill="url(#glow)" />',
    '  <circle cx="930" cy="312" r="206" fill="none" stroke="#7cf2d8" stroke-opacity="0.18" stroke-width="2" />',
    '  <circle cx="930" cy="312" r="160" fill="none" stroke="#f5f7fb" stroke-opacity="0.12" stroke-width="1.5" />',
    renderSvgPill({
      ...eyebrowPill,
      backgroundFill: "#f5f7fb",
      backgroundFillOpacity: 0.07,
      indent: "  ",
      stroke: "#f5f7fb",
      strokeOpacity: 0.09,
      textFill: "#d7e2f7",
    }),
    renderTextLines({
      lines: titleLines,
      fontFamily: DISPLAY_FONT_FAMILY,
      fontSize: 94,
      fontWeight: 700,
      fill: "#f5f7fb",
      x: LEFT_X,
      startY: TITLE_START_Y,
      lineHeight: TITLE_LINE_HEIGHT,
    }),
    `  <text x="${LEFT_X}" y="${taglineY}" font-family="${DISPLAY_FONT_FAMILY}" font-size="46" font-weight="700" fill="#7cf2d8">${escapeXml(tagline)}</text>`,
    renderTextLines({
      lines: descriptionLines,
      fontFamily: BODY_FONT_FAMILY,
      fontSize: 28,
      fontWeight: 600,
      fill: "#c0cadf",
      x: LEFT_X,
      startY: descriptionStartY,
      lineHeight: DESCRIPTION_LINE_HEIGHT,
    }),
    '  <rect x="96" y="500" width="372" height="2" rx="1" fill="url(#accentLine)" />',
    '  <g transform="translate(759 141) scale(3.42)">',
    `    ${mark}`,
    "  </g>",
    '  <g transform="translate(96 562)">',
    renderSvgPill({
      ...footerPill,
      backgroundFill: "#09111b",
      backgroundFillOpacity: 0.78,
      indent: "    ",
      stroke: "#f5f7fb",
      strokeOpacity: 0.12,
      textFill: "#f5f7fb",
    }),
    "  </g>",
    "</svg>",
    "",
  ].join("\n");
};

export const renderSocialPreviewPng = (svgSource: string): Buffer => {
  const renderer = new Resvg(svgSource, {
    fitTo: { mode: "width", value: SOCIAL_PREVIEW_WIDTH },
    background: "rgba(0,0,0,0)",
    font: resolveSocialPreviewFontOptions(),
  });

  return renderer.render().asPng();
};
