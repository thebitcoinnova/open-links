import { normalizeKnownSiteAlias } from "../icons/known-sites-data";

export type HandleExtractorId =
  | "cluborange"
  | "github"
  | "x"
  | "linkedin"
  | "facebook"
  | "instagram"
  | "rumble"
  | "primal"
  | "medium"
  | "substack"
  | "youtube";

export type HandleResolutionReason =
  | "resolved"
  | "missing_url"
  | "invalid_url"
  | "unsupported_domain"
  | "missing_handle_segment"
  | "not_profile_url"
  | "invalid_handle";

export interface HandleResolution {
  supported: boolean;
  extractorId?: HandleExtractorId;
  handle?: string;
  reason: HandleResolutionReason;
}

export interface ResolveHandleFromUrlInput {
  url?: string;
  icon?: string;
}

export interface ResolveLinkHandleInput extends ResolveHandleFromUrlInput {
  metadataHandle?: unknown;
}

export interface ResolvedLinkHandle {
  handle?: string;
  displayHandle?: string;
  source: "metadata" | "url" | "none";
  resolution: HandleResolution;
}

const GITHUB_HOSTS = new Set(["github.com", "gist.github.com"]);
const X_HOSTS = new Set(["x.com", "twitter.com", "mobile.twitter.com"]);
const LINKEDIN_HOSTS = new Set(["linkedin.com", "lnkd.in"]);
const FACEBOOK_HOSTS = new Set(["facebook.com", "m.facebook.com", "fb.com"]);
const INSTAGRAM_HOSTS = new Set(["instagram.com"]);
const CLUB_ORANGE_DOMAIN = "cluborange.org";
const RUMBLE_HOSTS = new Set(["rumble.com"]);
const PRIMAL_HOSTS = new Set(["primal.net"]);
const MEDIUM_HOSTS = new Set(["medium.com"]);
const SUBSTACK_HOSTS = new Set(["substack.com"]);
const YOUTUBE_HOSTS = new Set(["youtube.com", "m.youtube.com", "youtu.be"]);

const GITHUB_RESERVED = new Set([
  "about",
  "account",
  "apps",
  "blog",
  "collections",
  "contact",
  "dashboard",
  "enterprise",
  "events",
  "explore",
  "features",
  "gist",
  "gist.github.com",
  "issues",
  "login",
  "logout",
  "marketplace",
  "new",
  "notifications",
  "organizations",
  "orgs",
  "pricing",
  "pulls",
  "readme",
  "search",
  "security",
  "settings",
  "signup",
  "site",
  "sponsors",
  "team",
  "topics",
  "trending",
  "users",
]);

const X_RESERVED = new Set([
  "about",
  "compose",
  "explore",
  "hashtag",
  "home",
  "i",
  "intent",
  "login",
  "messages",
  "notifications",
  "privacy",
  "search",
  "settings",
  "share",
  "signup",
  "tos",
]);

const FACEBOOK_RESERVED = new Set([
  "about",
  "accounts",
  "adsmanager",
  "business",
  "events",
  "friends",
  "gaming",
  "groups",
  "help",
  "home.php",
  "login",
  "marketplace",
  "messages",
  "notifications",
  "pages",
  "people",
  "photo.php",
  "photos",
  "plugins",
  "privacy",
  "profile.php",
  "reel",
  "reels",
  "search",
  "settings",
  "share",
  "stories",
  "story.php",
  "watch",
]);

const INSTAGRAM_RESERVED = new Set([
  "about",
  "accounts",
  "api",
  "challenge",
  "developer",
  "direct",
  "explore",
  "legal",
  "p",
  "press",
  "privacy",
  "reel",
  "reels",
  "stories",
  "tv",
  "web",
]);

const PRIMAL_RESERVED = new Set([
  "about",
  "bookmarks",
  "downloads",
  "explore",
  "home",
  "login",
  "messages",
  "notifications",
  "premium",
  "search",
  "settings",
  "signup",
  "wallet",
]);

const RUMBLE_RESERVED = new Set([
  "about",
  "account",
  "ads",
  "c",
  "categories",
  "channel",
  "channels",
  "contact-us",
  "embed",
  "help",
  "live",
  "login",
  "logout",
  "news",
  "our-picks",
  "privacy",
  "search",
  "settings",
  "terms",
  "user",
  "video",
  "videos",
]);

const RUMBLE_PROFILE_TABS = new Set(["about", "channels", "livestreams", "reposts", "videos"]);

