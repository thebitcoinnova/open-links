import { resolveSupportedSocialProfile } from "../../src/lib/content/social-profile-fields";
import {
  isXCommunityUrl,
  normalizeHandle,
  resolveHandleFromUrl,
} from "../../src/lib/identity/handle-resolver";
import {
  decodeEntities,
  detectPlaceholderSignals,
  extractJsonLdBlocks,
  hasSchemaType,
  isRecord,
  parseJson,
  resolveCompleteness,
  safeTrim,
  toAbsoluteUrl,
  toSourceLabel,
} from "./document-primitives";
import { parseMetadata } from "./parse-metadata";
import { parseRumblePublicProfile, resolveRumbleAboutUrl } from "./rumble-public-profile";
import { parseAudienceCount } from "./social-profile-counts";
import type {
  EnrichmentStrategy,
  NormalizedEnrichmentResult,
  ResolveEnrichmentStrategyInput,
  ResolvedPublicEnrichmentStrategy,
} from "./strategy-types";

export const PUBLIC_BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
export const X_COMMUNITY_METADATA_USER_AGENT =
  "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)";
const INSTAGRAM_DESCRIPTION_PATTERN =
  /^\s*(?<followersValue>[^,]+?)\s+(?<followersLabel>Followers?),\s*(?<followingValue>[^,]+?)\s+(?<followingLabel>Following)\b/i;
const YOUTUBE_THUMBNAIL_URL_PATTERN =
  /itemprop="thumbnailUrl" href="([^"]+)"|"channelMetadataRenderer":\{.*?"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/s;

type PublicAugmentationOutcome = NormalizedEnrichmentResult;

export type PublicAugmentationStrategyId =
  | "primal-public-profile"
  | "rumble-public-profile"
  | "medium-public-feed"
  | "substack-public-profile"
  | "x-public-community"
  | "x-public-oembed"
  | "instagram-public-profile"
  | "youtube-public-profile";

export interface PublicAugmentationTarget {
  id: PublicAugmentationStrategyId;
  sourceUrl: string;
  acceptHeader?: string;
  headers?: Record<string, string>;
  parse: (body: string) => PublicAugmentationOutcome;
}

export type PublicAugmentationStrategy = EnrichmentStrategy<ResolvedPublicEnrichmentStrategy>;

export interface InstagramProfileMetadata {
  followersCount?: number;
  followersCountRaw?: string;
  followingCount?: number;
  followingCountRaw?: string;
}

export interface YoutubeProfileMetadata {
  subscribersCount?: number;
  subscribersCountRaw?: string;
}

interface SubstackJsonLdPerson {
  name?: string;
  description?: string;
  jobTitle?: string;
  image?: string;
  url?: string;
}

interface SubstackPublicationMetadata {
  name?: string;
  subdomain?: string;
  heroText?: string;
  logoUrl?: string;
}

interface SubstackPublishedByline {
  name?: string;
  handle?: string;
  bio?: string;
  photoUrl?: string;
}

interface SubstackProfileMetadata {
  name?: string;
  handle?: string;
  bio?: string;
  photoUrl?: string;
  subscribersCount?: number;
  subscribersCountRaw?: string;
}

interface ResolvePublicAugmentationTargetInput {
  url: string;
  icon?: string;
  metadataHandle?: unknown;
}

const SUBSTACK_PRELOADS_PATTERN = /window\._preloads\s*=\s*JSON\.parse\(("(?:(?:\\.)|[^"\\])*")\)/s;

const firstMatch = (text: string, patterns: RegExp[]): string | undefined => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = safeTrim(match?.[1]);
    if (value) {
      return decodeEntities(value).trim();
    }
  }

  return undefined;
};

const findJsonLdPerson = (value: unknown): SubstackJsonLdPerson | undefined => {
  const queue: unknown[] = [value];

  while (queue.length > 0) {
    const current = queue.shift();
    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    if (!isRecord(current)) {
      continue;
    }

    if (hasSchemaType(current["@type"], "Person")) {
      return {
        name: safeTrim(current.name),
        description: safeTrim(current.description),
        jobTitle: safeTrim(current.jobTitle),
        image: safeTrim(current.image),
        url: safeTrim(current.url),
      };
    }

    queue.push(...Object.values(current));
  }

  return undefined;
};

