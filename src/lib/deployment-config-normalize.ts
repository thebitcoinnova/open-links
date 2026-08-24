import type { DeployTarget } from "./deployment-config-types";
import { DEFAULT_UPSTREAM_GITHUB_REPOSITORY_SLUG } from "./github-repository";

export function normalizeBasePath(value?: string) {
  if (!value || value.trim().length === 0) {
    return "/";
  }

  const trimmed = value.trim();
  const prefixed = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const normalized = prefixed.replace(/\/+/g, "/");

  return normalized === "/" ? "/" : `${normalized.replace(/^\/+|\/+$/g, "")}/`.replace(/^/, "/");
}

export function normalizeOrigin(input: string) {
  return input.replace(/\/$/, "");
}

export function normalizeDeployPublicOrigin(input?: string) {
  const trimmed = input?.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return normalizeOrigin(url.origin);
  } catch {
    return undefined;
  }
}

export function isPlaceholderDeployPublicOrigin(input: string) {
  try {
    const hostname = new URL(normalizeOrigin(input)).hostname.toLowerCase();
    return hostname === "localhost" || hostname.endsWith(".local");
  } catch {
    return false;
  }
}

export function normalizeRoutePath(input: string) {
  const withLeadingSlash = input.startsWith("/") ? input : `/${input}`;
  return withLeadingSlash === "/" ? "/" : withLeadingSlash.replace(/\/$/, "");
}

export function parseDeployTarget(input?: string): DeployTarget {
  switch (input?.trim()) {
    case "github-pages":
      return "github-pages";
    case "railway":
      return "railway";
    case "render":
      return "render";
    default:
      return "aws";
  }
}

export function isUpstreamRepository(input: string) {
  return input.trim().toLowerCase() === DEFAULT_UPSTREAM_GITHUB_REPOSITORY_SLUG.toLowerCase();
}
