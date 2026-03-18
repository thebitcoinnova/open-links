import { fetchMetadata } from "../enrichment/fetch-metadata";
import { parseMetadata } from "../enrichment/parse-metadata";

const DEFAULT_FETCH_TIMEOUT_MS = 8_000;
const DEFAULT_FETCH_RETRIES = 1;

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

interface LinktreeAccountRecord {
  pageTitle?: unknown;
  description?: unknown;
  profilePictureUrl?: unknown;
  socialLinks?: unknown;
}

interface LinktreeContentLinkRecord {
  title?: unknown;
  url?: unknown;
  position?: unknown;
  type?: unknown;
  thumbnail?: unknown;
  metaData?: unknown;
  locked?: unknown;
}

interface LinktreeNextDataPageProps {
  account?: LinktreeAccountRecord;
  links?: LinktreeContentLinkRecord[];
}

interface LinktreeNextDataPayload {
  props?: {
    pageProps?: LinktreeNextDataPageProps;
  };
}

export interface LinktreeBootstrapLink {
  label: string;
  url: string;
  sourceOrder: number;
  linktreeType?: string;
  thumbnailUrl?: string;
}

export interface LinktreeBootstrapProfile {
  name?: string;
  bio?: string;
  avatar?: string;
  socialLinks: LinktreeBootstrapLink[];
}

export interface LinktreeBootstrapSnapshot {
  kind: "linktree";
  sourceUrl: string;
  fetchedUrl: string;
  title?: string;
  description?: string;
  avatar?: string;
  linkCount: number;
  socialLinkCount: number;
  links: Array<{
    label: string;
    url: string;
    linktreeType?: string;
    thumbnailUrl?: string;
  }>;
  socialLinks: Array<{
    label: string;
    url: string;
    linktreeType?: string;
  }>;
  warnings: string[];
}

export interface LinktreeBootstrapResult {
  kind: "linktree";
  sourceUrl: string;
  fetchedUrl: string;
  profile: LinktreeBootstrapProfile;
  links: LinktreeBootstrapLink[];
  snapshot: LinktreeBootstrapSnapshot;
  warnings: string[];
}

export interface ParseLinktreeBootstrapHtmlInput {
  sourceUrl: string;
  fetchedUrl?: string;
  html: string;
}

export interface FetchLinktreeBootstrapInput {
  sourceUrl: string;
  timeoutMs?: number;
  retries?: number;
}

const safeTrim = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeWhitespace = (value: string): string => value.replace(/\s+/gu, " ").trim();

const decodeHtmlEntities = (value: string): string => {
  let decoded = value;

  for (const [entity, replacement] of HTML_ENTITY_MAP) {
    decoded = decoded.replaceAll(entity, replacement);
  }

  return decoded;
};

const stripHtml = (value: string): string =>
  normalizeWhitespace(decodeHtmlEntities(value.replace(/<[^>]+>/gu, " ")));

const normalizeHost = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/^www\./u, "");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toAbsoluteUrl = (value: string | undefined, baseUrl: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return undefined;
  }
};

const hasAllowedImportScheme = (value: string): boolean => {
  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol);
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
      ) {
        url.port = "";
      }

      for (const key of [...url.searchParams.keys()]) {
        const normalizedKey = key.toLowerCase();
        const isTrackingPrefix = TRACKING_QUERY_PARAM_PREFIXES.some((prefix) =>
          normalizedKey.startsWith(prefix),
        );

        if (TRACKING_QUERY_PARAMS.has(normalizedKey) || isTrackingPrefix) {
          url.searchParams.delete(key);
        }
      }

      const nextPathname = url.pathname.replace(/\/+$/u, "");
      url.pathname = nextPathname.length > 0 ? nextPathname : "/";
      const sortedParams = [...url.searchParams.entries()].sort(([left], [right]) =>
        left.localeCompare(right),
      );
      url.search = "";
      for (const [key, entryValue] of sortedParams) {
        url.searchParams.append(key, entryValue);
      }
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

    if (
      normalizeComparableUrl(candidate.toString()) === normalizeComparableUrl(source.toString())
    ) {
      return true;
    }

    return normalizeHost(candidate.hostname) === normalizeHost(source.hostname);
  } catch {
    return false;
  }
};

