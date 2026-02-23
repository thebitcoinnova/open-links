import type { EnrichmentMetadata } from "./types";

const htmlEntityMap: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " "
};

const decodeEntities = (value: string): string =>
  value.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => htmlEntityMap[entity] ?? entity);

const toSourceLabel = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const toAbsoluteUrl = (candidate: string | undefined, baseUrl: string): string | undefined => {
  if (!candidate) {
    return undefined;
  }

  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return undefined;
  }
};

const attributeMap = (tag: string): Record<string, string> => {
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g;

  for (const match of tag.matchAll(attrRegex)) {
    const key = match[1]?.toLowerCase();
    const rawValue = match[2];
    if (!key || !rawValue) {
      continue;
    }

    const unquoted = rawValue.replace(/^['"]|['"]$/g, "").trim();
    attrs[key] = decodeEntities(unquoted);
  }

  return attrs;
};

const extractMetaContent = (html: string, keys: string[]): string | undefined => {
  const normalizedKeys = new Set(keys.map((key) => key.toLowerCase()));
  const metaRegex = /<meta\s+[^>]*>/gi;

  for (const match of html.matchAll(metaRegex)) {
    const tag = match[0] ?? "";
    const attrs = attributeMap(tag);
    const identity = (attrs.property ?? attrs.name ?? "").toLowerCase();

    if (normalizedKeys.has(identity) && attrs.content) {
      return attrs.content;
    }
  }

  return undefined;
};

const extractTitle = (html: string): string | undefined => {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const value = match?.[1]?.replace(/\s+/g, " ").trim();
  return value ? decodeEntities(value) : undefined;
};

export interface ParsedMetadata {
  metadata: EnrichmentMetadata;
  completeness: "full" | "partial" | "none";
  missing: Array<"title" | "description" | "image">;
}

export const parseMetadata = (html: string, url: string): ParsedMetadata => {
  const title = extractMetaContent(html, ["og:title", "twitter:title"]) ?? extractTitle(html);
  const description = extractMetaContent(html, [
    "og:description",
    "twitter:description",
    "description"
  ]);
  const image = toAbsoluteUrl(
    extractMetaContent(html, ["og:image", "twitter:image", "twitter:image:src"]),
    url
  );

  const metadata: EnrichmentMetadata = {
    title,
    description,
    image,
    sourceLabel: toSourceLabel(url)
  };

  const missing: Array<"title" | "description" | "image"> = [];

  if (!title) {
    missing.push("title");
  }
  if (!description) {
    missing.push("description");
  }
  if (!image) {
    missing.push("image");
  }

  const completeness: ParsedMetadata["completeness"] =
    missing.length === 0 ? "full" : missing.length === 3 ? "none" : "partial";

  return {
    metadata,
    completeness,
    missing
  };
};
