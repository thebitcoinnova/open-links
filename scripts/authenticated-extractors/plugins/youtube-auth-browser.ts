import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveSupportedSocialProfile } from "../../../src/lib/content/social-profile-fields";
import { fetchMetadata } from "../../enrichment/fetch-metadata";
import { parseMetadata } from "../../enrichment/parse-metadata";
import type {
  AuthenticatedExtractorEnsureSessionResult,
  AuthenticatedExtractorExtractContext,
  AuthenticatedExtractorExtractResult,
  AuthenticatedExtractorPlugin,
  AuthenticatedExtractorSessionContext,
} from "../types";
import { parseAudienceCount } from "./social-profile-counts";

const EXTRACTOR_ID = "youtube-auth-browser";
const EXTRACTOR_VERSION = "2026-03-03.2";
const SELECTOR_PROFILE = "youtube-public-metadata-v1";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const YOUTUBE_THUMBNAIL_URL_PATTERN =
  /itemprop="thumbnailUrl" href="([^"]+)"|"channelMetadataRenderer":\{.*?"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/s;

const safeTrim = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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
    return extension === "jpeg" ? "jpg" : extension;
  } catch {
    return undefined;
  }
};

const resolveSourceLabel = (sourceUrl: string): string => {
  try {
    const host = new URL(sourceUrl).hostname
      .replace(/^www\./, "")
      .replace(/^m\./, "")
      .toLowerCase();
    if (host === "youtu.be") {
      return "youtube.com";
    }
    return host;
  } catch {
    return "youtube.com";
  }
};

const normalizeTargetUrl = (sourceUrl: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw new Error(`Invalid YouTube URL '${sourceUrl}' for extractor '${EXTRACTOR_ID}'.`);
  }

  const host = parsed.hostname
    .replace(/^www\./, "")
    .replace(/^m\./, "")
    .toLowerCase();
  if (!(host === "youtube.com" || host.endsWith(".youtube.com"))) {
    throw new Error(
      `YouTube extractor only supports youtube.com profile/channel URLs. Got host '${parsed.hostname}'.`,
    );
  }

  const supportedProfile = resolveSupportedSocialProfile({
    url: sourceUrl,
    icon: "youtube",
  });
  if (!supportedProfile || supportedProfile.platform !== "youtube") {
    throw new Error(
      `YouTube extractor only supports clear youtube.com profile/channel URLs. Got '${sourceUrl}'.`,
    );
  }

  const segments = parsed.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  const first = segments[0];

  if (!first) {
    throw new Error(`YouTube URL '${sourceUrl}' is missing a profile path segment.`);
  }

  if (first.startsWith("@")) {
    return `https://www.youtube.com/${first}`;
  }

  if ((first === "channel" || first === "c" || first === "user") && segments[1]) {
    return `https://www.youtube.com/${first}/${segments[1]}`;
  }

  return `https://www.youtube.com/${first}`;
};

const detectPlaceholderSignals = (input: {
  html: string;
  title?: string;
  description?: string;
  currentUrl: string;
}): string[] => {
  const combined = [input.currentUrl, input.title ?? "", input.description ?? "", input.html]
    .join("\n")
    .toLowerCase();

  const checks: Array<{ label: string; pattern: RegExp }> = [
    {
      label: "consent_interstitial",
      pattern: /before you continue to youtube|consent\.youtube\.com/i,
    },
    {
      label: "sign_in_required",
      pattern: /sign in to continue to youtube|sign in to confirm you're not a bot/i,
    },
    {
      label: "challenge_page",
      pattern: /our systems have detected unusual traffic|sorry, you have been blocked/i,
    },
    {
      label: "unavailable_page",
      pattern: /this video is unavailable|this channel does not exist|account has been terminated/i,
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

interface ExtractedMetadataPayload {
  currentUrl: string;
  title: string;
  description: string;
  imageUrl: string;
  profileImageUrl?: string;
  subscribersCount?: number;
  subscribersCountRaw?: string;
  sourceLabel: string;
  placeholderSignals: string[];
}

export interface YoutubeProfileMetadata {
  subscribersCount?: number;
  subscribersCountRaw?: string;
}

export const extractYoutubeSubscriberCountRaw = (html: string): string | undefined => {
  const metadataRowsMarker = '"metadataRows":[';
  const startIndex = html.indexOf(metadataRowsMarker);
  if (startIndex < 0) {
    return undefined;
  }

  const segment = html.slice(startIndex, startIndex + 2_500);
  const contentMatch = /"content":"([^"]+ subscribers?)"/i.exec(segment);
  if (contentMatch?.[1]) {
    return safeTrim(contentMatch[1]);
  }

  const accessibilityMatch = /"accessibilityLabel":"([^"]+ subscribers?)"/i.exec(segment);
  return safeTrim(accessibilityMatch?.[1]);
};

