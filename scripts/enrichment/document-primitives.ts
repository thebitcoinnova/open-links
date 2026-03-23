import type { DocumentExtractionResult } from "./strategy-types";
import type { EnrichmentMetadata, EnrichmentMissingField } from "./types";

const namedHtmlEntityMap: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const JSON_LD_SCRIPT_PATTERN =
  /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

export interface PlaceholderSignalRule {
  label: string;
  pattern: RegExp;
}

const decodeNumericEntity = (entityBody: string): string | undefined => {
  const normalized = entityBody.toLowerCase();
  const codePoint = normalized.startsWith("#x")
    ? Number.parseInt(entityBody.slice(2), 16)
    : entityBody.startsWith("#")
      ? Number.parseInt(entityBody.slice(1), 10)
      : Number.NaN;

  if (!Number.isInteger(codePoint)) {
    return undefined;
  }

  if (codePoint < 0 || codePoint > 0x10ffff) {
    return undefined;
  }

  if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
    return undefined;
  }

  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return undefined;
  }
};

export const decodeEntities = (value: string): string =>
  value.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]+);/g, (entity, entityBody) => {
    if (entityBody.startsWith("#")) {
      const decoded = decodeNumericEntity(entityBody);
      return decoded ?? entity;
    }

    return namedHtmlEntityMap[entityBody] ?? entity;
  });

export const safeTrim = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = decodeEntities(value).trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseJson = <T>(value: string | undefined): T | undefined => {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
};

export const toSourceLabel = (url: string): string | undefined => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
};

export const toAbsoluteUrl = (
  candidate: string | undefined,
  baseUrl: string,
): string | undefined => {
  if (!candidate) {
    return undefined;
  }

  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return undefined;
  }
};

export const hasSchemaType = (value: unknown, schemaType: string): boolean => {
  if (typeof value === "string") {
    return value === schemaType;
  }

  if (Array.isArray(value)) {
    return value.some((entry) => entry === schemaType);
  }

  return false;
};

export const walkStructuredDataNodes = <T>(
  root: unknown,
  visit: (node: Record<string, unknown>) => T | undefined,
): T | undefined => {
  const queue: unknown[] = [root];

  while (queue.length > 0) {
    const current = queue.shift();

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    if (!isRecord(current)) {
      continue;
    }

    const result = visit(current);
    if (result !== undefined) {
      return result;
    }

    queue.push(...Object.values(current));
  }

  return undefined;
};

export const extractJsonLdBlocks = (html: string): unknown[] => {
  const blocks: unknown[] = [];

  for (const match of html.matchAll(JSON_LD_SCRIPT_PATTERN)) {
    const parsed = parseJson<unknown>(safeTrim(match[1]));
    if (parsed !== undefined) {
      blocks.push(parsed);
    }
  }

  return blocks;
};

export const resolveStructuredImageCandidate = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return safeTrim(value);
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const candidate = resolveStructuredImageCandidate(entry);
      if (candidate) {
        return candidate;
      }
    }

    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  return (
    safeTrim(value.url) ??
    safeTrim(value.contentUrl) ??
    safeTrim(value.src) ??
    resolveStructuredImageCandidate(value.logo) ??
    resolveStructuredImageCandidate(value.image)
  );
};

export const extractJsonLdImage = (html: string, baseUrl: string): string | undefined => {
  for (const block of extractJsonLdBlocks(html)) {
    const candidate = walkStructuredDataNodes(block, (node) => {
      const logoCandidate = resolveStructuredImageCandidate(node.logo);
      if (logoCandidate) {
        return logoCandidate;
      }

      const isIdentityNode =
        hasSchemaType(node["@type"], "Organization") || hasSchemaType(node["@type"], "Person");
      if (!isIdentityNode) {
        return undefined;
      }

      return resolveStructuredImageCandidate(node.image);
    });

    if (candidate) {
      return toAbsoluteUrl(candidate, baseUrl);
    }
  }

  return undefined;
};

export const attributeMap = (tag: string): Record<string, string> => {
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

export const extractMetaContent = (html: string, keys: string[]): string | undefined => {
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

export const extractTitle = (html: string): string | undefined => {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const value = match?.[1]?.replace(/\s+/g, " ").trim();
  return value ? decodeEntities(value) : undefined;
};

export const detectPlaceholderSignals = (body: string, rules: PlaceholderSignalRule[]): string[] =>
  rules.filter((rule) => rule.pattern.test(body)).map((rule) => rule.label);

export const resolveCompleteness = (metadata: EnrichmentMetadata): DocumentExtractionResult => {
  const missing: EnrichmentMissingField[] = [];

  if (!safeTrim(metadata.title)) {
    missing.push("title");
  }
  if (!safeTrim(metadata.description)) {
    missing.push("description");
  }
  if (!safeTrim(metadata.image)) {
    missing.push("image");
  }

  return {
    metadata,
    completeness: missing.length === 0 ? "full" : missing.length === 3 ? "none" : "partial",
    missing,
  };
};

export const extractStandardDocumentMetadata = (html: string, url: string): EnrichmentMetadata => {
  const title = extractMetaContent(html, ["og:title", "twitter:title"]) ?? extractTitle(html);
  const description = extractMetaContent(html, [
    "og:description",
    "twitter:description",
    "description",
  ]);
  const ogImage = toAbsoluteUrl(extractMetaContent(html, ["og:image"]), url);
  const twitterImage = toAbsoluteUrl(
    extractMetaContent(html, ["twitter:image", "twitter:image:src"]),
    url,
  );
  const image = ogImage ?? twitterImage ?? extractJsonLdImage(html, url);

  return {
    title,
    description,
    image,
    ogImage,
    twitterImage,
    sourceLabel: toSourceLabel(url),
  };
};

export const extractDocumentMetadata = (html: string, url: string): DocumentExtractionResult =>
  resolveCompleteness(extractStandardDocumentMetadata(html, url));
