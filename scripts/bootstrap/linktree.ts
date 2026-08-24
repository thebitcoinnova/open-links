import { fetchMetadata } from "../enrichment/fetch-metadata";
import { parseMetadata } from "../enrichment/parse-metadata";
import type {
  FetchLinktreeBootstrapInput,
  LinktreeBootstrapLink,
  LinktreeBootstrapResult,
  ParseLinktreeBootstrapHtmlInput,
} from "./linktree-contracts";
import {
  cleanSourceTitle,
  extractGenericAnchorLinks,
  extractNextDataPageProps,
  extractRenderedProfileImage,
  isLikelyProfileLink,
  isRecord,
  matchFirst,
  normalizeStructuredLinks,
  normalizeStructuredSocialLinks,
  safeTrim,
  toAbsoluteUrl,
} from "./linktree-parse-helpers";

export type {
  FetchLinktreeBootstrapInput,
  LinktreeBootstrapLink,
  LinktreeBootstrapProfile,
  LinktreeBootstrapResult,
  LinktreeBootstrapSnapshot,
  ParseLinktreeBootstrapHtmlInput,
} from "./linktree-contracts";

const DEFAULT_FETCH_TIMEOUT_MS = 8_000;
const DEFAULT_FETCH_RETRIES = 1;

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
    links: input.links.map(({ label, url, linktreeType, thumbnailUrl }) => ({
      label,
      url,
      linktreeType,
      thumbnailUrl,
    })),
    socialLinks: input.socialLinks.map(({ label, url, linktreeType }) => ({
      label,
      url,
      linktreeType,
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
  return buildResult({
    sourceUrl: input.sourceUrl,
    fetchedUrl,
    name: titleCandidate ? cleanSourceTitle(titleCandidate) : undefined,
    bio: parsedMetadata.metadata.description,
    avatar: parsedMetadata.metadata.image,
    links,
    socialLinks: links.filter((link) => isLikelyProfileLink(link.url)).slice(0, 6),
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
  const bio = safeTrim(account?.description) ?? parsedMetadata.metadata.description;
  const avatar =
    renderedAvatar ??
    toAbsoluteUrl(safeTrim(account?.profilePictureUrl), fetchedUrl) ??
    parsedMetadata.metadata.image;
  if (!renderedAvatar && safeTrim(account?.profilePictureUrl))
    warnings.push(
      "Rendered Linktree profile image was missing; used account.profilePictureUrl fallback.",
    );
  return buildResult({
    sourceUrl: input.sourceUrl,
    fetchedUrl,
    name: name ? cleanSourceTitle(name) : undefined,
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
