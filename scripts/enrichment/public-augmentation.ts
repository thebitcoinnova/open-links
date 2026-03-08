import { resolveSupportedSocialProfile } from "../../src/lib/content/social-profile-fields";
import { resolveHandleFromUrl } from "../../src/lib/identity/handle-resolver";
import { parseMetadata } from "./parse-metadata";
import { parseAudienceCount } from "./social-profile-counts";
import type { EnrichmentMetadata, EnrichmentMissingField } from "./types";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const INSTAGRAM_DESCRIPTION_PATTERN =
  /^\s*(?<followersValue>[^,]+?)\s+(?<followersLabel>Followers?),\s*(?<followingValue>[^,]+?)\s+(?<followingLabel>Following)\b/i;
const YOUTUBE_THUMBNAIL_URL_PATTERN =
  /itemprop="thumbnailUrl" href="([^"]+)"|"channelMetadataRenderer":\{.*?"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/s;

interface PublicAugmentationOutcome {
  metadata: EnrichmentMetadata;
  completeness: "full" | "partial" | "none";
  missing: EnrichmentMissingField[];
}

export interface PublicAugmentationTarget {
  id:
    | "medium-public-feed"
    | "x-public-oembed"
    | "instagram-public-profile"
    | "youtube-public-profile";
  sourceUrl: string;
  acceptHeader?: string;
  headers?: Record<string, string>;
  parse: (body: string) => PublicAugmentationOutcome;
}

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

const safeTrim = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const decodeHtmlEntities = (value: string): string =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .trim();

const firstMatch = (text: string, patterns: RegExp[]): string | undefined => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = safeTrim(match?.[1]);
    if (value) {
      return decodeHtmlEntities(value);
    }
  }

  return undefined;
};

const resolveCompleteness = (metadata: EnrichmentMetadata): PublicAugmentationOutcome => {
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

const detectMediumPlaceholderSignals = (xml: string): string[] => {
  const combined = xml.toLowerCase();
  const checks: Array<{ label: string; pattern: RegExp }> = [
    { label: "cloudflare_challenge", pattern: /just a moment/i },
    { label: "js_cookie_challenge", pattern: /enable javascript and cookies to continue/i },
    { label: "cloudflare_attention", pattern: /attention required.*cloudflare/i },
    { label: "security_check", pattern: /checking if the site connection is secure/i },
    { label: "access_denied", pattern: /access denied/i },
    { label: "medium_signin_page", pattern: /medium\.com\/m\/signin|sign in to medium/i },
  ];

  return checks.filter((check) => check.pattern.test(combined)).map((check) => check.label);
};

const detectXPlaceholderSignals = (input: {
  title?: string;
  providerName?: string;
  html?: string;
}): string[] => {
  const combined = [input.title ?? "", input.providerName ?? "", input.html ?? ""]
    .join("\n")
    .toLowerCase();
  const checks: Array<{ label: string; pattern: RegExp }> = [
    { label: "oembed_unavailable", pattern: /not found|no status found|invalid url/i },
    { label: "sign_in_prompt", pattern: /sign in|log in/i },
    {
      label: "challenge_page",
      pattern: /just a moment|checking if the site connection is secure/i,
    },
  ];

  return checks.filter((check) => check.pattern.test(combined)).map((check) => check.label);
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
  const checks: Array<{ label: string; pattern: RegExp }> = [
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
  ];

  return checks.filter((check) => check.pattern.test(combined)).map((check) => check.label);
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
  const checks: Array<{ label: string; pattern: RegExp }> = [
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
  ];

  return checks.filter((check) => check.pattern.test(combined)).map((check) => check.label);
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
  return extracted ? decodeHtmlEntities(extracted).replace(/^@/, "") : fallbackHandle;
};

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

  return resolveCompleteness({
    title,
    description,
    image,
    sourceLabel: "medium.com",
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
    description: `Posts and updates from @${displayHandle} on X.`,
    image: avatarUrl,
    profileImage: avatarUrl,
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
    profileImage,
    subscribersCount: counts.subscribersCount,
    subscribersCountRaw: counts.subscribersCountRaw,
    sourceLabel: "youtube.com",
  });
};

export const resolvePublicAugmentationTarget = (input: {
  url: string;
  icon?: string;
}): PublicAugmentationTarget | null => {
  const supportedProfile = resolveSupportedSocialProfile(input);
  if (supportedProfile?.platform === "instagram") {
    const sourceUrl = resolveInstagramTargetUrl(input.url);
    return {
      id: "instagram-public-profile",
      sourceUrl,
      parse: (body) => parseInstagramPublicProfile(sourceUrl, body),
    };
  }

  if (supportedProfile?.platform === "youtube") {
    const sourceUrl = resolveYoutubeTargetUrl(input.url);
    return {
      id: "youtube-public-profile",
      sourceUrl,
      parse: (body) => parseYoutubePublicProfile(sourceUrl, body),
    };
  }

  const handleResolution = resolveHandleFromUrl(input);
  if (handleResolution.reason === "resolved" && handleResolution.extractorId === "x") {
    return {
      id: "x-public-oembed",
      sourceUrl: buildXOEmbedUrl(input.url),
      acceptHeader: "application/json",
      headers: {
        "accept-language": "en-US,en;q=0.9",
        "user-agent": BROWSER_USER_AGENT,
      },
      parse: (body) => parseXOEmbed(input.url, body),
    };
  }

  if (handleResolution.reason === "resolved" && handleResolution.extractorId === "medium") {
    return {
      id: "medium-public-feed",
      sourceUrl: resolveMediumFeedUrl(input.url),
      acceptHeader: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
      headers: {
        "accept-language": "en-US,en;q=0.9",
        "user-agent": BROWSER_USER_AGENT,
      },
      parse: (body) => parseMediumFeed(input.url, body),
    };
  }

  return null;
};

export const hasPublicAugmentationTarget = (input: { url: string; icon?: string }): boolean =>
  resolvePublicAugmentationTarget(input) !== null;
