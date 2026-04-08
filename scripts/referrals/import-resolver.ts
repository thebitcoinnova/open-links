import { resolveReferralTarget } from "../enrichment/referral-targets";
import type {
  ReferralImportCandidateResolution,
  ReferralImportPlausibleUrl,
  ReferralImportRedirectHop,
  ReferralImportResolveReport,
  ReferralImportResolveReportItem,
  ReferralInboxCandidateInput,
} from "./import-contract";
import {
  DEFAULT_REFERRAL_IMPORT_INPUT_PATH,
  DEFAULT_REFERRAL_IMPORT_RESOLVED_PATH,
} from "./import-contract";
import { checkReferralTermsPolicy } from "./terms-policy";

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 1;
const DEFAULT_RETRY_DELAY_MS = 250;
const DEFAULT_MAX_HOPS = 8;
const USER_AGENT = "open-links-referral-resolver/0.1";

const TRACKING_HOST_PATTERNS = [
  /^ablink\./u,
  /^click\./u,
  /^email\./u,
  /^go\./u,
  /^links\./u,
  /^lnk\./u,
  /^news\./u,
  /^track\./u,
];
const TRACKING_HOSTS = new Set([
  "links.notify.chime.com",
  "links.foldapp.com",
  "track.customer.io",
]);
const NON_CANDIDATE_HOST_SUFFIXES = [".app.link"] as const;
const NON_CANDIDATE_PATH_PATTERNS = [
  /\/auth(?:\/|$)/iu,
  /\/help(?:\/|$)/iu,
  /\/legal(?:\/|$)/iu,
  /\/login(?:\/|$)/iu,
  /\/privacy(?:\/|$)/iu,
  /\/signin(?:\/|$)/iu,
  /\/support(?:\/|$)/iu,
  /\/terms(?:\/|$)/iu,
  /\/unsubscribe(?:\/|$)/iu,
];
const NON_CANDIDATE_TEXT_PATTERNS = [
  /\bauthwall\b/iu,
  /\bfacebook\b/iu,
  /\bhelp\b/iu,
  /\binstagram\b/iu,
  /\blearn more\b/iu,
  /\blegal\b/iu,
  /\blinkedin\b/iu,
  /\blogin\b/iu,
  /\bmanage preferences\b/iu,
  /\bprivacy\b/iu,
  /\bsign in\b/iu,
  /\bsupport\b/iu,
  /\bterms\b/iu,
  /\btiktok\b/iu,
  /\btwitter\b/iu,
  /\bunsubscribe\b/iu,
  /\byoutube\b/iu,
];

interface RequestAttemptSuccess {
  ok: true;
  response: Response;
}

interface RequestAttemptFailure {
  ok: false;
  error: string;
}

type RequestAttemptResult = RequestAttemptSuccess | RequestAttemptFailure;

interface RedirectAuditResult {
  hops: ReferralImportRedirectHop[];
  terminalUrl?: string;
  terminalStatusCode?: number;
  terminalContentType?: string;
  terminalTitle?: string;
  reason?: string;
}

interface ResolveCandidateResult {
  candidate: ReferralInboxCandidateInput;
  reportItem: ReferralImportResolveReportItem;
}

export interface ResolveReferralImportCandidatesInput {
  candidates: ReferralInboxCandidateInput[];
  inputPath?: string;
  outputPath?: string;
}

export interface ResolveReferralImportCandidatesOutput {
  candidates: ReferralInboxCandidateInput[];
  report: ReferralImportResolveReport;
}

const trimToUndefined = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseUrl = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const isHttpUrl = (value: string | undefined): value is string => {
  const parsed = value ? parseUrl(value) : null;
  return parsed?.protocol === "http:" || parsed?.protocol === "https:";
};

const normalizeHost = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/^www\./u, "");

const canonicalizePlausibleUrlKey = (value: string): string | undefined => {
  const parsed = parseUrl(value);
  if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
    return undefined;
  }

  parsed.hash = "";
  parsed.hostname = normalizeHost(parsed.hostname);

  if (
    (parsed.protocol === "https:" && parsed.port === "443") ||
    (parsed.protocol === "http:" && parsed.port === "80")
  ) {
    parsed.port = "";
  }

  if (parsed.pathname.length > 1) {
    parsed.pathname = parsed.pathname.replace(/\/+$/u, "");
  }

  const sortedQueryEntries = [...parsed.searchParams.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
  parsed.search = "";
  for (const [key, candidate] of sortedQueryEntries) {
    parsed.searchParams.append(key, candidate);
  }

  return parsed.toString();
};

const delay = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const fetchWithRetries = async (url: string): Promise<RequestAttemptResult> => {
  let lastError = "Unknown fetch error";

  for (let attempt = 0; attempt <= DEFAULT_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        },
      });
      return {
        ok: true,
        response,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < DEFAULT_RETRIES && DEFAULT_RETRY_DELAY_MS > 0) {
      await delay(DEFAULT_RETRY_DELAY_MS);
    }
  }

  return {
    ok: false,
    error: lastError,
  };
};

