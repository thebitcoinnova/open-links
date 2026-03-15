import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { stdin, stdout } from "node:process";
import { loadEmbeddedCode } from "../../shared/embedded-code-loader";
import { fetchWithRemoteCachePolicy } from "../../shared/remote-cache-fetch";
import { summarizeAuthFlowResult, waitForAuthenticatedSession } from "../auth-flow-runtime";
import {
  type BrowserSessionConfig,
  resolveAuthWaitSettings,
  resolveBrowserSessionConfig,
  runAgentBrowserJson,
} from "../browser-session";
import type {
  AuthFlowActionCandidate,
  AuthFlowSnapshot,
  AuthenticatedExtractorEnsureSessionResult,
  AuthenticatedExtractorExtractContext,
  AuthenticatedExtractorExtractResult,
  AuthenticatedExtractorPlugin,
  AuthenticatedExtractorSessionContext,
} from "../types";

const EXTRACTOR_ID = "facebook-auth-browser";
const EXTRACTOR_VERSION = "2026-03-15.1";
const SELECTOR_PROFILE = "facebook-profile-auth-v5";
const DEFAULT_FACEBOOK_AGENT_BROWSER_SESSION = "openlinks-facebook-auth";
const FACEBOOK_INSPECT_AUTH_FLOW_SNIPPET = loadEmbeddedCode(
  "browser/facebook/inspect-auth-flow.js",
);
const FACEBOOK_CLICK_TRUST_DEVICE_SNIPPET = loadEmbeddedCode(
  "browser/facebook/click-trust-device.js",
);
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const SHORT_VERIFY_TIMEOUT_MS = 8_000;

interface ResolvedProfileTarget {
  identifier: string;
  canonicalUrl: string;
}

interface FacebookInspection {
  snapshot: AuthFlowSnapshot;
  heading?: string;
  imageUrl?: string;
  metaImageUrl?: string;
}

interface FacebookImageCandidate {
  src: string;
  alt?: string;
  domScore?: number;
  width?: number;
  height?: number;
  sourceType?: string;
  ariaLabel?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const extensionFromContentType = (contentType: string | null): string | undefined => {
  const normalized = contentType?.split(";")[0]?.trim().toLowerCase();
  switch (normalized) {
    case "image/avif":
      return "avif";
    case "image/gif":
      return "gif";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/svg+xml":
      return "svg";
    case "image/x-icon":
    case "image/vnd.microsoft.icon":
      return "ico";
    default:
      return undefined;
  }
};

const extensionFromUrl = (sourceUrl: string): string | undefined => {
  try {
    const parsed = new URL(sourceUrl);
    const extension = path.posix.extname(parsed.pathname).replace(".", "").toLowerCase();
    if (!extension) {
      return undefined;
    }
    return extension === "jpeg" ? "jpg" : extension;
  } catch {
    return undefined;
  }
};

const safeTrim = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const requireInteractiveTerminal = () => {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error(
      "Interactive terminal is required for Facebook login. Run this command in a local TTY and retry.",
    );
  }
};

const resolveAgentConfig = (): BrowserSessionConfig =>
  resolveBrowserSessionConfig({
    defaultSession: DEFAULT_FACEBOOK_AGENT_BROWSER_SESSION,
    requireEncryptionKey: false,
  });

const toCookieHeader = (value: unknown): string | undefined => {
  const cookies = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.cookies)
      ? value.cookies
      : [];

  const pairs: string[] = [];
  for (const cookie of cookies) {
    if (!isRecord(cookie)) {
      continue;
    }
    const name = safeTrim(cookie.name);
    const cookieValue = safeTrim(cookie.value);
    if (!name || !cookieValue) {
      continue;
    }
    pairs.push(`${name}=${cookieValue}`);
  }

  return pairs.length > 0 ? pairs.join("; ") : undefined;
};

const resolveSourceLabel = (sourceUrl: string): string => {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "facebook.com";
  }
};

const decodeHtmlEntities = (value: string): string =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .trim();