const extractSubstackJsonLdPerson = (html: string): SubstackJsonLdPerson | undefined => {
  for (const block of extractJsonLdBlocks(html)) {
    const person = findJsonLdPerson(block);
    if (person) {
      return person;
    }
  }

  return undefined;
};

const extractSubstackPreloads = (html: string): Record<string, unknown> | undefined => {
  const encodedJson = html.match(SUBSTACK_PRELOADS_PATTERN)?.[1];
  const serialized = parseJson<string>(encodedJson);
  const parsed = parseJson<unknown>(serialized);
  return isRecord(parsed) ? parsed : undefined;
};

const resolveSubstackPublicationMetadata = (
  preloads: Record<string, unknown> | undefined,
): SubstackPublicationMetadata | undefined => {
  if (!preloads || !isRecord(preloads.pub)) {
    return undefined;
  }

  return {
    name: safeTrim(preloads.pub.name),
    subdomain: safeTrim(preloads.pub.subdomain),
    heroText: safeTrim(preloads.pub.hero_text),
    logoUrl: safeTrim(preloads.pub.logo_url),
  };
};

const isSubstackGenericPreviewImage = (value: string | undefined): boolean =>
  Boolean(value && /subscribe-card/iu.test(value));

const resolveSubstackProfileMetadata = (
  preloads: Record<string, unknown> | undefined,
): SubstackProfileMetadata | undefined => {
  if (!preloads || !isRecord(preloads.profile)) {
    return undefined;
  }

  const subscribersCountRaw = safeTrim(preloads.profile.subscriberCountString);
  const subscribersCountNumber =
    typeof preloads.profile.subscriberCountNumber === "number" &&
    Number.isFinite(preloads.profile.subscriberCountNumber)
      ? preloads.profile.subscriberCountNumber
      : undefined;

  return {
    name: safeTrim(preloads.profile.name),
    handle: safeTrim(preloads.profile.handle),
    bio: safeTrim(preloads.profile.bio),
    photoUrl: safeTrim(preloads.profile.photo_url),
    subscribersCount: subscribersCountNumber ?? parseAudienceCount(subscribersCountRaw),
    subscribersCountRaw,
  };
};

const extractSubstackPublishedByline = (
  root: Record<string, unknown> | undefined,
): SubstackPublishedByline | undefined => {
  if (!root) {
    return undefined;
  }

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

    if (Array.isArray(current.publishedBylines)) {
      const firstByline = current.publishedBylines.find(isRecord);
      if (firstByline) {
        return {
          name: safeTrim(firstByline.name),
          handle: safeTrim(firstByline.handle),
          bio: safeTrim(firstByline.bio),
          photoUrl: safeTrim(firstByline.photo_url),
        };
      }
    }

    queue.push(...Object.values(current));
  }

  return undefined;
};

const resolveSubstackCanonicalHandle = (
  person: SubstackJsonLdPerson | undefined,
  profile: SubstackProfileMetadata | undefined,
  byline: SubstackPublishedByline | undefined,
  publication: SubstackPublicationMetadata | undefined,
): string | undefined => {
  const canonicalResolution = person?.url
    ? resolveHandleFromUrl({ url: person.url, icon: "substack" })
    : undefined;
  if (
    canonicalResolution?.reason === "resolved" &&
    canonicalResolution.extractorId === "substack"
  ) {
    return canonicalResolution.handle;
  }

  return (
    normalizeHandle(profile?.handle) ??
    normalizeHandle(byline?.handle) ??
    normalizeHandle(publication?.subdomain)
  );
};

const detectMediumPlaceholderSignals = (xml: string): string[] => {
  const combined = xml.toLowerCase();
  return detectPlaceholderSignals(combined, [
    { label: "cloudflare_challenge", pattern: /just a moment/i },
    { label: "js_cookie_challenge", pattern: /enable javascript and cookies to continue/i },
    { label: "cloudflare_attention", pattern: /attention required.*cloudflare/i },
    { label: "security_check", pattern: /checking if the site connection is secure/i },
    { label: "access_denied", pattern: /access denied/i },
    { label: "medium_signin_page", pattern: /medium\.com\/m\/signin|sign in to medium/i },
  ]);
};