const resolveLocationUrl = (requestUrl: string, locationHeader: string): string | undefined => {
  try {
    return new URL(locationHeader, requestUrl).toString();
  } catch {
    return undefined;
  }
};

const extractTitle = (html: string): string | undefined => {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/iu);
  return trimToUndefined(match?.[1]);
};

const auditRedirectChain = async (url: string): Promise<RedirectAuditResult> => {
  const hops: ReferralImportRedirectHop[] = [];
  let currentUrl = url;

  for (let hopIndex = 0; hopIndex < DEFAULT_MAX_HOPS; hopIndex += 1) {
    const requestResult = await fetchWithRetries(currentUrl);
    if (!requestResult.ok) {
      hops.push({
        requestUrl: currentUrl,
        error: requestResult.error,
      });
      return {
        hops,
        terminalUrl: currentUrl,
        reason: `network_error:${requestResult.error}`,
      };
    }

    const response = requestResult.response;
    const statusCode = response.status;
    const contentType = trimToUndefined(response.headers.get("content-type") ?? undefined);

    if (REDIRECT_STATUS_CODES.has(statusCode)) {
      const locationHeader = trimToUndefined(response.headers.get("location") ?? undefined);
      const locationUrl = locationHeader
        ? resolveLocationUrl(currentUrl, locationHeader)
        : undefined;
      hops.push({
        requestUrl: currentUrl,
        statusCode,
        locationUrl,
      });

      if (!locationHeader) {
        return {
          hops,
          terminalUrl: currentUrl,
          terminalStatusCode: statusCode,
          reason: "redirect_missing_location",
        };
      }

      if (!locationUrl) {
        return {
          hops,
          terminalUrl: currentUrl,
          terminalStatusCode: statusCode,
          reason: "redirect_invalid_location",
        };
      }

      if (!isHttpUrl(locationUrl)) {
        return {
          hops,
          terminalUrl: locationUrl,
          terminalStatusCode: statusCode,
          reason: "redirect_non_http_target",
        };
      }

      currentUrl = locationUrl;
      continue;
    }

    const body = await response.text();
    const title = extractTitle(body);
    hops.push({
      requestUrl: currentUrl,
      statusCode,
      contentType,
      title,
    });

    return {
      hops,
      terminalUrl: currentUrl,
      terminalStatusCode: statusCode,
      terminalContentType: contentType,
      terminalTitle: title,
    };
  }

  hops.push({
    requestUrl: currentUrl,
    error: "redirect_hop_limit_exceeded",
  });
  return {
    hops,
    terminalUrl: currentUrl,
    reason: "redirect_hop_limit_exceeded",
  };
};

const isTrackingHost = (url: URL): boolean => {
  const host = normalizeHost(url.hostname);
  return TRACKING_HOSTS.has(host) || TRACKING_HOST_PATTERNS.some((pattern) => pattern.test(host));
};

const isNonCandidateUrl = (value: string, title: string | undefined): boolean => {
  const parsed = parseUrl(value);
  if (!parsed) {
    return true;
  }

  const host = normalizeHost(parsed.hostname);
  const hostBlocked = NON_CANDIDATE_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
  if (hostBlocked) {
    return true;
  }

  const pathAndQuery = `${parsed.pathname}${parsed.search}`.toLowerCase();
  if (NON_CANDIDATE_PATH_PATTERNS.some((pattern) => pattern.test(pathAndQuery))) {
    return true;
  }

  const combined = `${host} ${pathAndQuery} ${title ?? ""}`;
  return NON_CANDIDATE_TEXT_PATTERNS.some((pattern) => pattern.test(combined));
};

const scorePattern = (pattern: string): number => {
  switch (pattern) {
    case "known_family":
      return 400;
    case "query_param":
      return 320;
    case "path_segment":
      return 280;
    case "shortener":
      return 200;
    default:
      return 0;
  }
};

const collectChainUrls = (audit: RedirectAuditResult): { url: string; hopIndex: number }[] => {
  const urls: { url: string; hopIndex: number }[] = [];
  const seen = new Set<string>();

  audit.hops.forEach((hop, hopIndex) => {
    if (isHttpUrl(hop.requestUrl) && !seen.has(hop.requestUrl)) {
      seen.add(hop.requestUrl);
      urls.push({ url: hop.requestUrl, hopIndex });
    }

    if (isHttpUrl(hop.locationUrl) && !seen.has(hop.locationUrl)) {
      seen.add(hop.locationUrl);
      urls.push({ url: hop.locationUrl, hopIndex });
    }
  });

  if (isHttpUrl(audit.terminalUrl) && !seen.has(audit.terminalUrl)) {
    urls.push({ url: audit.terminalUrl, hopIndex: audit.hops.length - 1 });
  }

  return urls;
};