const formatIdentifierDisplayName = (identifier: string): string => {
  const parts = identifier
    .split(/[._-]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return identifier;
  }

  if (parts.every((part) => /^\d+$/.test(part))) {
    return identifier;
  }

  return parts.map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join(" ");
};

const isGenericHeading = (heading: string): boolean =>
  /^(new|notifications?|friends?|messages?|menu|search|home|watch|marketplace|reels)$/i.test(
    heading.trim(),
  );

const detectPlaceholderSignals = (body: string): string[] => {
  const normalized = body.toLowerCase();
  const checks: Array<{ label: string; pattern: RegExp }> = [
    { label: "content_unavailable", pattern: /this content isn't available right now/i },
    { label: "login_wall", pattern: /log in|sign up for facebook/i },
    { label: "temporarily_blocked", pattern: /temporarily blocked|security check/i },
  ];

  const findings: string[] = [];
  for (const check of checks) {
    if (check.pattern.test(normalized)) {
      findings.push(check.label);
    }
  }

  return findings;
};

const isLikelyProfileImageUrl = (value: string | undefined): boolean => {
  if (!value) {
    return false;
  }

  const normalized = value.toLowerCase();
  if (normalized.startsWith("data:")) {
    return false;
  }

  const blockedPatterns = [
    /\/images\/emoji\.php/i,
    /\/emoji\.php/i,
    /\/images\/fb_icon_325x325\.png/i,
    /\/favicon\.ico/i,
    /static\.xx\.fbcdn\.net\/rsrc\.php/i,
    /facebook\.com\/rsrc\.php/i,
    /\/logos?\//i,
  ];

  if (blockedPatterns.some((pattern) => pattern.test(normalized))) {
    return false;
  }

  const positivePatterns = [
    /scontent/i,
    /lookaside/i,
    /\/v\/t39\./i,
    /profile/i,
    /photo/i,
    /picture/i,
  ];

  return positivePatterns.some((pattern) => pattern.test(normalized));
};

const extractEvalPayload = (value: unknown): Record<string, unknown> | null => {
  if (isRecord(value) && isRecord(value.result)) {
    return value.result;
  }
  if (isRecord(value)) {
    return value;
  }
  return null;
};

const extractStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => safeTrim(item)).filter((item): item is string => Boolean(item));
};

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const extractAreaHintFromUrl = (sourceUrl: string): number => {
  try {
    const parsed = new URL(sourceUrl);
    const stp = parsed.searchParams.get("stp")?.toLowerCase() ?? "";
    if (!stp) {
      return 0;
    }

    let maxArea = 0;
    for (const token of stp.split("_")) {
      const match = token.match(/^([sp])(\d{2,4})x(\d{2,4})$/i);
      if (!match) {
        continue;
      }

      const width = Number.parseInt(match[2], 10);
      const height = Number.parseInt(match[3], 10);
      if (!Number.isFinite(width) || !Number.isFinite(height)) {
        continue;
      }
      maxArea = Math.max(maxArea, width * height);
    }

    return maxArea;
  } catch {
    return 0;
  }
};

const hasFbCompressionHint = (sourceUrl: string): boolean => {
  const normalized = sourceUrl.toLowerCase();
  try {
    const parsed = new URL(sourceUrl);
    const stp = parsed.searchParams.get("stp")?.toLowerCase() ?? "";
    if (/(^|_)fb\d{1,3}(_|$)/.test(stp)) {
      return true;
    }
  } catch {
    return /(^|[_?&=-])fb\d{1,3}([_&]|$)/.test(normalized);
  }
  return false;
};

const extractMaxSideHintFromUrl = (sourceUrl: string): number => {
  try {
    const parsed = new URL(sourceUrl);
    const stp = parsed.searchParams.get("stp")?.toLowerCase() ?? "";
    if (!stp) {
      return 0;
    }

    let maxSide = 0;
    for (const token of stp.split("_")) {
      const match = token.match(/^([sp])(\d{2,4})x(\d{2,4})$/i);
      if (!match) {
        continue;
      }

      const width = Number.parseInt(match[2], 10);
      const height = Number.parseInt(match[3], 10);
      if (!Number.isFinite(width) || !Number.isFinite(height)) {
        continue;
      }

      maxSide = Math.max(maxSide, width, height);
    }

    return maxSide;
  } catch {
    return 0;
  }
};