const detectXPlaceholderSignals = (input: {
  title?: string;
  providerName?: string;
  html?: string;
}): string[] => {
  const combined = [input.title ?? "", input.providerName ?? "", input.html ?? ""]
    .join("\n")
    .toLowerCase();
  return detectPlaceholderSignals(combined, [
    { label: "oembed_unavailable", pattern: /not found|no status found|invalid url/i },
    { label: "sign_in_prompt", pattern: /sign in|log in/i },
    {
      label: "challenge_page",
      pattern: /just a moment|checking if the site connection is secure/i,
    },
  ]);
};

const detectInstagramPlaceholderSignals = (input: {
  html: string;
  title?: string;
  description?: string;
  currentUrl: string;
}): string[] => {
  const combined = [input.currentUrl, input.title ?? "", input.description ?? "", input.html]
    .join("\n")
    .toLowerCase();
  return detectPlaceholderSignals(combined, [
    {
      label: "login_wall",
      pattern: /log in to instagram|login • instagram|sign up for instagram/i,
    },
    {
      label: "challenge_page",
      pattern: /please wait a few minutes before you try again|challenge_required/i,
    },
    {
      label: "not_found",
      pattern: /sorry, this page isn't available|user not found/i,
    },
  ]);
};

const detectYoutubePlaceholderSignals = (input: {
  html: string;
  title?: string;
  description?: string;
  currentUrl: string;
}): string[] => {
  const combined = [input.currentUrl, input.title ?? "", input.description ?? "", input.html]
    .join("\n")
    .toLowerCase();
  return detectPlaceholderSignals(combined, [
    {
      label: "consent_interstitial",
      pattern: /before you continue to youtube|consent\.youtube\.com/i,
    },
    {
      label: "sign_in_required",
      pattern: /sign in to continue to youtube|sign in to confirm you're not a bot/i,
    },
    {
      label: "challenge_page",
      pattern: /our systems have detected unusual traffic|sorry, you have been blocked/i,
    },
    {
      label: "unavailable_page",
      pattern: /this video is unavailable|this channel does not exist|account has been terminated/i,
    },
  ]);
};

const resolveMediumFeedUrl = (sourceUrl: string): string => {
  const resolution = resolveHandleFromUrl({ url: sourceUrl, icon: "medium" });
  if (
    resolution.reason !== "resolved" ||
    resolution.extractorId !== "medium" ||
    !resolution.handle
  ) {
    throw new Error(`Medium public augmentation only supports profile URLs. Got '${sourceUrl}'.`);
  }

  return `https://medium.com/feed/@${resolution.handle}`;
};

const resolveXHandle = (sourceUrl: string): string => {
  const resolution = resolveHandleFromUrl({ url: sourceUrl, icon: "x" });
  if (resolution.reason !== "resolved" || resolution.extractorId !== "x" || !resolution.handle) {
    throw new Error(`X public augmentation only supports profile URLs. Got '${sourceUrl}'.`);
  }

  return resolution.handle;
};

const resolveInstagramTargetUrl = (sourceUrl: string): string => {
  const supportedProfile = resolveSupportedSocialProfile({
    url: sourceUrl,
    icon: "instagram",
  });
  if (!supportedProfile || supportedProfile.platform !== "instagram") {
    throw new Error(
      `Instagram public augmentation only supports clear instagram.com profile/account URLs. Got '${sourceUrl}'.`,
    );
  }

  return `https://www.instagram.com/${supportedProfile.handle}/`;
};

const resolveYoutubeTargetUrl = (sourceUrl: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw new Error(`Invalid YouTube URL '${sourceUrl}'.`);
  }

  const supportedProfile = resolveSupportedSocialProfile({
    url: sourceUrl,
    icon: "youtube",
  });
  if (!supportedProfile || supportedProfile.platform !== "youtube") {
    throw new Error(
      `YouTube public augmentation only supports clear youtube.com profile/channel URLs. Got '${sourceUrl}'.`,
    );
  }

  const segments = parsed.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  const first = segments[0];
  if (!first) {
    throw new Error(`YouTube URL '${sourceUrl}' is missing a profile path segment.`);
  }

  if (first.startsWith("@")) {
    return `https://www.youtube.com/${first}`;
  }

  if ((first === "channel" || first === "c" || first === "user") && segments[1]) {
    return `https://www.youtube.com/${first}/${segments[1]}`;
  }

  return `https://www.youtube.com/${first}`;
};

