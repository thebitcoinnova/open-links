import { resolveReferralTarget } from "../enrichment/referral-targets";
import type { ReferralTermsPolicyResult, ReferralTermsPolicyStatus } from "./import-contract";

interface TermsPolicyRule {
  id: string;
  status: Extract<ReferralTermsPolicyStatus, "public_allowed" | "public_forbidden">;
  patterns: RegExp[];
}

interface TermsPolicyPageCandidate {
  score: number;
  url: string;
}

interface TermsPolicyPageResult {
  contentType?: string;
  html?: string;
  reason?: string;
  url: string;
}

interface TermsPolicyMatch {
  id: string;
  snippet: string;
  status: Extract<ReferralTermsPolicyStatus, "public_allowed" | "public_forbidden">;
}

export interface CheckReferralTermsPolicyInput {
  referralUrl: string;
  termsUrl?: string;
}

const TERMS_POLICY_STATUSES: ReferralTermsPolicyStatus[] = [
  "public_forbidden",
  "public_allowed",
  "ambiguous",
  "not_found",
];

const TERMS_POLICY_RULES: TermsPolicyRule[] = [
  {
    id: "only_share_with_people_you_know",
    status: "public_forbidden",
    patterns: [
      /\bonly\s+(?:share|send)\s+(?:this|the)?\s*(?:referral\s+)?link\s+with\s+people\s+you\s+know\b/iu,
      /\bmay\s+only\s+be\s+shared\s+with\s+people\s+you\s+know\b/iu,
    ],
  },
  {
    id: "no_public_posting",
    status: "public_forbidden",
    patterns: [
      /\bmay\s+not\s+publicly\s+post\b/iu,
      /\bmust\s+not\s+publicly\s+post\b/iu,
      /\bmust\s+not\s+publish\s+or\s+distribute\b.{0,140}\b(?:online|publicly)\b/iu,
      /\bmay\s+not\s+publish\s+or\s+distribute\b.{0,140}\b(?:online|publicly)\b/iu,
    ],
  },
  {
    id: "family_and_friends_only",
    status: "public_forbidden",
    patterns: [
      /\bfamily\s+and\s+personal\s+friends(?:\s+and\s+acquaintances)?\b/iu,
      /\bpeople\s+who\s+are\s+not\s+your\s+family\s+or\s+personal\s+friends(?:\s+and\s+acquaintances)?\b/iu,
    ],
  },
  {
    id: "public_sharing_allowed",
    status: "public_allowed",
    patterns: [
      /\bmay\s+publicly\s+share\b/iu,
      /\bcan\s+publicly\s+share\b/iu,
      /\bpublic\s+sharing\s+is\s+allowed\b/iu,
      /\bshare\s+(?:your|the)?\s*(?:referral\s+)?link\s+publicly\b/iu,
      /\bshare\s+with\s+anyone\b/iu,
      /\bpost\s+(?:your|the)?\s*(?:referral\s+)?link\s+(?:publicly|online)\b/iu,
    ],
  },
];

const URL_DISCOVERY_KEYWORDS = [
  "agreement",
  "faq",
  "help",
  "invite",
  "legal",
  "policy",
  "promo",
  "referral",
  "terms",
] as const;

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_FETCHES = 5;
const MAX_SNIPPET_LENGTH = 220;

const trimToUndefined = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const canonicalizeHttpUrl = (value: string | undefined): string | undefined => {
  const maybeValue = trimToUndefined(value);
  if (!maybeValue) {
    return undefined;
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(maybeValue);
  } catch {
    return undefined;
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return undefined;
  }

  parsedUrl.hash = "";
  parsedUrl.hostname = parsedUrl.hostname.toLowerCase();

  if (
    (parsedUrl.protocol === "https:" && parsedUrl.port === "443") ||
    (parsedUrl.protocol === "http:" && parsedUrl.port === "80")
  ) {
    parsedUrl.port = "";
  }

  if (parsedUrl.pathname.length > 1) {
    parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/u, "");
  }

  const sortedQueryEntries = [...parsedUrl.searchParams.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
  parsedUrl.search = "";
  for (const [key, candidate] of sortedQueryEntries) {
    parsedUrl.searchParams.append(key, candidate);
  }

  return parsedUrl.toString();
};

