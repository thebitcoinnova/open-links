import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { stdin, stdout } from "node:process";
import {
  classifyPlaceholderSignals,
  extractCookieNames,
  resolveAuthWaitSettings,
  resolveSessionConfig,
  runAgentBrowserJson,
  summarizeLinkedinAuthResult,
  waitForLinkedinAuthenticatedSession,
  type SessionConfig,
  type WaitForLinkedinAuthResult
} from "../../oneoff/linkedin-poc-common";
import type {
  AuthenticatedExtractorEnsureSessionResult,
  AuthenticatedExtractorExtractContext,
  AuthenticatedExtractorExtractResult,
  AuthenticatedExtractorPlugin,
  AuthenticatedExtractorSessionContext
} from "../types";

const EXTRACTOR_ID = "linkedin-auth-browser";
const EXTRACTOR_VERSION = "2026-02-25.2";
const SELECTOR_PROFILE = "linkedin-profile-v1";
const SHORT_VERIFY_TIMEOUT_MS = 8_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toText = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
};

const resolveCurrentUrl = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return value;
  }
  if (isRecord(value) && typeof value.url === "string") {
    return value.url;
  }
  return undefined;
};

const isAuthwallUrl = (value: string | undefined): boolean =>
  typeof value === "string" && /linkedin\.com\/(authwall|signup|checkpoint|uas\/login)/i.test(value);

const requireInteractiveTerminal = () => {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error(
      "Interactive terminal is required for LinkedIn login. Run this command in a local TTY and retry."
    );
  }
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

    const name = toText(cookie.name);
    const cookieValue = toText(cookie.value);
    if (!name || !cookieValue) {
      continue;
    }

    pairs.push(`${name}=${cookieValue}`);
  }

  return pairs.length > 0 ? pairs.join("; ") : undefined;
};

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

    if (extension === "jpeg") {
      return "jpg";
    }

    return extension;
  } catch {
    return undefined;
  }
};

const resolveSourceLabel = (sourceUrl: string): string => {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return "linkedin.com";
  }
};

const resolveAgentConfig = (): SessionConfig => resolveSessionConfig();

const authTransitionsSummary = (result: WaitForLinkedinAuthResult): string =>
  result.transitions
    .map((snapshot) => `${snapshot.state}@${snapshot.currentUrl ?? "unknown"}`)
    .join(" -> ");

