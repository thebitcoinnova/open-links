import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  AuthenticatedExtractorEnsureSessionResult,
  AuthenticatedExtractorExtractContext,
  AuthenticatedExtractorExtractResult,
  AuthenticatedExtractorPlugin,
  AuthenticatedExtractorSessionContext,
} from "../types";

const EXTRACTOR_ID = "x-auth-browser";
const EXTRACTOR_VERSION = "2026-02-26.1";
const SELECTOR_PROFILE = "x-oembed-unavatar-v1";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

interface OEmbedPayload {
  url?: string;
  title?: string;
  html?: string;
  provider_name?: string;
  provider_url?: string;
  type?: string;
  version?: string;
}

interface ResolvedProfileTarget {
  handle: string;
  canonicalUrl: string;
  oEmbedTargetUrl: string;
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

const decodeHtmlEntities = (value: string): string =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .trim();

const resolveSourceLabel = (sourceUrl: string): string => {
  try {
    const host = new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
    if (host.endsWith("twitter.com")) {
      return "x.com";
    }
    return host;
  } catch {
    return "x.com";
  }
};

const detectPlaceholderSignals = (input: {
  title?: string;
  providerName?: string;
  html?: string;
}): string[] => {
  const combined = [input.title ?? "", input.providerName ?? "", input.html ?? ""]
    .join("\n")
    .toLowerCase();
  const checks: Array<{ label: string; pattern: RegExp }> = [
    { label: "oembed_unavailable", pattern: /not found|no status found|invalid url/i },
    { label: "sign_in_prompt", pattern: /sign in|log in/i },
    {
      label: "challenge_page",
      pattern: /just a moment|checking if the site connection is secure/i,
    },
  ];

  const findings: string[] = [];
  for (const check of checks) {
    if (check.pattern.test(combined)) {
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
    throw new Error(`Invalid X URL '${sourceUrl}' for extractor '${EXTRACTOR_ID}'.`);
  }

  const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
  const allowed = ["x.com", "twitter.com", "mobile.twitter.com"];
  if (!allowed.includes(hostname) && !hostname.endsWith(".twitter.com")) {
    throw new Error(
      `X extractor only supports x.com/twitter.com hosts. Got '${parsed.hostname}' for '${sourceUrl}'.`,
    );
  }

  const handleSegment = parsed.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)[0];

  if (!handleSegment) {
    throw new Error(`Unable to resolve X handle from URL '${sourceUrl}'.`);
  }

  const handle = handleSegment.replace(/^@/, "");
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
    throw new Error(`Resolved handle '${handle}' is not a valid X username.`);
  }

  return {
    handle,
    canonicalUrl: `https://x.com/${handle}`,
    oEmbedTargetUrl: `https://twitter.com/${handle}`,
  };
};