const isLikelySubstackProfileUrl = (input: ResolvePublicAugmentationTargetInput): boolean => {
  const resolution = resolveHandleFromUrl(input);
  if (resolution.extractorId !== "substack") {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(input.url);
  } catch {
    return false;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const segments = parsed.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (host === "substack.com") {
    return segments.length === 1 && segments[0]?.startsWith("@");
  }

  if (host.endsWith(".substack.com")) {
    return segments.length === 0;
  }

  return segments.length === 0;
};

const buildSubstackCanonicalProfileUrl = (handle: string): string =>
  `https://substack.com/@${encodeURIComponent(handle)}`;

const buildXOEmbedUrl = (sourceUrl: string): string => {
  const handle = resolveXHandle(sourceUrl);
  const oEmbedUrl = new URL("https://publish.twitter.com/oembed");
  oEmbedUrl.searchParams.set("url", `https://twitter.com/${handle}`);
  oEmbedUrl.searchParams.set("omit_script", "true");
  oEmbedUrl.searchParams.set("hide_thread", "true");
  oEmbedUrl.searchParams.set("dnt", "true");
  return oEmbedUrl.toString();
};

const extractXDisplayHandle = (html: string | undefined, fallbackHandle: string): string => {
  if (!html) {
    return fallbackHandle;
  }

  const match = html.match(/Tweets by ([^<]+)/i);
  const extracted = safeTrim(match?.[1]);
  return extracted ? decodeEntities(extracted).trim().replace(/^@/, "") : fallbackHandle;
};

const buildGenericXDescription = (displayHandle: string): string =>
  `Posts and updates from @${displayHandle} on X.`;

export const parseInstagramProfileMetadata = (
  description: string | undefined,
): InstagramProfileMetadata => {
  const trimmed = safeTrim(description);
  if (!trimmed) {
    return {};
  }

  const match = INSTAGRAM_DESCRIPTION_PATTERN.exec(trimmed);
  const followersValue = safeTrim(match?.groups?.followersValue);
  const followersLabel = safeTrim(match?.groups?.followersLabel);
  const followingValue = safeTrim(match?.groups?.followingValue);
  const followingLabel = safeTrim(match?.groups?.followingLabel);

  const followersCountRaw =
    followersValue && followersLabel ? `${followersValue} ${followersLabel}` : undefined;
  const followingCountRaw =
    followingValue && followingLabel ? `${followingValue} ${followingLabel}` : undefined;

  return {
    followersCount: parseAudienceCount(followersCountRaw),
    followersCountRaw,
    followingCount: parseAudienceCount(followingCountRaw),
    followingCountRaw,
  };
};

export const extractYoutubeSubscriberCountRaw = (html: string): string | undefined => {
  const metadataRowsMarker = '"metadataRows":[';
  const startIndex = html.indexOf(metadataRowsMarker);
  if (startIndex < 0) {
    return undefined;
  }

  const segment = html.slice(startIndex, startIndex + 2_500);
  const contentMatch = /"content":"([^"]+ subscribers?)"/i.exec(segment);
  if (contentMatch?.[1]) {
    return safeTrim(contentMatch[1]);
  }

  const accessibilityMatch = /"accessibilityLabel":"([^"]+ subscribers?)"/i.exec(segment);
  return safeTrim(accessibilityMatch?.[1]);
};

export const extractYoutubeProfileImageUrl = (html: string): string | undefined => {
  const match = YOUTUBE_THUMBNAIL_URL_PATTERN.exec(html);
  return safeTrim(match?.[1] ?? match?.[2]);
};

