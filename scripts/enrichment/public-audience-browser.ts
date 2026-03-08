import { parseAudienceCount } from "./social-profile-counts";

const AUDIENCE_PATTERN =
  /(?<![\d.])(?<raw>(?:\d+(?:\.\d+)?[KMBkmb]|\d[\d.,]*)\s+(?<label>followers?|following))\b/giu;

export interface PublicAudienceBrowserSnapshot {
  currentUrl?: string;
  title?: string;
  bodyText?: string;
  metricTexts?: string[];
}

export interface PublicAudienceMetrics {
  followersCount?: number;
  followersCountRaw?: string;
  followingCount?: number;
  followingCountRaw?: string;
  placeholderSignals: string[];
}

export interface PublicAudiencePlaceholderCheck {
  label: string;
  pattern: RegExp;
  field?: "currentUrl" | "combined";
}

const safeTrim = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.replace(/\s+/gu, " ").trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeAudienceRaw = (value: string): string => value.replace(/\s+/gu, " ").trim();

const toAudienceSources = (snapshot: PublicAudienceBrowserSnapshot): string[] => {
  const sources = (snapshot.metricTexts ?? [])
    .map((value) => safeTrim(value))
    .filter((value): value is string => Boolean(value));

  const bodyText = safeTrim(snapshot.bodyText);
  if (bodyText) {
    sources.push(bodyText);
  }

  return sources;
};

export const detectPublicAudiencePlaceholderSignals = (
  snapshot: PublicAudienceBrowserSnapshot,
  checks: readonly PublicAudiencePlaceholderCheck[],
): string[] => {
  const currentUrl = safeTrim(snapshot.currentUrl);
  const combined = [snapshot.title, snapshot.bodyText]
    .map((value) => safeTrim(value))
    .filter((value): value is string => Boolean(value))
    .join("\n");

  return checks
    .filter((check) => {
      if (check.field === "currentUrl") {
        return check.pattern.test(currentUrl ?? "");
      }

      return check.pattern.test(combined);
    })
    .map((check) => check.label);
};

export const parsePublicAudienceMetrics = (input: {
  snapshot: PublicAudienceBrowserSnapshot;
  placeholderChecks?: readonly PublicAudiencePlaceholderCheck[];
}): PublicAudienceMetrics => {
  const metrics: PublicAudienceMetrics = {
    placeholderSignals: detectPublicAudiencePlaceholderSignals(
      input.snapshot,
      input.placeholderChecks ?? [],
    ),
  };

  for (const source of toAudienceSources(input.snapshot)) {
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
