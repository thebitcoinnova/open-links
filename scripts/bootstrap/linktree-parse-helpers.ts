import type {
  LinktreeBootstrapLink,
  LinktreeNextDataPageProps,
  LinktreeNextDataPayload,
} from "./linktree-contracts";

const TRACKING_QUERY_PARAM_PREFIXES = ["utm_"] as const;
const TRACKING_QUERY_PARAMS = new Set(["fbclid", "gclid", "igshid", "mc_cid", "mc_eid", "si"]);
const PROFILE_HOSTS = new Set([
  "facebook.com",
  "fb.com",
  "gist.github.com",
  "github.com",
  "instagram.com",
  "linkedin.com",
  "lnkd.in",
  "medium.com",
  "primal.net",
  "substack.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "youtu.be",
  "youtube.com",
]);
const HTML_ENTITY_MAP = new Map<string, string>([
  ["&amp;", "&"],
  ["&lt;", "<"],
  ["&gt;", ">"],
  ["&quot;", '"'],
  ["&#39;", "'"],
  ["&nbsp;", " "],
]);
const LINKTREE_SOCIAL_LABELS = new Map<string, string>([
  ["APPLE_PODCAST", "Apple Podcasts"],
  ["APPLE_MUSIC", "Apple Music"],
  ["BANDCAMP", "Bandcamp"],
  ["FACEBOOK", "Facebook"],
  ["GITHUB", "GitHub"],
  ["INSTAGRAM", "Instagram"],
  ["LINKEDIN", "LinkedIn"],
  ["MEDIUM", "Medium"],
  ["PRIMAL", "Primal"],
  ["SPOTIFY", "Spotify"],
  ["SUBSTACK", "Substack"],
  ["TIKTOK", "TikTok"],
  ["TWITTER", "X"],
  ["WEBSITE", "Website"],
  ["X", "X"],
  ["YOUTUBE", "YouTube"],
]);
const GENERIC_LINKTREE_TITLE_PATTERN = /\s*[|:-]\s*linktree(?:\s*[^|:-]*)?$/iu;

export const safeTrim = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeWhitespace = (value: string): string => value.replace(/\s+/gu, " ").trim();
export const decodeHtmlEntities = (value: string): string => {
  let decoded = value;
  for (const [entity, replacement] of HTML_ENTITY_MAP)
    decoded = decoded.replaceAll(entity, replacement);
  return decoded;
};
const stripHtml = (value: string): string =>
  normalizeWhitespace(decodeHtmlEntities(value.replace(/<[^>]+>/gu, " ")));
const normalizeHost = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/^www\./u, "");
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
export const toAbsoluteUrl = (value: string | undefined, baseUrl: string): string | undefined => {
  if (!value) return undefined;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return undefined;
  }
};
const hasAllowedImportScheme = (value: string): boolean => {
  try {
    return ["http:", "https:", "mailto:", "tel:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};
const normalizeComparableUrl = (value: string): string => {
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      url.hostname = normalizeHost(url.hostname);
      url.hash = "";
      if (
        (url.protocol === "https:" && url.port === "443") ||
        (url.protocol === "http:" && url.port === "80")
      )
        url.port = "";
      for (const key of [...url.searchParams.keys()]) {
        const normalizedKey = key.toLowerCase();
        if (
          TRACKING_QUERY_PARAMS.has(normalizedKey) ||
          TRACKING_QUERY_PARAM_PREFIXES.some((prefix) => normalizedKey.startsWith(prefix))
        )
          url.searchParams.delete(key);
      }
      const nextPathname = url.pathname.replace(/\/+$/u, "");
      url.pathname = nextPathname.length > 0 ? nextPathname : "/";
      const sortedParams = [...url.searchParams.entries()].sort(([left], [right]) =>
        left.localeCompare(right),
      );
      url.search = "";
      for (const [key, entryValue] of sortedParams) url.searchParams.append(key, entryValue);
    }
    return url.toString();
  } catch {
    return normalizeWhitespace(value).toLowerCase();
  }
};
const shouldSkipSourceRelativeUrl = (candidateUrl: string, sourceUrl: string): boolean => {
  try {
    const source = new URL(sourceUrl);
    const candidate = new URL(candidateUrl);
    return (
      normalizeComparableUrl(candidate.toString()) === normalizeComparableUrl(source.toString()) ||
      normalizeHost(candidate.hostname) === normalizeHost(source.hostname)
    );
  } catch {
    return false;
  }
};
const deriveDefaultLinkLabel = (value: string): string => {
  try {
    const url = new URL(value);
    if (url.protocol === "mailto:") return "Email";
    if (url.protocol === "tel:") return "Phone";
    const hostWithoutTld = normalizeHost(url.hostname).split(".").slice(0, -1).join(" ");
    const baseLabel = hostWithoutTld.length > 0 ? hostWithoutTld : normalizeHost(url.hostname);
    return baseLabel
      .split(/[-.\s]+/u)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");
  } catch {
    return "Imported Link";
  }
};
export const isLikelyProfileLink = (value: string): boolean => {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = normalizeHost(url.hostname);
    return (
      PROFILE_HOSTS.has(host) || host.endsWith(".substack.com") || host.endsWith(".medium.com")
    );
  } catch {
    return false;
  }
};
export const matchFirst = (pattern: RegExp, value: string): string | undefined => {
  const captured = value.match(pattern)?.[1];
  if (!captured) return undefined;
  const normalized = stripHtml(captured);
  return normalized.length > 0 ? normalized : undefined;
};
export const cleanSourceTitle = (value: string): string =>
  normalizeWhitespace(value.replace(GENERIC_LINKTREE_TITLE_PATTERN, ""));