const deriveDefaultLinkLabel = (value: string): string => {
  try {
    const url = new URL(value);

    if (url.protocol === "mailto:") {
      return "Email";
    }

    if (url.protocol === "tel:") {
      return "Phone";
    }

    const hostWithoutTld = normalizeHost(url.hostname).split(".").slice(0, -1).join(" ");
    const baseLabel = hostWithoutTld.length > 0 ? hostWithoutTld : normalizeHost(url.hostname);
    return baseLabel
      .split(/[-.\s]+/u)
      .filter((segment) => segment.length > 0)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");
  } catch {
    return "Imported Link";
  }
};

const isLikelyProfileLink = (value: string): boolean => {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    const host = normalizeHost(url.hostname);
    return (
      PROFILE_HOSTS.has(host) || host.endsWith(".substack.com") || host.endsWith(".medium.com")
    );
  } catch {
    return false;
  }
};

const matchFirst = (pattern: RegExp, value: string): string | undefined => {
  const match = value.match(pattern);
  const captured = match?.[1];
  if (!captured) {
    return undefined;
  }

  const normalized = stripHtml(captured);
  return normalized.length > 0 ? normalized : undefined;
};

const cleanSourceTitle = (value: string): string =>
  normalizeWhitespace(value.replace(GENERIC_LINKTREE_TITLE_PATTERN, ""));

const extractAnchorAttribute = (attributes: string, attributeName: string): string | undefined => {
  const match = attributes.match(new RegExp(`${attributeName}=["']([^"']+)["']`, "iu"));
  const captured = match?.[1];
  if (!captured) {
    return undefined;
  }

  const normalized = stripHtml(captured);
  return normalized.length > 0 ? normalized : undefined;
};