const scoreProfileImageCandidate = (candidate: FacebookImageCandidate): number => {
  if (!isLikelyProfileImageUrl(candidate.src)) {
    return Number.NEGATIVE_INFINITY;
  }

  const normalized = candidate.src.toLowerCase();
  let score = candidate.domScore ?? 0;

  if (/scontent/.test(normalized)) {
    score += 40;
  }
  if (/lookaside/.test(normalized)) {
    score += 20;
  }
  if (/\/v\/t39\./.test(normalized)) {
    score += 20;
  }
  if (/profile|photo|picture/.test(normalized)) {
    score += 15;
  }
  if (/profile picture|profile/i.test(candidate.alt ?? "")) {
    score += 25;
  }
  if (candidate.sourceType === "role-img") {
    score += 45;
  }
  if (/profile|picture|avatar/i.test(candidate.ariaLabel ?? "")) {
    score += 50;
  }

  const domArea = Math.max(0, (candidate.width ?? 0) * (candidate.height ?? 0));
  if (domArea >= 250_000) {
    score += 30;
  } else if (domArea >= 65_536) {
    score += 10;
  }
  if (domArea > 700_000 || (candidate.width ?? 0) > 700 || (candidate.height ?? 0) > 700) {
    score -= 90;
  }
  const aspectRatio =
    candidate.width && candidate.height
      ? candidate.width / Math.max(candidate.height, 1)
      : undefined;
  if (aspectRatio && aspectRatio >= 0.85 && aspectRatio <= 1.2) {
    score += 25;
  } else if (aspectRatio) {
    score -= 15;
  }

  const areaHint = extractAreaHintFromUrl(candidate.src);
  if (areaHint >= 250_000) {
    score += 25;
  } else if (areaHint > 0 && areaHint < 65_536) {
    score -= 30;
  }

  const maxSideHint = extractMaxSideHintFromUrl(candidate.src);
  if (maxSideHint > 0 && maxSideHint <= 320) {
    score -= 110;
  } else if (maxSideHint >= 400) {
    score += 20;
  }

  if (hasFbCompressionHint(candidate.src)) {
    score -= 180;
  }
  if (/\/images\/emoji\.php|\/emoji\.php/.test(normalized)) {
    score -= 400;
  }

  return score;
};

const resolvePreferredProfileImage = (
  payload: Record<string, unknown> | null,
  explicitProfileImageUrl: string | undefined,
  metaImageUrl: string | undefined,
): string | undefined => {
  if (isLikelyProfileImageUrl(explicitProfileImageUrl)) {
    return explicitProfileImageUrl;
  }

  const imageCandidates = Array.isArray(payload?.imageCandidates) ? payload.imageCandidates : [];
  const candidates: FacebookImageCandidate[] = [];
  for (const candidate of imageCandidates) {
    if (!isRecord(candidate)) {
      continue;
    }

    const src = safeTrim(candidate.src);
    if (!src) {
      continue;
    }

    candidates.push({
      src,
      alt: safeTrim(candidate.alt),
      domScore: toFiniteNumber(candidate.score),
      width: toFiniteNumber(candidate.width),
      height: toFiniteNumber(candidate.height),
      sourceType: safeTrim(candidate.sourceType),
      ariaLabel: safeTrim(candidate.ariaLabel),
    });
  }

  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: scoreProfileImageCandidate(candidate),
    }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      const leftArea = (left.candidate.width ?? 0) * (left.candidate.height ?? 0);
      const rightArea = (right.candidate.width ?? 0) * (right.candidate.height ?? 0);
      return rightArea - leftArea;
    });

  if (ranked.length > 0) {
    return ranked[0]?.candidate.src;
  }

  return isLikelyProfileImageUrl(metaImageUrl) ? metaImageUrl : undefined;
};