const extractAnchorAttribute = (attributes: string, attributeName: string): string | undefined => {
  const captured = attributes.match(new RegExp(`${attributeName}=["']([^"']+)["']`, "iu"))?.[1];
  if (!captured) return undefined;
  const normalized = stripHtml(captured);
  return normalized.length > 0 ? normalized : undefined;
};
export const extractRenderedProfileImage = (html: string, baseUrl: string): string | undefined => {
  const patterns = [
    /<img\b[^>]*data-testid=["']ProfileImage["'][^>]*src=["']([^"']+)["'][^>]*>/iu,
    /<img\b[^>]*src=["']([^"']+)["'][^>]*data-testid=["']ProfileImage["'][^>]*>/iu,
  ];
  for (const pattern of patterns) {
    const resolved = toAbsoluteUrl(
      safeTrim(decodeHtmlEntities(html.match(pattern)?.[1] ?? "")),
      baseUrl,
    );
    if (resolved) return resolved;
  }
  return undefined;
};
export const extractNextDataPageProps = (html: string): LinktreeNextDataPageProps | undefined => {
  const matched = html.match(
    /<script id=["']__NEXT_DATA__["'] type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/iu,
  )?.[1];
  if (!matched) return undefined;
  try {
    return (JSON.parse(matched) as LinktreeNextDataPayload).props?.pageProps;
  } catch {
    return undefined;
  }
};
export const extractGenericAnchorLinks = (
  html: string,
  baseUrl: string,
  warnings: string[],
): LinktreeBootstrapLink[] => {
  const anchorPattern = /<a\b([^>]*)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/giu;
  const links: LinktreeBootstrapLink[] = [];
  const seen = new Set<string>();
  let sourceOrder = 0;
  for (const match of html.matchAll(anchorPattern)) {
    const attributes = `${match[1] ?? ""} ${match[3] ?? ""}`;
    const resolvedUrl = toAbsoluteUrl(match[2] ?? "", baseUrl);
    if (
      !resolvedUrl ||
      !hasAllowedImportScheme(resolvedUrl) ||
      shouldSkipSourceRelativeUrl(resolvedUrl, baseUrl)
    )
      continue;
    const comparableUrl = normalizeComparableUrl(resolvedUrl);
    if (seen.has(comparableUrl)) continue;
    seen.add(comparableUrl);
    links.push({
      label:
        stripHtml(match[4] ?? "") ||
        extractAnchorAttribute(attributes, "aria-label") ||
        extractAnchorAttribute(attributes, "title") ||
        deriveDefaultLinkLabel(resolvedUrl),
      url: resolvedUrl,
      sourceOrder,
    });
    sourceOrder += 1;
  }
  if (links.length === 0) warnings.push(`No external links were extracted from '${baseUrl}'.`);
  return links;
};
const toLinktreeType = (value: unknown): string | undefined => safeTrim(value)?.toUpperCase();
const toOrderedIndex = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const trimmed = safeTrim(value);
  if (!trimmed) return fallback;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};
export const normalizeStructuredLinks = (
  links: unknown,
  baseUrl: string,
): LinktreeBootstrapLink[] => normalizeLinks(links, baseUrl, false);
export const normalizeStructuredSocialLinks = (
  links: unknown,
  baseUrl: string,
): LinktreeBootstrapLink[] => normalizeLinks(links, baseUrl, true);
const normalizeLinks = (
  links: unknown,
  baseUrl: string,
  social: boolean,
): LinktreeBootstrapLink[] => {
  if (!Array.isArray(links)) return [];
  const normalized = links
    .map((candidate, index) => {
      if (!isRecord(candidate) || (!social && candidate.locked)) return null;
      const resolvedUrl = toAbsoluteUrl(safeTrim(candidate.url), baseUrl);
      if (
        !resolvedUrl ||
        !hasAllowedImportScheme(resolvedUrl) ||
        shouldSkipSourceRelativeUrl(resolvedUrl, baseUrl)
      )
        return null;
      const linktreeType = toLinktreeType(candidate.type);
      const metaData = isRecord(candidate.metaData) ? candidate.metaData : undefined;
      return {
        label: social
          ? ((linktreeType ? LINKTREE_SOCIAL_LABELS.get(linktreeType) : undefined) ??
            deriveDefaultLinkLabel(resolvedUrl))
          : (safeTrim(candidate.title) ?? deriveDefaultLinkLabel(resolvedUrl)),
        url: resolvedUrl,
        sourceOrder: toOrderedIndex(candidate.position, index),
        linktreeType,
        thumbnailUrl: social
          ? undefined
          : toAbsoluteUrl(
              safeTrim(candidate.thumbnail) ??
                safeTrim(metaData?.thumbnail) ??
                safeTrim(metaData?.image),
              baseUrl,
            ),
      } satisfies LinktreeBootstrapLink;
    })
    .filter((value): value is Exclude<typeof value, null> => value !== null)
    .sort((left, right) => left.sourceOrder - right.sourceOrder);
  const seen = new Set<string>();
  return normalized.filter((link) => {
    const comparable = normalizeComparableUrl(link.url);
    if (seen.has(comparable)) return false;
    seen.add(comparable);
    return true;
  });
};
