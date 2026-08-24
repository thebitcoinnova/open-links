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

const DEFAULT_FACEBOOK_AGENT_BROWSER_SESSION = "openlinks-facebook-auth";

export interface ResolvedProfileTarget {
  identifier: string;
  canonicalUrl: string;
}

export interface FacebookInspection {
  snapshot: AuthFlowSnapshot;
  heading?: string;
  imageUrl?: string;
  metaImageUrl?: string;
}

export interface FacebookImageCandidate {
  src: string;
  alt?: string;
  domScore?: number;
  width?: number;
  height?: number;
  sourceType?: string;
  ariaLabel?: string;
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const extensionFromContentType = (contentType: string | null): string | undefined => {
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

export const extensionFromUrl = (sourceUrl: string): string | undefined => {
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

export const safeTrim = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const requireInteractiveTerminal = () => {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error(
      "Interactive terminal is required for Facebook login. Run this command in a local TTY and retry.",
    );
  }
};

export const resolveAgentConfig = (): BrowserSessionConfig =>
  resolveBrowserSessionConfig({
    defaultSession: DEFAULT_FACEBOOK_AGENT_BROWSER_SESSION,
    requireEncryptionKey: false,
  });

export const toCookieHeader = (value: unknown): string | undefined => {
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

export const resolveSourceLabel = (sourceUrl: string): string => {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "facebook.com";
  }
};

export const decodeHtmlEntities = (value: string): string =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .trim();

export const formatIdentifierDisplayName = (identifier: string): string => {
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

export const isGenericFacebookHeading = (heading: string): boolean =>
  /^(new|notifications?|friends?|messages?|chats?|menu|search|home|watch|marketplace|reels)$/i.test(
    heading.trim(),
  );

export const detectPlaceholderSignals = (body: string): string[] => {
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

export const isLikelyProfileImageUrl = (value: string | undefined): boolean => {
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

export const extractEvalPayload = (value: unknown): Record<string, unknown> | null => {
  if (isRecord(value) && isRecord(value.result)) {
    return value.result;
  }
  if (isRecord(value)) {
    return value;
  }
  return null;
};

export const extractStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => safeTrim(item)).filter((item): item is string => Boolean(item));
};

export const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

export const extractAreaHintFromUrl = (sourceUrl: string): number => {
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

export const hasFbCompressionHint = (sourceUrl: string): boolean => {
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

export const extractMaxSideHintFromUrl = (sourceUrl: string): number => {
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

export const scoreProfileImageCandidate = (candidate: FacebookImageCandidate): number => {
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

export const resolvePreferredProfileImage = (
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
