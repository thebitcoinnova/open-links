import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { stdin, stdout } from "node:process";
import {
  resolveAuthWaitSettings,
  runAgentBrowserJson,
  type SessionConfig
} from "../../oneoff/linkedin-debug-common";
import type {
  AuthenticatedExtractorEnsureSessionResult,
  AuthenticatedExtractorExtractContext,
  AuthenticatedExtractorExtractResult,
  AuthenticatedExtractorPlugin,
  AuthenticatedExtractorSessionContext
} from "../types";

const EXTRACTOR_ID = "facebook-auth-browser";
const EXTRACTOR_VERSION = "2026-02-26.2";
const SELECTOR_PROFILE = "facebook-profile-auth-v2";
const DEFAULT_FACEBOOK_AGENT_BROWSER_SESSION = "openlinks-facebook-auth";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const SHORT_VERIFY_TIMEOUT_MS = 8_000;

interface FacebookSessionSnapshot {
  verified: boolean;
  loginRequired: boolean;
  currentUrl?: string;
  title?: string;
  heading?: string;
  imageUrl?: string;
  metaImageUrl?: string;
  placeholderSignals: string[];
  bodySnippet?: string;
}

interface ResolvedProfileTarget {
  identifier: string;
  canonicalUrl: string;
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
      "Interactive terminal is required for Facebook login. Run this command in a local TTY and retry."
    );
  }
};

const resolveAgentConfig = (): SessionConfig => {
  const session = process.env.AGENT_BROWSER_SESSION?.trim() || DEFAULT_FACEBOOK_AGENT_BROWSER_SESSION;
  const sessionName = process.env.AGENT_BROWSER_SESSION_NAME?.trim() || session;
  const providedKey = process.env.AGENT_BROWSER_ENCRYPTION_KEY?.trim() ?? "";
  const encryptionKey = /^[a-fA-F0-9]{64}$/.test(providedKey)
    ? providedKey
    : "0000000000000000000000000000000000000000000000000000000000000000";

  return {
    session,
    sessionName,
    encryptionKey
  };
};

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
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .trim();