const extractLinkedinProfilePayload = async (
  config: SessionConfig,
  sourceUrl: string
): Promise<{
  title: string;
  description: string;
  imageUrl: string;
  currentUrl: string;
  placeholderSignals: string[];
}> => {
  const openResult = runAgentBrowserJson(["open", sourceUrl], config, {
    allowFailure: true
  });
  if (openResult.response?.success === false) {
    console.warn(`LinkedIn extractor open warning: ${openResult.response.error ?? "unknown error"}`);
  }

  runAgentBrowserJson(["wait", "2000"], config, { allowFailure: true });
  runAgentBrowserJson(["wait", "2000"], config, { allowFailure: true });

  const currentUrl = resolveCurrentUrl(
    runAgentBrowserJson(["get", "url"], config, { allowFailure: true }).response?.data
  );

  const evalResult = runAgentBrowserJson<unknown>(
    [
      "eval",
      `(() => {
        const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
        const isPlaceholder = (value) => /sign up\\s*\\|\\s*linkedin|join linkedin|authwall/i.test(value || "");

        const collectText = (nodes, minLength = 1, maxLength = 260) => {
          const seen = new Set();
          const values = [];
          for (const node of nodes) {
            const value = normalize(node.textContent || "");
            if (!value || value.length < minLength || value.length > maxLength || seen.has(value)) {
              continue;
            }
            seen.add(value);
            values.push(value);
          }
          return values;
        };

        const headingTexts = collectText(document.querySelectorAll("main h1, main h2"), 2, 120);
        const fullName =
          headingTexts.find((value) => !/about|activity|experience|education|skills|analytics|people you may know/i.test(value)) ||
          headingTexts[0] ||
          null;

        const headlineCandidates = collectText(document.querySelectorAll("main p, main span, main div"), 8, 180)
          .filter((value) => /engineer|developer|founder|owner|manager|designer|architect|student|lead/i.test(value))
          .filter((value) => !/connections|followers|contact info|profile language|public profile/i.test(value));
        const headline = headlineCandidates[0] || null;

        let about = null;
        const aboutHeading = Array.from(document.querySelectorAll("main h2, main h3, main span")).find(
          (node) => normalize(node.textContent || "").toLowerCase() === "about"
        );
        if (aboutHeading) {
          const section = aboutHeading.closest("section") || aboutHeading.parentElement;
          if (section) {
            const aboutCandidates = collectText(section.querySelectorAll("p, span, div"), 24, 500)
              .filter((value) => value.toLowerCase() !== "about")
              .filter((value) => !/show all|see more|contact info|connections/i.test(value));
            about = aboutCandidates[0] || null;
          }
        }

        const titleRaw = normalize(document.title || "");
        const title = titleRaw && !isPlaceholder(titleRaw) ? titleRaw : null;
        const description = about || headline || null;

        const imageNodes = Array.from(document.querySelectorAll("img[src*='profile-displayphoto']"));
        const scoredImages = imageNodes
          .map((node) => {
            const src = normalize(node.getAttribute("src") || "");
            const alt = normalize(node.getAttribute("alt") || "");
            if (!src) {
              return null;
            }

            let score = 0;
            if (/profile-displayphoto-shrink_200_200|profile-displayphoto-scale_200_200/i.test(src)) {
              score += 4;
            }
            if (/profile-displayphoto/i.test(src)) {
              score += 2;
            }
            if (alt && fullName && alt.toLowerCase().includes(fullName.toLowerCase())) {
              score += 5;
            }
            if (/view .* profile/i.test(alt)) {
              score += 2;
            }

            return { src, alt, score };
          })
          .filter(Boolean)
          .sort((left, right) => right.score - left.score);

        const imageUrl = scoredImages[0] ? scoredImages[0].src : null;

        return {
          title,
          fullName,
          headline,
          about,
          description,
          imageUrl,
          currentUrl: window.location.href
        };
      })()`
    ],
    config,
    { allowFailure: false }
  );

  const payload = (() => {
    const data = evalResult.response?.data;
    if (isRecord(data) && isRecord(data.result)) {
      return data.result;
    }
    if (isRecord(data)) {
      return data;
    }
    return null;
  })();

  const title = payload ? toText(payload.title) : undefined;
  const description = payload ? toText(payload.description) : undefined;
  const imageUrl = payload ? toText(payload.imageUrl) : undefined;
  const pageUrl = payload ? toText(payload.currentUrl) : undefined;

  const placeholderSignals = classifyPlaceholderSignals({
    title,
    description,
    html: `${pageUrl ?? ""} ${title ?? ""} ${description ?? ""}`
  });

  if (!title || !description || !imageUrl) {
    throw new Error(
      [
        "LinkedIn extractor could not capture required metadata fields from authenticated DOM.",
        `title=${title ? "present" : "missing"}, description=${description ? "present" : "missing"}, image=${
          imageUrl ? "present" : "missing"
        }`
      ].join(" ")
    );
  }

  if (placeholderSignals.length > 0) {
    throw new Error(
      `LinkedIn extractor captured placeholder/authwall signals: ${placeholderSignals.join(", ")}. Re-login and retry.`
    );
  }

  if (!pageUrl || isAuthwallUrl(pageUrl)) {
    throw new Error("LinkedIn extractor did not remain on an authenticated profile page.");
  }

  return {
    title,
    description,
    imageUrl,
    currentUrl: pageUrl,
    placeholderSignals
  };
};