const buildPlausibleUrls = (audit: RedirectAuditResult): ReferralImportPlausibleUrl[] => {
  const candidates = new Map<string, ReferralImportPlausibleUrl>();

  for (const candidate of collectChainUrls(audit)) {
    const parsed = parseUrl(candidate.url);
    if (!parsed) {
      continue;
    }

    if (isTrackingHost(parsed)) {
      continue;
    }

    if (isNonCandidateUrl(candidate.url, audit.terminalTitle)) {
      continue;
    }

    const target = resolveReferralTarget({ url: candidate.url });
    if (!target) {
      continue;
    }

    if (target.pattern === "direct" && !target.knownFamilyId) {
      continue;
    }

    const score = scorePattern(target.pattern);
    if (score <= 0) {
      continue;
    }

    const entry: ReferralImportPlausibleUrl = {
      url: candidate.url,
      sourceUrl: target.sourceUrl,
      pattern: target.pattern,
      score,
      hopIndex: candidate.hopIndex,
      knownFamilyId: target.knownFamilyId,
    };
    const dedupeKey = canonicalizePlausibleUrlKey(entry.sourceUrl) ?? entry.sourceUrl;
    const existing = candidates.get(dedupeKey);
    if (!existing || entry.score > existing.score || entry.hopIndex < existing.hopIndex) {
      candidates.set(dedupeKey, entry);
    }
  }

  return [...candidates.values()].sort(
    (left, right) => right.score - left.score || left.hopIndex - right.hopIndex,
  );
};

const buildResolution = (
  originalUrl: string,
  audit: RedirectAuditResult,
  plausibleUrls: ReferralImportPlausibleUrl[],
): ReferralImportCandidateResolution => {
  const base: ReferralImportCandidateResolution = {
    status: "unresolved",
    originalUrl,
    resolvedUrl: trimToUndefined(audit.terminalUrl),
    terminalStatusCode: audit.terminalStatusCode,
    terminalTitle: audit.terminalTitle,
  };

  if (plausibleUrls.length === 1) {
    return {
      ...base,
      status: "resolved_clear",
      recommendedUrl: plausibleUrls[0]?.sourceUrl,
    };
  }

  if (plausibleUrls.length > 1) {
    return {
      ...base,
      status: "review_required",
      reviewReason: "multiple plausible referral URLs found in redirect chain",
      reason: "multiple_plausible_urls",
    };
  }

  return {
    ...base,
    reason: audit.reason ?? "no_plausible_referral_url",
  };
};

const resolveCandidate = async (
  candidate: ReferralInboxCandidateInput,
): Promise<ResolveCandidateResult> => {
  const originalUrl = trimToUndefined(candidate.url);
  if (!isHttpUrl(originalUrl)) {
    const resolution: ReferralImportCandidateResolution = {
      status: "unresolved",
      originalUrl: originalUrl ?? "",
      reason: "missing_valid_http_url",
    };
    return {
      candidate: {
        ...candidate,
        resolution,
      },
      reportItem: {
        candidateId: trimToUndefined(candidate.candidateId) ?? "candidate",
        originalUrl,
        approvedUrl: trimToUndefined(candidate.approvedUrl),
        resolution,
        hops: [],
        plausibleUrls: [],
      },
    };
  }

  const audit = await auditRedirectChain(originalUrl);
  const plausibleUrls = buildPlausibleUrls(audit);
  const resolution = buildResolution(originalUrl, audit, plausibleUrls);
  const maybeTermsCheckUrl =
    trimToUndefined(candidate.approvedUrl) ?? trimToUndefined(resolution.recommendedUrl);
  const termsPolicy = maybeTermsCheckUrl
    ? await checkReferralTermsPolicy({
        referralUrl: maybeTermsCheckUrl,
        termsUrl: trimToUndefined(candidate.termsUrlHint),
      })
    : undefined;

  return {
    candidate: {
      ...candidate,
      resolution,
      termsPolicy,
    },
    reportItem: {
      candidateId: trimToUndefined(candidate.candidateId) ?? "candidate",
      originalUrl,
      approvedUrl: trimToUndefined(candidate.approvedUrl),
      resolution,
      termsPolicy,
      hops: audit.hops,
      plausibleUrls,
    },
  };
};

export const resolveReferralImportCandidates = async (
  input: ResolveReferralImportCandidatesInput,
): Promise<ResolveReferralImportCandidatesOutput> => {
  const results = await Promise.all(
    input.candidates.map((candidate) => resolveCandidate(candidate)),
  );

  return {
    candidates: results.map((result) => result.candidate),
    report: {
      version: 1,
      generatedAt: new Date().toISOString(),
      inputPath: input.inputPath ?? DEFAULT_REFERRAL_IMPORT_INPUT_PATH,
      outputPath: input.outputPath ?? DEFAULT_REFERRAL_IMPORT_RESOLVED_PATH,
      items: results.map((result) => result.reportItem),
    },
  };
};