const normalizeWhitespace = (value: string): string => value.replace(/\s+/gu, " ").trim();

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'")
    .replace(/&#x27;/giu, "'")
    .replace(/&#x2F;/giu, "/")
    .replace(/&#x3D;/giu, "=");

const extractVisibleText = (html: string): string => {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/gu, " ");
  const withoutScriptAndStyle = withoutComments.replace(
    /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/giu,
    " ",
  );
  const withoutTags = withoutScriptAndStyle.replace(/<[^>]+>/gu, " ");
  return normalizeWhitespace(decodeHtmlEntities(withoutTags));
};

const excerptAround = (text: string, index: number, matchLength: number): string => {
  const start = Math.max(0, index - 70);
  const end = Math.min(text.length, index + Math.max(matchLength, 24) + 90);
  return text.slice(start, end).trim();
};

const buildRelevantSnippet = (text: string): string | undefined => {
  const maybeKeywordMatch = /\b(referral|invite|promo|affiliate|share|terms|faq|help)\b/iu.exec(
    text,
  );
  if (maybeKeywordMatch?.index !== undefined) {
    return excerptAround(text, maybeKeywordMatch.index, maybeKeywordMatch[0].length);
  }

  return trimToUndefined(text.slice(0, MAX_SNIPPET_LENGTH));
};

const classifyTermsText = (text: string): TermsPolicyMatch | undefined => {
  for (const rule of TERMS_POLICY_RULES) {
    for (const pattern of rule.patterns) {
      const maybeMatch = pattern.exec(text);
      if (!maybeMatch || maybeMatch.index === undefined) {
        continue;
      }

      return {
        id: rule.id,
        status: rule.status,
        snippet: excerptAround(text, maybeMatch.index, maybeMatch[0].length),
      };
    }
  }

  return undefined;
};

const scoreDiscoveredUrl = (url: string, tagMarkup: string): number => {
  const maybeCanonicalUrl = canonicalizeHttpUrl(url);
  if (!maybeCanonicalUrl) {
    return 0;
  }

  if (/\.(?:avif|css|gif|ico|jpe?g|js|json|png|svg|webp)(?:$|\?)/iu.test(maybeCanonicalUrl)) {
    return 0;
  }

  const haystack = `${tagMarkup} ${maybeCanonicalUrl.toLowerCase()}`;
  let score = 0;

  if (haystack.includes("canonical")) {
    score += 10;
  }
  if (haystack.includes("og:url")) {
    score += 25;
  }
  if (haystack.includes("help.")) {
    score += 20;
  }
  if (haystack.includes("support.")) {
    score += 16;
  }

  for (const keyword of URL_DISCOVERY_KEYWORDS) {
    if (haystack.includes(keyword)) {
      score += keyword === "terms" || keyword === "help" || keyword === "faq" ? 24 : 12;
    }
  }

  return score;
};

const extractDiscoveredTermsCandidates = (
  html: string,
  baseUrl: string,
): TermsPolicyPageCandidate[] => {
  const candidatesByUrl = new Map<string, TermsPolicyPageCandidate>();
  const tagWithUrlPattern = /<(a|link|meta)\b[^>]*(href|content)=["']([^"']+)["'][^>]*>/giu;

  for (const match of html.matchAll(tagWithUrlPattern)) {
    const maybeTagMarkup = trimToUndefined(match[0]);
    const maybeRawUrl = trimToUndefined(match[3]);
    if (!maybeTagMarkup || !maybeRawUrl) {
      continue;
    }

    let resolvedUrl: string;

    try {
      resolvedUrl = new URL(maybeRawUrl, baseUrl).toString();
    } catch {
      continue;
    }

    const score = scoreDiscoveredUrl(resolvedUrl, maybeTagMarkup.toLowerCase());
    if (score <= 0) {
      continue;
    }

    const maybeCanonicalUrl = canonicalizeHttpUrl(resolvedUrl);
    if (!maybeCanonicalUrl) {
      continue;
    }

    const maybeExisting = candidatesByUrl.get(maybeCanonicalUrl);
    if (!maybeExisting || score > maybeExisting.score) {
      candidatesByUrl.set(maybeCanonicalUrl, {
        score,
        url: maybeCanonicalUrl,
      });
    }
  }

  return [...candidatesByUrl.values()].sort((left, right) => right.score - left.score);
};

const fetchTermsPage = async (url: string): Promise<TermsPolicyPageResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "user-agent": "open-links-referral-terms-check/0.1",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    const maybeContentType = trimToUndefined(response.headers.get("content-type") ?? undefined);

    if (!maybeContentType?.toLowerCase().includes("html")) {
      return {
        contentType: maybeContentType,
        reason: maybeContentType ? `non_html_response:${maybeContentType}` : "non_html_response",
        url: response.url || url,
      };
    }

    return {
      contentType: maybeContentType,
      html: await response.text(),
      url: response.url || url,
    };
  } catch (error) {
    return {
      reason:
        error instanceof Error ? `fetch_failed:${error.message}` : "fetch_failed:unknown_error",
      url,
    };
  } finally {
    clearTimeout(timeout);
  }
};