const fetchOEmbedPayload = async (
  targetUrl: string,
): Promise<{ payload: OEmbedPayload; oEmbedUrl: string }> => {
  const oEmbedUrl = new URL("https://publish.twitter.com/oembed");
  oEmbedUrl.searchParams.set("url", targetUrl);
  oEmbedUrl.searchParams.set("omit_script", "true");
  oEmbedUrl.searchParams.set("hide_thread", "true");
  oEmbedUrl.searchParams.set("dnt", "true");

  const response = await fetch(oEmbedUrl, {
    method: "GET",
    redirect: "follow",
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/json",
      "accept-language": "en-US,en;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`X oEmbed fetch failed: HTTP ${response.status} for ${oEmbedUrl.toString()}`);
  }

  const payload = (await response.json()) as OEmbedPayload;
  return {
    payload,
    oEmbedUrl: oEmbedUrl.toString(),
  };
};

const extractDisplayHandleFromHtml = (html: string | undefined, fallbackHandle: string): string => {
  if (!html) {
    return fallbackHandle;
  }
  const match = html.match(/Tweets by ([^<]+)/i);
  const extracted = safeTrim(match?.[1]);
  return extracted ? decodeHtmlEntities(extracted).replace(/^@/, "") : fallbackHandle;
};

const buildMetadataPayload = async (
  sourceUrl: string,
): Promise<{
  handle: string;
  title: string;
  description: string;
  currentUrl: string;
  oEmbedUrl: string;
  placeholderSignals: string[];
}> => {
  const target = resolveProfileTarget(sourceUrl);
  const { payload, oEmbedUrl } = await fetchOEmbedPayload(target.oEmbedTargetUrl);

  const providerName = safeTrim(payload.provider_name) ?? "";
  if (!/twitter/i.test(providerName)) {
    throw new Error(
      `X extractor expected oEmbed provider 'Twitter' but received '${providerName || "missing"}'.`,
    );
  }

  const displayHandle = extractDisplayHandleFromHtml(payload.html, target.handle);
  const placeholderSignals = detectPlaceholderSignals({
    title: payload.title,
    providerName,
    html: payload.html,
  });

  if (placeholderSignals.includes("oembed_unavailable")) {
    throw new Error(
      `X extractor received unavailable oEmbed payload for handle '${displayHandle}'. Signals: ${placeholderSignals.join(", ")}.`,
    );
  }

  const title = safeTrim(payload.title) ?? `@${displayHandle} on X`;
  const description = `Posts and updates from @${displayHandle} on X.`;

  return {
    handle: displayHandle,
    title,
    description,
    currentUrl: safeTrim(payload.url) ?? target.canonicalUrl,
    oEmbedUrl,
    placeholderSignals,
  };
};

const downloadImageAsset = async (
  context: AuthenticatedExtractorExtractContext,
  sourceUrls: string[],
): Promise<{
  path: string;
  sourceUrl: string;
  contentType: string;
  bytes: number;
  sha256: string;
}> => {
  const attempts: string[] = [];

  for (const sourceUrl of sourceUrls) {
    const response = await fetch(sourceUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "user-agent": USER_AGENT,
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
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
      "jpg";
    const fileName = `${sha256}.${extension}`;

    fs.mkdirSync(context.publicAssetDirAbsolute, { recursive: true });
    fs.writeFileSync(path.join(context.publicAssetDirAbsolute, fileName), bytes);

    const relativePath = path.posix.join(
      context.publicAssetDirRelative.replaceAll("\\", "/"),
      fileName,
    );
    const contentType =
      response.headers.get("content-type")?.split(";")[0]?.trim() ?? "application/octet-stream";

    return {
      path: relativePath,
      sourceUrl,
      contentType,
      bytes: bytes.byteLength,
      sha256,
    };
  }

  throw new Error(`X extractor image fetch failed. Attempts: ${attempts.join(" | ")}`);
};

const ensureSession = async (
  context: AuthenticatedExtractorSessionContext,
): Promise<AuthenticatedExtractorEnsureSessionResult> => {
  try {
    const payload = await buildMetadataPayload(context.targetUrl);
    return {
      verified: true,
      details: `verified handle=${payload.handle}; source=oembed`,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      verified: false,
      details: message,
    };
  }
};

const extract = async (
  context: AuthenticatedExtractorExtractContext,
): Promise<AuthenticatedExtractorExtractResult> => {
  const payload = await buildMetadataPayload(context.sourceUrl);
  const imageAsset = await downloadImageAsset(context, [
    `https://unavatar.io/x/${encodeURIComponent(payload.handle)}`,
    "https://abs.twimg.com/responsive-web/client-web/icon-ios.77d25eba.png",
  ]);

  return {
    capturedAt: new Date().toISOString(),
    metadata: {
      title: payload.title,
      description: payload.description,
      image: imageAsset.path,
      sourceLabel: resolveSourceLabel(context.sourceUrl),
    },
    assets: {
      image: {
        path: imageAsset.path,
        sourceUrl: imageAsset.sourceUrl,
        contentType: imageAsset.contentType,
        bytes: imageAsset.bytes,
        sha256: imageAsset.sha256,
      },
    },
    diagnostics: {
      extractorVersion: EXTRACTOR_VERSION,
      selectorProfile: SELECTOR_PROFILE,
      placeholderSignals: payload.placeholderSignals,
      capturedFromUrl: payload.currentUrl,
      notes: [
        `cacheKey=${context.cacheKey}`,
        `handle=${payload.handle}`,
        `oembedUrl=${payload.oEmbedUrl}`,
      ],
    },
  };
};

export const xAuthBrowserExtractor: AuthenticatedExtractorPlugin = {
  id: EXTRACTOR_ID,
  ensureSession,
  extract,
};