const CLUB_ORANGE_RESERVED = new Set([
  "about",
  "admin",
  "app",
  "community",
  "download",
  "events",
  "groups",
  "home",
  "login",
  "messages",
  "notifications",
  "privacy",
  "settings",
  "signup",
  "terms",
  "user",
  "wallet",
]);

const MEDIUM_RESERVED = new Set([
  "about",
  "creators",
  "m",
  "me",
  "membership",
  "notifications",
  "plans",
  "policy",
  "privacy",
  "publish",
  "p",
  "search",
  "signin",
  "signup",
  "tag",
  "topics",
  "write",
]);

const SUBSTACK_SUBDOMAIN_RESERVED = new Set([
  "api",
  "app",
  "cdn",
  "help",
  "podcasts",
  "profile",
  "static",
  "substack",
  "support",
  "www",
]);

const YOUTUBE_RESERVED = new Set([
  "about",
  "account",
  "feed",
  "gaming",
  "hashtag",
  "jobs",
  "kids",
  "live",
  "music",
  "news",
  "playlist",
  "premium",
  "results",
  "shorts",
  "watch",
]);

const LINKEDIN_PREFIXES = new Set(["in", "company", "school"]);

const normalizeHost = (value: string): string => value.toLowerCase().replace(/^www\./, "");

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const toPathSegments = (pathname: string): string[] =>
  pathname
    .split("/")
    .map((segment) => safeDecode(segment).trim())
    .filter((segment) => segment.length > 0);

const toLowerTrimmed = (value: string): string => value.trim().toLowerCase();

const isXCommunitySegments = (segments: string[]): boolean => {
  const first = toLowerTrimmed(segments[0] ?? "");
  const second = toLowerTrimmed(segments[1] ?? "");
  const maybeCommunityId = toLowerTrimmed(segments[2] ?? "");

  return first === "i" && second === "communities" && /^\d{5,30}$/.test(maybeCommunityId);
};

export const isXCommunityUrl = (input: ResolveHandleFromUrlInput): boolean => {
  if (!input.url || input.url.trim().length === 0) {
    return false;
  }

  try {
    const parsed = new URL(input.url);
    const host = normalizeHost(parsed.hostname);
    if (!X_HOSTS.has(host)) {
      return false;
    }

    return isXCommunitySegments(toPathSegments(parsed.pathname));
  } catch {
    return false;
  }
};

export const normalizeHandle = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const withoutPrefix = value.trim().replace(/^@+/, "").replace(/\/+$/, "");
  if (withoutPrefix.length === 0) {
    return undefined;
  }

  if (!/^[A-Za-z0-9._-]{1,100}$/.test(withoutPrefix)) {
    return undefined;
  }

  return withoutPrefix.toLowerCase();
};

export const formatHandleForDisplay = (value: string | undefined): string | undefined => {
  const normalized = normalizeHandle(value);
  return normalized ? `@${normalized}` : undefined;
};

const resolved = (extractorId: HandleExtractorId, handle: string): HandleResolution => ({
  supported: true,
  extractorId,
  handle,
  reason: "resolved",
});

const unsupported = (reason: HandleResolutionReason): HandleResolution => ({
  supported: false,
  reason,
});

const supportedWithoutHandle = (
  extractorId: HandleExtractorId,
  reason: Exclude<
    HandleResolutionReason,
    "resolved" | "missing_url" | "invalid_url" | "unsupported_domain"
  >,
): HandleResolution => ({
  supported: true,
  extractorId,
  reason,
});

const isSubdomainOf = (host: string, suffix: string): boolean =>
  host === suffix || host.endsWith(`.${suffix}`);

const resolveGithub = (segments: string[]): HandleResolution => {
  const candidate = segments[0];
  if (!candidate) {
    return supportedWithoutHandle("github", "missing_handle_segment");
  }

  const normalizedCandidate = toLowerTrimmed(candidate.replace(/^@+/, ""));
  if (GITHUB_RESERVED.has(normalizedCandidate)) {
    return supportedWithoutHandle("github", "not_profile_url");
  }

  if (!/^(?!-)[a-z0-9-]{1,39}(?<!-)$/.test(normalizedCandidate)) {
    return supportedWithoutHandle("github", "invalid_handle");
  }

  return resolved("github", normalizedCandidate);
};