export const parseYoutubeProfileMetadata = (html: string): YoutubeProfileMetadata => {
  const subscribersCountRaw = extractYoutubeSubscriberCountRaw(html);
  return {
    subscribersCount: parseAudienceCount(subscribersCountRaw),
    subscribersCountRaw,
  };
};

const parseMediumFeed = (sourceUrl: string, xml: string): PublicAugmentationOutcome => {
  const channel = firstMatch(xml, [/<channel>([\s\S]*?)<\/channel>/i]) ?? xml;
  const title = firstMatch(channel, [
    /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i,
    /<title>([\s\S]*?)<\/title>/i,
  ]);
  const description = firstMatch(channel, [
    /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i,
    /<description>([\s\S]*?)<\/description>/i,
  ]);
  const image = firstMatch(channel, [/<image>[\s\S]*?<url>([\s\S]*?)<\/url>[\s\S]*?<\/image>/i]);
  const placeholderSignals = detectMediumPlaceholderSignals(xml);

  if (placeholderSignals.length > 0) {
    throw new Error(
      `Medium public augmentation captured placeholder content: ${placeholderSignals.join(", ")}.`,
    );
  }

  const handleResolution = resolveHandleFromUrl({ url: sourceUrl, icon: "medium" });
  const handle =
    handleResolution.reason === "resolved" && handleResolution.extractorId === "medium"
      ? handleResolution.handle
      : undefined;

  return resolveCompleteness({
    title,
    description,
    image,
    profileImage: image,
    handle,
    sourceLabel: "medium.com",
  });
};

const parsePrimalPublicProfile = (sourceUrl: string, html: string): PublicAugmentationOutcome => {
  const parsed = parseMetadata(html, sourceUrl);
  const handleResolution = resolveHandleFromUrl({ url: sourceUrl, icon: "primal" });
  const handle =
    handleResolution.reason === "resolved" && handleResolution.extractorId === "primal"
      ? handleResolution.handle
      : undefined;

  return resolveCompleteness({
    title: safeTrim(parsed.metadata.title),
    description: safeTrim(parsed.metadata.description),
    image: safeTrim(parsed.metadata.image),
    ogImage: safeTrim(parsed.metadata.ogImage),
    twitterImage: safeTrim(parsed.metadata.twitterImage),
    profileImage: safeTrim(parsed.metadata.image),
    handle,
    sourceLabel: "primal.net",
  });
};

const parseSubstackPublicProfile = (
  input: {
    originalUrl: string;
    fetchUrl: string;
  },
  html: string,
): PublicAugmentationOutcome => {
  const parsed = parseMetadata(html, input.fetchUrl);
  const person = extractSubstackJsonLdPerson(html);
  const preloads = extractSubstackPreloads(html);
  const profile = resolveSubstackProfileMetadata(preloads);
  const publication = resolveSubstackPublicationMetadata(preloads);
  const byline = extractSubstackPublishedByline(preloads);
  const profileImage = toAbsoluteUrl(
    safeTrim(person?.image) ??
      safeTrim(profile?.photoUrl) ??
      safeTrim(byline?.photoUrl) ??
      safeTrim(publication?.logoUrl),
    input.fetchUrl,
  );
  const parsedPreviewImage =
    toAbsoluteUrl(safeTrim(parsed.metadata.image), input.fetchUrl) ??
    safeTrim(parsed.metadata.image);
  const image =
    parsedPreviewImage &&
    parsedPreviewImage !== profileImage &&
    !isSubstackGenericPreviewImage(parsedPreviewImage)
      ? parsedPreviewImage
      : (profileImage ?? parsedPreviewImage);

  return resolveCompleteness({
    title:
      safeTrim(person?.name) ??
      safeTrim(profile?.name) ??
      safeTrim(publication?.name) ??
      safeTrim(byline?.name) ??
      safeTrim(parsed.metadata.title),
    description:
      safeTrim(person?.jobTitle) ??
      safeTrim(profile?.bio) ??
      safeTrim(publication?.heroText) ??
      safeTrim(byline?.bio) ??
      safeTrim(person?.description) ??
      safeTrim(parsed.metadata.description),
    image,
    ogImage: safeTrim(parsed.metadata.ogImage),
    twitterImage: safeTrim(parsed.metadata.twitterImage),
    profileImage,
    handle: resolveSubstackCanonicalHandle(person, profile, byline, publication),
    subscribersCount: profile?.subscribersCount,
    subscribersCountRaw: profile?.subscribersCountRaw,
    sourceLabel: toSourceLabel(input.originalUrl) ?? parsed.metadata.sourceLabel,
  });
};