const inspectFacebookFlow = async (config: BrowserSessionConfig): Promise<FacebookInspection> => {
  const evalResult = runAgentBrowserJson<unknown>(
    ["eval", FACEBOOK_INSPECT_AUTH_FLOW_SNIPPET],
    config,
    { allowFailure: true },
  );

  const payload = extractEvalPayload(evalResult.response?.data);
  const title = safeTrim(payload?.title);
  const currentUrl = safeTrim(payload?.currentUrl);
  const bodySnippet = safeTrim(payload?.bodySnippet);
  const heading = safeTrim(payload?.heading);
  const profileImageUrl = safeTrim(payload?.profileImage);
  const metaImageUrl = safeTrim(payload?.metaImage);
  const controls = extractStringArray(payload?.controls);
  const imageUrl = resolvePreferredProfileImage(payload, profileImageUrl, metaImageUrl);
  const lowerCombined = [title ?? "", bodySnippet ?? "", currentUrl ?? "", controls.join("\n")]
    .join("\n")
    .toLowerCase();

  const hasLoginSignals =
    payload?.hasPasswordField === true ||
    payload?.hasEmailField === true ||
    payload?.hasLoginForm === true ||
    /\/login|recover/i.test(currentUrl ?? "") ||
    /log in|forgot account\?/i.test(lowerCombined);

  const hasMfaSignals =
    /\/checkpoint|\/two_factor|remember_browser\/login_approvals|approvals_code/i.test(
      currentUrl ?? "",
    ) ||
    /two-factor|two factor|security code|authentication app|approve your login|enter the code/i.test(
      lowerCombined,
    );

  const hasTrustDeviceSignals =
    /\/remember_browser/i.test(currentUrl ?? "") ||
    /trust this device|remember browser|save browser|yes, trust/i.test(lowerCombined);

  const hasBlockedSignals = /temporarily blocked|account restricted|security check required/i.test(
    lowerCombined,
  );

  const placeholderSignals = detectPlaceholderSignals(bodySnippet ?? "");
  const signals = [...placeholderSignals];
  if (hasLoginSignals) {
    signals.push("login_required");
  }
  if (hasMfaSignals) {
    signals.push("mfa_challenge");
  }
  if (hasTrustDeviceSignals) {
    signals.push("trust_device_prompt");
  }
  if (!imageUrl) {
    signals.push("profile_image_missing");
  }
  if (hasBlockedSignals) {
    signals.push("blocked_state");
  }

  const actionCandidates: AuthFlowActionCandidate[] = [];
  if (hasTrustDeviceSignals) {
    const trustControl = controls.find((value) =>
      /trust this device|trust device|save browser|remember browser|yes, trust/i.test(
        value.toLowerCase(),
      ),
    );
    actionCandidates.push({
      actionId: "facebook.trust_device.confirm",
      label: trustControl ?? "Trust this device",
      kind: "click_button",
      risk: "low",
      confidence: trustControl ? 0.95 : 0.4,
      details: trustControl
        ? "Matched consent control text on trust-device screen."
        : "Detected trust-device screen but no exact button match was found.",
    });
  }

  const hasAuthenticatedMarkers =
    Boolean(heading) &&
    Boolean(imageUrl) &&
    !hasLoginSignals &&
    !hasMfaSignals &&
    !hasTrustDeviceSignals &&
    !hasBlockedSignals;

  const state = (() => {
    if (hasBlockedSignals) {
      return "blocked";
    }
    if (hasAuthenticatedMarkers) {
      return "authenticated";
    }
    if (hasTrustDeviceSignals) {
      return "post_auth_consent";
    }
    if (hasMfaSignals) {
      return "mfa_challenge";
    }
    if (hasLoginSignals) {
      return "login";
    }
    return "unknown";
  })();

  return {
    snapshot: {
      timestamp: new Date().toISOString(),
      state,
      currentUrl,
      title,
      signals: [...new Set(signals)],
      actionCandidates,
    },
    heading,
    imageUrl,
    metaImageUrl,
  };
};

