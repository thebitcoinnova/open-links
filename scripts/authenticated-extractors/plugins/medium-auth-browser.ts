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

const EXTRACTOR_ID = "medium-auth-browser";
const EXTRACTOR_VERSION = "2026-02-25.1";
const SELECTOR_PROFILE = "medium-rss-v1";

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
    return extension === "jpeg" ? "jpg" : extension;
  } catch {
    return undefined;
  }
};

const resolveSourceLabel = (sourceUrl: string): string => {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return "medium.com";
  }
};

const detectPlaceholderSignals = (input: {
  currentUrl?: string;
  title?: string;
  description?: string;
  rawBody?: string;
}): string[] => {
  const combined = [
    input.currentUrl ?? "",
    input.title ?? "",
    input.description ?? "",
    input.rawBody ?? ""
  ]
    .join("\n")
    .toLowerCase();

  const findings: string[] = [];
  const checks: Array<{ label: string; pattern: RegExp }> = [
    { label: "cloudflare_challenge", pattern: /just a moment/i },
    { label: "js_cookie_challenge", pattern: /enable javascript and cookies to continue/i },
    { label: "cloudflare_attention", pattern: /attention required.*cloudflare/i },
    { label: "security_check", pattern: /checking if the site connection is secure/i },
    { label: "access_denied", pattern: /access denied/i },
    { label: "medium_signin_page", pattern: /medium\.com\/m\/signin|sign in to medium/i }
  ];

  for (const check of checks) {
    if (check.pattern.test(combined)) {
      findings.push(check.label);
    }
  }

  return findings;
};

const decodeEntities = (value: string): string =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .trim();

const firstMatch = (text: string, patterns: RegExp[]): string | undefined => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim();
    if (value && value.length > 0) {
      return decodeEntities(value);
    }
  }
  return undefined;
};

const resolveMediumFeedUrl = (sourceUrl: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw new Error(`Invalid Medium URL '${sourceUrl}' for extractor '${EXTRACTOR_ID}'.`);
  }

  const host = parsed.hostname.toLowerCase();
  if (!(host === "medium.com" || host.endsWith(".medium.com"))) {
    throw new Error(
      `Medium extractor only supports medium.com hosts. Got '${parsed.hostname}' for '${sourceUrl}'.`
    );
  }

  const pathSegments = parsed.pathname.split("/").filter((segment) => segment.length > 0);
  if (pathSegments.length === 0) {
    throw new Error(`Unable to resolve Medium feed URL from '${sourceUrl}'.`);
  }

  const firstSegment = pathSegments[0];
  if (firstSegment.startsWith("@")) {
    return `https://medium.com/feed/${firstSegment}`;
  }

  return `https://medium.com/feed/${firstSegment}`;
};

const fetchFeedXml = async (feedUrl: string): Promise<string> => {
  const response = await fetch(feedUrl, {
    method: "GET",
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
      "accept-language": "en-US,en;q=0.9"
    }
  });

  if (!response.ok) {
    throw new Error(`Medium feed fetch failed: HTTP ${response.status} for ${feedUrl}`);
  }

  return response.text();
};

const extractFromFeed = async (
  sourceUrl: string
): Promise<{
  title: string;
  description: string;
  imageUrl: string;
  currentUrl: string;
  placeholderSignals: string[];
  feedUrl: string;
}> => {
  const feedUrl = resolveMediumFeedUrl(sourceUrl);
  const xml = await fetchFeedXml(feedUrl);

  const channel = firstMatch(xml, [/<channel>([\s\S]*?)<\/channel>/i]) ?? xml;

  const title = firstMatch(channel, [
    /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i,
    /<title>([\s\S]*?)<\/title>/i
  ]);
  const description = firstMatch(channel, [
    /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i,
    /<description>([\s\S]*?)<\/description>/i
  ]);
  const imageUrl = firstMatch(channel, [/<image>[\s\S]*?<url>([\s\S]*?)<\/url>[\s\S]*?<\/image>/i]);
  const currentUrl =
    firstMatch(channel, [/<link>([\s\S]*?)<\/link>/i]) ??
    sourceUrl;

  const placeholderSignals = detectPlaceholderSignals({
    currentUrl,
    title,
    description,
    rawBody: xml
  });

  if (!title || !description || !imageUrl) {
    throw new Error(
      [
        "Medium extractor could not capture required metadata from feed XML.",
        `title=${title ? "present" : "missing"}, description=${description ? "present" : "missing"}, image=${imageUrl ? "present" : "missing"}.`
      ].join(" ")
    );
  }

  if (placeholderSignals.length > 0) {
    throw new Error(
      `Medium extractor captured placeholder/challenge content: ${placeholderSignals.join(", ")}.`
    );
  }

  return {
    title,
    description,
    imageUrl,
    currentUrl,
    placeholderSignals,
    feedUrl
  };
};

const downloadImageAsset = async (
  sourceUrl: string,
  context: AuthenticatedExtractorExtractContext
): Promise<{ path: string; bytes: number; contentType: string; sha256: string }> => {
  const headers: Record<string, string> = {
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9"
  };

  const response = await fetch(sourceUrl, {
    method: "GET",
    redirect: "follow",
    headers
  });

  if (!response.ok) {
    throw new Error(`Medium extractor image fetch failed: HTTP ${response.status} for ${sourceUrl}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error("Medium extractor image fetch returned empty body.");
  }

  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const extension =
    extensionFromContentType(response.headers.get("content-type")) ?? extensionFromUrl(sourceUrl) ?? "jpg";
  const fileName = `${sha256}.${extension}`;

  fs.mkdirSync(context.publicAssetDirAbsolute, { recursive: true });
  fs.writeFileSync(path.join(context.publicAssetDirAbsolute, fileName), bytes);

  const relativePath = path.posix.join(context.publicAssetDirRelative.replaceAll("\\", "/"), fileName);
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "application/octet-stream";

  return {
    path: relativePath,
    bytes: bytes.byteLength,
    contentType,
    sha256
  };
};

const ensureSession = async (
  context: AuthenticatedExtractorSessionContext
): Promise<AuthenticatedExtractorEnsureSessionResult> => {
  try {
    const payload = await extractFromFeed(context.targetUrl);
    return {
      verified: true,
      details: `verified feed=${payload.feedUrl}; title=${payload.title.slice(0, 80)}`
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
  const payload = await extractFromFeed(context.sourceUrl);
  const imageAsset = await downloadImageAsset(payload.imageUrl, context);

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
      notes: [`cacheKey=${context.cacheKey}`, `feedUrl=${payload.feedUrl}`]
    }
  };
};

export const mediumAuthBrowserExtractor: AuthenticatedExtractorPlugin = {
  id: EXTRACTOR_ID,
  ensureSession,
  extract
};
