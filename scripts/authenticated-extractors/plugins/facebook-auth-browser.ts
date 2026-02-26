import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { stdin, stdout } from "node:process";
import {
  summarizeAuthFlowResult,
  waitForAuthenticatedSession
} from "../auth-flow-runtime";
import {
  resolveAuthWaitSettings,
  resolveBrowserSessionConfig,
  runAgentBrowserJson,
  type BrowserSessionConfig
} from "../browser-session";
import type {
  AuthFlowActionCandidate,
  AuthFlowSnapshot,
  AuthenticatedExtractorEnsureSessionResult,
  AuthenticatedExtractorExtractContext,
  AuthenticatedExtractorExtractResult,
  AuthenticatedExtractorPlugin,
  AuthenticatedExtractorSessionContext
} from "../types";

const EXTRACTOR_ID = "facebook-auth-browser";
const EXTRACTOR_VERSION = "2026-02-26.3";
const SELECTOR_PROFILE = "facebook-profile-auth-v3";
const DEFAULT_FACEBOOK_AGENT_BROWSER_SESSION = "openlinks-facebook-auth";
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

const resolveAgentConfig = (): BrowserSessionConfig =>
  resolveBrowserSessionConfig({
    defaultSession: DEFAULT_FACEBOOK_AGENT_BROWSER_SESSION,
    requireEncryptionKey: false
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

const extractStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => safeTrim(item))
    .filter((item): item is string => Boolean(item));
};

