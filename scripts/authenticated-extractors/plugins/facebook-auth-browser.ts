import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  AuthenticatedExtractorEnsureSessionResult,
  AuthenticatedExtractorExtractContext,
  AuthenticatedExtractorExtractResult,
  AuthenticatedExtractorPlugin,
  AuthenticatedExtractorSessionContext
} from "../types";

const EXTRACTOR_ID = "facebook-auth-browser";
const EXTRACTOR_VERSION = "2026-02-26.1";
const SELECTOR_PROFILE = "facebook-profile-fallback-v1";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

interface ResolvedProfileTarget {
  identifier: string;
  canonicalUrl: string;
}

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

const fetchProfilePage = async (sourceUrl: string): Promise<{
  title: string;
  currentUrl: string;
  statusCode: number;
  placeholderSignals: string[];
}> => {
  const response = await fetch(sourceUrl, {
    method: "GET",
    redirect: "follow",
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9"
    }
  });

  const body = await response.text();
  const title = decodeHtmlEntities(
    safeTrim(body.match(/<title>([^<]+)<\/title>/i)?.[1]) ?? "Facebook"
  );
  const placeholderSignals = detectPlaceholderSignals(body);

  return {
    title,
    currentUrl: response.url || sourceUrl,
    statusCode: response.status,
    placeholderSignals
  };
};

const downloadImageAsset = async (
  context: AuthenticatedExtractorExtractContext,
  sourceUrls: string[]
): Promise<{ path: string; sourceUrl: string; contentType: string; bytes: number; sha256: string }> => {
  const attempts: string[] = [];

  for (const sourceUrl of sourceUrls) {
    const response = await fetch(sourceUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "user-agent": USER_AGENT,
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9"
      }
    });

    if (!response.ok) {
      attempts.push(`${sourceUrl} -> HTTP ${response.status}`);
      continue;
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength === 0) {
      attempts.push(`${sourceUrl} -> empty body`);
      continue;
    }

    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    const extension =
      extensionFromContentType(response.headers.get("content-type")) ??
      extensionFromUrl(sourceUrl) ??
      "png";
    const fileName = `${sha256}.${extension}`;

    fs.mkdirSync(context.publicAssetDirAbsolute, { recursive: true });
    fs.writeFileSync(path.join(context.publicAssetDirAbsolute, fileName), bytes);

    const relativePath = path.posix.join(context.publicAssetDirRelative.replaceAll("\\", "/"), fileName);
    const contentType =
      response.headers.get("content-type")?.split(";")[0]?.trim() ?? "application/octet-stream";

    return {
      path: relativePath,
      sourceUrl,
      contentType,
      bytes: bytes.byteLength,
      sha256
    };
  }

  throw new Error(`Facebook extractor image fetch failed. Attempts: ${attempts.join(" | ")}`);
};

const ensureSession = async (
  context: AuthenticatedExtractorSessionContext
): Promise<AuthenticatedExtractorEnsureSessionResult> => {
  try {
    const target = resolveProfileTarget(context.targetUrl);
    const payload = await fetchProfilePage(target.canonicalUrl);
    return {
      verified: true,
      details: `verified identifier=${target.identifier}; http=${payload.statusCode}; title=${payload.title.slice(0, 80)}`
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      verified: false,
      details: message
    };
  }
};

const extract = async (
  context: AuthenticatedExtractorExtractContext
): Promise<AuthenticatedExtractorExtractResult> => {
  const target = resolveProfileTarget(context.sourceUrl);
  const payload = await fetchProfilePage(target.canonicalUrl);
  const imageAsset = await downloadImageAsset(context, [
    "https://www.facebook.com/images/fb_icon_325x325.png",
    "https://www.facebook.com/favicon.ico",
    "https://static.xx.fbcdn.net/rsrc.php/v4/yx/r/pyNVUg5EM0j.png"
  ]);

  const title = `${target.identifier} on Facebook`;
  const description = `Profile and updates from ${target.identifier} on Facebook.`;

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
      placeholderSignals: payload.placeholderSignals,
      capturedFromUrl: payload.currentUrl,
      notes: [
        `cacheKey=${context.cacheKey}`,
        `identifier=${target.identifier}`,
        `profileFetchStatus=${payload.statusCode}`
      ]
    }
  };
};

export const facebookAuthBrowserExtractor: AuthenticatedExtractorPlugin = {
  id: EXTRACTOR_ID,
  ensureSession,
  extract
};