const extractRenderedProfileImage = (html: string, baseUrl: string): string | undefined => {
  const patterns = [
    /<img\b[^>]*data-testid=["']ProfileImage["'][^>]*src=["']([^"']+)["'][^>]*>/iu,
    /<img\b[^>]*src=["']([^"']+)["'][^>]*data-testid=["']ProfileImage["'][^>]*>/iu,
  ];

  for (const pattern of patterns) {
    const matched = html.match(pattern)?.[1];
    const resolved = toAbsoluteUrl(safeTrim(decodeHtmlEntities(matched ?? "")), baseUrl);
    if (resolved) {
      return resolved;
    }
  }

  return undefined;
};

const extractNextDataPageProps = (html: string): LinktreeNextDataPageProps | undefined => {
  const matched = html.match(
    /<script id=["']__NEXT_DATA__["'] type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/iu,
  )?.[1];

  if (!matched) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(matched) as LinktreeNextDataPayload;
    return parsed.props?.pageProps;
  } catch {
    return undefined;
  }
};

const extractGenericAnchorLinks = (
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
    const href = match[2] ?? "";
    const resolvedUrl = toAbsoluteUrl(href, baseUrl);
    if (!resolvedUrl || !hasAllowedImportScheme(resolvedUrl)) {
      continue;
    }

    if (shouldSkipSourceRelativeUrl(resolvedUrl, baseUrl)) {
      continue;
    }

    const comparableUrl = normalizeComparableUrl(resolvedUrl);
    if (seen.has(comparableUrl)) {
      continue;
    }

    seen.add(comparableUrl);
    const label =
      stripHtml(match[4] ?? "") ||
      extractAnchorAttribute(attributes, "aria-label") ||
      extractAnchorAttribute(attributes, "title") ||
      deriveDefaultLinkLabel(resolvedUrl);

    links.push({
      label,
      url: resolvedUrl,
      sourceOrder,
    });
    sourceOrder += 1;
  }

  if (links.length === 0) {
    warnings.push(`No external links were extracted from '${baseUrl}'.`);
  }

  return links;
};

const toLinktreeType = (value: unknown): string | undefined => {
  const trimmed = safeTrim(value);
  return trimmed ? trimmed.toUpperCase() : undefined;
};

const toOrderedIndex = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const trimmed = safeTrim(value);
  if (!trimmed) {
    return fallback;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeStructuredLinks = (links: unknown, baseUrl: string): LinktreeBootstrapLink[] => {
  if (!Array.isArray(links)) {
    return [];
  }

  const normalized = links
    .map((candidate, index) => {
      if (!isRecord(candidate)) {
        return null;
      }

      if (candidate.locked) {
        return null;
      }

      const resolvedUrl = toAbsoluteUrl(safeTrim(candidate.url), baseUrl);
      if (!resolvedUrl || !hasAllowedImportScheme(resolvedUrl)) {
        return null;
      }

      if (shouldSkipSourceRelativeUrl(resolvedUrl, baseUrl)) {
        return null;
      }

      const metaData = isRecord(candidate.metaData) ? candidate.metaData : undefined;
      const link: LinktreeBootstrapLink = {
        label: safeTrim(candidate.title) ?? deriveDefaultLinkLabel(resolvedUrl),
        url: resolvedUrl,
        sourceOrder: toOrderedIndex(candidate.position, index),
        linktreeType: toLinktreeType(candidate.type),
        thumbnailUrl: toAbsoluteUrl(
          safeTrim(candidate.thumbnail) ??
            safeTrim(metaData?.thumbnail) ??
            safeTrim(metaData?.image),
          baseUrl,
        ),
      };

      return link;
    })
    .filter((value): value is Exclude<typeof value, null> => value !== null)
    .sort((left, right) => left.sourceOrder - right.sourceOrder);

  const deduped: LinktreeBootstrapLink[] = [];
  const seen = new Set<string>();

  for (const link of normalized) {
    const comparable = normalizeComparableUrl(link.url);
    if (seen.has(comparable)) {
      continue;
    }

    seen.add(comparable);
    deduped.push(link);
  }

  return deduped;
};

const normalizeStructuredSocialLinks = (
  links: unknown,
  baseUrl: string,
): LinktreeBootstrapLink[] => {
  if (!Array.isArray(links)) {
    return [];
  }

  const normalized = links
    .map((candidate, index) => {
      if (!isRecord(candidate)) {
        return null;
      }

      const resolvedUrl = toAbsoluteUrl(safeTrim(candidate.url), baseUrl);
      if (!resolvedUrl || !hasAllowedImportScheme(resolvedUrl)) {
        return null;
      }

      if (shouldSkipSourceRelativeUrl(resolvedUrl, baseUrl)) {
        return null;
      }

      const linktreeType = toLinktreeType(candidate.type);
      const link: LinktreeBootstrapLink = {
        label:
          (linktreeType ? LINKTREE_SOCIAL_LABELS.get(linktreeType) : undefined) ??
          deriveDefaultLinkLabel(resolvedUrl),
        url: resolvedUrl,
        sourceOrder: toOrderedIndex(candidate.position, index),
        linktreeType,
      };

      return link;
    })
    .filter((value): value is Exclude<typeof value, null> => value !== null)
    .sort((left, right) => left.sourceOrder - right.sourceOrder);

  const deduped: LinktreeBootstrapLink[] = [];
  const seen = new Set<string>();

  for (const link of normalized) {
    const comparable = normalizeComparableUrl(link.url);
    if (seen.has(comparable)) {
      continue;
    }

    seen.add(comparable);
    deduped.push(link);
  }

  return deduped;
};

const buildResult = (input: {
  sourceUrl: string;
  fetchedUrl: string;
  name?: string;
  bio?: string;
  avatar?: string;
  links: LinktreeBootstrapLink[];
  socialLinks: LinktreeBootstrapLink[];
  warnings: string[];
}): LinktreeBootstrapResult => ({
  kind: "linktree",
  sourceUrl: input.sourceUrl,
  fetchedUrl: input.fetchedUrl,
  profile: {
    name: input.name,
    bio: input.bio,
    avatar: input.avatar,
    socialLinks: input.socialLinks,
  },
  links: input.links,
  snapshot: {
    kind: "linktree",
    sourceUrl: input.sourceUrl,
    fetchedUrl: input.fetchedUrl,
    title: input.name,
    description: input.bio,
    avatar: input.avatar,
    linkCount: input.links.length,
    socialLinkCount: input.socialLinks.length,
    links: input.links.map((link) => ({
      label: link.label,
      url: link.url,
      linktreeType: link.linktreeType,
      thumbnailUrl: link.thumbnailUrl,
    })),
    socialLinks: input.socialLinks.map((link) => ({
      label: link.label,
      url: link.url,
      linktreeType: link.linktreeType,
    })),
    warnings: [...input.warnings],
  },
  warnings: [...input.warnings],
});

const parseGenericLinktreeLikeHtml = (
  input: ParseLinktreeBootstrapHtmlInput,
  warnings: string[],
): LinktreeBootstrapResult => {
  const fetchedUrl = input.fetchedUrl ?? input.sourceUrl;
  const parsedMetadata = parseMetadata(input.html, fetchedUrl);
  const titleCandidate =
    matchFirst(/<h1\b[^>]*>([\s\S]*?)<\/h1>/iu, input.html) ?? parsedMetadata.metadata.title;
  const links = extractGenericAnchorLinks(input.html, fetchedUrl, warnings);
  const socialLinks = links.filter((link) => isLikelyProfileLink(link.url)).slice(0, 6);
  const name = titleCandidate ? cleanSourceTitle(titleCandidate) : undefined;

  return buildResult({
    sourceUrl: input.sourceUrl,
    fetchedUrl,
    name,
    bio: parsedMetadata.metadata.description,
    avatar: parsedMetadata.metadata.image,
    links,
    socialLinks,
    warnings,
  });
};

export const parseLinktreeBootstrapHtml = (
  input: ParseLinktreeBootstrapHtmlInput,
): LinktreeBootstrapResult => {
  const warnings: string[] = [];
  const fetchedUrl = input.fetchedUrl ?? input.sourceUrl;
  const renderedAvatar = extractRenderedProfileImage(input.html, fetchedUrl);
  const pageProps = extractNextDataPageProps(input.html);

  if (!pageProps) {
    warnings.push("Structured Linktree payload was not found; used generic HTML fallback.");
    return parseGenericLinktreeLikeHtml(input, warnings);
  }

  const account = isRecord(pageProps.account) ? pageProps.account : undefined;
  const links = normalizeStructuredLinks(pageProps.links, fetchedUrl);
  const socialLinks = normalizeStructuredSocialLinks(account?.socialLinks, fetchedUrl);
  const parsedMetadata = parseMetadata(input.html, fetchedUrl);

  if (links.length === 0) {
    warnings.push(
      "Structured Linktree payload contained no content links; used generic HTML fallback.",
    );
    return parseGenericLinktreeLikeHtml(input, warnings);
  }

  const name =
    safeTrim(account?.pageTitle) ??
    matchFirst(/<h1\b[^>]*>([\s\S]*?)<\/h1>/iu, input.html) ??
    parsedMetadata.metadata.title;
  const cleanedName = name ? cleanSourceTitle(name) : undefined;
  const bio = safeTrim(account?.description) ?? parsedMetadata.metadata.description;
  const avatar =
    renderedAvatar ??
    toAbsoluteUrl(safeTrim(account?.profilePictureUrl), fetchedUrl) ??
    parsedMetadata.metadata.image;

  if (!renderedAvatar && safeTrim(account?.profilePictureUrl)) {
    warnings.push(
      "Rendered Linktree profile image was missing; used account.profilePictureUrl fallback.",
    );
  }

  return buildResult({
    sourceUrl: input.sourceUrl,
    fetchedUrl,
    name: cleanedName,
    bio,
    avatar,
    links,
    socialLinks,
    warnings,
  });
};

export const fetchLinktreeBootstrap = async (
  input: FetchLinktreeBootstrapInput,
): Promise<LinktreeBootstrapResult> => {
  const fetched = await fetchMetadata(input.sourceUrl, {
    timeoutMs: input.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS,
    retries: input.retries ?? DEFAULT_FETCH_RETRIES,
    acceptHeader: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
  });

  if (!fetched.ok || !fetched.html) {
    const reason = fetched.error ?? `HTTP ${fetched.statusCode ?? "unknown"}`;
    throw new Error(`Failed to fetch Linktree source '${input.sourceUrl}': ${reason}`);
  }

  return parseLinktreeBootstrapHtml({
    sourceUrl: input.sourceUrl,
    fetchedUrl: input.sourceUrl,
    html: fetched.html,
  });
};