const queueTermsCandidate = (
  queue: TermsPolicyPageCandidate[],
  seenUrls: Set<string>,
  candidate: TermsPolicyPageCandidate | undefined,
): void => {
  if (!candidate) {
    return;
  }

  const maybeCanonicalUrl = canonicalizeHttpUrl(candidate.url);
  if (!maybeCanonicalUrl || seenUrls.has(maybeCanonicalUrl)) {
    return;
  }

  const maybeExisting = queue.find((queued) => queued.url === maybeCanonicalUrl);
  if (maybeExisting) {
    maybeExisting.score = Math.max(maybeExisting.score, candidate.score);
    return;
  }

  queue.push({
    score: candidate.score,
    url: maybeCanonicalUrl,
  });
  queue.sort((left, right) => right.score - left.score);
};

const buildInitialTermsCandidates = (
  input: CheckReferralTermsPolicyInput,
): TermsPolicyPageCandidate[] => {
  const maybeReferralUrl = canonicalizeHttpUrl(input.referralUrl);
  if (!maybeReferralUrl) {
    return [];
  }

  const queue: TermsPolicyPageCandidate[] = [];
  const seenUrls = new Set<string>();
  const maybeReferralTarget = resolveReferralTarget({ url: maybeReferralUrl });

  queueTermsCandidate(queue, seenUrls, {
    score: 100,
    url: canonicalizeHttpUrl(input.termsUrl) ?? "",
  });
  queueTermsCandidate(queue, seenUrls, {
    score: 96,
    url: canonicalizeHttpUrl(maybeReferralTarget?.catalogReferral?.termsUrl) ?? "",
  });
  queueTermsCandidate(queue, seenUrls, {
    score: 84,
    url: canonicalizeHttpUrl(maybeReferralTarget?.catalog?.canonicalProgramUrl) ?? "",
  });
  queueTermsCandidate(queue, seenUrls, {
    score: 10,
    url: maybeReferralTarget?.sourceUrl ?? maybeReferralUrl,
  });

  return queue;
};