const openFacebookTarget = (config: BrowserSessionConfig, sourceUrl: string, headed: boolean) => {
  runAgentBrowserJson(["open", sourceUrl], config, {
    extraArgs: headed ? ["--headed"] : [],
    allowFailure: true,
  });
  runAgentBrowserJson(["wait", "1500"], config, { allowFailure: true });
};

const waitForMs = (config: BrowserSessionConfig, durationMs: number): Promise<void> => {
  runAgentBrowserJson(["wait", String(Math.max(250, durationMs))], config, { allowFailure: true });
  return Promise.resolve();
};

const executeFacebookAction = async (
  config: BrowserSessionConfig,
  candidate: AuthFlowActionCandidate,
): Promise<{ success: boolean; details?: string }> => {
  if (candidate.actionId !== "facebook.trust_device.confirm") {
    return {
      success: false,
      details: `Unsupported action '${candidate.actionId}'.`,
    };
  }

  const result = runAgentBrowserJson<unknown>(
    ["eval", FACEBOOK_CLICK_TRUST_DEVICE_SNIPPET],
    config,
    { allowFailure: true },
  );

  const payload = extractEvalPayload(result.response?.data);
  if (payload?.clicked === true) {
    return {
      success: true,
      details: `clicked '${safeTrim(payload.label) ?? "trust_device"}'`,
    };
  }

  return {
    success: false,
    details: safeTrim(payload?.reason) ?? "no_matching_control",
  };
};

export const resolveFacebookProfileTarget = (sourceUrl: string): ResolvedProfileTarget => {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw new Error(`Invalid Facebook URL '${sourceUrl}' for extractor '${EXTRACTOR_ID}'.`);
  }

  const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
  if (hostname !== "facebook.com" && !hostname.endsWith(".facebook.com")) {
    throw new Error(
      `Facebook extractor only supports facebook.com hosts. Got '${parsed.hostname}' for '${sourceUrl}'.`,
    );
  }

  const segments = parsed.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  let identifier = "";
  if (segments[0] === "people") {
    identifier = safeTrim(segments[1]) ?? "";
    const profileId = safeTrim(segments[2]) ?? "";
    if (!identifier) {
      throw new Error(`Unable to resolve Facebook people-page identifier from '${sourceUrl}'.`);
    }
    if (!/^[A-Za-z0-9._-]{1,100}$/.test(identifier)) {
      throw new Error(`Resolved Facebook profile identifier '${identifier}' is not valid.`);
    }
    if (!/^\d{5,30}$/.test(profileId)) {
      throw new Error(`Resolved Facebook people-page id '${profileId}' is not valid.`);
    }

    return {
      identifier,
      canonicalUrl: `https://www.facebook.com/people/${identifier}/${profileId}/`,
    };
  }

  if (segments[0] === "profile.php") {
    identifier = safeTrim(parsed.searchParams.get("id")) ?? "";
  } else {
    identifier = segments[0] ?? "";
  }

  if (!identifier) {
    throw new Error(`Unable to resolve Facebook profile identifier from '${sourceUrl}'.`);
  }

  if (!/^[A-Za-z0-9._-]{1,100}$/.test(identifier)) {
    throw new Error(`Resolved Facebook profile identifier '${identifier}' is not valid.`);
  }

  return {
    identifier,
    canonicalUrl: `https://www.facebook.com/${identifier}`,
  };
};