const downloadImageAsset = async (
  config: SessionConfig,
  sourceUrl: string,
  context: AuthenticatedExtractorExtractContext
): Promise<{ path: string; bytes: number; contentType: string; sha256: string }> => {
  const cookiesPayload = runAgentBrowserJson(["cookies", "get"], config, {
    allowFailure: true
  }).response?.data;
  const cookieHeader = toCookieHeader(cookiesPayload);

  const headers: Record<string, string> = {
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
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
    throw new Error(`LinkedIn extractor image fetch failed: HTTP ${response.status} for ${sourceUrl}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error("LinkedIn extractor image fetch returned empty body.");
  }

  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const extension =
    extensionFromContentType(response.headers.get("content-type")) ?? extensionFromUrl(sourceUrl) ?? "jpg";
  const fileName = `${sha256}.${extension}`;

  const absolutePath = path.join(context.publicAssetDirAbsolute, fileName);
  fs.mkdirSync(context.publicAssetDirAbsolute, { recursive: true });
  fs.writeFileSync(absolutePath, bytes);

  const relativePath = path.posix.join(context.publicAssetDirRelative.replaceAll("\\", "/"), fileName);
  return {
    path: relativePath,
    bytes: bytes.byteLength,
    contentType: response.headers.get("content-type")?.split(";")[0]?.trim() ?? "application/octet-stream",
    sha256
  };
};

const verifySession = async (
  config: SessionConfig,
  targetUrl: string
): Promise<AuthenticatedExtractorEnsureSessionResult> => {
  const settings = resolveAuthWaitSettings();
  const authResult = await waitForLinkedinAuthenticatedSession(config, {
    targetUrl,
    timeoutMs: Math.min(settings.timeoutMs, SHORT_VERIFY_TIMEOUT_MS),
    pollMs: Math.min(settings.pollMs, 1_000),
    logPrefix: `[${EXTRACTOR_ID}]`,
    emitStateLogs: false
  });

  runAgentBrowserJson(["close"], config, { allowFailure: true });

  return {
    verified: authResult.verified,
    details: summarizeLinkedinAuthResult(authResult)
  };
};

const ensureSession = async (
  context: AuthenticatedExtractorSessionContext
): Promise<AuthenticatedExtractorEnsureSessionResult> => {
  const config = resolveAgentConfig();
  const initialCheck = await verifySession(config, context.targetUrl);
  if (initialCheck.verified) {
    return initialCheck;
  }

  requireInteractiveTerminal();

  const settings = resolveAuthWaitSettings();
  console.log("");
  console.log(`[${context.extractorId}] LinkedIn login required.`);
  console.log(
    `[${context.extractorId}] A headed browser will open. Complete credentials and any MFA/challenge; extraction will continue automatically once authenticated.`
  );
  console.log(
    `[${context.extractorId}] Waiting up to ${settings.timeoutMs}ms (poll ${settings.pollMs}ms).`
  );

  const authResult = await waitForLinkedinAuthenticatedSession(config, {
    targetUrl: context.targetUrl,
    headed: true,
    timeoutMs: settings.timeoutMs,
    pollMs: settings.pollMs,
    logPrefix: `[${context.extractorId}]`,
    emitStateLogs: true
  });

  runAgentBrowserJson(["close"], config, { allowFailure: true });

  if (!authResult.verified) {
    throw new Error(
      `LinkedIn login verification failed. ${summarizeLinkedinAuthResult(authResult)}. transitions=${authTransitionsSummary(
        authResult
      )}`
    );
  }

  return {
    verified: true,
    details: `${summarizeLinkedinAuthResult(authResult)}; transitions=${authTransitionsSummary(authResult)}`
  };
};

const extract = async (
  context: AuthenticatedExtractorExtractContext
): Promise<AuthenticatedExtractorExtractResult> => {
  const config = resolveAgentConfig();

  const preCheck = await verifySession(config, context.sourceUrl);
  if (!preCheck.verified) {
    await ensureSession({ extractorId: context.extractorId, targetUrl: context.sourceUrl });
  }

  const payload = await extractLinkedinProfilePayload(config, context.sourceUrl);
  const imageAsset = await downloadImageAsset(config, payload.imageUrl, context);

  runAgentBrowserJson(["close"], config, { allowFailure: true });

  return {
    capturedAt: new Date().toISOString(),
    metadata: {
      title: payload.title,
      description: payload.description,
      image: imageAsset.path,
      sourceLabel: resolveSourceLabel(context.sourceUrl)
    },
    assets: {
      image: {
        path: imageAsset.path,
        sourceUrl: payload.imageUrl,
        contentType: imageAsset.contentType,
        bytes: imageAsset.bytes,
        sha256: imageAsset.sha256
      }
    },
    diagnostics: {
      extractorVersion: EXTRACTOR_VERSION,
      selectorProfile: SELECTOR_PROFILE,
      placeholderSignals: payload.placeholderSignals,
      capturedFromUrl: payload.currentUrl,
      notes: [
        `session=${config.session}`,
        `sessionName=${config.sessionName}`,
        `cacheKey=${context.cacheKey}`
      ]
    }
  };
};

export const linkedinAuthBrowserExtractor: AuthenticatedExtractorPlugin = {
  id: EXTRACTOR_ID,
  ensureSession,
  extract
};