const parseXOEmbed = (sourceUrl: string, payloadText: string): PublicAugmentationOutcome => {
  const payload = JSON.parse(payloadText) as {
    title?: string;
    html?: string;
    provider_name?: string;
  };
  const handle = resolveXHandle(sourceUrl);
  const providerName = safeTrim(payload.provider_name) ?? "";
  const displayHandle = extractXDisplayHandle(payload.html, handle);
  const placeholderSignals = detectXPlaceholderSignals({
    title: payload.title,
    providerName,
    html: payload.html,
  });

  if (!/twitter/i.test(providerName)) {
    throw new Error(
      `X public augmentation expected oEmbed provider 'Twitter' but received '${providerName || "missing"}'.`,
    );
  }

  if (placeholderSignals.length > 0) {
    throw new Error(
      `X public augmentation received placeholder oEmbed payload: ${placeholderSignals.join(", ")}.`,
    );
  }

  const avatarUrl = `https://unavatar.io/x/${encodeURIComponent(displayHandle)}`;
  return resolveCompleteness({
    title: safeTrim(payload.title) ?? `@${displayHandle} on X`,
    description: buildGenericXDescription(displayHandle),
    image: avatarUrl,
    profileImage: avatarUrl,
    sourceLabel: "x.com",
  });
};

const parseXCommunityPage = (sourceUrl: string, html: string): PublicAugmentationOutcome => {
  const parsed = parseMetadata(html, sourceUrl);
  const title = safeTrim(parsed.metadata.title);
  const description = safeTrim(parsed.metadata.description);
  const image = safeTrim(parsed.metadata.image);
  const placeholderSignals = detectXPlaceholderSignals({
    title,
    html,
  });

  if (placeholderSignals.length > 0) {
    throw new Error(
      `X public augmentation captured placeholder community metadata: ${placeholderSignals.join(", ")}.`,
    );
  }

  return resolveCompleteness({
    title,
    description,
    image,
    ogImage: safeTrim(parsed.metadata.ogImage),
    twitterImage: safeTrim(parsed.metadata.twitterImage),
    sourceLabel: "x.com",
  });
};

const parseInstagramPublicProfile = (
  sourceUrl: string,
  html: string,
): PublicAugmentationOutcome => {
  const parsed = parseMetadata(html, sourceUrl);
  const title = safeTrim(parsed.metadata.title);
  const description = safeTrim(parsed.metadata.description);
  const image = safeTrim(parsed.metadata.image);
  const placeholderSignals = detectInstagramPlaceholderSignals({
    html,
    currentUrl: sourceUrl,
    title,
    description,
  });

  if (placeholderSignals.length > 0) {
    throw new Error(
      `Instagram public augmentation captured placeholder content: ${placeholderSignals.join(", ")}.`,
    );
  }

  const counts = parseInstagramProfileMetadata(description);
  return resolveCompleteness({
    title,
    description,
    image,
    ogImage: safeTrim(parsed.metadata.ogImage),
    twitterImage: safeTrim(parsed.metadata.twitterImage),
    profileImage: image,
    followersCount: counts.followersCount,
    followersCountRaw: counts.followersCountRaw,
    followingCount: counts.followingCount,
    followingCountRaw: counts.followingCountRaw,
    sourceLabel: "instagram.com",
  });
};