const downloadImageAsset = async (
  config: BrowserSessionConfig,
  context: AuthenticatedExtractorExtractContext,
  sourceUrl: string,
): Promise<{
  path: string;
  sourceUrl: string;
  contentType: string;
  bytes: number;
  sha256: string;
  etag?: string;
  lastModified?: string;
}> => {
  const cookiesPayload = runAgentBrowserJson(["cookies", "get"], config, {
    allowFailure: true,
  }).response?.data;
  const cookieHeader = toCookieHeader(cookiesPayload);

  const headers: Record<string, string> = {
    "user-agent": USER_AGENT,
    accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
  };
  if (cookieHeader) {
    headers.cookie = cookieHeader;
  }

  const response = await fetchWithRemoteCachePolicy({
    url: sourceUrl,
    pipeline: "authenticated_asset_images",
    policyRegistry: context.remoteCachePolicyRegistry,
    timeoutMs: 10_000,
    headers,
    userAgent: USER_AGENT,
    bodyType: "buffer",
    force: true,
    cacheValueAvailable: false,
    statsCollector: context.remoteCacheStats,
  });

  if (response.kind !== "fetched") {
    throw new Error(
      `Facebook extractor image fetch failed: ${
        response.kind === "error" ? response.error : `unexpected result ${response.kind}`
      } for ${sourceUrl}`,
    );
  }

  const bytes = response.body as Buffer;
  if (bytes.byteLength === 0) {
    throw new Error("Facebook extractor image fetch returned empty body.");
  }

  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const extension =
    extensionFromContentType(response.headers.contentType ?? null) ??
    extensionFromUrl(sourceUrl) ??
    "jpg";
  const fileName = `${sha256}.${extension}`;

  fs.mkdirSync(context.publicAssetDirAbsolute, { recursive: true });
  fs.writeFileSync(path.join(context.publicAssetDirAbsolute, fileName), bytes);

  const relativePath = path.posix.join(
    context.publicAssetDirRelative.replaceAll("\\", "/"),
    fileName,
  );
  const contentType = response.headers.contentType ?? "application/octet-stream";

  return {
    path: relativePath,
    sourceUrl,
    contentType,
    bytes: bytes.byteLength,
    sha256,
    etag: response.headers.etag,
    lastModified: response.headers.lastModified,
  };
};

const verifySession = async (
  config: BrowserSessionConfig,
  targetUrl: string,
): Promise<AuthenticatedExtractorEnsureSessionResult> => {
  openFacebookTarget(config, targetUrl, false);

  try {
    const settings = resolveAuthWaitSettings();
    const result = await waitForAuthenticatedSession({
      timeoutMs: Math.min(settings.timeoutMs, SHORT_VERIFY_TIMEOUT_MS),
      pollMs: Math.min(settings.pollMs, 1_000),
      heartbeatMs: 4_000,
      logPrefix: `[${EXTRACTOR_ID}]`,
      promptOnActions: false,
      pauseOnUnknown: false,
      inspect: async () => (await inspectFacebookFlow(config)).snapshot,
      wait: async (durationMs) => waitForMs(config, durationMs),
    });

    return {
      verified: result.verified,
      details: summarizeAuthFlowResult(result),
      report: result.report,
    };
  } finally {
    runAgentBrowserJson(["close"], config, { allowFailure: true });
  }
};

const ensureSession = async (
  context: AuthenticatedExtractorSessionContext,
): Promise<AuthenticatedExtractorEnsureSessionResult> => {
  const target = resolveFacebookProfileTarget(context.targetUrl);
  const config = resolveAgentConfig();

  const initialCheck = await verifySession(config, target.canonicalUrl);
  if (initialCheck.verified) {
    return initialCheck;
  }

  requireInteractiveTerminal();

  const settings = resolveAuthWaitSettings();
  console.log("");
  console.log(`[${context.extractorId}] Facebook login required.`);
  console.log(
    `[${context.extractorId}] A headed browser will open. Complete login and any MFA/challenge screens.`,
  );
  console.log(
    `[${context.extractorId}] Consent actions (for example trust-device) are ask-first and require your confirmation.`,
  );
  console.log(
    `[${context.extractorId}] Waiting up to ${settings.timeoutMs}ms (poll ${settings.pollMs}ms).`,
  );

  openFacebookTarget(config, target.canonicalUrl, true);
  try {
    const result = await waitForAuthenticatedSession({
      timeoutMs: settings.timeoutMs,
      pollMs: settings.pollMs,
      heartbeatMs: 15_000,
      logPrefix: `[${context.extractorId}]`,
      promptOnActions: true,
      pauseOnUnknown: true,
      inspect: async () => (await inspectFacebookFlow(config)).snapshot,
      wait: async (durationMs) => waitForMs(config, durationMs),
      executeAction: async (candidate) => executeFacebookAction(config, candidate),
    });

    return {
      verified: result.verified,
      details: summarizeAuthFlowResult(result),
      report: result.report,
    };
  } finally {
    runAgentBrowserJson(["close"], config, { allowFailure: true });
  }
};

