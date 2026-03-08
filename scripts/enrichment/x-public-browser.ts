import { parseAudienceCount } from "./social-profile-counts";

const X_BROWSER_PLACEHOLDER_CHECKS = [
  { label: "login_redirect", pattern: /\/i\/flow\/login\b/i, field: "currentUrl" },
  { label: "account_missing", pattern: /this account doesn['’]?t exist/i, field: "combined" },
  { label: "account_suspended", pattern: /account suspended/i, field: "combined" },
  { label: "transient_error", pattern: /something went wrong|try reloading/i, field: "combined" },
  { label: "rate_limited", pattern: /rate limit exceeded/i, field: "combined" },
] as const;

const AUDIENCE_PATTERN =
  /(?<![\d.])(?<raw>(?:\d+(?:\.\d+)?[KMBkmb]|\d[\d.,]*)\s+(?<label>followers?|following))\b/giu;

export interface XPublicProfileBrowserSnapshot {
  currentUrl?: string;
  title?: string;
  bodyText?: string;
  metricTexts?: string[];
}

export interface XPublicProfileMetrics {
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

const toAudienceSources = (snapshot: XPublicProfileBrowserSnapshot): string[] => {
  const sources = (snapshot.metricTexts ?? [])
    .map((value) => safeTrim(value))
    .filter((value): value is string => Boolean(value));

  const bodyText = safeTrim(snapshot.bodyText);
  if (bodyText) {
    sources.push(bodyText);
  }

  return sources;
};

export const detectXPublicBrowserPlaceholderSignals = (
  snapshot: XPublicProfileBrowserSnapshot,
): string[] => {
  const currentUrl = safeTrim(snapshot.currentUrl);
  const combined = [snapshot.title, snapshot.bodyText]
    .map((value) => safeTrim(value))
    .filter((value): value is string => Boolean(value))
    .join("\n");

  return X_BROWSER_PLACEHOLDER_CHECKS.filter((check) => {
    if (check.field === "currentUrl") {
      return check.pattern.test(currentUrl ?? "");
    }

    return check.pattern.test(combined);
  }).map((check) => check.label);
};

export const parseXPublicProfileMetrics = (
  snapshot: XPublicProfileBrowserSnapshot,
): XPublicProfileMetrics => {
  const metrics: XPublicProfileMetrics = {
    placeholderSignals: detectXPublicBrowserPlaceholderSignals(snapshot),
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
