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

import type { FacebookInspection, ResolvedProfileTarget } from "./facebook-profile-parsing";
import {
  decodeHtmlEntities,
  detectPlaceholderSignals,
  extensionFromContentType,
  extensionFromUrl,
  extractEvalPayload,
  extractStringArray,
  formatIdentifierDisplayName,
  isGenericFacebookHeading,
  requireInteractiveTerminal,
  resolveAgentConfig,
  resolvePreferredProfileImage,
  resolveSourceLabel,
  safeTrim,
  toCookieHeader,
} from "./facebook-profile-parsing";
export { isGenericFacebookHeading } from "./facebook-profile-parsing";
const EXTRACTOR_ID = "facebook-auth-browser";
const EXTRACTOR_VERSION = "2026-03-15.1";
const SELECTOR_PROFILE = "facebook-profile-auth-v5";
const FACEBOOK_INSPECT_AUTH_FLOW_SNIPPET = loadEmbeddedCode(
  "browser/facebook/inspect-auth-flow.js",
);
const FACEBOOK_CLICK_TRUST_DEVICE_SNIPPET = loadEmbeddedCode(
  "browser/facebook/click-trust-device.js",
);
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const SHORT_VERIFY_TIMEOUT_MS = 8_000;

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
      decodedHeading && !isGenericFacebookHeading(decodedHeading)
        ? decodedHeading
        : fallbackDisplayName;
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
