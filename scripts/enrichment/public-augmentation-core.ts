import {
  type GeneratedLinkReferralConfig,
  type LinkReferralConfig,
  REFERRAL_PROVENANCE_FIELDS,
  type ReferralFieldName,
  mergeReferralWithManualOverrides,
  normalizeReferralConfig,
  resolveReferralCompleteness,
} from "../../src/lib/content/referral-fields";
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
import { type ReferralTargetCatalogContribution, resolveReferralTarget } from "./referral-targets";
import { parseRumblePublicProfile, resolveRumbleAboutUrl } from "./rumble-public-profile";
import { parseAudienceCount } from "./social-profile-counts";
import type {
  EnrichmentStrategy,
  NormalizedEnrichmentResult,
  ResolveEnrichmentStrategyInput,
  ResolvedPublicEnrichmentStrategy,
} from "./strategy-types";
import type { EnrichmentMetadata } from "./types";

export const PUBLIC_BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
export const X_COMMUNITY_METADATA_USER_AGENT =
  "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)";
export const INSTAGRAM_DESCRIPTION_PATTERN =
  /^\s*(?<followersValue>[^,]+?)\s+(?<followersLabel>Followers?),\s*(?<followingValue>[^,]+?)\s+(?<followingLabel>Following)\b/i;
export const YOUTUBE_THUMBNAIL_URL_PATTERN =
  /itemprop="thumbnailUrl" href="([^"]+)"|"channelMetadataRenderer":\{.*?"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/s;
export const YOUTUBE_ABOUT_CHANNEL_MARKER = '"aboutChannelViewModel":{';
export const YOUTUBE_METADATA_ROWS_MARKER = '"metadataRows":[';
export const YOUTUBE_SUBSCRIBER_SEGMENT_LENGTH = 5_000;
export const REFERRAL_HEADLINE_HINT_PATTERN =
  /\b(join|save|get|bonus|discount|deal|offer|membership|invite|credit|free)\b/i;
export const REFERRAL_TERMS_PATTERN =
  /\b(new users only|limited time|subject to approval|terms apply|starting at\b|while supplies last|minimum purchase|cannot be combined)\b/i;
export const REFERRAL_VISITOR_BENEFIT_PATTERN =
  /\b(save|discount|bonus|credit|free|cash\s*back|cashback|off your|starting at\b|pay in sats|trial)\b/i;
export const REFERRAL_OWNER_BENEFIT_PATTERN =
  /\b(supports?\s+(?:the\s+)?(?:project|creator|site|author)|commission|store credit|referral reward|creator receives|we (?:earn|receive|get)|i (?:earn|receive|get))\b/i;

export type PublicAugmentationOutcome = NormalizedEnrichmentResult;

export type PublicAugmentationStrategyId =
  | "cluborange-referral-signup"
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
  originalUrl?: string;
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

export interface SubstackJsonLdPerson {
  name?: string;
  description?: string;
  jobTitle?: string;
  image?: string;
  url?: string;
}

export interface SubstackPublicationMetadata {
  name?: string;
  subdomain?: string;
  heroText?: string;
  logoUrl?: string;
}

export interface SubstackPublishedByline {
  name?: string;
  handle?: string;
  bio?: string;
  photoUrl?: string;
}

export interface SubstackProfileMetadata {
  name?: string;
  handle?: string;
  bio?: string;
  photoUrl?: string;
  subscribersCount?: number;
  subscribersCountRaw?: string;
}

export interface ResolvePublicAugmentationTargetInput {
  url: string;
  icon?: string;
  metadataHandle?: unknown;
}

export interface ResolvePublicReferralAugmentationInput {
  originalUrl: string;
  sourceUrl: string;
  finalUrl?: string;
  strategyId: string;
  metadata: EnrichmentMetadata;
  manualReferral?: LinkReferralConfig;
  benefitTextCandidates?: string[];
}

export const SUBSTACK_PRELOADS_PATTERN =
  /window\._preloads\s*=\s*JSON\.parse\(("(?:(?:\\.)|[^"\\])*")\)/s;

export const firstMatch = (text: string, patterns: RegExp[]): string | undefined => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = safeTrim(match?.[1]);
    if (value) {
      return decodeEntities(value).trim();
    }
  }

  return undefined;
};