export const normalizeReferralTermsPolicyResult = (
  value: unknown,
): ReferralTermsPolicyResult | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const maybeStatus = trimToUndefined(value.status);
  if (!maybeStatus || !TERMS_POLICY_STATUSES.includes(maybeStatus as ReferralTermsPolicyStatus)) {
    return undefined;
  }

  const maybeNormalizedSourceUrl =
    canonicalizeHttpUrl(trimToUndefined(value.normalizedSourceUrl)) ??
    canonicalizeHttpUrl(trimToUndefined(value.checkedUrl));
  if (!maybeNormalizedSourceUrl) {
    return undefined;
  }

  const normalized: ReferralTermsPolicyResult = {
    status: maybeStatus as ReferralTermsPolicyStatus,
    normalizedSourceUrl: maybeNormalizedSourceUrl,
  };

  const maybeCheckedUrl = canonicalizeHttpUrl(trimToUndefined(value.checkedUrl));
  if (maybeCheckedUrl) {
    normalized.checkedUrl = maybeCheckedUrl;
  }

  const maybeMatchedRuleId = trimToUndefined(value.matchedRuleId);
  if (maybeMatchedRuleId) {
    normalized.matchedRuleId = maybeMatchedRuleId;
  }

  const maybeEvidenceSnippet = trimToUndefined(value.evidenceSnippet);
  if (maybeEvidenceSnippet) {
    normalized.evidenceSnippet = normalizeWhitespace(maybeEvidenceSnippet).slice(
      0,
      MAX_SNIPPET_LENGTH,
    );
  }

  const maybeReason = trimToUndefined(value.reason);
  if (maybeReason) {
    normalized.reason = maybeReason;
  }

  return normalized;
};

export const checkReferralTermsPolicy = async (
  input: CheckReferralTermsPolicyInput,
): Promise<ReferralTermsPolicyResult> => {
  const maybeReferralUrl = canonicalizeHttpUrl(input.referralUrl);
  if (!maybeReferralUrl) {
    return {
      status: "not_found",
      normalizedSourceUrl: trimToUndefined(input.referralUrl) ?? "",
      reason: "missing_valid_http_url",
    };
  }

  const maybeReferralTarget = resolveReferralTarget({ url: maybeReferralUrl });
  const normalizedSourceUrl = maybeReferralTarget?.sourceUrl ?? maybeReferralUrl;
  const queue = buildInitialTermsCandidates(input);
  const visitedUrls = new Set<string>();
  const failureReasons: string[] = [];
  let maybeAmbiguousResult: ReferralTermsPolicyResult | undefined;

  while (queue.length > 0 && visitedUrls.size < MAX_FETCHES) {
    const maybeCandidate = queue.shift();
    if (!maybeCandidate) {
      break;
    }

    const maybeCandidateUrl = canonicalizeHttpUrl(maybeCandidate.url);
    if (!maybeCandidateUrl || visitedUrls.has(maybeCandidateUrl)) {
      continue;
    }

    visitedUrls.add(maybeCandidateUrl);

    const pageResult = await fetchTermsPage(maybeCandidateUrl);
    if (!pageResult.html) {
      if (pageResult.reason) {
        failureReasons.push(`${maybeCandidateUrl}:${pageResult.reason}`);
      }
      continue;
    }

    const visibleText = extractVisibleText(pageResult.html);
    const maybeMatch = classifyTermsText(visibleText);
    if (maybeMatch) {
      return {
        status: maybeMatch.status,
        normalizedSourceUrl,
        checkedUrl: pageResult.url,
        matchedRuleId: maybeMatch.id,
        evidenceSnippet: maybeMatch.snippet,
      };
    }

    maybeAmbiguousResult ??= {
      status: "ambiguous",
      normalizedSourceUrl,
      checkedUrl: pageResult.url,
      evidenceSnippet: buildRelevantSnippet(visibleText),
      reason: "no_conclusive_public_sharing_policy_language",
    };

    for (const discoveredCandidate of extractDiscoveredTermsCandidates(
      pageResult.html,
      pageResult.url,
    )) {
      queueTermsCandidate(queue, visitedUrls, discoveredCandidate);
    }
  }

  if (maybeAmbiguousResult) {
    return maybeAmbiguousResult;
  }

  return {
    status: "not_found",
    normalizedSourceUrl,
    checkedUrl: canonicalizeHttpUrl(input.termsUrl) ?? normalizedSourceUrl,
    reason: failureReasons[0] ?? "no_public_terms_page_found",
  };
};