const resolveX = (segments: string[]): HandleResolution => {
  const candidate = segments[0];
  if (!candidate) {
    return supportedWithoutHandle("x", "missing_handle_segment");
  }

  if (isXCommunitySegments(segments)) {
    return resolved("x", toLowerTrimmed(segments[2] ?? ""));
  }

  const normalizedCandidate = toLowerTrimmed(candidate.replace(/^@+/, ""));
  if (X_RESERVED.has(normalizedCandidate)) {
    return supportedWithoutHandle("x", "not_profile_url");
  }

  if (!/^[a-z0-9_]{1,15}$/.test(normalizedCandidate)) {
    return supportedWithoutHandle("x", "invalid_handle");
  }

  return resolved("x", normalizedCandidate);
};

const resolveLinkedin = (segments: string[]): HandleResolution => {
  const prefix = toLowerTrimmed(segments[0] ?? "");
  if (!prefix) {
    return supportedWithoutHandle("linkedin", "missing_handle_segment");
  }

  if (!LINKEDIN_PREFIXES.has(prefix)) {
    return supportedWithoutHandle("linkedin", "not_profile_url");
  }

  const candidate = toLowerTrimmed((segments[1] ?? "").replace(/^@+/, ""));
  if (!candidate) {
    return supportedWithoutHandle("linkedin", "missing_handle_segment");
  }

  if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(candidate)) {
    return supportedWithoutHandle("linkedin", "invalid_handle");
  }

  return resolved("linkedin", candidate);
};

const resolveFacebook = (url: URL, segments: string[]): HandleResolution => {
  const first = toLowerTrimmed(segments[0] ?? "");
  if (!first) {
    return supportedWithoutHandle("facebook", "missing_handle_segment");
  }

  if (first === "people") {
    const slug = normalizeHandle(segments[1]);
    if (!slug) {
      return supportedWithoutHandle("facebook", "missing_handle_segment");
    }

    if (!/^[a-z0-9.-]{3,100}$/.test(slug)) {
      return supportedWithoutHandle("facebook", "invalid_handle");
    }

    const maybeProfileId = toLowerTrimmed(segments[2] ?? "");
    if (!maybeProfileId || !/^\d{5,30}$/.test(maybeProfileId)) {
      return supportedWithoutHandle("facebook", "not_profile_url");
    }

    return resolved("facebook", slug);
  }

  if (first === "profile.php") {
    const id = normalizeHandle(url.searchParams.get("id"));
    if (!id) {
      return supportedWithoutHandle("facebook", "missing_handle_segment");
    }
    return resolved("facebook", id);
  }

  if (FACEBOOK_RESERVED.has(first)) {
    return supportedWithoutHandle("facebook", "not_profile_url");
  }

  const candidate = normalizeHandle(first);
  if (!candidate || !/^[a-z0-9.-]{3,100}$/.test(candidate)) {
    return supportedWithoutHandle("facebook", "invalid_handle");
  }

  return resolved("facebook", candidate);
};

const resolveInstagram = (segments: string[]): HandleResolution => {
  const candidate = toLowerTrimmed((segments[0] ?? "").replace(/^@+/, ""));
  if (!candidate) {
    return supportedWithoutHandle("instagram", "missing_handle_segment");
  }

  if (INSTAGRAM_RESERVED.has(candidate)) {
    return supportedWithoutHandle("instagram", "not_profile_url");
  }

  if (!/^[a-z0-9._]{1,30}$/.test(candidate)) {
    return supportedWithoutHandle("instagram", "invalid_handle");
  }

  return resolved("instagram", candidate);
};

const hasOnlyAllowedRumbleSuffix = (segments: string[], handleIndex: number): boolean => {
  if (segments.length <= handleIndex + 1) {
    return true;
  }

  if (segments.length !== handleIndex + 2) {
    return false;
  }

  const maybeTab = toLowerTrimmed(segments[handleIndex + 1] ?? "");
  return !!maybeTab && RUMBLE_PROFILE_TABS.has(maybeTab);
};