const parseYoutubePublicProfile = (sourceUrl: string, html: string): PublicAugmentationOutcome => {
  const parsed = parseMetadata(html, sourceUrl);
  const title = safeTrim(parsed.metadata.title);
  const description = safeTrim(parsed.metadata.description);
  const profileImage = extractYoutubeProfileImageUrl(html);
  const image = safeTrim(parsed.metadata.image) ?? profileImage;
  const placeholderSignals = detectYoutubePlaceholderSignals({
    html,
    currentUrl: sourceUrl,
    title,
    description,
  });

  if (placeholderSignals.length > 0) {
    throw new Error(
      `YouTube public augmentation captured placeholder content: ${placeholderSignals.join(", ")}.`,
    );
  }

  const counts = parseYoutubeProfileMetadata(html);
  return resolveCompleteness({
    title,
    description,
    image,
    ogImage: safeTrim(parsed.metadata.ogImage),
    twitterImage: safeTrim(parsed.metadata.twitterImage),
    profileImage,
    subscribersCount: counts.subscribersCount,
    subscribersCountRaw: counts.subscribersCountRaw,
    sourceLabel: "youtube.com",
  });
};

const PUBLIC_AUGMENTATION_STRATEGIES: PublicAugmentationStrategy[] = [
  {
    id: "instagram-public-profile",
    branch: "public_augmented",
    sourceKind: "html",
    matches: (input) => resolveSupportedSocialProfile(input)?.platform === "instagram",
    resolve: (input) => {
      if (resolveSupportedSocialProfile(input)?.platform !== "instagram") {
        return null;
      }

      const sourceUrl = resolveInstagramTargetUrl(input.url);
      return {
        id: "instagram-public-profile",
        branch: "public_augmented",
        sourceKind: "html",
        source: { sourceUrl },
        normalize: (body) => parseInstagramPublicProfile(sourceUrl, body),
      };
    },
  },
  {
    id: "youtube-public-profile",
    branch: "public_augmented",
    sourceKind: "html",
    matches: (input) => resolveSupportedSocialProfile(input)?.platform === "youtube",
    resolve: (input) => {
      if (resolveSupportedSocialProfile(input)?.platform !== "youtube") {
        return null;
      }

      const sourceUrl = resolveYoutubeTargetUrl(input.url);
      return {
        id: "youtube-public-profile",
        branch: "public_augmented",
        sourceKind: "html",
        source: { sourceUrl },
        normalize: (body) => parseYoutubePublicProfile(sourceUrl, body),
      };
    },
  },
  {
    id: "primal-public-profile",
    branch: "public_augmented",
    sourceKind: "html",
    matches: (input) => resolveSupportedSocialProfile(input)?.platform === "primal",
    resolve: (input) =>
      resolveSupportedSocialProfile(input)?.platform === "primal"
        ? {
            id: "primal-public-profile",
            branch: "public_augmented",
            sourceKind: "html",
            source: { sourceUrl: input.url },
            normalize: (body) => parsePrimalPublicProfile(input.url, body),
          }
        : null,
  },
  {
    id: "rumble-public-profile",
    branch: "public_augmented",
    sourceKind: "html",
    matches: (input) => resolveSupportedSocialProfile(input)?.platform === "rumble",
    resolve: (input) => {
      if (resolveSupportedSocialProfile(input)?.platform !== "rumble") {
        return null;
      }

      const sourceUrl = resolveRumbleAboutUrl(input.url);
      return {
        id: "rumble-public-profile",
        branch: "public_augmented",
        sourceKind: "html",
        source: {
          sourceUrl,
          headers: {
            "accept-language": "en-US,en;q=0.9",
            "user-agent": PUBLIC_BROWSER_USER_AGENT,
          },
        },
        normalize: (body) => parseRumblePublicProfile(sourceUrl, body),
      };
    },
  },
  {
    id: "substack-public-profile",
    branch: "public_augmented",
    sourceKind: "html",
    matches: (input) => isLikelySubstackProfileUrl(input),
    resolve: (input) => {
      if (!isLikelySubstackProfileUrl(input)) {
        return null;
      }

      const supportedProfile = resolveSupportedSocialProfile(input);
      const sourceUrl =
        supportedProfile?.platform === "substack"
          ? buildSubstackCanonicalProfileUrl(supportedProfile.handle)
          : input.url;

      return {
        id: "substack-public-profile",
        branch: "public_augmented",
        sourceKind: "html",
        source: {
          sourceUrl,
          headers: {
            "accept-language": "en-US,en;q=0.9",
            "user-agent": PUBLIC_BROWSER_USER_AGENT,
          },
        },
        normalize: (body) =>
          parseSubstackPublicProfile(
            {
              originalUrl: input.url,
              fetchUrl: sourceUrl,
            },
            body,
          ),
      };
    },
  },
  {
    id: "x-public-community",
    branch: "public_augmented",
    sourceKind: "html",
    matches: (input) => isXCommunityUrl(input),
    resolve: (input) =>
      isXCommunityUrl(input)
        ? {
            id: "x-public-community",
            branch: "public_augmented",
            sourceKind: "html",
            source: {
              sourceUrl: input.url,
              headers: {
                "accept-language": "en-US,en;q=0.9",
                "user-agent": X_COMMUNITY_METADATA_USER_AGENT,
              },
            },
            normalize: (body) => parseXCommunityPage(input.url, body),
          }
        : null,
  },
  {
    id: "x-public-oembed",
    branch: "public_augmented",
    sourceKind: "oembed",
    matches: (input) => {
      const handleResolution = resolveHandleFromUrl(input);
      return (
        !isXCommunityUrl(input) &&
        handleResolution.reason === "resolved" &&
        handleResolution.extractorId === "x"
      );
    },
    resolve: (input) => {
      const handleResolution = resolveHandleFromUrl(input);
      if (
        isXCommunityUrl(input) ||
        handleResolution.reason !== "resolved" ||
        handleResolution.extractorId !== "x"
      ) {
        return null;
      }

      return {
        id: "x-public-oembed",
        branch: "public_augmented",
        sourceKind: "oembed",
        source: {
          sourceUrl: buildXOEmbedUrl(input.url),
          acceptHeader: "application/json",
          headers: {
            "accept-language": "en-US,en;q=0.9",
            "user-agent": PUBLIC_BROWSER_USER_AGENT,
          },
        },
        normalize: (body) => parseXOEmbed(input.url, body),
      };
    },
  },
  {
    id: "medium-public-feed",
    branch: "public_augmented",
    sourceKind: "xml",
    matches: (input) => {
      const handleResolution = resolveHandleFromUrl(input);
      return handleResolution.reason === "resolved" && handleResolution.extractorId === "medium";
    },
    resolve: (input) => {
      const handleResolution = resolveHandleFromUrl(input);
      if (handleResolution.reason !== "resolved" || handleResolution.extractorId !== "medium") {
        return null;
      }

      return {
        id: "medium-public-feed",
        branch: "public_augmented",
        sourceKind: "xml",
        source: {
          sourceUrl: resolveMediumFeedUrl(input.url),
          acceptHeader: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
          headers: {
            "accept-language": "en-US,en;q=0.9",
            "user-agent": PUBLIC_BROWSER_USER_AGENT,
          },
        },
        normalize: (body) => parseMediumFeed(input.url, body),
      };
    },
  },
];