const extract = async (
  context: AuthenticatedExtractorExtractContext,
): Promise<AuthenticatedExtractorExtractResult> => {
  const config = resolveAgentConfig();
  const target = resolveFacebookProfileTarget(context.sourceUrl);

  const preCheck = await verifySession(config, target.canonicalUrl);
  if (!preCheck.verified) {
    const ensured = await ensureSession({
      extractorId: context.extractorId,
      targetUrl: target.canonicalUrl,
    });
    if (!ensured.verified) {
      throw new Error(`Facebook login verification failed. ${ensured.details ?? "unknown error"}`);
    }
  }

  openFacebookTarget(config, target.canonicalUrl, false);
  try {
    const inspection = await inspectFacebookFlow(config);
    if (inspection.snapshot.state !== "authenticated" || !inspection.imageUrl) {
      throw new Error(
        `Facebook extractor could not capture authenticated profile image. state=${inspection.snapshot.state}; signals=${
          inspection.snapshot.signals.join(",") || "none"
        }; url=${inspection.snapshot.currentUrl ?? "unknown"}`,
      );
    }

    const imageAsset = await downloadImageAsset(config, context, inspection.imageUrl);
    const ogImageAsset =
      inspection.metaImageUrl && inspection.metaImageUrl !== inspection.imageUrl
        ? await downloadImageAsset(config, context, inspection.metaImageUrl)
        : undefined;
    const decodedHeading = inspection.heading ? decodeHtmlEntities(inspection.heading) : undefined;
    const fallbackDisplayName = formatIdentifierDisplayName(target.identifier);
    const displayName =
      decodedHeading && !isGenericHeading(decodedHeading) ? decodedHeading : fallbackDisplayName;
    const title = `${displayName} on Facebook`;
    const description = `Profile and updates from ${displayName} on Facebook.`;

    return {
      capturedAt: new Date().toISOString(),
      metadata: {
        title,
        description,
        image: imageAsset.path,
        profileImage: imageAsset.path,
        ogImage: ogImageAsset?.path,
        sourceLabel: resolveSourceLabel(context.sourceUrl),
      },
      assets: {
        image: {
          path: imageAsset.path,
          sourceUrl: imageAsset.sourceUrl,
          contentType: imageAsset.contentType,
          bytes: imageAsset.bytes,
          sha256: imageAsset.sha256,
          etag: imageAsset.etag,
          lastModified: imageAsset.lastModified,
        },
        profileImage: {
          path: imageAsset.path,
          sourceUrl: imageAsset.sourceUrl,
          contentType: imageAsset.contentType,
          bytes: imageAsset.bytes,
          sha256: imageAsset.sha256,
          etag: imageAsset.etag,
          lastModified: imageAsset.lastModified,
        },
        ogImage: ogImageAsset
          ? {
              path: ogImageAsset.path,
              sourceUrl: ogImageAsset.sourceUrl,
              contentType: ogImageAsset.contentType,
              bytes: ogImageAsset.bytes,
              sha256: ogImageAsset.sha256,
              etag: ogImageAsset.etag,
              lastModified: ogImageAsset.lastModified,
            }
          : undefined,
      },
      diagnostics: {
        extractorVersion: EXTRACTOR_VERSION,
        selectorProfile: SELECTOR_PROFILE,
        placeholderSignals: inspection.snapshot.signals,
        capturedFromUrl: inspection.snapshot.currentUrl ?? target.canonicalUrl,
        notes: [
          `cacheKey=${context.cacheKey}`,
          `identifier=${target.identifier}`,
          `authState=${inspection.snapshot.state}`,
          `session=${config.session}`,
          `sessionName=${config.sessionName}`,
        ],
      },
    };
  } finally {
    runAgentBrowserJson(["close"], config, { allowFailure: true });
  }
};

export const facebookAuthBrowserExtractor: AuthenticatedExtractorPlugin = {
  id: EXTRACTOR_ID,
  ensureSession,
  extract,
};