export const extractYoutubeProfileImageUrl = (html: string): string | undefined => {
  const match = YOUTUBE_THUMBNAIL_URL_PATTERN.exec(html);
  return safeTrim(match?.[1] ?? match?.[2]);
};

export const parseYoutubeProfileMetadata = (html: string): YoutubeProfileMetadata => {
  const subscribersCountRaw = extractYoutubeSubscriberCountRaw(html);
  return {
    subscribersCount: parseAudienceCount(subscribersCountRaw),
    subscribersCountRaw,
  };
};

const extractPublicMetadata = async (sourceUrl: string): Promise<ExtractedMetadataPayload> => {
  const currentUrl = normalizeTargetUrl(sourceUrl);
  const fetched = await fetchMetadata(currentUrl, {
    timeoutMs: 10_000,
    retries: 1,
  });

  if (!fetched.ok || !fetched.html) {
    throw new Error(
      `YouTube metadata fetch failed for '${currentUrl}' (status=${fetched.statusCode ?? "n/a"}; error=${fetched.error ?? "unknown"}).`,
    );
  }

  const parsed = parseMetadata(fetched.html, currentUrl);
  const title = safeTrim(parsed.metadata.title);
  const description = safeTrim(parsed.metadata.description);
  const profileImageUrl = extractYoutubeProfileImageUrl(fetched.html);
  const imageUrl = safeTrim(parsed.metadata.image) ?? profileImageUrl;
  const profileMetadata = parseYoutubeProfileMetadata(fetched.html);
  const placeholderSignals = detectPlaceholderSignals({
    html: fetched.html,
    currentUrl,
    title,
    description,
  });

  if (placeholderSignals.length > 0) {
    throw new Error(
      `YouTube extractor captured placeholder/challenge content: ${placeholderSignals.join(", ")}.`,
    );
  }

  const missing: string[] = [];
  if (!title) {
    missing.push("title");
  }
  if (!description) {
    missing.push("description");
  }
  if (!imageUrl) {
    missing.push("image");
  }

  if (missing.length > 0) {
    throw new Error(
      [
        "YouTube extractor could not capture required metadata fields.",
        `missing=${missing.join(", ")}.`,
        `completeness=${parsed.completeness}.`,
      ].join(" "),
    );
  }

  if (!title || !description || !imageUrl) {
    throw new Error("YouTube extractor required metadata fields were unexpectedly missing.");
  }

  return {
    currentUrl,
    title,
    description,
    imageUrl,
    profileImageUrl,
    subscribersCount: profileMetadata.subscribersCount,
    subscribersCountRaw: profileMetadata.subscribersCountRaw,
    sourceLabel: resolveSourceLabel(currentUrl),
    placeholderSignals,
  };
};

const downloadImageAsset = async (
  context: AuthenticatedExtractorExtractContext,
  sourceUrl: string,
): Promise<{
  path: string;
  sourceUrl: string;
  contentType: string;
  bytes: number;
  sha256: string;
}> => {
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
    throw new Error(
      `YouTube extractor image fetch failed: HTTP ${response.status} for ${sourceUrl}.`,
    );
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error("YouTube extractor image fetch returned empty body.");
  }

  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const extension =
    extensionFromContentType(response.headers.get("content-type")) ??
    extensionFromUrl(sourceUrl) ??
    "jpg";
  const fileName = `${sha256}.${extension}`;
  const absolutePath = path.join(context.publicAssetDirAbsolute, fileName);

  fs.mkdirSync(context.publicAssetDirAbsolute, { recursive: true });
  fs.writeFileSync(absolutePath, bytes);

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
};

const ensureSession = async (
  context: AuthenticatedExtractorSessionContext,
): Promise<AuthenticatedExtractorEnsureSessionResult> => {
  try {
    const metadata = await extractPublicMetadata(context.targetUrl);
    return {
      verified: true,
      details: `verified metadata fetch for ${metadata.currentUrl}`,
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
  const metadata = await extractPublicMetadata(context.sourceUrl);
  const imageAsset = await downloadImageAsset(
    context,
    metadata.profileImageUrl ?? metadata.imageUrl,
  );

  return {
    capturedAt: new Date().toISOString(),
    metadata: {
      title: metadata.title,
      description: metadata.description,
      image: imageAsset.path,
      profileImage: metadata.profileImageUrl ? imageAsset.path : undefined,
      subscribersCount: metadata.subscribersCount,
      subscribersCountRaw: metadata.subscribersCountRaw,
      sourceLabel: metadata.sourceLabel,
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
      placeholderSignals: metadata.placeholderSignals,
      capturedFromUrl: metadata.currentUrl,
      notes: [`cacheKey=${context.cacheKey}`],
    },
  };
};

export const youtubeAuthBrowserExtractor: AuthenticatedExtractorPlugin = {
  id: EXTRACTOR_ID,
  ensureSession,
  extract,
};