const inspectFacebookFlow = async (config: BrowserSessionConfig): Promise<FacebookInspection> => {
  const evalResult = runAgentBrowserJson<unknown>(
    [
      "eval",
      `(() => {
        const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
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
          .sort((left, right) => (right?.score || 0) - (left?.score || 0))
          .slice(0, 40);

        const controls = Array.from(
          document.querySelectorAll("button, [role='button'], input[type='submit'], input[type='button'], div[role='button']")
        )
          .map((node) => {
            const text = normalize(
              node.textContent ||
                node.getAttribute("aria-label") ||
                (node instanceof HTMLInputElement ? node.value : "")
            );
            if (!text) {
              return null;
            }
            return text;
          })
          .filter(Boolean)
          .slice(0, 80);

        return {
          title,
          currentUrl,
          bodySnippet: bodyText.slice(0, 5000),
          hasPasswordField,
          hasEmailField,
          hasLoginForm,
          heading,
          metaImage,
          imageCandidates,
          controls
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
  const controls = extractStringArray(payload?.controls);

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
  const lowerCombined = [
    title ?? "",
    bodySnippet ?? "",
    currentUrl ?? "",
    controls.join("\n")
  ]
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
      currentUrl ?? ""
    ) ||
    /two-factor|two factor|security code|authentication app|approve your login|enter the code/i.test(
      lowerCombined
    );

  const hasTrustDeviceSignals =
    /\/remember_browser/i.test(currentUrl ?? "") ||
    /trust this device|remember browser|save browser|yes, trust/i.test(lowerCombined);

  const hasBlockedSignals =
    /temporarily blocked|account restricted|security check required/i.test(lowerCombined);

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
        value.toLowerCase()
      )
    );
    actionCandidates.push({
      actionId: "facebook.trust_device.confirm",
      label: trustControl ?? "Trust this device",
      kind: "click_button",
      risk: "low",
      confidence: trustControl ? 0.95 : 0.4,
      details: trustControl
        ? "Matched consent control text on trust-device screen."
        : "Detected trust-device screen but no exact button match was found."
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
      actionCandidates
    },
    heading,
    imageUrl
  };
};

const openFacebookTarget = (config: BrowserSessionConfig, sourceUrl: string, headed: boolean) => {
  runAgentBrowserJson(["open", sourceUrl], config, {
    extraArgs: headed ? ["--headed"] : [],
    allowFailure: true
  });
  runAgentBrowserJson(["wait", "1500"], config, { allowFailure: true });
};

const waitForMs = (config: BrowserSessionConfig, durationMs: number): Promise<void> => {
  runAgentBrowserJson(["wait", String(Math.max(250, durationMs))], config, { allowFailure: true });
  return Promise.resolve();
};

const executeFacebookAction = async (
  config: BrowserSessionConfig,
  candidate: AuthFlowActionCandidate
): Promise<{ success: boolean; details?: string }> => {
  if (candidate.actionId !== "facebook.trust_device.confirm") {
    return {
      success: false,
      details: `Unsupported action '${candidate.actionId}'.`
    };
  }

  const result = runAgentBrowserJson<unknown>(
    [
      "eval",
      `(() => {
        const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
        const controls = Array.from(
          document.querySelectorAll("button, [role='button'], input[type='submit'], input[type='button'], div[role='button']")
        );
        const matcher = /trust this device|trust device|save browser|remember browser|yes, trust/i;
        const target = controls.find((node) => {
          const text = normalize(
            node.textContent ||
              node.getAttribute("aria-label") ||
              (node instanceof HTMLInputElement ? node.value : "")
          );
          return matcher.test(text);
        });

        if (!target) {
          return {
            clicked: false,
            reason: "no_matching_control"
          };
        }

        const label = normalize(
          target.textContent ||
            target.getAttribute("aria-label") ||
            (target instanceof HTMLInputElement ? target.value : "")
        );
        target.click();
        return {
          clicked: true,
          label
        };
      })()`
    ],
    config,
    { allowFailure: true }
  );

  const payload = extractEvalPayload(result.response?.data);
  if (payload?.clicked === true) {
    return {
      success: true,
      details: `clicked '${safeTrim(payload.label) ?? "trust_device"}'`
    };
  }

  return {
    success: false,
    details: safeTrim(payload?.reason) ?? "no_matching_control"
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
  config: BrowserSessionConfig,
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

const verifySession = async (
  config: BrowserSessionConfig,
  targetUrl: string
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
      wait: async (durationMs) => waitForMs(config, durationMs)
    });

    return {
      verified: result.verified,
      details: summarizeAuthFlowResult(result),
      report: result.report
    };
  } finally {
    runAgentBrowserJson(["close"], config, { allowFailure: true });
  }
};

const ensureSession = async (
  context: AuthenticatedExtractorSessionContext
): Promise<AuthenticatedExtractorEnsureSessionResult> => {
  const target = resolveProfileTarget(context.targetUrl);
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
    `[${context.extractorId}] A headed browser will open. Complete login and any MFA/challenge screens.`
  );
  console.log(
    `[${context.extractorId}] Consent actions (for example trust-device) are ask-first and require your confirmation.`
  );
  console.log(
    `[${context.extractorId}] Waiting up to ${settings.timeoutMs}ms (poll ${settings.pollMs}ms).`
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
      executeAction: async (candidate) => executeFacebookAction(config, candidate)
    });

    return {
      verified: result.verified,
      details: summarizeAuthFlowResult(result),
      report: result.report
    };
  } finally {
    runAgentBrowserJson(["close"], config, { allowFailure: true });
  }
};

const extract = async (
  context: AuthenticatedExtractorExtractContext
): Promise<AuthenticatedExtractorExtractResult> => {
  const config = resolveAgentConfig();
  const target = resolveProfileTarget(context.sourceUrl);

  const preCheck = await verifySession(config, target.canonicalUrl);
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
  try {
    const inspection = await inspectFacebookFlow(config);
    if (inspection.snapshot.state !== "authenticated" || !inspection.imageUrl) {
      throw new Error(
        `Facebook extractor could not capture authenticated profile image. state=${inspection.snapshot.state}; signals=${inspection.snapshot.signals.join(
          ","
        ) || "none"}; url=${inspection.snapshot.currentUrl ?? "unknown"}`
      );
    }

    const imageAsset = await downloadImageAsset(config, context, inspection.imageUrl);
    const displayName = inspection.heading ?? target.identifier;
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
        placeholderSignals: inspection.snapshot.signals,
        capturedFromUrl: inspection.snapshot.currentUrl ?? target.canonicalUrl,
        notes: [
          `cacheKey=${context.cacheKey}`,
          `identifier=${target.identifier}`,
          `authState=${inspection.snapshot.state}`,
          `session=${config.session}`,
          `sessionName=${config.sessionName}`
        ]
      }
    };
  } finally {
    runAgentBrowserJson(["close"], config, { allowFailure: true });
  }
};

export const facebookAuthBrowserExtractor: AuthenticatedExtractorPlugin = {
  id: EXTRACTOR_ID,
  ensureSession,
  extract
};