const resolveRumble = (segments: string[]): HandleResolution => {
  const first = toLowerTrimmed(segments[0] ?? "");
  if (!first) {
    return supportedWithoutHandle("rumble", "missing_handle_segment");
  }

  if (first === "user" || first === "c") {
    const rawCandidate = segments[1];
    if (!rawCandidate) {
      return supportedWithoutHandle("rumble", "missing_handle_segment");
    }

    if (!hasOnlyAllowedRumbleSuffix(segments, 1)) {
      return supportedWithoutHandle("rumble", "not_profile_url");
    }

    const candidate = normalizeHandle(rawCandidate);
    if (!candidate || !/^[a-z0-9][a-z0-9._-]{0,99}$/.test(candidate)) {
      return supportedWithoutHandle("rumble", "invalid_handle");
    }

    return resolved("rumble", candidate);
  }

  if (RUMBLE_RESERVED.has(first) || /\.html$/i.test(first)) {
    return supportedWithoutHandle("rumble", "not_profile_url");
  }

  if (!hasOnlyAllowedRumbleSuffix(segments, 0)) {
    return supportedWithoutHandle("rumble", "not_profile_url");
  }

  const candidate = normalizeHandle(first);
  if (!candidate || !/^[a-z0-9][a-z0-9._-]{0,99}$/.test(candidate)) {
    return supportedWithoutHandle("rumble", "invalid_handle");
  }

  return resolved("rumble", candidate);
};

const resolveClubOrange = (segments: string[]): HandleResolution => {
  const candidate = toLowerTrimmed((segments[0] ?? "").replace(/^@+/, ""));
  if (!candidate) {
    return supportedWithoutHandle("cluborange", "missing_handle_segment");
  }

  if (segments.length > 1 || CLUB_ORANGE_RESERVED.has(candidate)) {
    return supportedWithoutHandle("cluborange", "not_profile_url");
  }

  const normalizedCandidate = normalizeHandle(candidate);
  if (!normalizedCandidate || !/^[a-z0-9._-]{1,100}$/.test(normalizedCandidate)) {
    return supportedWithoutHandle("cluborange", "invalid_handle");
  }

  return resolved("cluborange", normalizedCandidate);
};

const resolvePrimal = (segments: string[]): HandleResolution => {
  const candidate = toLowerTrimmed((segments[0] ?? "").replace(/^@+/, ""));
  if (!candidate) {
    return supportedWithoutHandle("primal", "missing_handle_segment");
  }

  if (segments.length > 1 || PRIMAL_RESERVED.has(candidate)) {
    return supportedWithoutHandle("primal", "not_profile_url");
  }

  const normalizedCandidate = normalizeHandle(candidate);
  if (!normalizedCandidate || !/^[a-z0-9._-]{1,100}$/.test(normalizedCandidate)) {
    return supportedWithoutHandle("primal", "invalid_handle");
  }

  return resolved("primal", normalizedCandidate);
};

const resolveMedium = (segments: string[]): HandleResolution => {
  const first = segments[0];
  if (!first) {
    return supportedWithoutHandle("medium", "missing_handle_segment");
  }

  const normalizedFirst = toLowerTrimmed(first);
  if (MEDIUM_RESERVED.has(normalizedFirst)) {
    return supportedWithoutHandle("medium", "not_profile_url");
  }

  if (!first.startsWith("@")) {
    return supportedWithoutHandle("medium", "not_profile_url");
  }

  const candidate = normalizeHandle(first);
  if (!candidate || !/^[a-z0-9_-]{1,60}$/.test(candidate)) {
    return supportedWithoutHandle("medium", "invalid_handle");
  }

  return resolved("medium", candidate);
};

const resolveSubstack = (host: string, segments: string[]): HandleResolution => {
  if (isSubdomainOf(host, "substack.com") && host !== "substack.com") {
    const subdomain = host.slice(0, -".substack.com".length).split(".")[0] ?? "";
    const normalizedSubdomain = normalizeHandle(subdomain);
    if (
      normalizedSubdomain &&
      /^[a-z0-9][a-z0-9-]{0,62}$/.test(normalizedSubdomain) &&
      !SUBSTACK_SUBDOMAIN_RESERVED.has(normalizedSubdomain)
    ) {
      return resolved("substack", normalizedSubdomain);
    }

    return supportedWithoutHandle("substack", "invalid_handle");
  }

  if (host === "substack.com") {
    const first = segments[0];
    if (!first) {
      return supportedWithoutHandle("substack", "missing_handle_segment");
    }

    if (first.startsWith("@")) {
      const candidate = normalizeHandle(first);
      if (!candidate || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(candidate)) {
        return supportedWithoutHandle("substack", "invalid_handle");
      }
      return resolved("substack", candidate);
    }

    return supportedWithoutHandle("substack", "not_profile_url");
  }

  return supportedWithoutHandle("substack", "not_profile_url");
};

