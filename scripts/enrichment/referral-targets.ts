const REFERRAL_PARAM_KEYS = new Set(["ref", "referral", "invite", "code", "coupon"]);
const ANALYTICS_PARAM_KEYS = new Set(["fbclid", "gclid", "mc_cid", "mc_eid"]);
const ANALYTICS_PARAM_PREFIXES = ["utm_"] as const;
const PATH_REFERRAL_SEGMENTS = new Set([
  "r",
  "ref",
  "refer",
  "referral",
  "invite",
  "promo",
  "offer",
  "deal",
]);
const SHORTENER_HOSTS = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "buff.ly",
  "rebrand.ly",
  "shorturl.at",
  "ow.ly",
]);

export type ReferralTargetPattern =
  | "direct"
  | "query_param"
  | "path_segment"
  | "known_family"
  | "shortener";

export interface ReferralTargetResolution {
  originalUrl: string;
  sourceUrl: string;
  pattern: ReferralTargetPattern;
  preservedParams: string[];
  strippedParams: string[];
  referralParams: Record<string, string>;
  knownFamilyId?: string;
}

const trimToUndefined = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const parseUrl = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const isHttpUrl = (value: string | undefined): value is string => {
  if (!value) {
    return false;
  }

  const parsed = parseUrl(value);
  return parsed?.protocol === "http:" || parsed?.protocol === "https:";
};

const normalizeHost = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/^www\./u, "");

const isAnalyticsParamKey = (key: string): boolean => {
  const normalized = key.trim().toLowerCase();
  return (
    ANALYTICS_PARAM_KEYS.has(normalized) ||
    ANALYTICS_PARAM_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  );
};

const collectReferralParams = (url: URL): Record<string, string> => {
  const referralParams: Record<string, string> = {};

  for (const [key, value] of url.searchParams.entries()) {
    const normalizedKey = key.trim().toLowerCase();
    if (REFERRAL_PARAM_KEYS.has(normalizedKey) && trimToUndefined(value)) {
      referralParams[normalizedKey] = value.trim();
    }
  }

  return referralParams;
};

const stripAnalyticsParams = (
  url: URL,
): {
  preservedParams: string[];
  strippedParams: string[];
} => {
  const preservedParams: string[] = [];
  const strippedParams: string[] = [];

  const keys = [...new Set([...url.searchParams.keys()])];

  for (const key of keys) {
    const normalizedKey = key.trim().toLowerCase();
    if (isAnalyticsParamKey(normalizedKey)) {
      url.searchParams.delete(key);
      strippedParams.push(normalizedKey);
      continue;
    }

    if (REFERRAL_PARAM_KEYS.has(normalizedKey)) {
      preservedParams.push(normalizedKey);
    }
  }

  return {
    preservedParams: [...new Set(preservedParams)].sort(),
    strippedParams: [...new Set(strippedParams)].sort(),
  };
};

const isLikelyPathBasedReferral = (url: URL): boolean => {
  const segments = url.pathname
    .split("/")
    .map((segment) => segment.trim().toLowerCase())
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return false;
  }

  return segments.some((segment) => PATH_REFERRAL_SEGMENTS.has(segment));
};

export const extractClubOrangeReferralCode = (sourceUrl: string): string | null => {
  const parsed = parseUrl(sourceUrl);
  if (!parsed) {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  const normalizedHost = host.replace(/^www\./u, "");
  const segments = parsed.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (host === "signup.cluborange.org") {
    if (segments.length !== 2 || segments[0] !== "co") {
      return null;
    }

    return trimToUndefined(decodeURIComponent(segments[1] ?? "")) ?? null;
  }

  if (normalizedHost !== "cluborange.org") {
    return null;
  }

  if (segments.length !== 1 || segments[0] !== "signup") {
    return null;
  }

  return trimToUndefined(parsed.searchParams.get("referral") ?? undefined) ?? null;
};

export const buildClubOrangeReferralSignupUrl = (sourceUrl: string): string => {
  const referral = extractClubOrangeReferralCode(sourceUrl);
  if (!referral) {
    throw new Error(
      `Club Orange referral signup normalization only supports referral URLs. Got '${sourceUrl}'.`,
    );
  }

  const targetUrl = new URL("https://www.cluborange.org/signup");
  targetUrl.searchParams.set("referral", referral);
  return targetUrl.toString();
};

const resolveKnownFamilyTarget = (input: {
  originalUrl: string;
  candidateUrl: string;
}): {
  sourceUrl: string;
  pattern: ReferralTargetPattern;
  knownFamilyId: string;
} | null => {
  if (extractClubOrangeReferralCode(input.candidateUrl)) {
    return {
      sourceUrl: buildClubOrangeReferralSignupUrl(input.candidateUrl),
      pattern: "known_family",
      knownFamilyId: "cluborange-referral-signup",
    };
  }

  return null;
};

const isShortenerHost = (url: URL): boolean => SHORTENER_HOSTS.has(normalizeHost(url.hostname));

export const resolveReferralTarget = (input: {
  url: string;
  finalUrl?: string;
}): ReferralTargetResolution | null => {
  const originalUrl = trimToUndefined(input.url);
  if (!originalUrl || !isHttpUrl(originalUrl)) {
    return null;
  }

  const originalParsed = parseUrl(originalUrl);
  if (!originalParsed) {
    return null;
  }

  const candidateUrl =
    trimToUndefined(input.finalUrl) && isHttpUrl(input.finalUrl) ? input.finalUrl : originalUrl;

  const knownFamilyTarget = resolveKnownFamilyTarget({
    originalUrl,
    candidateUrl,
  });
  const parsed = parseUrl(knownFamilyTarget?.sourceUrl ?? candidateUrl);
  if (!parsed) {
    return null;
  }

  const { preservedParams, strippedParams } = stripAnalyticsParams(parsed);
  const referralParams = collectReferralParams(parsed);

  let pattern: ReferralTargetPattern = "direct";
  if (knownFamilyTarget) {
    pattern = knownFamilyTarget.pattern;
  } else if (candidateUrl !== originalUrl && isShortenerHost(originalParsed)) {
    pattern = "shortener";
  } else if (Object.keys(referralParams).length > 0) {
    pattern = "query_param";
  } else if (isLikelyPathBasedReferral(parsed)) {
    pattern = "path_segment";
  }

  return {
    originalUrl,
    sourceUrl: parsed.toString(),
    pattern,
    preservedParams,
    strippedParams,
    referralParams,
    knownFamilyId: knownFamilyTarget?.knownFamilyId,
  };
};