const detectPlaceholderSignals = (body: string): string[] => {
  const normalized = body.toLowerCase();
  const checks: Array<{ label: string; pattern: RegExp }> = [
    { label: "content_unavailable", pattern: /this content isn't available right now/i },
    { label: "login_wall", pattern: /log in|sign up for facebook/i },
    { label: "temporarily_blocked", pattern: /temporarily blocked|security check/i }
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
    /\/images\/fb_icon_325x325\.png/i,
    /\/favicon\.ico/i,
    /static\.xx\.fbcdn\.net\/rsrc\.php/i,
    /facebook\.com\/rsrc\.php/i,
    /\/logos?\//i
  ];

  if (blockedPatterns.some((pattern) => pattern.test(normalized))) {
    return false;
  }

  const positivePatterns = [
    /scontent/i,
    /lookaside/i,
    /fbcdn\.net/i,
    /profile/i,
    /photo/i,
    /picture/i
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

const readFacebookSnapshot = (config: SessionConfig): FacebookSessionSnapshot => {
  const evalResult = runAgentBrowserJson<unknown>(
    [
      "eval",
      `(() => {
        const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
        const lower = (value) => normalize(value).toLowerCase();

        const title = normalize(document.title || "");
        const currentUrl = window.location.href;
        const bodyText = normalize(document.body?.innerText || "");

        const hasPasswordField = Boolean(document.querySelector("input[type='password'], input[name='pass']"));
        const hasEmailField = Boolean(document.querySelector("input[type='email'], input[name='email']"));
        const hasLoginForm = Boolean(document.querySelector("form[action*='login'], #login_form"));

        const headingCandidates = Array.from(
          document.querySelectorAll("h1, h2, [role='heading']")
        )
          .map((node) => normalize(node.textContent || ""))
          .filter((value) => value.length >= 2 && value.length <= 120)
          .filter((value) => !/log in|forgot account|this content isn't available|go to feed|go back/i.test(value));
        const heading = headingCandidates[0] || null;

        const metaImage =
          document.querySelector("meta[property='og:image']")?.getAttribute("content") ||
          document.querySelector("meta[name='twitter:image']")?.getAttribute("content") ||
          null;

        const imageCandidates = Array.from(document.querySelectorAll("img[src]"))
          .map((node) => {
            const src = normalize(node.getAttribute("src") || "");
            const alt = normalize(node.getAttribute("alt") || "");
            if (!src) {
              return null;
            }

            let score = 0;
            if (/scontent|fbcdn\\.net|lookaside|profile|photo|picture/i.test(src)) {
              score += 5;
            }
            if (/profile picture|profile/i.test(alt)) {
              score += 2;
            }
            if (/\\/rsrc\\.php|\\/images\\/fb_icon_325x325\\.png|\\/favicon\\.ico/i.test(src)) {
              score -= 4;
            }

            return { src, alt, score };
          })
          .filter(Boolean)
          .sort((left, right) => (right?.score || 0) - (left?.score || 0));

        return {
          title,
          currentUrl,
          bodySnippet: bodyText.slice(0, 5000),
          hasPasswordField,
          hasEmailField,
          hasLoginForm,
          heading,
          metaImage,
          imageCandidates
        };
      })()`
    ],
    config,
    { allowFailure: true }
  );

  const payload = extractEvalPayload(evalResult.response?.data);
  const title = safeTrim(payload?.title);
  const currentUrl = safeTrim(payload?.currentUrl);
  const bodySnippet = safeTrim(payload?.bodySnippet);
  const heading = safeTrim(payload?.heading);
  const metaImageUrl = safeTrim(payload?.metaImage);

  const imageCandidates = Array.isArray(payload?.imageCandidates) ? payload?.imageCandidates : [];
  const imageUrls: string[] = [];
  for (const candidate of imageCandidates) {
    if (!isRecord(candidate)) {
      continue;
    }
    const src = safeTrim(candidate.src);
    if (src) {
      imageUrls.push(src);
    }
  }

  const imageUrl =
    imageUrls.find((value) => isLikelyProfileImageUrl(value)) ??
    (isLikelyProfileImageUrl(metaImageUrl) ? metaImageUrl : undefined);

  const lowerText = `${title ?? ""}\n${bodySnippet ?? ""}\n${currentUrl ?? ""}`.toLowerCase();
  const loginRequired =
    payload?.hasPasswordField === true ||
    payload?.hasEmailField === true ||
    payload?.hasLoginForm === true ||
    /\/login|checkpoint|recover/i.test(currentUrl ?? "") ||
    /log in|forgot account\?/i.test(lowerText);

  const placeholderSignals = detectPlaceholderSignals(bodySnippet ?? "");
  if (loginRequired) {
    placeholderSignals.push("login_required");
  }
  if (!imageUrl) {
    placeholderSignals.push("profile_image_missing");
  }

  const verified = !loginRequired && Boolean(imageUrl) && !placeholderSignals.includes("content_unavailable");

  return {
    verified,
    loginRequired,
    currentUrl,
    title,
    heading,
    imageUrl,
    metaImageUrl,
    placeholderSignals: [...new Set(placeholderSignals)],
    bodySnippet
  };
};

const openFacebookTarget = (config: SessionConfig, sourceUrl: string, headed: boolean) => {
  runAgentBrowserJson(["open", sourceUrl], config, {
    extraArgs: headed ? ["--headed"] : [],
    allowFailure: true
  });
  runAgentBrowserJson(["wait", "1500"], config, { allowFailure: true });
};

const summarizeSnapshot = (snapshot: FacebookSessionSnapshot): string =>
  [
    `verified=${snapshot.verified ? "yes" : "no"}`,
    `loginRequired=${snapshot.loginRequired ? "yes" : "no"}`,
    `url=${snapshot.currentUrl ?? "unknown"}`,
    `title=${snapshot.title ?? "unknown"}`,
    `image=${snapshot.imageUrl ? "present" : "missing"}`,
    `signals=${snapshot.placeholderSignals.join(",") || "none"}`
  ].join("; ");

const verifySession = (
  config: SessionConfig,
  targetUrl: string
): AuthenticatedExtractorEnsureSessionResult => {
  openFacebookTarget(config, targetUrl, false);
  const snapshot = readFacebookSnapshot(config);
  runAgentBrowserJson(["close"], config, { allowFailure: true });

  return {
    verified: snapshot.verified,
    details: summarizeSnapshot(snapshot)
  };
};

const resolveProfileTarget = (sourceUrl: string): ResolvedProfileTarget => {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw new Error(`Invalid Facebook URL '${sourceUrl}' for extractor '${EXTRACTOR_ID}'.`);
  }

  const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
  if (hostname !== "facebook.com" && !hostname.endsWith(".facebook.com")) {
    throw new Error(
      `Facebook extractor only supports facebook.com hosts. Got '${parsed.hostname}' for '${sourceUrl}'.`
    );
  }

  const segments = parsed.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  let identifier = "";
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
    canonicalUrl: `https://www.facebook.com/${identifier}`
  };
};

const downloadImageAsset = async (
  config: SessionConfig,
  context: AuthenticatedExtractorExtractContext,
  sourceUrl: string
): Promise<{ path: string; sourceUrl: string; contentType: string; bytes: number; sha256: string }> => {
  const cookiesPayload = runAgentBrowserJson(["cookies", "get"], config, {
    allowFailure: true
  }).response?.data;
  const cookieHeader = toCookieHeader(cookiesPayload);

  const headers: Record<string, string> = {
    "user-agent": USER_AGENT,
    accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9"
  };
  if (cookieHeader) {
    headers.cookie = cookieHeader;
  }

  const response = await fetch(sourceUrl, {
    method: "GET",
    redirect: "follow",
    headers
  });

  if (!response.ok) {
    throw new Error(`Facebook extractor image fetch failed: HTTP ${response.status} for ${sourceUrl}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error("Facebook extractor image fetch returned empty body.");
  }

  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const extension =
    extensionFromContentType(response.headers.get("content-type")) ??
    extensionFromUrl(sourceUrl) ??
    "jpg";
  const fileName = `${sha256}.${extension}`;

  fs.mkdirSync(context.publicAssetDirAbsolute, { recursive: true });
  fs.writeFileSync(path.join(context.publicAssetDirAbsolute, fileName), bytes);

  const relativePath = path.posix.join(context.publicAssetDirRelative.replaceAll("\\", "/"), fileName);
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "application/octet-stream";

  return {
    path: relativePath,
    sourceUrl,
    contentType,
    bytes: bytes.byteLength,
    sha256
  };
};

const ensureSession = async (
  context: AuthenticatedExtractorSessionContext
): Promise<AuthenticatedExtractorEnsureSessionResult> => {
  const target = resolveProfileTarget(context.targetUrl);
  const config = resolveAgentConfig();

  const initialCheck = verifySession(config, target.canonicalUrl);
  if (initialCheck.verified) {
    return initialCheck;
  }

  requireInteractiveTerminal();

  const settings = resolveAuthWaitSettings();
  console.log("");
  console.log(`[${context.extractorId}] Facebook login required.`);
  console.log(
    `[${context.extractorId}] A headed browser will open. Log in to Facebook, open the target profile, and leave the tab on the profile page.`
  );
  console.log(
    `[${context.extractorId}] Waiting up to ${settings.timeoutMs}ms (poll ${settings.pollMs}ms).`
  );

  openFacebookTarget(config, target.canonicalUrl, true);

  const started = Date.now();
  let latest = readFacebookSnapshot(config);

  while (Date.now() - started <= settings.timeoutMs) {
    if (latest.verified) {
      runAgentBrowserJson(["close"], config, { allowFailure: true });
      return {
        verified: true,
        details: summarizeSnapshot(latest)
      };
    }

    runAgentBrowserJson(["wait", String(Math.min(settings.pollMs, 2_000))], config, {
      allowFailure: true
    });
    latest = readFacebookSnapshot(config);
  }

  runAgentBrowserJson(["close"], config, { allowFailure: true });

  return {
    verified: false,
    details: `timed_out; ${summarizeSnapshot(latest)}`
  };
};

const extract = async (
  context: AuthenticatedExtractorExtractContext
): Promise<AuthenticatedExtractorExtractResult> => {
  const config = resolveAgentConfig();
  const target = resolveProfileTarget(context.sourceUrl);

  const preCheck = verifySession(config, target.canonicalUrl);
  if (!preCheck.verified) {
    const ensured = await ensureSession({
      extractorId: context.extractorId,
      targetUrl: target.canonicalUrl
    });
    if (!ensured.verified) {
      throw new Error(`Facebook login verification failed. ${ensured.details ?? "unknown error"}`);
    }
  }

  openFacebookTarget(config, target.canonicalUrl, false);
  const snapshot = readFacebookSnapshot(config);
  if (!snapshot.verified || !snapshot.imageUrl) {
    runAgentBrowserJson(["close"], config, { allowFailure: true });
    throw new Error(
      `Facebook extractor could not capture authenticated profile image. ${summarizeSnapshot(snapshot)}`
    );
  }

  const imageAsset = await downloadImageAsset(config, context, snapshot.imageUrl);
  runAgentBrowserJson(["close"], config, { allowFailure: true });

  const displayName = snapshot.heading ?? target.identifier;
  const title = `${decodeHtmlEntities(displayName)} on Facebook`;
  const description = `Profile and updates from ${decodeHtmlEntities(displayName)} on Facebook.`;

  return {
    capturedAt: new Date().toISOString(),
    metadata: {
      title,
      description,
      image: imageAsset.path,
      sourceLabel: resolveSourceLabel(context.sourceUrl)
    },
    assets: {
      image: {
        path: imageAsset.path,
        sourceUrl: imageAsset.sourceUrl,
        contentType: imageAsset.contentType,
        bytes: imageAsset.bytes,
        sha256: imageAsset.sha256
      }
    },
    diagnostics: {
      extractorVersion: EXTRACTOR_VERSION,
      selectorProfile: SELECTOR_PROFILE,
      placeholderSignals: snapshot.placeholderSignals,
      capturedFromUrl: snapshot.currentUrl ?? target.canonicalUrl,
      notes: [
        `cacheKey=${context.cacheKey}`,
        `identifier=${target.identifier}`,
        `loginRequired=${snapshot.loginRequired ? "yes" : "no"}`,
        `session=${config.session}`,
        `sessionName=${config.sessionName}`
      ]
    }
  };
};

export const facebookAuthBrowserExtractor: AuthenticatedExtractorPlugin = {
  id: EXTRACTOR_ID,
  ensureSession,
  extract
};