const toPublicAugmentationTarget = (
  strategy: ResolvedPublicEnrichmentStrategy,
): PublicAugmentationTarget => ({
  id: strategy.id as PublicAugmentationStrategyId,
  sourceUrl: strategy.source.sourceUrl,
  acceptHeader: strategy.source.acceptHeader,
  headers: strategy.source.headers,
  parse: strategy.normalize,
});

export const listPublicAugmentationStrategies = (): PublicAugmentationStrategy[] => [
  ...PUBLIC_AUGMENTATION_STRATEGIES,
];

export const resolvePublicAugmentedStrategy = (
  input: ResolveEnrichmentStrategyInput,
): ResolvedPublicEnrichmentStrategy | null => {
  for (const strategy of PUBLIC_AUGMENTATION_STRATEGIES) {
    if (!strategy.matches(input)) {
      continue;
    }

    const resolved = strategy.resolve(input);
    if (resolved) {
      return resolved;
    }
  }

  return null;
};

export const resolvePublicAugmentationTarget = (
  input: ResolvePublicAugmentationTargetInput,
): PublicAugmentationTarget | null => {
  const resolved = resolvePublicAugmentedStrategy(input);
  return resolved ? toPublicAugmentationTarget(resolved) : null;
};

export const hasPublicAugmentationTarget = (input: { url: string; icon?: string }): boolean =>
  resolvePublicAugmentedStrategy(input) !== null;