const resolveYoutube = (host: string, segments: string[]): HandleResolution => {
  if (host === "youtu.be") {
    return supportedWithoutHandle("youtube", "not_profile_url");
  }

  const first = toLowerTrimmed(segments[0] ?? "");
  if (!first) {
    return supportedWithoutHandle("youtube", "missing_handle_segment");
  }

  if (first.startsWith("@")) {
    const candidate = normalizeHandle(first);
    if (!candidate || !/^[a-z0-9._-]{3,30}$/.test(candidate)) {
      return supportedWithoutHandle("youtube", "invalid_handle");
    }
    return resolved("youtube", candidate);
  }

  if (first === "channel" || first === "c" || first === "user") {
    const raw = segments[1];
    if (!raw) {
      return supportedWithoutHandle("youtube", "missing_handle_segment");
    }

    const candidate = normalizeHandle(raw);
    if (!candidate || !/^[a-z0-9._-]{3,100}$/.test(candidate)) {
      return supportedWithoutHandle("youtube", "invalid_handle");
    }
    return resolved("youtube", candidate);
  }

  if (YOUTUBE_RESERVED.has(first)) {
    return supportedWithoutHandle("youtube", "not_profile_url");
  }

  if (segments.length > 1) {
    return supportedWithoutHandle("youtube", "not_profile_url");
  }

  const candidate = normalizeHandle(first);
  if (!candidate || !/^[a-z0-9._-]{3,30}$/.test(candidate)) {
    return supportedWithoutHandle("youtube", "invalid_handle");
  }

  return resolved("youtube", candidate);
};

const isSubstackIconHint = (icon: string | undefined): boolean => {
  if (typeof icon !== "string") {
    return false;
  }

  const normalized = normalizeKnownSiteAlias(icon);
  return normalized === "substack";
};

export const resolveHandleFromUrl = (input: ResolveHandleFromUrlInput): HandleResolution => {
  if (!input.url || input.url.trim().length === 0) {
    return unsupported("missing_url");
  }

  let parsed: URL;
  try {
    parsed = new URL(input.url);
  } catch {
    return unsupported("invalid_url");
  }

  const host = normalizeHost(parsed.hostname);
  const segments = toPathSegments(parsed.pathname);

  if (GITHUB_HOSTS.has(host)) {
    return resolveGithub(segments);
  }

  if (X_HOSTS.has(host)) {
    return resolveX(segments);
  }

  if (LINKEDIN_HOSTS.has(host)) {
    return resolveLinkedin(segments);
  }

  if (FACEBOOK_HOSTS.has(host)) {
    return resolveFacebook(parsed, segments);
  }

  if (INSTAGRAM_HOSTS.has(host)) {
    return resolveInstagram(segments);
  }

  if (RUMBLE_HOSTS.has(host)) {
    return resolveRumble(segments);
  }

  if (host === CLUB_ORANGE_DOMAIN || isSubdomainOf(host, CLUB_ORANGE_DOMAIN)) {
    return resolveClubOrange(segments);
  }

  if (PRIMAL_HOSTS.has(host)) {
    return resolvePrimal(segments);
  }

  if (MEDIUM_HOSTS.has(host)) {
    return resolveMedium(segments);
  }

  if (SUBSTACK_HOSTS.has(host) || isSubdomainOf(host, "substack.com")) {
    return resolveSubstack(host, segments);
  }

  if (YOUTUBE_HOSTS.has(host) || isSubdomainOf(host, "youtube.com")) {
    return resolveYoutube(host, segments);
  }

  if (isSubstackIconHint(input.icon)) {
    return supportedWithoutHandle("substack", "not_profile_url");
  }

  return unsupported("unsupported_domain");
};

export const resolveLinkHandle = (input: ResolveLinkHandleInput): ResolvedLinkHandle => {
  const metadataHandle = normalizeHandle(input.metadataHandle);
  const resolution = resolveHandleFromUrl(input);
  const hideDisplayHandle = resolution.extractorId === "x" && isXCommunityUrl(input);

  if (metadataHandle) {
    return {
      handle: metadataHandle,
      displayHandle: hideDisplayHandle ? undefined : `@${metadataHandle}`,
      source: "metadata",
      resolution,
    };
  }

  if (resolution.handle) {
    return {
      handle: resolution.handle,
      displayHandle: hideDisplayHandle ? undefined : `@${resolution.handle}`,
      source: "url",
      resolution,
    };
  }

  return {
    source: "none",
    resolution,
  };
};