export const findJsonLdPerson = (value: unknown): SubstackJsonLdPerson | undefined => {
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

export const extractSubstackJsonLdPerson = (html: string): SubstackJsonLdPerson | undefined => {
  for (const block of extractJsonLdBlocks(html)) {
    const person = findJsonLdPerson(block);
    if (person) {
      return person;
    }
  }

  return undefined;
};

export const extractSubstackPreloads = (html: string): Record<string, unknown> | undefined => {
  const encodedJson = html.match(SUBSTACK_PRELOADS_PATTERN)?.[1];
  const serialized = parseJson<string>(encodedJson);
  const parsed = parseJson<unknown>(serialized);
  return isRecord(parsed) ? parsed : undefined;
};

export const resolveSubstackPublicationMetadata = (
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

export const isSubstackGenericPreviewImage = (value: string | undefined): boolean =>
  Boolean(value && /subscribe-card/iu.test(value));

export const parseSubstackSubscriberCountValue = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return parseAudienceCount(safeTrim(value));
};

export const formatSubstackSubscriberCountRaw = (count: number | undefined): string | undefined =>
  count === undefined ? undefined : `${count.toLocaleString("en-US")} subscribers`;

export const resolveSubstackProfileMetadata = (
  preloads: Record<string, unknown> | undefined,
): SubstackProfileMetadata | undefined => {
  if (!preloads) {
    return undefined;
  }

  const profile = isRecord(preloads.profile) ? preloads.profile : undefined;
  const pub = isRecord(preloads.pub) ? preloads.pub : undefined;
  if (!profile && !pub) {
    return undefined;
  }

  const publicationSubscribersCount =
    parseSubstackSubscriberCountValue(pub?.freeSubscriberCount) ??
    parseSubstackSubscriberCountValue(pub?.freeSubscriberCountOrderOfMagnitude);
  const subscribersCountRaw =
    safeTrim(profile?.subscriberCountString) ??
    formatSubstackSubscriberCountRaw(publicationSubscribersCount);
  const subscribersCountNumber =
    typeof profile?.subscriberCountNumber === "number" &&
    Number.isFinite(profile.subscriberCountNumber)
      ? profile.subscriberCountNumber
      : undefined;

  return {
    name: safeTrim(profile?.name) ?? safeTrim(pub?.author_name),
    handle: safeTrim(profile?.handle) ?? safeTrim(pub?.author_handle),
    bio: safeTrim(profile?.bio) ?? safeTrim(pub?.author_bio),
    photoUrl: safeTrim(profile?.photo_url) ?? safeTrim(pub?.author_photo_url),
    subscribersCount:
      subscribersCountNumber ??
      publicationSubscribersCount ??
      parseAudienceCount(subscribersCountRaw),
    subscribersCountRaw,
  };
};

export const extractSubstackPublishedByline = (
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

export const resolveSubstackCanonicalHandle = (
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

export const detectMediumPlaceholderSignals = (xml: string): string[] => {
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

export const detectXPlaceholderSignals = (input: {
  title?: string;
  description?: string;
  providerName?: string;
  html?: string;
}): string[] => {
  const combined = [
    input.title ?? "",
    input.description ?? "",
    input.providerName ?? "",
    input.html ?? "",
  ]
    .join("\n")
    .toLowerCase();
  return detectPlaceholderSignals(combined, [
    {
      label: "oembed_unavailable",
      pattern: /not found|no status found|invalid url|nothing to see here|doesn['’]?t exist/i,
    },
    { label: "sign_in_prompt", pattern: /sign in|log in/i },
    {
      label: "challenge_page",
      pattern: /just a moment|checking if the site connection is secure/i,
    },
  ]);
};

export const detectInstagramPlaceholderSignals = (input: {
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

export const detectYoutubePlaceholderSignals = (input: {
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

export const resolveMediumFeedUrl = (sourceUrl: string): string => {
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

export const resolveXHandle = (sourceUrl: string): string => {
  const resolution = resolveHandleFromUrl({ url: sourceUrl, icon: "x" });
  if (resolution.reason !== "resolved" || resolution.extractorId !== "x" || !resolution.handle) {
    throw new Error(`X public augmentation only supports profile URLs. Got '${sourceUrl}'.`);
  }

  return resolution.handle;
};

export const resolveInstagramTargetUrl = (sourceUrl: string): string => {
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

export const resolveYoutubeTargetUrl = (sourceUrl: string): string => {
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

  let profilePath = `/${first}`;
  if (!first.startsWith("@") && (first === "channel" || first === "c" || first === "user")) {
    profilePath = `/${first}/${segments[1]}`;
  }

  return `https://www.youtube.com${profilePath}/about`;
};

export const isLikelySubstackProfileUrl = (
  input: ResolvePublicAugmentationTargetInput,
): boolean => {
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

export const buildSubstackCanonicalProfileUrl = (handle: string): string =>
  `https://substack.com/@${encodeURIComponent(handle)}`;

export const buildXOEmbedUrl = (sourceUrl: string): string => {
  const handle = resolveXHandle(sourceUrl);
  const oEmbedUrl = new URL("https://publish.twitter.com/oembed");
  oEmbedUrl.searchParams.set("url", `https://twitter.com/${handle}`);
  oEmbedUrl.searchParams.set("omit_script", "true");
  oEmbedUrl.searchParams.set("hide_thread", "true");
  oEmbedUrl.searchParams.set("dnt", "true");
  return oEmbedUrl.toString();
};

export const extractXDisplayHandle = (html: string | undefined, fallbackHandle: string): string => {
  if (!html) {
    return fallbackHandle;
  }

  const match = html.match(/\b(?:Tweets|Posts) by ([^<]+)/i);
  const extracted = safeTrim(match?.[1]);
  return extracted ? decodeEntities(extracted).trim().replace(/^@/, "") : fallbackHandle;
};

export const buildGenericXDescription = (displayHandle: string): string =>
  `Posts and updates from @${displayHandle} on X.`;

export const resolveClubOrangeReferralSignupTarget = (
  sourceUrl: string,
): ReturnType<typeof resolveReferralTarget> => {
  const target = resolveReferralTarget({
    url: sourceUrl,
  });

  if (target?.catalog?.offerId !== "club-orange-signup") {
    return null;
  }

  return target;
};
