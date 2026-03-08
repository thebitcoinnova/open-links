import { parseAudienceCount } from "./social-profile-counts";

const MEDIUM_BROWSER_PLACEHOLDER_CHECKS = [
  { label: "cloudflare_challenge", pattern: /just a moment/i },
  { label: "security_verification", pattern: /performing security verification/i },
  {
    label: "bot_verification",
    pattern: /verifies? you are not a bot|checking if the site connection is secure/i,
  },
  { label: "cloudflare_branding", pattern: /performance and security by cloudflare/i },
  { label: "enable_javascript", pattern: /enable javascript and cookies to continue/i },
  { label: "access_denied", pattern: /access denied/i },
] as const;

const AUDIENCE_PATTERN =
  /(?<![\d.])(?<raw>(?:\d+(?:\.\d+)?[KMBkmb]|\d[\d.,]*)\s+(?<label>followers?|following))\b/giu;

export interface MediumPublicProfileBrowserSnapshot {
  currentUrl?: string;
  title?: string;
  bodyText?: string;
  metricTexts?: string[];
}

export interface MediumPublicProfileMetrics {
  followersCount?: number;
  followersCountRaw?: string;
  followingCount?: number;
  followingCountRaw?: string;
  placeholderSignals: string[];
}

const safeTrim = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.replace(/\s+/gu, " ").trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeAudienceRaw = (value: string): string => value.replace(/\s+/gu, " ").trim();

const toAudienceSources = (snapshot: MediumPublicProfileBrowserSnapshot): string[] => {
  const sources = (snapshot.metricTexts ?? [])
    .map((value) => safeTrim(value))
    .filter((value): value is string => Boolean(value));

  const bodyText = safeTrim(snapshot.bodyText);
  if (bodyText) {
    sources.push(bodyText);
  }

  return sources;
};

export const detectMediumPublicBrowserPlaceholderSignals = (
  snapshot: MediumPublicProfileBrowserSnapshot,
): string[] => {
  const combined = [snapshot.currentUrl, snapshot.title, snapshot.bodyText]
    .map((value) => safeTrim(value))
    .filter((value): value is string => Boolean(value))
    .join("\n");

  return MEDIUM_BROWSER_PLACEHOLDER_CHECKS.filter((check) => check.pattern.test(combined)).map(
    (check) => check.label,
  );
};

export const parseMediumPublicProfileMetrics = (
  snapshot: MediumPublicProfileBrowserSnapshot,
): MediumPublicProfileMetrics => {
  const metrics: MediumPublicProfileMetrics = {
    placeholderSignals: detectMediumPublicBrowserPlaceholderSignals(snapshot),
  };

  for (const source of toAudienceSources(snapshot)) {
    for (const match of source.matchAll(AUDIENCE_PATTERN)) {
      const raw = safeTrim(match.groups?.raw);
      const label = safeTrim(match.groups?.label)?.toLowerCase();
      if (!raw || !label) {
        continue;
      }

      const normalizedRaw = normalizeAudienceRaw(raw);
      const parsedCount = parseAudienceCount(normalizedRaw);
      if (parsedCount === undefined) {
        continue;
      }

      if (label.startsWith("follower") && !metrics.followersCountRaw) {
        metrics.followersCount = parsedCount;
        metrics.followersCountRaw = normalizedRaw;
      }

      if (label === "following" && !metrics.followingCountRaw) {
        metrics.followingCount = parsedCount;
        metrics.followingCountRaw = normalizedRaw;
      }
    }

    if (metrics.followersCountRaw && metrics.followingCountRaw) {
      break;
    }
  }

  return metrics;
};
